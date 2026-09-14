/**
 * GameError — the single error shape used across the engine.
 * Every error carries `code`, optional `field`, and optional `hint`, so the
 * CLI can print machine-readable JSON for Hermes (see addendum §4).
 */
export class GameError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly hint?: string;

  constructor(code: string, field?: string, hint?: string) {
    const parts = [code];
    if (field) parts.push(`at ${field}`);
    if (hint) parts.push(hint);
    super(parts.join(' — '));
    this.name = 'GameError';
    this.code = code;
    this.field = field;
    this.hint = hint;
  }

  toJSON(): { code: string; field?: string; hint?: string } {
    return { code: this.code, field: this.field, hint: this.hint };
  }
}

/** True when `err` is a GameError (or duck-typed equivalent). */
export function isGameError(err: unknown): err is GameError {
  return err instanceof GameError;
}
