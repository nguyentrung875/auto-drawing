/**
 * Story 4.3 — batch orchestration: enqueue → poll FIFO → bounded pool →
 * fail-forward → `batch_report.json`.
 *
 * Guarantees:
 *   - Pre-flight disk check (`INSUFFICIENT_DISK_SPACE`) before any render.
 *   - `WORKER_POOL_MAX = min(CPU-1, 3)` workers, one job each at a time.
 *   - A job that fails (validator / LLM / timeout / render) is marked
 *     `status: failed`, logged with `{code, filter, cause}`, and the batch
 *     continues — `manual_interventions` stays 0.
 *   - Every prompt is deterministic: seeds derive from the batch seed and the
 *     job index via `seedrandom` (AD-10 bans `Math.random()`).
 */
import { createRng } from '../game/rng';
import {
  BatchReporter,
  ensureDiskSpace,
  InsufficientDiskSpaceError,
  MIN_FREE_DISK_BYTES,
  type BatchJobSummary,
  type BatchReport,
} from '../observability';
import { ProductProvider } from '../product/ProductProvider';
import { JobRunner, type JobOutcome, type RunJobOptions } from './JobRunner';
import { QueueStore } from './QueueStore';
import type { QueueJob } from './schema';
import { runPool, workerPoolSize } from './WorkerPool';

export interface EnqueueBatchRequest {
  count: number;
  mechanics: Array<QueueJob['mechanic']>;
  productIds: string[];
  seed: number;
  resultVariant?: 'in_video' | 'comment';
  /** Products per job by mechanic (defaults: HI_LO 2, ONE_AWAY 1, else 4). */
  productsPerJob?: Partial<Record<QueueJob['mechanic'], number>>;
  batchId?: string;
  jobIdFactory: (index: number) => string;
}

export interface BatchOptions {
  rootDir?: string;
  queueDir?: string;
  productsDir?: string;
  exportDir?: string;
  logsDir?: string;
  batchId?: string;
  count?: number;
  mechanics?: Array<QueueJob['mechanic']>;
  productIds?: string[];
  seed?: number;
  resultVariant?: 'in_video' | 'comment';
  concurrency?: number;
  /** Skip the ≥2GB pre-flight check (tests only). */
  skipDiskCheck?: boolean;
  requiredFreeBytes?: number;
  /** Injected renderer/audio/LLM for tests and future backends. */
  jobOptions?: Partial<Omit<RunJobOptions, 'job'>>;
  jobIdFactory?: (index: number) => string;
  onJobFinished?: (outcome: JobOutcome, index: number) => void;
  onJobStarted?: (job: QueueJob, worker: number) => void;
  now?: () => number;
}

export interface BatchResult {
  report: BatchReport;
  reportPath: string;
  outcomes: JobOutcome[];
  rejected: Array<{ jobId: string; gameId: string; code: string; filter: string; hint: string }>;
}

const DEFAULT_PRODUCTS_PER_JOB: Record<QueueJob['mechanic'], number> = {
  HI_LO: 2,
  MOST_EXPENSIVE: 4,
  ONE_AWAY: 1,
};

/** Deterministic per-index product/mechanic selection for a batch. */
export function planBatchJobs(request: EnqueueBatchRequest): Array<{
  jobId: string;
  gameId: string;
  mechanic: QueueJob['mechanic'];
  productIds: string[];
  seed: number;
}> {
  if (request.productIds.length === 0) {
    throw new Error('planBatchJobs: at least one product is required');
  }
  if (request.mechanics.length === 0) {
    throw new Error('planBatchJobs: at least one mechanic is required');
  }
  const rng = createRng(request.seed, 'batch-plan');
  const jobs = [];
  for (let index = 0; index < request.count; index += 1) {
    const mechanic = request.mechanics[index % request.mechanics.length]!;
    const wanted = request.productsPerJob?.[mechanic] ?? DEFAULT_PRODUCTS_PER_JOB[mechanic];
    const usable = Math.min(wanted, request.productIds.length);
    // Deterministic rotation + draw: same batch seed → same 50 jobs.
    const offset = Math.floor(rng() * request.productIds.length);
    const picks: string[] = [];
    for (let i = 0; i < usable; i += 1) {
      picks.push(request.productIds[(offset + i) % request.productIds.length]!);
    }
    const seed = request.seed + index * 977;
    jobs.push({
      jobId: request.jobIdFactory(index),
      gameId: `${mechanic.toLowerCase()}_${seed}`,
      mechanic,
      productIds: picks,
      seed,
    });
  }
  return jobs;
}

export class BatchOrchestrator {
  private readonly rootDir: string;
  private readonly store: QueueStore;
  private readonly exportDir: string;
  private readonly logsDir: string;
  private readonly productsDir: string;

  constructor(private readonly options: BatchOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.store = new QueueStore(options.queueDir ?? 'queue');
    this.exportDir = options.exportDir ?? 'export';
    this.logsDir = options.logsDir ?? 'logs';
    this.productsDir = options.productsDir ?? 'products';
  }

