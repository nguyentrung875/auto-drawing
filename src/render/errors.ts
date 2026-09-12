/** Render-context errors, shaped like every other `{code, field, hint}` error. */
export class RenderError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly hint?: string;
  override readonly cause?: Error;

  constructor(code: string, field?: string, hint?: string, cause?: Error) {
    super([code, field && `at ${field}`, hint].filter(Boolean).join(' — '));
    this.name = 'RenderError';
    this.code = code;
    this.field = field;
    this.hint = hint;
    this.cause = cause;
  }

  toJSON(): { code: string; field?: string; hint?: string; cause?: string } {
    return {
      code: this.code,
      field: this.field,
      hint: this.hint,
      cause: this.cause?.message,
    };
  }
}

export const RENDER_ERROR_CODES = {
  FONT_MISSING: 'E_FONT_MISSING',
  FRAMES_MISSING: 'E_RENDER_FRAMES_MISSING',
  TIMEOUT: 'PROCESS_TIMEOUT',
  FFMPEG_MISSING: 'E_FFMPEG_MISSING',
  ENCODE_FAILED: 'E_ENCODE_FAILED',
  AUDIO_MERGE_FAILED: 'E_AUDIO_MERGE_FAILED',
  AFFILIATE_BURNED: 'E_AFFILIATE_BURNED_IN',
  OUTPUT_MISSING: 'E_RENDER_OUTPUT_MISSING',
  BACKEND_UNAVAILABLE: 'E_RENDER_BACKEND_UNAVAILABLE',
} as const;

export type RenderErrorCode = (typeof RENDER_ERROR_CODES)[keyof typeof RENDER_ERROR_CODES];

/** Warning codes that never block a render (mirrors AD-4's warning philosophy). */
export const RENDER_WARNING_CODES = {
  SLOW: 'W_RENDER_SLOW',
  RENDERER_FALLBACK: 'W_RENDERER_FALLBACK',
  ASSET_PLACEHOLDER: 'W_ASSET_PLACEHOLDER',
  MUSIC_MISSING: 'W_MUSIC_MISSING',
  TEXT_DROPPED: 'W_TEXT_GLYPH_DROPPED',
} as const;

export { filterForCode, type JobFilter } from '../observability/filters';
