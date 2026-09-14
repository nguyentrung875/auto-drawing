/**
 * Queue-context errors.
 *
 * The queue orchestrates the pipeline but must not import the render context
 * (AD-1: `queue → validator → … → render`), so failures it raises itself carry
 * the same `{code, field, hint}` shape every other context uses.
 */
export class QueueError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly hint?: string;
  override readonly cause?: Error;

  constructor(code: string, field?: string, hint?: string, cause?: Error) {
    super([code, field && `at ${field}`, hint].filter(Boolean).join(' — '));
    this.name = 'QueueError';
    this.code = code;
    this.field = field;
    this.hint = hint;
    this.cause = cause;
  }

  toJSON(): { code: string; field?: string; hint?: string } {
    return { code: this.code, field: this.field, hint: this.hint };
  }
}

export const QUEUE_ERROR_CODES = {
  JOB_INVALID: 'E_QUEUE_JOB_INVALID',
  RENDER_STAGE_MISSING: 'E_RENDER_STAGE_MISSING',
  PRICE_SOURCE_INVALID: 'E_PRICE_SOURCE_INVALID',
  AUDIO_SYNC_DRIFT: 'E_AUDIO_SYNC_DRIFT',
} as const;
