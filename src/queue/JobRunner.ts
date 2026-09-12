/**
 * Per-job pipeline (Story 4.2 + fail-forward core of 4.3).
 *
 *   ProductProvider → Validator (schema + game logic) → Mechanic/Engine
 *   → AudioEngine (TTS + SFX sync) → Scene System → RenderEngine
 *   → logs/<gameId>.json (+ queue job status)
 *
 * Every failure is normalised to `{code, field, hint, filter}` and returned as a
 * *failed outcome*, not thrown: the batch pool depends on that to fail forward.
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { AudioEngine, type IAudioEngine, type AudioSegment } from '../audio';
import { GameEngine, MechanicRegistry, isGameError } from '../game';
import { filterForCode, JobLogger, type JobLog } from '../observability';
import { ProductProvider } from '../product/ProductProvider';
import type { Product } from '../product/schema';
import { SceneSystem } from '../scene';
import { Validator } from '../validator';
import type { GameJson, ResultVariant } from '../types/game';
import { TimeoutError, withTimeout } from '../utils/async';
import { QueueError, QUEUE_ERROR_CODES } from './errors';
import { requestLlmCopy, type LlmStubOptions } from './llmStub';
import type { RenderStagePort } from './ports';
import type { QueueJob } from './schema';
import type { RenderStageInput, RenderStageOutput } from './stageTypes';

/** Renderer port; the CLI wires `RenderEngine`, tests wire fakes. */
export type RenderPort = RenderStagePort;

export interface RunJobOptions {
  job: QueueJob;
  rootDir?: string;
  productsDir?: string;
  exportDir?: string;
  logsDir?: string;
  workerIndex?: number;
  /** Injected render stage (required — the queue cannot import render, AD-1). */
  renderer?: RenderPort;
  audioAdapter?: IAudioEngine;
  llm?: LlmStubOptions;
  /** Epoch ms when the job was dequeued (set by the poller); defaults to now. */
  startedAt?: number;
  /** Already-attempted render retries (queue `retries` field). */
  retries?: number;
  onProgress?: (event: JobProgressEvent) => void;
}

export interface JobProgressEvent {
  jobId: string;
  worker: number;
  stage: 'validate' | 'engine' | 'audio' | 'scene' | 'render' | 'done' | 'failed';
  detail?: string;
}

export interface JobErrorInfo {
  code: string;
  field?: string;
  hint?: string;
  filter: string;
  cause?: string;
}

export interface JobOutcome {
  jobId: string;
  gameId: string;
  mechanic: string;
  status: 'done' | 'failed';
  worker: number;
  log: JobLog;
  logPath: string;
  videoPath?: string;
  captionPath?: string;
  fileSize: number;
  renderMs: number;
  seed: number;
  products: string[];
  warnings: Array<{ code: string; hint: string }>;
  error?: JobErrorInfo;
}

function normalizeError(error: unknown): JobErrorInfo {
  if (error instanceof TimeoutError) {
    return { code: error.code, filter: 'timeout', hint: error.message, cause: error.message };
  }
  if (error instanceof QueueError) {
    return {
      ...error.toJSON(),
      filter: filterForCode(error.code),
      cause: error.message,
    };
  }
  if (isGameError(error)) {
    const json = (error as unknown as { toJSON(): { code: string; field?: string; hint?: string } }).toJSON();
    return { ...json, filter: filterForCode(json.code), cause: json.hint ?? json.code };
  }
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code ?? 'E_UNKNOWN';
    const field = (error as Error & { field?: string }).field;
    return { code, field, hint: error.message, filter: filterForCode(code), cause: error.message };
  }
  return { code: 'E_UNKNOWN', filter: 'queue', hint: String(error), cause: String(error) };
}

/** TTS ceiling from AD-10: `(text.length / 10 + 2)s`. */
export function ttsTimeoutMs(script: string): number {
  return Math.round(((script.length / 10 + 2) * 1000));
}

export class JobRunner {
  private readonly products: ProductProvider;
  private readonly rootDir: string;
  private readonly exportDir: string;

