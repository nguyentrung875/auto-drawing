/**
 * Story 4.1 — `RenderEngine.render(...)`: Game JSON + timeline + audio → MP4.
 *
 * Pipeline (AD-8 / AD-10):
 *   frames (PNG seq, ≤45s budget) → audio bed (WAV) → ffmpeg mux (H.264/AAC)
 *   → affiliate-link pixel scan → `export/<gameId>_<seed>.mp4` + `caption.json`
 *
 * Guarantees enforced here:
 *   - `libx264 -crf 18 -preset fast`, 1080×1920@30fps, AAC audio.
 *   - The affiliate link is never drawn into the video (AD-4); the encoded file
 *     is scanned before it is reported as done.
 *   - `render >45s` logs `W_RENDER_SLOW` but still finishes.
 *   - `temp/<jobId>/` always cleaned in `finally`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildAudioBed } from './audioBed';
import { RENDER_ERROR_CODES, RENDER_WARNING_CODES, RenderError } from './errors';
import { FFmpegMuxer } from './ffmpeg';
import { assertNoAffiliateBurn } from './pixelScan';
import { SoftwareFrameRenderer } from './softwareFrameRenderer';
import {
  DEFAULT_RENDER_CONFIG,
  type FrameRenderContext,
  type IFrameRenderer,
  type IVideoMuxer,
  type RenderConfig,
  type RenderInput,
  type RenderOutput,
  type RenderWarning,
} from './types';

export interface RenderEngineOptions {
  config?: Partial<RenderConfig>;
  frameRenderer?: IFrameRenderer;
  muxer?: IVideoMuxer;
  /** Project root for resolving `config.json`, `assets/` and relative paths. */
  rootDir?: string;
  /** Keep `temp/<jobId>/` after the render (debugging only). */
  keepTemp?: boolean;
}

export interface RenderEngineConfigSource {
  workerPoolMax?: number;
  video?: { width?: number; height?: number; fps?: number };
  render?: { codec?: string; crf?: number; preset?: string; ffmpegPath?: string };
  paths?: { export?: string; queue?: string; logs?: string; products?: string; games?: string };
}

/** Read `config.json` (CLI flag > config.json > default, AR config hierarchy). */
export function loadConfigFile(rootDir: string): RenderEngineConfigSource {
  const file = path.join(rootDir, 'config.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as RenderEngineConfigSource;
  } catch {
    return {};
  }
}

export function configFrom(
  file: RenderEngineConfigSource,
  overrides: Partial<RenderConfig> = {},
): RenderConfig {
  return {
    ...DEFAULT_RENDER_CONFIG,
    width: overrides.width ?? file.video?.width ?? DEFAULT_RENDER_CONFIG.width,
    height: overrides.height ?? file.video?.height ?? DEFAULT_RENDER_CONFIG.height,
    fps: overrides.fps ?? file.video?.fps ?? DEFAULT_RENDER_CONFIG.fps,
    codec: overrides.codec ?? file.render?.codec ?? DEFAULT_RENDER_CONFIG.codec,
    crf: overrides.crf ?? file.render?.crf ?? DEFAULT_RENDER_CONFIG.crf,
    preset: overrides.preset ?? file.render?.preset ?? DEFAULT_RENDER_CONFIG.preset,
    ffmpegPath: overrides.ffmpegPath ?? file.render?.ffmpegPath,
    frameRenderer: overrides.frameRenderer ?? DEFAULT_RENDER_CONFIG.frameRenderer,
    renderBudgetMs: overrides.renderBudgetMs ?? DEFAULT_RENDER_CONFIG.renderBudgetMs,
    frameTimeoutMs: overrides.frameTimeoutMs ?? DEFAULT_RENDER_CONFIG.frameTimeoutMs,
    encodeTimeoutMs: overrides.encodeTimeoutMs ?? DEFAULT_RENDER_CONFIG.encodeTimeoutMs,
    tilt: overrides.tilt ?? DEFAULT_RENDER_CONFIG.tilt,
  };
}

export class RenderEngine {
  private readonly options: RenderEngineOptions;

  constructor(options: RenderEngineOptions = {}) {
    this.options = options;
  }

  static render(input: RenderInput, options: RenderEngineOptions = {}): Promise<RenderOutput> {
    return new RenderEngine(options).render(input);
  }

  /** Frame stage backend, with the honest fallback recorded as a warning. */
  private createFrameRenderer(config: RenderConfig, warnings: RenderWarning[]): IFrameRenderer {
    if (this.options.frameRenderer) return this.options.frameRenderer;
    if (config.frameRenderer === 'motion-canvas') {
      warnings.push({
        code: RENDER_WARNING_CODES.RENDERER_FALLBACK,
        hint: 'Motion Canvas headless backend is not installed in this checkout — using the built-in software frame renderer (AD-8 stage contract unchanged)',
      });
    }
    return new SoftwareFrameRenderer();
  }

