/**
 * LLM stub for hook/question/cta copy (FR-1 support, AD-10 retry rule).
 *
 * The MVP contract is JSON: the stub returns a *validated* patch for the three
 * copy fields (never `price`, never `answer` — AD-4), and a malformed response
 * is retried up to 3× before the job fails with `E_LLM_JSON_INVALID`.
 * Callers may inject their own implementation; the default is `null`, which
 * means "use the deterministic template" and costs nothing.
 */
import { retry, type RetryOptions } from '../utils/async';

export interface LlmCopyRequest {
  mechanic: string;
  productNames: string[];
  question: string;
  attempt: number;
}

export interface LlmCopyPatch {
  hook?: string;
  question?: string;
  cta?: string;
}

export interface LlmStubOptions {
  /** Produces a raw JSON string; throwing = malformed response (retryable). */
  raw?: (request: LlmCopyRequest) => Promise<string>;
  retry?: RetryOptions;
}

export class LlmJsonError extends Error {
  readonly code = 'E_LLM_JSON_INVALID';
  readonly field = 'llm.response';
  readonly hint: string;

  constructor(hint: string) {
    super(`E_LLM_JSON_INVALID — ${hint}`);
    this.name = 'LlmJsonError';
    this.hint = hint;
  }

  toJSON(): { code: string; field: string; hint: string } {
    return { code: this.code, field: this.field, hint: this.hint };
  }
}

export const LLM_COPY_MAX_ATTEMPTS = 3;

/** Fields an LLM is allowed to touch: prices and answers never come from it. */
const ALLOWED_FIELDS = new Set(['hook', 'question', 'cta']);

function parsePatch(raw: string): LlmCopyPatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LlmJsonError('LLM stub returned a payload that is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new LlmJsonError('LLM stub returned JSON that is not an object');
  }
  const patch: LlmCopyPatch = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new LlmJsonError(`LLM stub returned a forbidden field '${key}' (price/answer are Engine-owned)`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new LlmJsonError(`LLM stub returned an empty '${key}'`);
    }
    patch[key as keyof LlmCopyPatch] = value.trim();
  }
  return patch;
}

/** Run the stub with the 3× retry policy; throws `LlmJsonError` when it never parses. */
export async function requestLlmCopy(
  request: Omit<LlmCopyRequest, 'attempt'>,
  options: LlmStubOptions & { onRetry?: (error: unknown, attempt: number) => void } = {},
): Promise<{ patch: LlmCopyPatch; attempts: number; errors: unknown[] }> {
  if (!options.raw) return { patch: {}, attempts: 0, errors: [] };
  const result = await retry(
    async (attempt) => parsePatch(await options.raw!({ ...request, attempt })),
    {
      attempts: options.retry?.attempts ?? LLM_COPY_MAX_ATTEMPTS,
      delayMs: options.retry?.delayMs ?? 20,
      jitter: options.retry?.jitter ?? 0.2,
      sleep: options.retry?.sleep,
      onRetry: (error, attempt, delayMs) => {
        options.retry?.onRetry?.(error, attempt, delayMs);
        options.onRetry?.(error, attempt);
      },
    },
  );
  return { patch: result.value, attempts: result.attempts, errors: result.errors };
}
