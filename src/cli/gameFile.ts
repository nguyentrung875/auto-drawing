/**
 * `--game <file.json>` support for `game render`.
 *
 * Renders an already-authored Game JSON (Hermes/LLM output) through the same
 * Validator → Engine → Render path as the template mechanics.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { GameJson } from '../types/game';

export type LoadGameResult =
  | { ok: true; game: GameJson }
  | { ok: false; error: { code: string; field: string; hint: string } };

export function loadGameJson(filePath: string): LoadGameResult {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      error: { code: 'E_SCHEMA_MISSING_FIELD', field: 'game', hint: `file not found: ${filePath}` },
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as GameJson;
    return { ok: true, game: parsed };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'E_SCHEMA_MISSING_FIELD',
        field: 'game',
        hint: `${filePath} is not valid JSON: ${(error as Error).message}`,
      },
    };
  }
}