  async render(input: RenderInput): Promise<RenderOutput> {
    const rootDir = input.rootDir ?? this.options.rootDir ?? process.cwd();
    const config = configFrom(loadConfigFile(rootDir), {
      ...this.options.config,
      ...input.config,
    });
    const warnings: RenderWarning[] = [];
    const gameId = input.game.metadata.gameId;
    const seed = input.seed;
    const startedAt = performance.now();

    if (input.frames.length === 0) {
      throw new RenderError(
        RENDER_ERROR_CODES.FRAMES_MISSING,
        'frames',
        'Scene System produced no frames — call SceneSystem.render() before RenderEngine.render()',
      );
    }

    const planningStart = performance.now();
    const frameCount = Math.max(1, Math.round(input.timeline.totalDuration * config.fps));
    const exportDir = path.resolve(rootDir, input.exportDir ?? 'export');
    const tempRoot = path.resolve(rootDir, input.tempDir ?? 'temp');
    const jobTempDir = path.join(tempRoot, input.jobId);
    rmSync(jobTempDir, { recursive: true, force: true });
    mkdirSync(jobTempDir, { recursive: true });
    mkdirSync(exportDir, { recursive: true });
    const framesDir = path.join(jobTempDir, 'frames');
    const audioPath = path.join(jobTempDir, 'audio.wav');
    const planningMs = Number((performance.now() - planningStart).toFixed(2));

    try {
      const audioStart = performance.now();
      const bed = buildAudioBed({
        audio: input.audio,
        totalDuration: input.timeline.totalDuration,
        rootDir,
        outputPath: audioPath,
      });
      const fatalBedWarning = bed.warnings.find((warning) => warning.code === 'E_AUDIO_OUTPUT_MISSING');
      if (fatalBedWarning) {
        throw new RenderError('E_AUDIO_MERGE_FAILED', 'audio.sfx', fatalBedWarning.hint);
      }
      warnings.push(...bed.warnings);
      const audioMixMs = Number((performance.now() - audioStart).toFixed(2));

      const frameRenderer = this.createFrameRenderer(config, warnings);
      const renderStart = performance.now();
      const context: FrameRenderContext = {
        config,
        framesDir,
        width: config.width,
        height: config.height,
        fps: config.fps,
        frameCount,
        // The renderer checks the deadline with Date.now(), not the monotonic clock.
        deadlineAt: Date.now() + (config.frameTimeoutMs ?? 90_000),
        deadlineMs: config.frameTimeoutMs ?? 90_000,
      };
      const frameResult = await frameRenderer.renderFrames(input, context);
      warnings.push(...frameResult.warnings);
      const renderMs = Number((performance.now() - renderStart).toFixed(2));

      const emitted = readdirSync(framesDir).filter((file) => /^frame_\d+\.png$/.test(file)).length;
      if (emitted !== frameCount) {
        throw new RenderError(
          RENDER_ERROR_CODES.FRAMES_MISSING,
          'frames',
          `expected ${frameCount} PNG frames but found ${emitted} in ${framesDir}`,
        );
      }

      const muxer = this.options.muxer ?? new FFmpegMuxer(config.ffmpegPath);
      const videoPath = path.join(exportDir, `${gameId}_${seed}.mp4`);
      const encodeBudgetMs = Math.min(
        config.encodeTimeoutMs ?? 120_000,
        Math.max(20_000, frameCount * 200),
      );
      const mux = await muxer.mux({
        framesPattern: path.join(framesDir, frameResult.pattern),
        fps: config.fps,
        audioWavPath: audioPath,
        outputPath: videoPath,
        cc: config,
        timeoutMs: encodeBudgetMs,
      });

      await assertNoAffiliateBurn({
        videoPath,
        affiliateLink: input.game.publishing.affiliate_link ?? '',
        ffmpegPath: config.ffmpegPath,
      });

      const totalMs = Number((performance.now() - startedAt).toFixed(2));
      const slow = totalMs > (config.renderBudgetMs ?? 45_000);
      if (slow) {
        warnings.push({
          code: RENDER_WARNING_CODES.SLOW,
          hint: `render took ${(totalMs / 1000).toFixed(1)}s, over the ${((config.renderBudgetMs ?? 45_000) / 1000).toFixed(0)}s budget (W_RENDER_SLOW)`,
        });
      }

      const captionPath = path.join(exportDir, `${gameId}_${seed}.caption.json`);
      writeFileSync(
        captionPath,
        `${JSON.stringify(
          {
            caption: input.game.publishing.caption,
            hashtags: input.game.publishing.hashtags,
            affiliate_link: input.game.publishing.affiliate_link ?? '',
          },
          null,
          2,
        )}\n`,
      );

      const durationMs = Math.round((input.timeline.totalDuration * 1000));
      return {
        jobId: input.jobId,
        gameId,
        videoPath,
        captionPath,
        caption: input.game.publishing.caption,
        hashtags: input.game.publishing.hashtags,
        affiliateLink: input.game.publishing.affiliate_link,
        width: config.width,
        height: config.height,
        fps: config.fps,
        frameCount,
        durationMs,
        fileSize: statSync(videoPath).size,
        warnings,
        timings: {
          planningMs,
          ttsMs: Number((input.ttsMs ?? 0).toFixed(2)),
          renderMs,
          encodeMs: mux.durationMs,
          audioMixMs,
          totalMs,
        },
        slow,
      };
    } finally {
      if (!this.options.keepTemp) rmSync(jobTempDir, { recursive: true, force: true });
    }
  }
}

export { RENDER_ERROR_CODES, RENDER_WARNING_CODES };
