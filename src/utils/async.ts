/**
 * Async helpers shared by the queue and render contexts.
 *
 * `withTimeout` implements AD-10's per-stage ceilings for in-process work (TTS),
 * and `retry` implements the bounded LLM-stub retry (`3×`) with deterministic
 * jitter (AR-10 bans `Math.random()`, and `src/utils` has no seed to draw from).
 */

export class TimeoutError extends Error {
  readonly code = 'PROCESS_TIMEOUT';

  constructor(stage: string, timeoutMs: number) {
    super(`PROCESS_TIMEOUT — ${stage} exceeded ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }

  toJSON(): { code: string; field: string; hint: string } {
    return { code: this.code, field: 'timeout', hint: this.message };
  }
}

/** Await `promise` but fail with `TimeoutError` once `timeoutMs` elapses. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage = 'task',
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  // Prevent unhandled rejections if the underlying promise fails after timeout
  promise.catch(() => {});
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(stage, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RetryOptions {
  /** Total attempts including the first (AC 4.3: retry 3× → attempts). */
  attempts?: number;
  /** Base backoff between attempts (ms). */
  delayMs?: number;
  /** Deterministic jitter factor (0..1) applied per attempt. */
  jitter?: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
  errors: unknown[];
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry `operation` up to `attempts` times. Jitter is derived from the attempt
 * index (1, 0.5, 0.25, …) so runs stay reproducible in tests and logs.
 */
export async function retry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = options.delayMs ?? 50;
  const jitter = options.jitter ?? 0.2;
  const sleep = options.sleep ?? defaultSleep;
  const errors: unknown[] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, attempts: attempt, errors };
    } catch (error) {
      errors.push(error);
      if (attempt === attempts) break;
      const backoff = delayMs * attempt * (1 + jitter * (1 / attempt));
      options.onRetry?.(error, attempt, Math.round(backoff));
      await sleep(Math.round(backoff));
    }
  }
  throw errors[errors.length - 1] ?? new Error('retry: operation failed');
}
