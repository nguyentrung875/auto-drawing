/**
 * Bounded worker pool for batch rendering (AD-10).
 *
 * `WORKER_POOL_MAX = min(CPU count - 1, 3)` — a hard ceiling until the R0
 * benchmark raises it. Each worker runs exactly one job at a time; a rejected
 * job never stops the pool (fail-forward) and every task release is guaranteed
 * through `finally`.
 */
import os from 'node:os';

export const WORKER_POOL_HARD_MAX = 3;

/** `min(os.cpus().length - 1, 3)`, never below 1. */
export function workerPoolSize(
  cpuCount = os.cpus().length,
  hardMax = WORKER_POOL_HARD_MAX,
): number {
  return Math.max(1, Math.min(cpuCount - 1, hardMax));
}

export interface PoolTask<T> {
  item: T;
  index: number;
  worker: number;
}

export interface PoolOptions<R> {
  concurrency?: number;
  /** Called after each task settles, in completion order. */
  onSettled?: (result: R, index: number, worker: number) => void;
}

/**
 * Run `worker(task)` over `items` with a bounded pool. Returns results in the
 * original order; a rejected task yields `null` so callers decide what a
 * failure means (the batch marks the job failed and keeps going).
 */
export async function runPool<T, R>(
  items: T[],
  worker: (task: PoolTask<T>) => Promise<R>,
  options: PoolOptions<R> = {},
): Promise<Array<R | null>> {
  const rawConcurrency = options.concurrency ?? workerPoolSize();
  const concurrency = Number.isFinite(rawConcurrency) && rawConcurrency > 0 ? Math.max(1, Math.floor(rawConcurrency)) : workerPoolSize();
  const results: Array<R | null> = new Array(items.length).fill(null);
  let cursor = 0;

  const runWorker = async (workerIndex: number): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        const result = await worker({ item: items[index]!, index, worker: workerIndex });
        results[index] = result;
        options.onSettled?.(result, index, workerIndex);
      } catch {
        results[index] = null;
        options.onSettled?.(null as unknown as R, index, workerIndex);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, (_, index) =>
      runWorker(index),
    ),
  );
  return results;
}
