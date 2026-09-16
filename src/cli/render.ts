/**
 * `game render` — single-video CLI (Story 4.2).
 *
 * Flow: validate inputs → `queue/job_<uuid>.json` (`status: pending`) → poll →
 * Validator → Engine → Audio → Scene → Render → job file `status: done` +
 * `export/<gameId>_<seed>.mp4` + `logs/<gameId>.json`, exit 0 with a one-job
 * `batch_report` on stdout. A bad Game JSON exits 1 with `{code, field, hint}`.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { BatchReporter } from '../observability';
import { JobRunner } from '../queue/JobRunner';
import type { RenderStagePort } from '../queue/ports';
import { QueueStore } from '../queue/QueueStore';
import type { QueueJob } from '../queue/schema';
import type { BatchJobSummary } from '../observability/types';
import { createRenderStage, runJobWithRenderEngine } from './pipeline';
import { findBrowserExecutable } from '../render/browserFrameRenderer';

export interface RenderArgs {
  mechanic?: string;
  productIds: string[];
  seed?: number;
  resultVariant?: 'in_video' | 'comment';
  hiddenIndex?: number;
  mode?: string;
  rounds?: number;
  timer?: number;
  /** `--game <file.json>`: render an existing Game JSON instead of a template. */
  gameFile?: string;
  queueDir: string;
  rootDir: string;
  exportDir?: string;
  logsDir?: string;
  renderer?: RenderStagePort;
  rendererType?: 'browser' | 'software' | 'satori';
  keepQueueFile?: boolean;
}

export interface RenderCommandResult {
  exitCode: number;
  error?: { code: string; field?: string; hint?: string };
  jobId?: string;
  jobPath?: string;
  videoPath?: string;
  captionPath?: string;
  reportPath?: string;
  renderMs?: number;
  summary?: string;
}

const MECHANIC_ALIASES: Record<string, QueueJob['mechanic']> = {
  hi_lo: 'HI_LO',
  most_expensive: 'MOST_EXPENSIVE',
  one_away: 'ONE_AWAY',
  odd_one_out: 'ODD_ONE_OUT',
  guess_the_price: 'GUESS_THE_PRICE',
  g9: 'GUESS_THE_PRICE',
  g7: 'GROCERY_BASKET',
  grocery: 'GROCERY_BASKET',
  grocery_basket: 'GROCERY_BASKET',
  g41: 'DEAL_OR_SCAM',
  deal: 'DEAL_OR_SCAM',
  deal_or_scam: 'DEAL_OR_SCAM',
};

export function normalizeMechanic(raw: string | undefined): QueueJob['mechanic'] | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return MECHANIC_ALIASES[key] ?? (key.toUpperCase() as QueueJob['mechanic']);
}

/** Parse the `game render` argv slice. */
export function parseRenderArgs(argv: string[], rootDir = process.cwd()): RenderArgs {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, 'true');
    }
  }
  const seed = flags.get('seed');
  const hiddenIndex = flags.get('hidden-index');
  const variant = flags.get('result-variant');
  const mode = flags.get('mode');
  const rounds = flags.get('rounds');
  const timer = flags.get('timer');
  return {
    mechanic: normalizeMechanic(flags.get('mechanic')),
    productIds: (flags.get('products') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    seed: seed === undefined ? undefined : Number(seed),
    resultVariant: variant === 'comment' ? 'comment' : variant === 'in_video' ? 'in_video' : undefined,
    hiddenIndex: hiddenIndex === undefined ? undefined : Number(hiddenIndex),
    mode,
    rounds: rounds !== undefined ? Number(rounds) : undefined,
    timer: timer !== undefined ? Number(timer) : undefined,
    gameFile: flags.get('game'),
    queueDir: flags.get('queue-dir') ?? 'queue',
    rendererType: flags.get('renderer') === 'satori'
      ? 'satori'
      : flags.get('renderer') === 'software'
        ? 'software'
        : flags.get('renderer') === 'browser'
          ? 'browser'
          : (findBrowserExecutable() ? 'browser' : 'software'),
    rootDir,
  };
}