  constructor(private readonly options: RunJobOptions) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.products = new ProductProvider(
      path.resolve(this.rootDir, options.productsDir ?? 'products'),
      { watch: false },
    );
    this.exportDir = options.exportDir ?? 'export';
  }

  static async run(options: RunJobOptions): Promise<JobOutcome> {
    return new JobRunner(options).run();
  }

  private resolveProducts(job: QueueJob): { products: Product[]; missing: string[] } {
    const resolved = job.productIds.map((productId) => this.products.get(productId));
    return {
      products: resolved.filter((product): product is Product => product !== null),
      missing: job.productIds.filter((productId, index) => resolved[index] === null),
    };
  }

  async run(): Promise<JobOutcome> {
    const { job } = this.options;
    const worker = this.options.workerIndex ?? 0;
    const startedAt = this.options.startedAt ?? Date.now();
    const logger = new JobLogger(path.resolve(this.rootDir, this.options.logsDir ?? 'logs'));
    const validatorErrors: Array<{ code: string; field?: string; hint?: string }> = [];
    const progress = (stage: JobProgressEvent['stage'], detail?: string): void =>
      this.options.onProgress?.({ jobId: job.jobId, worker, stage, detail });

    let ttsMs = 0;
    let audioVoiceMs = 0;
    let renderMs = 0;
    let encodeMs = 0;
    let planningMs = 0;
    let audioMixMs = 0;
    let fileSize = 0;
    let videoPath: string | undefined;
    let captionPath: string | undefined;
    let slow = false;
    let warnings: Array<{ code: string; hint: string }> = [];
    let llmAttempts = 1;

    try {
      // 1. Products (AD-5 / AD-4: prices come from the provider, never the LLM).
      const { products, missing } = this.resolveProducts(job);
      if (missing.length > 0) {
        validatorErrors.push(
          ...missing.map((productId) => ({
            code: 'E_PRICE_SOURCE_INVALID',
            field: 'entities.productId',
            hint: `product '${productId}' not found in ProductProvider`,
          })),
        );
        throw new QueueError(
          QUEUE_ERROR_CODES.PRICE_SOURCE_INVALID,
          'entities.productId',
          `product '${missing[0]}' not found in ProductProvider`,
        );
      }

      // 2. Mechanic + Engine: deterministic Game JSON (answer/timeline).
      progress('engine');
      const mechanic = MechanicRegistry.get(job.mechanic);
      const variant: ResultVariant = job.result_variant ?? 'in_video';
      const { game, sceneData } = mechanic.create({
        products,
        seed: job.seed,
        resultVariant: variant,
        hiddenIndex: job.hiddenIndex,
      });
      if (this.options.llm?.raw) {
        const llm = await requestLlmCopy(
          {
            mechanic: job.mechanic,
            productNames: products.map((product) => product.name),
            question: game.content.question,
          },
          this.options.llm,
        );
        llmAttempts = llm.attempts;
        if (llm.patch.hook) game.content.hook = llm.patch.hook;
        if (llm.patch.question) game.content.question = llm.patch.question;
        if (llm.patch.cta) game.content.cta = llm.patch.cta;
      }

      // 3. Two-layer Validator — a failure here never reaches the renderer.
      progress('validate');
      const checkAssets = existsSync(path.resolve(this.rootDir, 'assets'));
      const validation = Validator.validate(game, products, {
        assetExists: (product) => (checkAssets ? this.products.hasAsset(product.productId) : true),
      });
      validatorErrors.push(...validation.errors);
      warnings = [...validation.warnings.map((warning) => ({ code: warning.code, hint: warning.hint }))];
      if (!validation.ok) {
        const first = validation.errors[0]!;
        throw new QueueError(first.code, first.field, first.hint);
      }

      const computed = GameEngine.compute(game, products, job.seed);

      // 4. Audio (viPiper adapter + SFX) with the AD-10 TTS ceiling.
      progress('audio');
      const ttsStart = performance.now();
      const script = game.audio?.voice?.script || game.content.voice_script;
      const audio: AudioSegment = await withTimeout(
        new AudioEngine(this.options.audioAdapter).synthesize(game, computed.timeline),
        ttsTimeoutMs(script),
        'TTS',
      );
      ttsMs = Number((performance.now() - ttsStart).toFixed(2));
      audioVoiceMs = ttsMs;
      if (audio.syncDelta > 0.1) {
        throw new QueueError(
          QUEUE_ERROR_CODES.AUDIO_SYNC_DRIFT,
          'audio.voice',
          `voice/reveal sync drift ${audio.syncDelta}s exceeds 0.1s`,
        );
      }

      // 5. Scene System → renderer-neutral frames (Epic 3 output).
      progress('scene');
      const scene = SceneSystem.render(game as unknown as GameJson, {
        products,
        computed,
        timeline: computed.timeline,
        sceneData,
        variant,
      });

      // 6. Render + mux (AD-8) with temp/<jobId> cleanup in `finally`.
      progress('render');
      const renderer = this.options.renderer;
      if (!renderer) {
        throw new QueueError(
          QUEUE_ERROR_CODES.RENDER_STAGE_MISSING,
          'renderStage',
          'no render stage was provided — wire RenderEngine from the composition root (CLI) or inject a fake in tests',
        );
      }
      const output: RenderStageOutput = await renderer.render({
        game: game as unknown as RenderStageInput['game'],
        timeline: scene.timeline,
        audio,
        frames: scene.frames,
        variant,
        sceneData,
        products: products.map((product) => ({
          productId: product.productId,
          name: product.name,
          image: product.image,
          price: product.price,
        })),
        diversification: computed.diversification,
        jobId: job.jobId,
        seed: job.seed,
        rootDir: this.rootDir,
        exportDir: this.exportDir,
        ttsMs,
      });

      planningMs = output.timings.planningMs;
      renderMs = output.timings.renderMs;
      encodeMs = output.timings.encodeMs;
      audioMixMs = output.timings.audioMixMs;
      fileSize = output.fileSize;
      videoPath = output.videoPath;
      captionPath = output.captionPath;
      slow = output.slow;
      warnings.push(...output.warnings.map((warning) => ({ code: warning.code, hint: warning.hint })));

      const totalMs = Number((Date.now() - startedAt).toFixed(2));
      const { log, path: logPath } = logger.writeFrom({
        jobId: job.jobId,
        gameId: game.metadata.gameId,
        mechanic: job.mechanic,
        seed: job.seed,
        resultVariant: variant,
        products: job.productIds,
        status: 'done',
        validatorErrors: [],
        warnings,
        planningMs,
        ttsMs,
        audioVoiceMs,
        renderMs,
        encodeMs,
        audioMixMs,
        totalMs,
        fileSize,
        filePath: videoPath,
        captionPath,
        slow,
        attempts: Math.max(llmAttempts, this.options.retries ? this.options.retries + 1 : 1),
        retries: this.options.retries ?? 0,
        startedAt,
        worker,
      });
      progress('done', videoPath);

      return {
        jobId: job.jobId,
        gameId: game.metadata.gameId,
        mechanic: job.mechanic,
        status: 'done',
        worker,
        log,
        logPath,
        videoPath,
        captionPath,
        fileSize,
        renderMs,
        seed: job.seed,
        products: job.productIds,
        warnings,
      };
    } catch (error) {
      const info = normalizeError(error);
      const totalMs = Number((Date.now() - startedAt).toFixed(2));
      const { log, path: logPath } = logger.writeFrom({
        jobId: job.jobId,
        gameId: job.gameId,
        mechanic: job.mechanic,
        seed: job.seed,
        resultVariant: job.result_variant,
        products: job.productIds,
        status: 'failed',
        code: info.code,
        filter: info.filter,
        cause: info.cause,
        validatorErrors:
          validatorErrors.length > 0 ? validatorErrors : [{ code: info.code, field: info.field, hint: info.hint }],
        warnings,
        planningMs,
        ttsMs,
        audioVoiceMs,
        renderMs,
        encodeMs,
        audioMixMs,
        totalMs,
        fileSize,
        filePath: videoPath,
        captionPath,
        slow,
        attempts: Math.max(llmAttempts, this.options.retries ? this.options.retries + 1 : 1),
        retries: this.options.retries ?? 0,
        startedAt,
        worker,
      });
      progress('failed', `${info.code} (${info.filter})`);
      return {
        jobId: job.jobId,
        gameId: job.gameId,
        mechanic: job.mechanic,
        status: 'failed',
        worker,
        log,
        logPath,
        videoPath,
        captionPath,
        fileSize,
        renderMs,
        seed: job.seed,
        products: job.productIds,
        warnings,
        error: info,
      };
    } finally {
      rmSync(path.resolve(this.rootDir, 'temp', job.jobId), { recursive: true, force: true });
    }
  }
}
