/**
 * Queue job schema (`queue/job_<uuid>.json`) — AD-9.
 *
 * Hermes writes these files directly, so the schema is the contract between the
 * (future) Hermes stub and the poller: a malformed file fails that one job with
 * `E_QUEUE_JOB_INVALID` instead of breaking the batch.
 */
import { z } from 'zod';

export const jobStatusSchema = z.enum(['pending', 'running', 'done', 'failed']);

export const queueJobSchema = z.object({
  jobId: z.string().min(1),
  gameId: z.string().min(1),
  mechanic: z.enum(['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY']),
  productIds: z.array(z.string().min(1)).min(1),
  seed: z.number().int(),
  result_variant: z.enum(['in_video', 'comment']).default('in_video'),
  status: jobStatusSchema.default('pending'),
  retries: z.number().int().min(0).default(0),
  /** Ordering key for FIFO polling (ms epoch); defaults to file mtime. */
  enqueuedAt: z.number().int().optional(),
  hiddenIndex: z.number().int().optional(),
  batchId: z.string().optional(),
  videoPath: z.string().optional(),
  captionPath: z.string().optional(),
  code: z.string().optional(),
  filter: z.string().optional(),
  cause: z.string().optional(),
  attempts: z.number().int().min(0).optional(),
  worker: z.number().int().optional(),
  updatedAt: z.string().optional(),
});

export type QueueJob = z.infer<typeof queueJobSchema>;

export interface JobValidationError {
  code: 'E_QUEUE_JOB_INVALID';
  field: string;
  hint: string;
}

/** Validate an unknown JSON payload as a queue job. */
export function parseQueueJob(
  value: unknown,
): { ok: true; job: QueueJob } | { ok: false; error: JobValidationError } {
  const parsed = queueJobSchema.safeParse(value);
  if (parsed.success) return { ok: true, job: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error: {
      code: 'E_QUEUE_JOB_INVALID',
      field: issue?.path.join('.') || 'job',
      hint: issue?.message ?? 'invalid queue job',
    },
  };
}
