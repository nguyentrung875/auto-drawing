/**
 * Stories 4.2 + 4.3 — queue: FIFO poll, bounded pool, fail-forward, retry,
 * disk pre-flight, RAM ceiling and the batch report.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkDiskSpace,
  ensureDiskSpace,
  InsufficientDiskSpaceError,
  JobLogger,
  MIN_FREE_DISK_BYTES,
} from '../../src/observability';
import { BatchOrchestrator, planBatchJobs } from '../../src/queue/BatchOrchestrator';
import { JobRunner, ttsTimeoutMs } from '../../src/queue/JobRunner';
import { requestLlmCopy, LlmJsonError } from '../../src/queue/llmStub';
import { QueueStore } from '../../src/queue/QueueStore';
import { runPool, workerPoolSize, WORKER_POOL_HARD_MAX } from '../../src/queue/WorkerPool';
import type { QueueJob } from '../../src/queue/schema';
import { createFakeRenderStage } from '../helpers/renderStage';

const ROOT = process.cwd();
let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'epic4-queue-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function statusOf(store: QueueStore, jobId: string): string | undefined {
  const read = store.read(jobId);
  return read.ok ? read.job.status : undefined;
}

function videoPathOf(store: QueueStore, jobId: string): string | undefined {
  const read = store.read(jobId);
  return read.ok ? read.job.videoPath : undefined;
}

function job(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    jobId: 'job-0001',
    gameId: 'hi_lo_1',
    mechanic: 'HI_LO',
    productIds: ['p001', 'p002'],
    seed: 1,
    result_variant: 'in_video',
    status: 'pending',
    retries: 0,
    ...overrides,
  };
}

describe('WorkerPool (AD-10)', () => {
  it('caps the pool at min(CPU-1, 3) and never below 1', () => {
    expect(workerPoolSize(8)).toBe(3);
    expect(workerPoolSize(4)).toBe(3);
    expect(workerPoolSize(2)).toBe(1);
    expect(workerPoolSize(1)).toBe(1);
    expect(workerPoolSize(1, WORKER_POOL_HARD_MAX)).toBe(1);
    expect(workerPoolSize(64)).toBeLessThanOrEqual(WORKER_POOL_HARD_MAX);
  });

  it('runs jobs concurrently up to the limit and fails forward on rejection', async () => {
    let active = 0;
    let maxActive = 0;
    const results = await runPool(
      [1, 2, 3, 4, 5, 6],
      async ({ item }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        if (item === 3) throw new Error('boom');
        return item * 2;
      },
      { concurrency: 2 },
    );
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(results).toEqual([2, 4, null, 8, 10, 12]);
  });
});

describe('QueueStore (AD-9)', () => {
  it('writes jobs atomically and lists them FIFO', async () => {
    const store = new QueueStore(path.join(workDir, 'queue'));
    store.enqueue({ jobId: 'b', gameId: 'g_b', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 2 });
    // Distinct enqueue instants: FIFO must follow insertion order, not jobId.
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.enqueue({ jobId: 'a', gameId: 'g_a', mechanic: 'ONE_AWAY', productIds: ['p001'], seed: 1 });
    const { entries, invalid } = store.list();
    expect(invalid).toHaveLength(0);
    expect(entries.map((entry) => entry.job.jobId)).toEqual(['b', 'a']);
    // Same-millisecond enqueues still resolve deterministically (mtime → name).
    const sameMs = new QueueStore(path.join(workDir, 'queue-same-ms'));
    sameMs.enqueue({ jobId: 'z', gameId: 'g_z', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 3 });
    sameMs.enqueue({ jobId: 'y', gameId: 'g_y', mechanic: 'ONE_AWAY', productIds: ['p001'], seed: 4 });
    const sameMsOrder = sameMs.list().entries.map((entry) => entry.job.jobId);
    expect(sameMsOrder).toHaveLength(2);
    expect([...sameMsOrder].sort()).toEqual(['y', 'z']);
    expect(readdirSync(path.join(workDir, 'queue')).some((file) => file.endsWith('.tmp.json'))).toBe(false);
  });

  it('reports malformed job files without throwing (fail-forward fodder)', () => {
    const queueDir = path.join(workDir, 'queue');
    const store = new QueueStore(queueDir);
    store.enqueue({ jobId: 'good', gameId: 'g', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 1 });
    writeFileSync(path.join(queueDir, 'job_broken.json'), '{ not json');
    writeFileSync(path.join(queueDir, 'job_missing.json'), JSON.stringify({ jobId: 'x' }));
    const { entries, invalid } = store.list();
    expect(entries).toHaveLength(1);
    expect(invalid).toHaveLength(2);
    expect(invalid.every((entry) => entry.error.code === 'E_QUEUE_JOB_INVALID')).toBe(true);
  });

  it('transitions status pending → running → done', () => {
    const store = new QueueStore(path.join(workDir, 'queue'));
    const { job: created } = store.enqueue({
      jobId: 'j1',
      gameId: 'g',
      mechanic: 'HI_LO',
      productIds: ['p001', 'p002'],
      seed: 1,
    });
    store.update(created, { status: 'running' });
    expect(statusOf(store, 'j1')).toBe('running');
    store.update(created, { status: 'done', videoPath: '/tmp/x.mp4' });
    expect(videoPathOf(store, 'j1')).toBe('/tmp/x.mp4');
  });
});

describe('JobRunner (Story 4.2 pipeline)', () => {
  it('renders a valid job and logs every AC field', async () => {
    const stage = createFakeRenderStage();
    const outcome = await JobRunner.run({
      job: job(),
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      renderer: stage,
    });
    expect(outcome.status).toBe('done');
    expect(stage.stats.calls).toBe(1);
    const log = JSON.parse(readFileSync(outcome.logPath, 'utf8'));
    for (const key of [
      'planning_ms', 'tts_ms', 'render_ms', 'encode_ms', 'seed', 'products',
      'audio_voice_ms', 'file_size', 'validator_errors',
    ]) {
      expect(log).toHaveProperty(key);
    }
    expect(log.products).toEqual(['p001', 'p002']);
    expect(log.status).toBe('done');
    expect(log.filter).toBeUndefined();
    expect(log.slow).toBe(false);
    expect(typeof log.started_at).toBe('string');
    expect(new Date(log.started_at).getFullYear()).toBeGreaterThan(2020);
  });

  it('fails a job whose product does not exist, with code + filter', async () => {
    const outcome = await JobRunner.run({
      job: job({ jobId: 'bad-product', productIds: ['p001', 'p999'], gameId: 'hi_lo_missing' }),
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      renderer: createFakeRenderStage(),
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatchObject({ code: 'E_PRICE_SOURCE_INVALID', filter: 'price_source' });
    expect(outcome.log.validator_errors[0]?.code).toBe('E_PRICE_SOURCE_INVALID');
  });

  it('reports E_RENDER_STAGE_MISSING when no render stage is wired', async () => {
    const outcome = await JobRunner.run({
      job: job({ jobId: 'no-stage' }),
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error?.code).toBe('E_RENDER_STAGE_MISSING');
  });

  it('cleans temp/<jobId>/ in finally even when the render stage leaks it', async () => {
    const outcome = await JobRunner.run({
      job: job({ jobId: 'leaky' }),
      rootDir: workDir,
      productsDir: path.join(ROOT, 'products'),
      exportDir: 'export',
      logsDir: 'logs',
      renderer: createFakeRenderStage({ leakTemp: true }),
    });
    expect(outcome.status).toBe('done');
    expect(existsSync(path.join(workDir, 'temp', 'leaky'))).toBe(false);
  });

  it('derives the TTS timeout from the script length (AD-10)', () => {
    expect(ttsTimeoutMs('')).toBe(2000);
    expect(ttsTimeoutMs('x'.repeat(100))).toBe(12_000);
  });
});

describe('LLM stub retry (AC 4.3)', () => {
  it('retries a malformed JSON response 3× then fails', async () => {
    let calls = 0;
    await expect(
      requestLlmCopy(
        { mechanic: 'HI_LO', productNames: ['p001'], question: 'q' },
        { raw: async () => { calls += 1; return '{ not json'; }, retry: { sleep: async () => {} } },
      ),
    ).rejects.toBeInstanceOf(LlmJsonError);
    expect(calls).toBe(3);
  });

  it('succeeds on the third attempt and reports the attempt count', async () => {
    let calls = 0;
    const result = await requestLlmCopy(
      { mechanic: 'HI_LO', productNames: ['p001'], question: 'q' },
      {
        raw: async () => {
          calls += 1;
          if (calls < 3) throw new Error('transient');
          return JSON.stringify({ hook: 'Hook mới', cta: 'Follow nhé' });
        },
        retry: { sleep: async () => {} },
      },
    );
    expect(result.attempts).toBe(3);
    expect(result.patch).toEqual({ hook: 'Hook mới', cta: 'Follow nhé' });
  });

  it('rejects an LLM patch that tries to own price or answer', async () => {
    await expect(
      requestLlmCopy(
        { mechanic: 'HI_LO', productNames: ['p001'], question: 'q' },
        { raw: async () => JSON.stringify({ price: 1 }), retry: { sleep: async () => {}, attempts: 1 } },
      ),
    ).rejects.toMatchObject({ code: 'E_LLM_JSON_INVALID' });
  });
});

describe('BatchOrchestrator (Story 4.3)', () => {
  it('plans 50 deterministic jobs across the three mechanics', () => {
    const productIds = Array.from({ length: 50 }, (_, index) => `p${String(index + 1).padStart(3, '0')}`);
    const plan = planBatchJobs({
      count: 50,
      mechanics: ['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY'],
      productIds,
      seed: 839271,
      jobIdFactory: (index) => `job-${index + 1}`,
    });
    expect(plan).toHaveLength(50);
    expect(new Set(plan.map((entry) => entry.mechanic)).size).toBe(3);
    expect(plan[0]!.mechanic).toBe('HI_LO');
    expect(plan[0]!.productIds).toHaveLength(2);
    expect(plan[1]!.productIds).toHaveLength(4);
    expect(plan[2]!.productIds).toHaveLength(1);
    expect(plan[3]!.seed).toBe(839271 + 3 * 977);
    const again = planBatchJobs({
      count: 50,
      mechanics: ['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY'],
      productIds,
      seed: 839271,
      jobIdFactory: (index) => `job-${index + 1}`,
    });
    expect(again).toEqual(plan);
  });

  it('runs a batch fail-forward: one bad product does not stop the others', async () => {
    const queueDir = path.join(workDir, 'queue');
    const exportDir = path.join(workDir, 'export');
    const logsDir = path.join(workDir, 'logs');
    const store = new QueueStore(queueDir);
    store.enqueue({ jobId: 'j1', gameId: 'g1', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 11 });
    store.enqueue({ jobId: 'j2', gameId: 'g2', mechanic: 'ONE_AWAY', productIds: ['p999'], seed: 12 });
    store.enqueue({ jobId: 'j3', gameId: 'g3', mechanic: 'MOST_EXPENSIVE', productIds: ['p001', 'p002', 'p003'], seed: 13 });

    const stage = createFakeRenderStage();
    const orchestrator = new BatchOrchestrator({
      rootDir: ROOT,
      queueDir,
      exportDir,
      logsDir,
      skipDiskCheck: true,
      concurrency: 2,
      jobOptions: { renderer: stage },
    });
    const result = await orchestrator.run();

    expect(result.report.total).toBe(3);
    expect(result.report.passed).toBe(2);
    expect(result.report.failed).toBe(1);
    expect(result.report.pass_rate).toBeCloseTo(2 / 3, 3);
    expect(result.report.manual_interventions).toBe(0);
    expect(result.report.failed_jobs[0]).toMatchObject({ jobId: 'j2', code: 'E_PRICE_SOURCE_INVALID' });
    expect(result.report.worker_pool_max).toBe(2);
    expect(result.report.avg_render_ms).toBeGreaterThan(0);
    expect(existsSync(result.reportPath)).toBe(true);
    expect(JSON.parse(readFileSync(result.reportPath, 'utf8')).jobs).toHaveLength(3);

    // Job files reflect the fail-forward transitions.
    expect(statusOf(store, 'j1')).toBe('done');
    expect(statusOf(store, 'j2')).toBe('failed');
    expect(statusOf(store, 'j3')).toBe('done');

    // Logs exist for every job, failures included, with code/filter/cause.
    const logger = new JobLogger(logsDir);
    const logs = logger.list();
    expect(logs).toHaveLength(3);
    const failed = logs.find((log) => log.status === 'failed')!;
    expect(failed.code).toBe('E_PRICE_SOURCE_INVALID');
    expect(failed.filter).toBe('price_source');
    expect(typeof failed.cause).toBe('string');
  });

  it('enqueues 50 jobs (AC 4.3 count) and keeps RAM well under the 4GB ceiling', async () => {
    const queueDir = path.join(workDir, 'queue');
    const orchestrator = new BatchOrchestrator({
      rootDir: ROOT,
      queueDir,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      skipDiskCheck: true,
      count: 50,
      seed: 4242,
      jobIdFactory: (index) => `job-${String(index + 1).padStart(4, '0')}`,
      jobOptions: { renderer: createFakeRenderStage() },
    });
    const staged = orchestrator.enqueue(50, 'batch-50');
    expect(staged).toHaveLength(50);
    expect(readdirSync(queueDir).filter((file) => file.endsWith('.json'))).toHaveLength(50);
    const result = await orchestrator.run();
    expect(result.report.total).toBe(50);
    expect(result.report.passed).toBe(50);
    const heapGb = process.memoryUsage().heapUsed / 1024 ** 3;
    expect(heapGb).toBeLessThan(4);
  }, 240_000);

  it('aborts the batch before rendering when free disk is below the floor', async () => {
    const orchestrator = new BatchOrchestrator({
      rootDir: workDir,
      queueDir: path.join(workDir, 'queue'),
      exportDir: path.join(workDir, 'export'),
      requiredFreeBytes: Number.MAX_SAFE_INTEGER,
      jobOptions: { renderer: createFakeRenderStage() },
    });
    await expect(orchestrator.run()).rejects.toBeInstanceOf(InsufficientDiskSpaceError);
    expect(existsSync(path.join(workDir, 'export'))).toBe(false);
  });
});

describe('DiskGuard (AD-10 pre-flight)', () => {
  it('reports free space and enforces the 2GB floor', () => {
    const space = checkDiskSpace(workDir);
    expect(space.path).toBe(workDir);
    expect(space.freeBytes).toBeGreaterThan(0);
    expect(space.requiredBytes).toBe(MIN_FREE_DISK_BYTES);
    expect(ensureDiskSpace(workDir).ok).toBe(true);
    expect(() => ensureDiskSpace(workDir, Number.MAX_SAFE_INTEGER)).toThrow(InsufficientDiskSpaceError);
    try {
      ensureDiskSpace(workDir, Number.MAX_SAFE_INTEGER);
    } catch (error) {
      const json = (error as InsufficientDiskSpaceError).toJSON();
      expect(json.code).toBe('INSUFFICIENT_DISK_SPACE');
      expect(json.hint).toMatch(/GB/);
    }
  });
});
