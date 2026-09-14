/**
 * Bounded context: queue — file queue (`queue/*.json`), FIFO poller, bounded
 * worker pool and fail-forward batch orchestration (AD-9, AD-10).
 *
 * The context never imports `src/render`: render work enters through the
 * `RenderStagePort` and is wired by the CLI (the composition root).
 */
export const QUEUE_CONTEXT = 'queue';

export { BatchOrchestrator, planBatchJobs, type BatchOptions, type BatchResult, type EnqueueBatchRequest } from './BatchOrchestrator';
export { JobRunner, ttsTimeoutMs, type JobOutcome, type JobProgressEvent, type RunJobOptions } from './JobRunner';
export { QueueStore, type EnqueueInput, type InvalidQueueEntry, type QueueEntry } from './QueueStore';
export { WORKER_POOL_HARD_MAX, runPool, workerPoolSize, type PoolOptions, type PoolTask } from './WorkerPool';
export { requestLlmCopy, LlmJsonError, LLM_COPY_MAX_ATTEMPTS, type LlmCopyPatch, type LlmStubOptions } from './llmStub';
export { QueueError, QUEUE_ERROR_CODES } from './errors';
export type { RenderStagePort } from './ports';
export { parseQueueJob, queueJobSchema, type QueueJob } from './schema';
export type { RenderStageInput, RenderStageOutput } from './stageTypes';
