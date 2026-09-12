/**
 * `game batch` — 50-job hands-free batch (Story 4.3).
 *
 * Thin CLI adapter over `BatchOrchestrator`: pre-flight disk → enqueue N jobs →
 * drain with the bounded pool → `export/batch-<ts>/batch_report.json` + summary.
 */
import path from 'node:path';
import { checkDiskSpace, isSm1Satisfied, MIN_FREE_DISK_BYTES } from '../observability';
import { BatchOrchestrator, type BatchOptions, type BatchResult } from '../queue/BatchOrchestrator';
import { workerPoolSize } from '../queue/WorkerPool';
import type { QueueJob } from '../queue/schema';
import { createRenderStage } from './pipeline';
import { normalizeMechanic } from './render';

export interface BatchArgs extends BatchOptions {
  /** Defaults to 50 (the batch AC). */
  count?: number;
  /** Suppress per-job progress lines (batch_report still lands on disk). */
  silent?: boolean;
}

export function parseBatchArgs(argv: string[], rootDir = process.cwd()): BatchArgs {
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
  const mechanics = (flags.get('mechanics') ?? 'hi_lo,most_expensive,one_away')
    .split(',')
    .map((value) => normalizeMechanic(value))
    .filter((value): value is QueueJob['mechanic'] => value !== undefined);
  const variant = flags.get('result-variant');
  return {
    rootDir,
    count: Number(flags.get('count') ?? 50),
    mechanics,
    productIds: flags.get('products')
      ? flags
          .get('products')!
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
    seed: Number(flags.get('seed') ?? 839271),
    resultVariant: variant === 'comment' ? 'comment' : variant === 'in_video' ? 'in_video' : undefined,
    queueDir: flags.get('queue-dir') ?? 'queue',
    exportDir: flags.get('export-dir') ?? 'export',
    logsDir: flags.get('logs-dir') ?? 'logs',
    batchId: flags.get('batch-id') ?? undefined,
    silent: flags.get('quiet') !== undefined,
    concurrency: flags.get('concurrency') ? Number(flags.get('concurrency')) : undefined,
  };
}

export interface BatchCommandResult {
  exitCode: number;
  error?: { code: string; field?: string; hint?: string };
  result?: BatchResult;
  summary?: string;
}

export async function runBatchCommand(
  args: BatchArgs,
  orchestratorFactory: (options: BatchOptions) => BatchOrchestrator = (options) =>
    new BatchOrchestrator(options),
): Promise<BatchCommandResult> {
  const rootDir = args.rootDir ?? process.cwd();
  if (!args.skipDiskCheck) {
    const space = checkDiskSpace(rootDir, args.requiredFreeBytes ?? MIN_FREE_DISK_BYTES);
    if (!space.ok) {
      const free = (space.freeBytes / 1024 ** 3).toFixed(2);
      const required = (space.requiredBytes / 1024 ** 3).toFixed(2);
      return {
        exitCode: 1,
        error: {
          code: 'INSUFFICIENT_DISK_SPACE',
          field: 'disk',
          hint: `${free}GB free at ${space.path}; ${required}GB required before rendering a batch`,
        },
      };
    }
  }

  const progress: Partial<BatchOptions> = args.silent
    ? {}
    : {
        onJobFinished: (outcome, index) => {
          const renderMs = Math.round(outcome.log.render_ms);
          const status = outcome.status === 'done' ? 'done' : `failed[${outcome.error?.code ?? 'E_UNKNOWN'}]`;
          console.log(
            `  [${String(index + 1).padStart(2, '0')}] ${outcome.gameId} ${outcome.mechanic} ${status} render=${renderMs}ms`,
          );
        },
      };
  if ((args.concurrency ?? workerPoolSize()) < 1) {
    return {
      exitCode: 1,
      error: { code: 'E_QUEUE_JOB_INVALID', field: 'concurrency', hint: 'concurrency must be >= 1' },
    };
  }

  const orchestrator = orchestratorFactory({
    ...args,
    rootDir,
    ...progress,
    // The composition root wires the real render engine (queue ↛ render, AD-1).
    jobOptions: { renderer: createRenderStage(rootDir), ...args.jobOptions },
  });

  const result = await orchestrator.run();
  // A batch that met SM-1 (≥98% passed) is a successful batch even when a job
  // failed; below SM-1 the batch exit code tells the scheduler to look.
  return {
    exitCode: isSm1Satisfied(result.report) ? 0 : 1,
    result,
    summary: `${result.reportPath}\n${formatBatchSummary(result)}`,
  };
}

export function formatBatchSummary(result: BatchResult): string {
  const { report } = result;
  const lines = [
    `passed ${report.passed}/${report.total} — failed ${report.failed} — avg_render_ms ${Math.round(report.avg_render_ms)}`,
  ];
  if (report.failed_jobs.length > 0) {
    for (const job of report.failed_jobs) {
      lines.push(`  FAILED ${job.gameId} [${job.code ?? 'E_UNKNOWN'}${job.filter ? ` / ${job.filter}` : ''}]`);
    }
  }
  lines.push(`report: ${path.join(report.output_dir, `batch-${report.batch_id}`, 'batch_report.json')}`);
  return lines.join('\n');
}