/** Execute `game render`; returns everything the CLI adapter prints. */
export async function runRenderCommand(args: RenderArgs): Promise<RenderCommandResult> {
  const { loadGameJson } = await import('./gameFile');
  const rootDir = args.rootDir;
  if (!args.mechanic && !args.gameFile) {
    return {
      exitCode: 1,
      error: {
        code: 'E_GAME_LOGIC_INVALID',
        field: 'mechanic',
        hint: 'pass --mechanic hi_lo|most_expensive|one_away (or --game <file.json>)',
      },
    };
  }
  if (args.productIds.length === 0 && !args.gameFile) {
    const { ProductProvider } = await import('../product/ProductProvider');
    const provider = new ProductProvider(path.resolve(rootDir, 'products'), { watch: false });
    const all = provider.getAll();
    const needed =
      args.mechanic === 'GROCERY_BASKET'
        ? 3
        : args.mechanic === 'MOST_EXPENSIVE' || args.mechanic === 'ODD_ONE_OUT'
          ? 4
          : args.mechanic === 'HI_LO'
            ? 2
            : 1;
    args.productIds = all.slice(0, needed).map((p) => p.productId);
  }

  const isMulti =
    args.mode === 'multi' ||
    args.rounds !== undefined ||
    args.timer !== undefined ||
    args.mechanic === 'GUESS_THE_PRICE';

  if (isMulti) {
    const seed = Number.isFinite(args.seed) ? (args.seed as number) : 839271;
    const { ProductProvider } = await import('../product/ProductProvider');
    const { ChallengeCurator } = await import('../challenge/ChallengeCurator');
    const { AllInOneScene } = await import('../scene/AllInOneScene');
    const { MultiRoundAudioComposer } = await import('../audio/MultiRoundAudioComposer');
    const { g9Definition } = await import('../definitions/g9_guess_the_price');
    const { g7Definition } = await import('../definitions/g7_grocery_basket');
    const { g41Definition } = await import('../definitions/g41_deal_or_scam');
    const { Canvas } = await import('../render/canvas');
    const { encodePng } = await import('../render/png');
    const { paintMultiRoundFrame } = await import('../render/scenePainter');
    const { FFmpegMuxer } = await import('../render/ffmpeg');
    const { DEFAULT_RENDER_CONFIG } = await import('../render/types');

    const provider = new ProductProvider(path.resolve(rootDir, 'products'), { watch: false });
    const products = provider.getAll();
    const curator = new ChallengeCurator();
    const dsl =
      args.mechanic === 'GROCERY_BASKET'
        ? g7Definition
        : args.mechanic === 'DEAL_OR_SCAM'
          ? g41Definition
          : g9Definition;
    const challenge = curator.curate(dsl, products, seed, {
      totalRounds: args.rounds,
      timerSeconds: args.timer,
    });
    const scene = new AllInOneScene(challenge);
    const timeline = scene.getTimeline();

    const jobId = `job_multi_${randomUUID()}`;
    const gameId = challenge.gameId;
    const exportDir = path.resolve(rootDir, args.exportDir ?? 'export');
    const tempDir = path.resolve(rootDir, 'temp', jobId);
    const framesDir = path.join(tempDir, 'frames');
    mkdirSync(framesDir, { recursive: true });
    mkdirSync(exportDir, { recursive: true });

    const fps = 30;
    const frameCount = Math.round(timeline.totalDuration * fps);

    if (args.renderer) {
      const outcome = await args.renderer.render({
        jobId,
        game: {
          metadata: { gameId, mechanic: (args.mechanic ?? 'GUESS_THE_PRICE') as any, seed },
          content: { title: challenge.title },
          gameplay: {},
          entities: challenge.rounds.flatMap((r) => r.products),
          publishing: { caption: challenge.title, hashtags: ['#game', '#multi'] },
        },
        timeline: { slots: timeline.slots, totalDuration: timeline.totalDuration },
        frames: [],
        audio: {
          voiceWavPath: '',
          voiceStartAt: 0,
          voiceDuration: 0,
          duration: timeline.totalDuration,
          revealAt: 0,
          syncDelta: 0,
          sfxCues: [],
          music: { track: 'tension_01', volume: 0.18 },
        },
        seed,
        exportDir: args.exportDir,
        rootDir,
      } as any);

      return {
        exitCode: outcome.warnings?.some((w) => w.code.startsWith('E_')) ? 1 : 0,
        jobId,
        videoPath: outcome.videoPath,
        captionPath: outcome.captionPath,
        renderMs: outcome.timings?.renderMs,
      };
    }

    const startMs = performance.now();
    for (let i = 0; i < frameCount; i += 1) {
      const timeSeconds = i / fps;
      const canvas = new Canvas(1080, 1920);
      paintMultiRoundFrame(canvas, scene, timeSeconds, { rootDir });
      const png = encodePng({ width: 1080, height: 1920, data: canvas.data });
      writeFileSync(path.join(framesDir, `frame_${String(i + 1).padStart(5, '0')}.png`), png);
    }

    const audioPath = path.join(tempDir, 'audio.wav');
    const audioComposer = new MultiRoundAudioComposer();
    await audioComposer.composeAudio(challenge, timeline, {
      rootDir,
      outputPath: audioPath,
      musicTrack: 'tension_01',
      musicVolume: 0.18,
    });

    const videoPath = path.join(exportDir, `${gameId}_${seed}.mp4`);
    const muxer = new FFmpegMuxer();
    await muxer.mux({
      framesPattern: path.join(framesDir, 'frame_%05d.png'),
      fps,
      audioWavPath: audioPath,
      outputPath: videoPath,
      cc: DEFAULT_RENDER_CONFIG,
      timeoutMs: 120000,
    });

    const captionPath = path.join(exportDir, `${gameId}_${seed}.caption.json`);
    writeFileSync(
      captionPath,
      JSON.stringify(
        {
          caption: `${challenge.title} 🔥 ${challenge.rounds.length} vòng chơi đỉnh cao!`,
          hashtags: ['#guesstheprice', '#multiround', '#viral'],
          affiliate_link: challenge.rounds[0]?.products[0]?.affiliate_link ?? '',
        },
        null,
        2,
      ) + '\n',
    );

    rmSync(tempDir, { recursive: true, force: true });
    const renderMs = Math.round(performance.now() - startMs);

    return {
      exitCode: 0,
      jobId,
      videoPath,
      captionPath,
      renderMs,
      summary: `Successfully rendered 38s multi-round video to ${videoPath}`,
    };
  }

  const batchId = `single_${Date.now().toString(36)}`;
  let job: QueueJob;
  if (args.gameFile) {
    const loaded = loadGameJson(path.resolve(rootDir, args.gameFile));
    if (!loaded.ok) return { exitCode: 1, error: loaded.error };
    job = {
      jobId: `job_${randomUUID()}`,
      gameId: loaded.game.metadata.gameId,
      mechanic: loaded.game.metadata.mechanic,
      productIds: loaded.game.entities.map((entity) => entity.productId),
      seed: loaded.game.metadata.seed,
      result_variant: loaded.game.metadata.result_variant ?? 'in_video',
      status: 'pending',
      retries: 0,
    };
  } else {
    const mechanic = args.mechanic as QueueJob['mechanic'];
    const expected =
      mechanic === 'GROCERY_BASKET'
        ? 3
        : mechanic === 'HI_LO'
          ? 2
          : mechanic === 'ONE_AWAY' || mechanic === 'GUESS_THE_PRICE' || mechanic === 'DEAL_OR_SCAM'
            ? 1
            : undefined;
    if (expected !== undefined && args.productIds.length !== expected) {
      return {
        exitCode: 1,
        error: {
          code: 'E_GAME_LOGIC_INVALID',
          field: 'entities',
          hint: `${mechanic} needs exactly ${expected} product(s), got ${args.productIds.length}`,
        },
      };
    }
    const seed = Number.isFinite(args.seed) ? (args.seed as number) : 839271;
    job = {
      jobId: `job_${randomUUID()}`,
      gameId: `${mechanic.toLowerCase()}_${seed}`,
      mechanic,
      productIds: args.productIds,
      seed,
      result_variant: args.resultVariant ?? 'in_video',
      status: 'pending',
      retries: 0,
      hiddenIndex: args.hiddenIndex,
      batchId,
    };
  }

  // 1. Enqueue: the queue file is the single source of truth (AD-9).
  const store = new QueueStore(path.resolve(rootDir, args.queueDir));
  store.enqueue({
    jobId: job.jobId,
    gameId: job.gameId,
    mechanic: job.mechanic,
    productIds: job.productIds,
    seed: job.seed,
    result_variant: job.result_variant,
    hiddenIndex: job.hiddenIndex,
    batchId: job.batchId,
  });

  // 2. Poll → pipeline → status transition.
  store.update(job, { status: 'running' });
  const outcome = await runJobWithRenderEngine({
    job,
    rootDir,
    exportDir: args.exportDir,
    logsDir: args.logsDir,
    renderer: args.renderer ?? (args.rendererType ? createRenderStage(rootDir, { frameRenderer: args.rendererType }) : undefined),
    startedAt: undefined,
  });
  store.update(job, {
    status: outcome.status,
    videoPath: outcome.videoPath,
    captionPath: outcome.captionPath,
    code: outcome.error?.code,
    filter: outcome.error?.filter,
    cause: outcome.error?.cause,
  });

  const summary: BatchJobSummary = {
    jobId: outcome.jobId,
    gameId: outcome.gameId,
    mechanic: outcome.mechanic,
    status: outcome.status,
    code: outcome.error?.code,
    filter: outcome.error?.filter,
    videoPath: outcome.videoPath,
    renderMs: outcome.log.render_ms,
    fileSize: outcome.fileSize,
  };
  const exportDir = path.resolve(rootDir, args.exportDir ?? 'export');
  const report = BatchReporter.build({
    batchId,
    outputDir: exportDir,
    jobs: [summary],
    workerPoolMax: 1,
    startedAt: Date.now() - outcome.log.total_ms,
  });
  const reportPath = BatchReporter.write(report, exportDir);

  if (outcome.status === 'failed') {
    return {
      exitCode: 1,
      error: {
        code: outcome.error?.code ?? 'E_UNKNOWN',
        field: outcome.error?.field,
        hint: outcome.error?.hint,
      },
      jobId: outcome.jobId,
      reportPath,
      summary: BatchReporter.formatSummary(report),
    };
  }

  return {
    exitCode: 0,
    jobId: outcome.jobId,
    videoPath: outcome.videoPath,
    captionPath: outcome.captionPath,
    reportPath,
    renderMs: outcome.log.render_ms,
    summary: BatchReporter.formatSummary(report),
  };
}

export { JobRunner };
