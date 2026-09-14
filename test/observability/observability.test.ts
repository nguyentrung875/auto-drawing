/**
 * Story 4.3 — observability: per-job logs (shape + atomicity), the batch report
 * (SM-1 pass rate, failed jobs, summary) and the disk pre-flight.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BatchReporter,
  JobLogger,
  SM1_MIN_PASS_RATE,
  filterForCode,
  isSm1Satisfied,
  type BatchJobSummary,
} from '../../src/observability';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'epic4-obs-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('JobLogger', () => {
  it('writes logs/<gameId>.json with the AC job fields and no temp file left behind', () => {
    const logger = new JobLogger(path.join(workDir, 'logs'));
    const { log, path: logPath } = logger.writeFrom({
      jobId: 'job_1',
      gameId: 'hi_lo_839271',
      mechanic: 'HI_LO',
      seed: 839271,
      resultVariant: 'in_video',
      products: ['p001', 'p042'],
      status: 'done',
      validatorErrors: [],
      warnings: [{ code: 'W_MUSIC_MISSING', hint: 'synthesised bed' }],
      planningMs: 1.5,
      ttsMs: 12.25,
      audioVoiceMs: 12.25,
      renderMs: 9000.5,
      encodeMs: 9500.25,
      audioMixMs: 180,
      totalMs: 18_700,
      fileSize: 512_000,
      filePath: '/tmp/x.mp4',
      startedAt: Date.now() - 18_700,
      worker: 2,
    });

    expect(logPath).toBe(path.join(workDir, 'logs', 'hi_lo_839271.json'));
    expect(log.worker).toBe(2);
    expect(log.slow).toBe(false);
    const raw = JSON.parse(readFileSync(logPath, 'utf8'));
    expect(raw).toMatchObject({
      jobId: 'job_1',
      gameId: 'hi_lo_839271',
      mechanic: 'HI_LO',
      seed: 839271,
      products: ['p001', 'p042'],
      status: 'done',
      planning_ms: 1.5,
      tts_ms: 12.25,
      audio_voice_ms: 12.25,
      render_ms: 9000.5,
      encode_ms: 9500.25,
      audio_mix_ms: 180,
      total_ms: 18700,
      file_size: 512000,
      file_path: '/tmp/x.mp4',
      validator_errors: [],
      slow: false,
    });
    expect(new Date(raw.started_at).getTime()).toBeGreaterThan(1_700_000_000_000);
    expect(new Date(raw.finished_at).getTime()).toBeGreaterThan(new Date(raw.started_at).getTime() - 1);
    expect(readdirSync(path.join(workDir, 'logs')).some((file) => file.endsWith('.tmp'))).toBe(false);
  });

  it('round-trips logs and lists them', () => {
    const logger = new JobLogger(path.join(workDir, 'logs'));
    logger.writeFrom({
      jobId: 'job_1',
      gameId: 'a',
      mechanic: 'HI_LO',
      seed: 1,
      products: ['p001'],
      status: 'done',
      startedAt: Date.now(),
    });
    logger.writeFrom({
      jobId: 'job_2',
      gameId: 'b',
      mechanic: 'ONE_AWAY',
      seed: 2,
      products: ['p001'],
      status: 'failed',
      code: 'E_GAME_LOGIC_INVALID',
      filter: 'game_logic',
      cause: 'ONE_AWAY needs exactly 1 product',
      startedAt: Date.now(),
    });
    expect(logger.read('a')?.status).toBe('done');
    expect(logger.read('missing')).toBeNull();
    const logs = logger.list();
    expect(logs.map((log) => log.gameId).sort()).toEqual(['a', 'b']);
    expect(logs.find((log) => log.gameId === 'b')).toMatchObject({
      code: 'E_GAME_LOGIC_INVALID',
      filter: 'game_logic',
    });
  });
});

function summary(overrides: Partial<BatchJobSummary> = {}): BatchJobSummary {
  return { jobId: 'j1', gameId: 'g1', mechanic: 'HI_LO', status: 'done', renderMs: 9000, ...overrides };
}

describe('BatchReporter', () => {
  it('computes totals, pass rate, avg render time and failed jobs', () => {
    const jobs = [
      summary({ jobId: 'j1' }),
      summary({ jobId: 'j2', renderMs: 11_000 }),
      summary({ jobId: 'j3', gameId: 'g3', status: 'failed', code: 'PROCESS_TIMEOUT', filter: 'timeout' }),
      summary({ jobId: 'j4', gameId: 'g4', status: 'failed', code: 'E_PRICE_SOURCE_INVALID', filter: 'price_source' }),
    ];
    const report = BatchReporter.build({
      batchId: 'batch-1',
      outputDir: '/tmp/export',
      jobs,
      workerPoolMax: 3,
      startedAt: Date.now() - 60_000,
      warnings: ['1 queue file(s) were not valid jobs'],
    });
    expect(report.total).toBe(4);
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(2);
    expect(report.pass_rate).toBe(0.5);
    expect(report.avg_render_ms).toBe(9_500);
    expect(report.worker_pool_max).toBe(3);
    expect(report.manual_interventions).toBe(0);
    expect(report.failed_jobs.map((job) => job.jobId)).toEqual(['j3', 'j4']);
    expect(report.duration_ms).toBeGreaterThan(59_000);
    expect(isSm1Satisfied(report)).toBe(false);

    const path40 = BatchReporter.write(report, path.join(workDir, 'export'));
    expect(existsSync(path40)).toBe(true);
    expect(path40).toContain(path.join('export', 'batch-batch-1', 'batch_report.json'));
    const parsed = BatchReporter.read(path40)!;
    expect(parsed.pass_rate).toBe(0.5);
    const formatted = BatchReporter.formatSummary(parsed);
    expect(formatted).toContain('passed 2/4');
    expect(formatted).toContain('FAILED g3 [PROCESS_TIMEOUT / timeout]');
    expect(formatted).toContain('SM-1');
  });

  it('satisfies SM-1 at 49/50 and above', () => {
    const jobs: BatchJobSummary[] = Array.from({ length: 50 }, (_, index) =>
      summary({
        jobId: `j${index}`,
        gameId: `g${index}`,
        status: index === 0 ? 'failed' : 'done',
        code: index === 0 ? 'E_ENCODE_FAILED' : undefined,
      }),
    );
    const report = BatchReporter.build({
      batchId: 'batch-49',
      outputDir: '/tmp/export',
      jobs,
      workerPoolMax: 3,
      startedAt: Date.now(),
    });
    expect(report.passed).toBe(49);
    expect(report.pass_rate).toBe(0.98);
    expect(report.pass_rate).toBeGreaterThanOrEqual(SM1_MIN_PASS_RATE);
    expect(isSm1Satisfied(report)).toBe(true);
    expect(BatchReporter.formatSummary(report)).not.toContain('WARNING');
  });

  it('maps error codes to the filter Hermes sees', () => {
    expect(filterForCode('E_SCHEMA_MISSING_FIELD')).toBe('schema');
    expect(filterForCode('E_MISSING_REQUIRED_SCENE')).toBe('schema');
    expect(filterForCode('E_GAME_LOGIC_INVALID')).toBe('game_logic');
    expect(filterForCode('E_HILO_EQUAL_PRICE')).toBe('game_logic');
    expect(filterForCode('E_PRICE_SOURCE_INVALID')).toBe('price_source');
    expect(filterForCode('E_ASSET_MISSING')).toBe('asset');
    expect(filterForCode('E_AUDIO_SYNC_DRIFT')).toBe('audio');
    expect(filterForCode('E_TIMELINE_DRIFT')).toBe('scene');
    expect(filterForCode('E_RENDER_FRAMES_MISSING')).toBe('render');
    expect(filterForCode('E_FFMPEG_MISSING')).toBe('render');
    expect(filterForCode('PROCESS_TIMEOUT')).toBe('timeout');
    expect(filterForCode('INSUFFICIENT_DISK_SPACE')).toBe('disk');
    expect(filterForCode('E_LLM_JSON_INVALID')).toBe('llm');
    expect(filterForCode('E_QUEUE_JOB_INVALID')).toBe('queue');
  });
});
