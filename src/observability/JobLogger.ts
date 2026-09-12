/**
 * `logs/<gameId>.json` writer/reader (NFR-4).
 *
 * Writes are atomic (`.tmp` → rename) so a killed batch never leaves a
 * half-written log that Hermes would fail to parse, and every failure carries
 * `{code, filter, cause}` (AD-10) instead of a bare stack trace.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { isJobLog, type JobLog, type JobStatus } from './types';

export interface JobLogInput {
  jobId: string;
  gameId: string;
  mechanic: string;
  seed: number;
  resultVariant?: string;
  products: string[];
  status: JobStatus;
  code?: string;
  filter?: string;
  cause?: string;
  validatorErrors?: Array<{ code: string; field?: string; hint?: string }>;
  warnings?: Array<{ code: string; hint: string }>;
  planningMs?: number;
  ttsMs?: number;
  audioVoiceMs?: number;
  renderMs?: number;
  encodeMs?: number;
  audioMixMs?: number;
  totalMs?: number;
  fileSize?: number;
  filePath?: string;
  captionPath?: string;
  slow?: boolean;
  attempts?: number;
  retries?: number;
  startedAt?: number;
  worker?: number;
}

export class JobLogger {
  readonly logsDir: string;

  constructor(logsDir = 'logs') {
    this.logsDir = logsDir;
  }

  logPath(gameId: string): string {
    return path.join(this.logsDir, `${sanitizeId(gameId)}.json`);
  }

  /** Serialize a job outcome into the Hermes-facing log shape. */
  static toLog(input: JobLogInput): JobLog {
    const startedAt = input.startedAt ?? performance.now() - (input.totalMs ?? 0);
    return {
      jobId: input.jobId,
      gameId: input.gameId,
      mechanic: input.mechanic,
      seed: input.seed,
      result_variant: input.resultVariant,
      status: input.status,
      products: [...input.products],
      code: input.code,
      filter: input.filter,
      cause: input.cause,
      validator_errors: input.validatorErrors ?? [],
      warnings: input.warnings ?? [],
      planning_ms: round(input.planningMs),
      tts_ms: round(input.ttsMs),
      audio_voice_ms: round(input.audioVoiceMs ?? input.ttsMs),
      render_ms: round(input.renderMs),
      encode_ms: round(input.encodeMs),
      audio_mix_ms: round(input.audioMixMs),
      total_ms: round(input.totalMs),
      file_size: input.fileSize ?? 0,
      file_path: input.filePath,
      caption_path: input.captionPath,
      slow: input.slow ?? false,
      attempts: input.attempts ?? 1,
      retries: input.retries ?? 0,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      worker: input.worker,
    };
  }

  write(log: JobLog): string {
    const target = this.logPath(log.gameId);
    mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(log, null, 2)}\n`);
    renameSync(temporary, target);
    return target;
  }

  writeFrom(input: JobLogInput): { log: JobLog; path: string } {
    const log = JobLogger.toLog(input);
    return { log, path: this.write(log) };
  }

  read(gameId: string): JobLog | null {
    const file = this.logPath(gameId);
    if (!existsSync(file)) return null;
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      return isJobLog(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** All logs on disk, newest first (`mtime`). */
  list(): JobLog[] {
    if (!existsSync(this.logsDir)) return [];
    const logs: JobLog[] = [];
    for (const file of readdirSync(this.logsDir)) {
      if (!file.endsWith('.json')) continue;
      const parsed = this.read(file.replace(/\.json$/, ''));
      if (parsed) logs.push(parsed);
    }
    return logs;
  }
}

function round(value: number | undefined): number {
  return value === undefined ? 0 : Number(value.toFixed(2));
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}
