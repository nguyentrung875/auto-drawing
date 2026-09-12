/**
 * Observability contracts (NFR-4 / Story 4.3).
 *
 * Hermes is a non-developer consumer: everything it needs to answer "which job
 * failed and why?" lives in two files — `logs/<gameId>.json` per job and
 * `export/batch-<ts>/batch_report.json` per batch. Field names follow the
 * acceptance criteria (`planning_ms`, `tts_ms`, `render_ms`, `encode_ms`,
 * `audio_voice_ms`, `file_size`, `validator_errors[]`).
 */

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface JobLog {
  jobId: string;
  gameId: string;
  mechanic: string;
  seed: number;
  result_variant?: string;
  status: JobStatus;
  products: string[];
  /** Failure code (`E_*`, `PROCESS_TIMEOUT`, `INSUFFICIENT_DISK_SPACE`). */
  code?: string;
  /** Filter that produced the failure: validator | game_logic | render | … */
  filter?: string;
  /** Human-readable cause (error hint/message). */
  cause?: string;
  /** Two-layer validator output, verbatim. */
  validator_errors: Array<{ code: string; field?: string; hint?: string }>;
  warnings: Array<{ code: string; hint: string }>;
  planning_ms: number;
  tts_ms: number;
  audio_voice_ms: number;
  render_ms: number;
  encode_ms: number;
  audio_mix_ms: number;
  total_ms: number;
  file_size: number;
  file_path?: string;
  caption_path?: string;
  /** True when the render exceeded the 45s budget (`W_RENDER_SLOW`). */
  slow: boolean;
  attempts: number;
  retries: number;
  started_at: string;
  finished_at: string;
  worker?: number;
}

export interface BatchJobSummary {
  jobId: string;
  gameId: string;
  mechanic?: string;
  status: JobStatus;
  code?: string;
  filter?: string;
  videoPath?: string;
  renderMs?: number;
  fileSize?: number;
}

export interface BatchReport {
  batch_id: string;
  output_dir: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total: number;
  passed: number;
  failed: number;
  /** SM-1: ≥98% pass rate. */
  pass_rate: number;
  avg_render_ms: number;
  worker_pool_max: number;
  /** SM-3: a hands-free batch needs zero manual interventions. */
  manual_interventions: number;
  jobs: BatchJobSummary[];
  failed_jobs: BatchJobSummary[];
  warnings: string[];
}

/** Parse a job log off disk without trusting its shape. */
export function isJobLog(value: unknown): value is JobLog {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<JobLog>;
  return typeof candidate.jobId === 'string' && typeof candidate.gameId === 'string';
}
