/**
 * Stories 4.2 + 4.3 — CLI surface: `game render`, `game batch`,
 * `game products list`, `game queue status`, `game logs`, `game --help`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELP, listProducts, run } from '../../src/cli/index';
import { parseBatchArgs, runBatchCommand } from '../../src/cli/batch';
import {
  formatLogs,
  formatQueueStatus,
  parseInspectArgs,
  queueStatus,
  readLogs,
  renderConfigSummary,
} from '../../src/cli/inspect';
import { JobLogger } from '../../src/observability';
import { parseRenderArgs, runRenderCommand } from '../../src/cli/render';
import { BatchOrchestrator } from '../../src/queue/BatchOrchestrator';
import { QueueStore } from '../../src/queue/QueueStore';
import { createFakeRenderStage } from '../helpers/renderStage';
import { productIdsFor } from '../helpers/render';

const ROOT = process.cwd();
let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'epic4-cli-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    out.push(args.map(String).join(' '));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    err.push(args.map(String).join(' '));
  });
  return {
    out,
    err,
    restore: () => {
      log.mockRestore();
      error.mockRestore();
    },
  };
}

describe('game products list (AC 4.2)', () => {
  it('prints 50 SKUs with productId | name | price VND | affiliate_link', () => {
    const { out, restore } = capture();
    try {
      listProducts();
      expect(out).toHaveLength(51);
      expect(out[0]).toBe('productId | name | price VND | affiliate_link');
      const first = out[1]!.split(' | ');
      expect(first).toHaveLength(4);
      expect(first[0]).toBe('p001');
      expect(first[2]).toContain('189.000');
      expect(first[3]).toMatch(/^https:\/\/shopee\.vn\/p001/);
      expect(out[50]!.split(' | ')[0]).toBe('p050');
      expect(out.filter((line) => line.startsWith('p0'))).toHaveLength(50);
    } finally {
      restore();
    }
  });
});

describe('game --help (AC 4.2)', () => {
  it('lists render, batch, products list, queue status and logs', () => {
    for (const command of ['game render', 'game batch', 'game products list', 'game queue status', 'game logs']) {
      expect(HELP).toContain(command);
    }
    const { out, restore } = capture();
    try {
      expect(run(['--help'])).toBe(0);
      expect(out.join('\n')).toContain('game batch');
    } finally {
      restore();
    }
  });
});

describe('game render (Story 4.2)', () => {
  it('parses mechanic/products/seed/result-variant flags', () => {
    const args = parseRenderArgs([
      '--mechanic', 'hi_lo',
      '--products', 'p001,p042',
      '--seed', '839271',
      '--result-variant', 'in_video',
    ]);
    expect(args).toMatchObject({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p042'],
      seed: 839271,
      resultVariant: 'in_video',
    });
    expect(parseRenderArgs(['--mechanic', 'one_away', '--hidden-index', '3']).hiddenIndex).toBe(3);
  });

  it('enqueues a job file, runs the pipeline, and reports a one-job batch report', async () => {
    const queueDir = path.join(workDir, 'queue');
    const result = await runRenderCommand({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p042'],
      seed: 839271,
      resultVariant: 'in_video',
      queueDir,
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      renderer: createFakeRenderStage(),
    } as never);

    expect(result.exitCode).toBe(0);
    expect(result.videoPath).toContain(path.join(workDir, 'export'));
    const jobFile = new QueueStore(queueDir).read(result.jobId!);
    expect(jobFile.ok && jobFile.job.status).toBe('done');
    expect(jobFile.ok && jobFile.job.videoPath).toBe(result.videoPath);
    expect(existsSync(result.reportPath!)).toBe(true);
    expect(result.summary).toContain('passed 1/1');
  });

  it('exits 1 with {code,field,hint} when the Game JSON cannot satisfy the validator', async () => {
    // MOST_EXPENSIVE with a single product: the mechanic rule fails in the
    // game-logic layer, which is exactly the {"code","field","hint"} contract.
    const queueDir = path.join(workDir, 'queue');
    const result = await runRenderCommand({
      mechanic: 'MOST_EXPENSIVE',
      productIds: ['p001'],
      seed: 1,
      queueDir,
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      renderer: createFakeRenderStage(),
    } as never);
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatchObject({ code: 'E_GAME_LOGIC_INVALID' });
    expect(result.error?.field).toBeTruthy();
    expect(result.error?.hint).toBeTruthy();
  });

  it('rejects a wrong product count for the mechanic before rendering', async () => {
    const result = await runRenderCommand({
      mechanic: 'HI_LO',
      productIds: ['p001'],
      seed: 1,
      queueDir: path.join(workDir, 'queue'),
      rootDir: ROOT,
      renderer: createFakeRenderStage(),
    } as never);
    expect(result.exitCode).toBe(1);
    expect(result.error?.hint).toContain('exactly 2');
  });

  it('renders a pre-authored Game JSON (`--game`) and surfaces missing products', async () => {
    const game = {
      metadata: { gameId: 'custom_1', mechanic: 'HI_LO', version: 'v1', seed: 7 },
      content: { title: 't', hook: 'h', question: 'q', cta: 'c', caption: 'cap', hashtags: ['x'], voice_script: 'v' },
      entities: [{ productId: 'p001' }, { productId: 'p002' }],
      gameplay: { mechanic: 'HI_LO', interaction: 'BOOLEAN' },
      scenes: ['hook', 'product', 'question', 'countdown', 'reveal', 'result', 'cta'],
      audio: { voice: { script: 'v', enabled: true }, sfx: [{ type: 'countdown', at: 0 }] },
      publishing: { caption: 'cap', hashtags: ['x'], affiliate_link: 'https://shopee.vn/p001?aff=123' },
    };
    const goodFile = path.join(workDir, 'game-ok.json');
    writeFileSync(goodFile, JSON.stringify(game));
    const ok = await runRenderCommand({
      gameFile: goodFile,
      productIds: [],
      queueDir: path.join(workDir, 'queue'),
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      renderer: createFakeRenderStage(),
    } as never);
    expect(ok.exitCode).toBe(0);

    const brokenFile = path.join(workDir, 'game-broken.json');
    writeFileSync(brokenFile, JSON.stringify({ ...game, entities: [{ productId: 'p999' }] }));
    const broken = await runRenderCommand({
      gameFile: brokenFile,
      productIds: [],
      queueDir: path.join(workDir, 'queue'),
      rootDir: ROOT,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      renderer: createFakeRenderStage(),
    } as never);
    expect(broken.exitCode).toBe(1);
    expect(broken.error?.code).toBe('E_PRICE_SOURCE_INVALID');
  });
});

describe('game batch (Story 4.3)', () => {
  it('parses --count/--mechanics and runs the batch through the orchestrator', async () => {
    const args = parseBatchArgs([
      '--count', '50',
      '--mechanics', 'hi_lo,most_expensive,one_away',
      '--result-variant', 'comment',
      '--seed', '839271',
    ]);
    expect(args.count).toBe(50);
    expect(args.mechanics).toEqual(['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY']);
    expect(args.resultVariant).toBe('comment');

    const result = await runBatchCommand(
      {
        rootDir: ROOT,
        queueDir: path.join(workDir, 'queue'),
        exportDir: path.join(workDir, 'export'),
        logsDir: path.join(workDir, 'logs'),
        count: 5,
        mechanics: ['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY'],
        seed: 4242,
        skipDiskCheck: true,
        concurrency: 2,
        jobOptions: { renderer: createFakeRenderStage() },
      },
      (options) => new BatchOrchestrator(options),
    );
    expect(result.exitCode).toBe(0);
    expect(result.result!.report).toMatchObject({ total: 5, passed: 5, failed: 0 });
    expect(result.summary).toContain('passed 5/5');
    expect(result.summary).toContain('batch_report.json');
    expect(result.result!.report.jobs.map((job) => job.jobId)).toEqual([
      'job-0001', 'job-0002', 'job-0003', 'job-0004', 'job-0005',
    ]);
  });

  it('aborts before rendering with INSUFFICIENT_DISK_SPACE', async () => {
    const result = await runBatchCommand({
      rootDir: workDir,
      queueDir: path.join(workDir, 'queue'),
      exportDir: path.join(workDir, 'export'),
      count: 3,
      requiredFreeBytes: Number.MAX_SAFE_INTEGER,
      jobOptions: { renderer: createFakeRenderStage() },
    });
    expect(result.exitCode).toBe(1);
    expect(result.error?.code).toBe('INSUFFICIENT_DISK_SPACE');
    expect(existsSync(path.join(workDir, 'export'))).toBe(false);
  });

  it('rejects an invalid job file but keeps the valid ones running (fail-forward)', async () => {
    const queueDir = path.join(workDir, 'queue');
    const store = new QueueStore(queueDir);
    store.enqueue({ jobId: 'ok1', gameId: 'g1', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 5 });
    writeFileSync(path.join(queueDir, 'job_nonsense.json'), '{"jobId":"nonsense"}');
    const result = await runBatchCommand({
      rootDir: ROOT,
      queueDir,
      exportDir: path.join(workDir, 'export'),
      logsDir: path.join(workDir, 'logs'),
      skipDiskCheck: true,
      jobOptions: { renderer: createFakeRenderStage() },
    });
    expect(result.result!.report.total).toBe(2);
    expect(result.result!.report.passed).toBe(1);
    expect(result.result!.report.failed).toBe(1);
    expect(result.result!.rejected[0]!.code).toBe('E_QUEUE_JOB_INVALID');
    expect(result.summary).toContain('FAILED');
    // 1/2 passed is below SM-1, so the batch exits non-zero for the scheduler.
    expect(result.exitCode).toBe(1);
    // Every dir is redirected into the temp work dir: a test must never write
    // logs/queue/export into the repository checkout next to a running batch.
    const sm1 = await runBatchCommand({
      rootDir: workDir,
      productsDir: path.join(ROOT, 'products'),
      queueDir: path.join(workDir, 'queue-2'),
      exportDir: path.join(workDir, 'export-2'),
      logsDir: path.join(workDir, 'logs-2'),
      skipDiskCheck: true,
      count: 50,
      jobIdFactory: (index) => `sm1-${index}`,
      jobOptions: {
        renderer: createFakeRenderStage({
          failWith: (input) => (input.jobId === 'sm1-49' ? new Error('E_ENCODE_FAILED') : undefined),
        }),
      },
    });
    expect(sm1.result!.report).toMatchObject({ total: 50, passed: 49, failed: 1 });
    expect(sm1.exitCode).toBe(0);
  });
});

describe('game queue status / game logs / game config', () => {
  it('reports queue depth and per-job status', () => {
    const queueDir = path.join(workDir, 'queue');
    const store = new QueueStore(queueDir);
    store.enqueue({ jobId: 'a', gameId: 'g_a', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 1 });
    store.enqueue({ jobId: 'b', gameId: 'g_b', mechanic: 'ONE_AWAY', productIds: ['p001'], seed: 2 });
    const status = queueStatus({ queueDir });
    expect(status.rows).toHaveLength(2);
    expect(status.counts.pending).toBe(2);
    const text = formatQueueStatus(status);
    expect(text).toContain('pending 2');
    const { out, restore } = capture();
    try {
      const parsed = parseInspectArgs(['status', '--queue-dir', queueDir]);
      expect(parsed.queueDir).toBe(queueDir);
    } finally {
      restore();
    }
    void out;
  });

  it('formats job logs with render/encode timings', () => {
    const logsDir = path.join(workDir, 'logs');
    const store = new QueueStore(path.join(workDir, 'queue'));
    store.enqueue({ jobId: 'a', gameId: 'g_a', mechanic: 'HI_LO', productIds: ['p001', 'p002'], seed: 1 });
    new JobLogger(logsDir).writeFrom({
      jobId: 'a',
      gameId: 'g_a',
      mechanic: 'HI_LO',
      seed: 1,
      products: ['p001', 'p002'],
      status: 'done',
      renderMs: 9000,
      encodeMs: 9500,
      totalMs: 18_600,
      fileSize: 512_000,
      startedAt: Date.now() - 18_600,
    });
    const logs = readLogs({ logsDir });
    expect(logs.rows).toHaveLength(1);
    const text = formatLogs(logs);
    expect(text).toContain('g_a');
    expect(text).toContain('render 9000ms');
    const single = readLogs({ logsDir, gameId: 'g_a' });
    expect(single.rows).toHaveLength(1);
    expect(readLogs({ logsDir, gameId: 'nope' }).rows).toHaveLength(0);
  });

  it('prints the resolved render configuration', () => {
    const config = renderConfigSummary(ROOT) as Record<string, unknown>;
    expect(config).toMatchObject({ width: 1080, height: 1920, fps: 30, codec: 'libx264', crf: 18 });
    expect(config.workerPoolMax).toBeGreaterThanOrEqual(1);
  });

  it('routes async-only commands through runAsync (documented error in sync run())', () => {
    const { err, restore } = capture();
    try {
      expect(run(['batch', '--count', '1'])).toBe(1);
      expect(err.join('\n')).toContain('E_ASYNC_COMMAND');
    } finally {
      restore();
    }
    expect(productIdsFor('HI_LO')).toEqual(['p001', 'p002']);
    expect(productIdsFor('ONE_AWAY')).toEqual(['p001']);
  });
});
