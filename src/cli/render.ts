/**
 * `game render` — single-video CLI (Story 4.2).
 *
 * Flow: validate inputs → `queue/job_<uuid>.json` (`status: pending`) → poll →
 * Validator → Engine → Audio → Scene → Render → job file `status: done` +
 * `export/<gameId>_<seed>.mp4` + `logs/<gameId>.json`, exit 0 with a one-job
 * `batch_report` on stdout. A bad Game JSON exits 1 with `{code, field, hint}`.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { BatchReporter } from '../observability';
import { JobRunner } from '../queue/JobRunner';
import type { RenderStagePort } from '../queue/ports';
import { QueueStore } from '../queue/QueueStore';
import type { QueueJob } from '../queue/schema';
import type { BatchJobSummary } from '../observability/types';
import { runJobWithRenderEngine } from './pipeline';

export interface RenderArgs {
  mechanic?: string;
  productIds: string[];
  seed?: number;
  resultVariant?: 'in_video' | 'comment';
  hiddenIndex?: number;
  /** `--game <file.json>`: render an existing Game JSON instead of a template. */
  gameFile?: string;
  queueDir: string;
  rootDir: string;
  exportDir?: string;
  logsDir?: string;
  renderer?: RenderStagePort;
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
  return {
    mechanic: normalizeMechanic(flags.get('mechanic')),
    productIds: (flags.get('products') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    seed: seed === undefined ? undefined : Number(seed),
    resultVariant: variant === 'comment' ? 'comment' : variant === 'in_video' ? 'in_video' : undefined,
    hiddenIndex: hiddenIndex === undefined ? undefined : Number(hiddenIndex),
    gameFile: flags.get('game'),
    queueDir: flags.get('queue-dir') ?? 'queue',
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
    return {
      exitCode: 1,
      error: {
        code: 'E_GAME_LOGIC_INVALID',
        field: 'products',
        hint: 'pass --products p001,p042',
      },
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
    const expected = mechanic === 'HI_LO' ? 2 : mechanic === 'ONE_AWAY' ? 1 : undefined;
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
    renderer: args.renderer,
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