  static async run(options: BatchOptions = {}): Promise<BatchResult> {
    return new BatchOrchestrator(options).run();
  }

  /** Pre-flight + enqueue + drain. */
  async run(): Promise<BatchResult> {
    const startedAt = this.options.now?.() ?? Date.now();
    const batchId = this.options.batchId ?? new Date().toISOString().replace(/[:.]/g, '-');
    const concurrency = this.options.concurrency ?? workerPoolSize();

    if (!this.options.skipDiskCheck) {
      ensureDiskSpace(this.rootDir, this.options.requiredFreeBytes ?? MIN_FREE_DISK_BYTES);
    }

    if (this.options.count !== undefined) {
      this.enqueue(this.options.count, batchId);
    }
    const { entries, invalid } = this.store.list();
    const rejected = invalid.map((entry) => ({
      jobId: entry.file,
      gameId: entry.file,
      code: entry.error.code,
      filter: 'queue',
      hint: entry.error.hint,
    }));

    const pendingEntries = entries.filter(
      (entry) => entry.job.status === 'pending' || entry.job.status === 'running',
    );
    for (const entry of pendingEntries) {
      this.store.update(entry.job, { status: 'pending' });
    }

    const outcomes: Array<JobOutcome | undefined> = new Array(pendingEntries.length);
    await runPool(
      pendingEntries,
      async ({ item: entry, index, worker }) => {
        const job = entry.job;
        this.options.onJobStarted?.(job, worker);
        const jobStartedAt = this.options.now?.() ?? Date.now();
        this.store.update(job, { status: 'running', worker, attempts: (job.attempts ?? 0) + 1 });
        const outcome = await JobRunner.run({
          ...this.options.jobOptions,
          job,
          rootDir: this.rootDir,
          productsDir: this.productsDir,
          exportDir: this.exportDir,
          logsDir: this.logsDir,
          workerIndex: worker,
          startedAt: jobStartedAt,
        });
        this.store.update(job, {
          status: outcome.status,
          videoPath: outcome.videoPath,
          captionPath: outcome.captionPath,
          code: outcome.error?.code,
          filter: outcome.error?.filter,
          cause: outcome.error?.cause,
        });
        outcomes[index] = outcome;
        this.options.onJobFinished?.(outcome, index);
        return outcome;
      },
      { concurrency },
    );

    const summaries: BatchJobSummary[] = [];
    pendingEntries.forEach((entry, index) => {
      const outcome = outcomes[index];
      if (!outcome) {
        summaries.push({
          jobId: entry.job.jobId,
          gameId: entry.job.gameId,
          mechanic: entry.job.mechanic,
          status: 'failed',
          code: 'E_UNKNOWN',
          filter: 'queue',
        });
        return;
      }
      summaries.push({
        jobId: outcome.jobId,
        gameId: outcome.gameId,
        mechanic: outcome.mechanic,
        status: outcome.status,
        code: outcome.error?.code,
        filter: outcome.error?.filter,
        videoPath: outcome.videoPath,
        renderMs: outcome.log.render_ms,
        fileSize: outcome.fileSize,
      });
    });
    for (const entry of rejected) {
      summaries.push({
        jobId: entry.jobId,
        gameId: entry.gameId,
        status: 'failed',
        code: entry.code,
        filter: entry.filter,
      });
    }

    const report = BatchReporter.build({
      batchId,
      outputDir: this.exportDir,
      jobs: summaries,
      workerPoolMax: concurrency,
      startedAt,
      warnings: rejected.length > 0 ? [`${rejected.length} queue file(s) were not valid jobs`] : [],
    });
    const reportPath = BatchReporter.write(report, this.exportDir);
    return {
      report,
      reportPath,
      outcomes: outcomes.filter((outcome): outcome is JobOutcome => outcome !== undefined),
      rejected,
    };
  }

  /** Write `count` jobs into `queue/` (Hermes-equivalent client). */
  enqueue(count: number, batchId?: string): QueueJob[] {
    const productIds = this.options.productIds ?? this.defaultProductIds();
    const jobs = planBatchJobs({
      count,
      mechanics: this.options.mechanics ?? ['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY'],
      productIds,
      seed: this.options.seed ?? 839271,
      resultVariant: this.options.resultVariant,
      batchId,
      jobIdFactory: this.options.jobIdFactory ?? ((index) => `job-${String(index + 1).padStart(4, '0')}`),
    });
    return jobs.map((job) => {
      const { job: stored } = this.store.enqueue({
        jobId: job.jobId,
        gameId: job.gameId,
        mechanic: job.mechanic,
        productIds: job.productIds,
        seed: job.seed,
        result_variant: this.options.resultVariant ?? 'in_video',
        batchId,
      });
      return stored;
    });
  }

  /** All SKU ids available to the batch (50 by default). */
  private defaultProductIds(): string[] {
    const provider = new ProductProvider(this.productsDir, { watch: false });
    return provider.getAll().map((product) => product.productId);
  }
}

export { InsufficientDiskSpaceError };
