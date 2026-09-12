/**
 * File queue store: `queue/job_<uuid>.json` in, `queue/` out (AD-9).
 *
 * - `enqueue()` writes atomically (`.tmp` → rename), so a poller can never read
 *   a half-written job.
 * - `list()` orders by `enqueuedAt` and falls back to file mtime → FIFO.
 * - `update()` rewrites status transitions (`pending → running → done|failed`)
 *   while preserving everything Hermes put in the file.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseQueueJob, type JobValidationError, type QueueJob } from './schema';

export interface EnqueueInput {
  jobId: string;
  gameId: string;
  mechanic: QueueJob['mechanic'];
  productIds: string[];
  seed: number;
  result_variant?: 'in_video' | 'comment';
  hiddenIndex?: number;
  batchId?: string;
}

export interface QueueEntry {
  file: string;
  job: QueueJob;
}

export interface InvalidQueueEntry {
  file: string;
  error: JobValidationError;
}

export class QueueStore {
  readonly dir: string;

  constructor(dir = 'queue') {
    this.dir = dir;
  }

  jobPath(jobId: string): string {
    return path.join(this.dir, `job_${jobId}.json`);
  }

  ensureDir(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  /** Write a new job file; returns its path. */
  enqueue(input: EnqueueInput): { job: QueueJob; path: string } {
    this.ensureDir();
    const job: QueueJob = {
      jobId: input.jobId,
      gameId: input.gameId,
      mechanic: input.mechanic,
      productIds: input.productIds,
      seed: input.seed,
      result_variant: input.result_variant ?? 'in_video',
      status: 'pending',
      retries: 0,
      enqueuedAt: Date.now(),
      hiddenIndex: input.hiddenIndex,
      batchId: input.batchId,
    };
    const target = this.jobPath(job.jobId);
    this.writeAtomic(target, job);
    return { job, path: target };
  }

  /** Rewrite a job (status transition, paths, errors). */
  update(job: QueueJob, patch: Partial<QueueJob>): QueueJob {
    this.ensureDir();
    const updated: QueueJob = {
      ...job,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.writeAtomic(this.jobPath(job.jobId), updated);
    return updated;
  }

  read(jobId: string): { ok: true; job: QueueJob } | { ok: false; error: JobValidationError } {
    const file = this.jobPath(jobId);
    if (!existsSync(file)) {
      return {
        ok: false,
        error: {
          code: 'E_QUEUE_JOB_INVALID',
          field: 'jobId',
          hint: `queue job '${jobId}' not found at ${file}`,
        },
      };
    }
    return parseQueueJob(readFileSync(file, 'utf8') ? JSON.parse(readFileSync(file, 'utf8')) : null);
  }

  /** FIFO listing of valid jobs plus the invalid files (fail-forward fodder). */
  list(): { entries: QueueEntry[]; invalid: InvalidQueueEntry[] } {
    if (!existsSync(this.dir)) return { entries: [], invalid: [] };
    const entries: QueueEntry[] = [];
    const mtimes = new Map<string, number>();
    const invalid: InvalidQueueEntry[] = [];
    for (const file of readdirSync(this.dir)) {
      if (!file.startsWith('job_') || !file.endsWith('.json') || file.endsWith('.tmp.json')) continue;
      const full = path.join(this.dir, file);
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(full, 'utf8'));
      } catch {
        invalid.push({
          file,
          error: { code: 'E_QUEUE_JOB_INVALID', field: 'json', hint: 'file is not valid JSON' },
        });
        continue;
      }
      const result = parseQueueJob(parsed);
      if (!result.ok) {
        invalid.push({ file, error: result.error });
        continue;
      }
      const job = result.job;
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(full).mtimeMs;
      } catch {
        // File moved/deleted during list
      }
      mtimes.set(file, mtimeMs);
      if (job.enqueuedAt === undefined) {
        job.enqueuedAt = Math.round(mtimeMs);
      }
      entries.push({ file, job });
    }
    // FIFO: `enqueuedAt` first; jobs enqueued inside the same millisecond fall
    // back to the file's mtime (sub-ms on Linux), then to the file name.
    entries.sort(
      (a, b) =>
        (a.job.enqueuedAt ?? 0) - (b.job.enqueuedAt ?? 0) ||
        (mtimes.get(a.file) ?? 0) - (mtimes.get(b.file) ?? 0) ||
        a.file.localeCompare(b.file),
    );
    return { entries, invalid };
  }

  /** Jobs in a given status (default `pending`), FIFO. */
  byStatus(status: QueueJob['status'] = 'pending'): QueueJob[] {
    return this.list()
      .entries.filter((entry) => entry.job.status === status)
      .map((entry) => entry.job);
  }

  private writeAtomic(target: string, job: QueueJob): void {
    const temporary = `${target}.tmp.json`;
    writeFileSync(temporary, `${JSON.stringify(job, null, 2)}\n`);
    renameSync(temporary, target);
  }
}
