/**
 * Read-only CLI commands for operators and Hermes:
 *   `game queue status [--json]`
 *   `game logs [--gameId <id>] [--json]`
 *   `game config` (resolved render config, for troubleshooting)
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { JobLogger } from '../observability';
import { QueueStore } from '../queue/QueueStore';
import { workerPoolSize } from '../queue/WorkerPool';
import { loadConfigFile, configFrom } from '../render';

export interface InspectOptions {
  rootDir?: string;
  queueDir?: string;
  logsDir?: string;
  json?: boolean;
  gameId?: string;
}

export function parseInspectArgs(argv: string[]): InspectOptions {
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
  return {
    queueDir: flags.get('queue-dir') ?? flags.get('queue') ?? 'queue',
    logsDir: flags.get('logs-dir') ?? flags.get('logs') ?? 'logs',
    gameId: flags.get('gameId') ?? flags.get('game-id'),
    json: argv.includes('--json'),
  };
}

export interface QueueStatusRow {
  jobId: string;
  gameId: string;
  mechanic: string;
  seed: number;
  status: string;
  productIds: string;
  file: string;
}

export function queueStatus(options: InspectOptions = {}): {
  rows: QueueStatusRow[];
  counts: Record<string, number>;
  invalid: number;
  queueDir: string;
} {
  const store = new QueueStore(options.queueDir ?? 'queue');
  const { entries, invalid } = store.list();
  const counts: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 };
  const rows = entries.map((entry) => {
    const status = entry.job.status;
    counts[status] = (counts[status] ?? 0) + 1;
    return {
      jobId: entry.job.jobId,
      gameId: entry.job.gameId,
      mechanic: entry.job.mechanic,
      seed: entry.job.seed,
      status,
      productIds: entry.job.productIds.join(','),
      file: entry.file,
    };
  });
  return { rows, counts, invalid: invalid.length, queueDir: store.dir };
}

export function formatQueueStatus(status: ReturnType<typeof queueStatus>): string {
  const lines = [
    `queue: ${status.queueDir}`,
    `pending ${status.counts.pending ?? 0} | running ${status.counts.running ?? 0} | done ${status.counts.done ?? 0} | failed ${status.counts.failed ?? 0}${status.invalid > 0 ? ` | invalid ${status.invalid}` : ''}`,
  ];
  for (const row of status.rows) {
    lines.push(
      `  ${row.status.padEnd(7)} ${row.jobId} ${row.gameId} ${row.mechanic} seed=${row.seed} products=${row.productIds}`,
    );
  }
  return lines.join('\n');
}

export interface LogRow {
  gameId: string;
  jobId: string;
  status: string;
  mechanic: string;
  code?: string;
  filter?: string;
  renderMs: number;
  encodeMs: number;
  totalMs: number;
  fileSize: number;
  videoPath?: string;
}

export function readLogs(options: InspectOptions = {}): { rows: LogRow[]; logsDir: string } {
  const logger = new JobLogger(options.logsDir ?? 'logs');
  if (options.gameId) {
    const log = logger.read(options.gameId);
    if (!log) return { rows: [], logsDir: logger.logsDir };
    return { rows: [toRow(log)], logsDir: logger.logsDir };
  }
  return {
    rows: logger
      .list()
      .sort((a, b) => a.finished_at.localeCompare(b.finished_at))
      .map(toRow),
    logsDir: logger.logsDir,
  };
}

function toRow(log: ReturnType<JobLogger['list']>[number]): LogRow {
  return {
    gameId: log.gameId,
    jobId: log.jobId,
    status: log.status,
    mechanic: log.mechanic,
    code: log.code,
    filter: log.filter,
    renderMs: log.render_ms,
    encodeMs: log.encode_ms,
    totalMs: log.total_ms,
    fileSize: log.file_size,
    videoPath: log.file_path,
  };
}

export function formatLogs(result: ReturnType<typeof readLogs>): string {
  if (result.rows.length === 0) return `no logs found in ${result.logsDir}`;
  const lines = [`logs: ${result.logsDir} (${result.rows.length})`];
  for (const row of result.rows) {
    lines.push(
      [
        row.status.padEnd(6),
        row.gameId.padEnd(28),
        row.mechanic.padEnd(15),
        `render ${Math.round(row.renderMs)}ms`,
        `encode ${Math.round(row.encodeMs)}ms`,
        `total ${Math.round(row.totalMs)}ms`,
        `${(row.fileSize / 1024 / 1024).toFixed(2)}MB`,
        row.code ? `code=${row.code}${row.filter ? ` filter=${row.filter}` : ''}` : '',
      ]
        .filter(Boolean)
        .join('  '),
    );
  }
  return lines.join('\n');
}

export function renderConfigSummary(rootDir = process.cwd()): Record<string, unknown> {
  const config = configFrom(loadConfigFile(rootDir), {});
  return {
    ...config,
    workerPoolMax: workerPoolSize(),
    ffmpegPresent: Boolean(config.ffmpegPath),
    exportDirExists: existsSync(path.resolve(rootDir, 'export')),
    logsDirExists: existsSync(path.resolve(rootDir, 'logs')),
    exportFiles: existsSync(path.resolve(rootDir, 'export'))
      ? readdirSync(path.resolve(rootDir, 'export')).length
      : 0,
  };
}
