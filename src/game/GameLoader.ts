/**
 * Story 1.2 — GameLoader.
 *
 * Loads and strictly validates Universal Game JSON:
 *   - structural zod validation → E_SCHEMA_MISSING_FIELD (field + hint)
 *   - scene subset check → E_SCHEMA_SCENE_INVALID
 *   - required scenes check → E_MISSING_REQUIRED_SCENE
 *   - duplicate gameId across a batch → E_DUPLICATE_GAME_ID
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { gameSchema, MVP_SCENES, REQUIRED_SCENES } from './schema';
import { GameError } from './errors';
import type { GameJson } from '../types/game';

/** Map a zod failure to a schema error, keeping the first issue's path/hint. */
function toSchemaError(err: unknown): GameError {
  if (err instanceof GameError) return err;
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue && issue.path.length > 0 ? issue.path.join('.') : undefined;
    const hint =
      issue && issue.message === 'Required'
        ? 'required field is missing'
        : issue
          ? issue.message
          : 'invalid input';
    return new GameError('E_SCHEMA_MISSING_FIELD', field, hint);
  }
  return new GameError(
    'E_SCHEMA_MISSING_FIELD',
    undefined,
    err instanceof Error ? err.message : String(err),
  );
}

/** Enforce scenes ⊆ 7 MVP scenes and required scenes presence. */
function checkScenes(scenes: string[]): void {
  const allowed = new Set<string>(MVP_SCENES);
  for (const scene of scenes) {
    if (!allowed.has(scene)) {
      throw new GameError(
        'E_SCHEMA_SCENE_INVALID',
        `scenes.${scene}`,
        `scene '${scene}' is not one of the 7 MVP scenes (${MVP_SCENES.join(', ')})`,
      );
    }
  }
  for (const required of REQUIRED_SCENES) {
    if (!scenes.includes(required)) {
      throw new GameError(
        'E_MISSING_REQUIRED_SCENE',
        'scenes',
        `scene '${required}' is required`,
      );
    }
  }
}

export class GameLoader {
  /** Load and validate a single Game JSON file. */
  static load(filePath: string): GameJson {
    const raw = readFileSync(filePath, 'utf8');
    return GameLoader.parse(raw, filePath);
  }

  /** Validate a Game JSON string (used by tests and by the file queue later). */
  static parse(raw: string, source = '<input>'): GameJson {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new GameError(
        'E_SCHEMA_MISSING_FIELD',
        undefined,
        `invalid JSON in ${source}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const result = gameSchema.safeParse(data);
    if (!result.success) throw toSchemaError(result.error);
    checkScenes(result.data.scenes);
    return result.data as GameJson;
  }

  /** Load a batch of files; duplicate `metadata.gameId` is rejected. */
  static loadBatch(filePaths: string[]): GameJson[] {
    const games: GameJson[] = [];
    const seen = new Map<string, string>();
    for (const filePath of filePaths) {
      const game = GameLoader.load(filePath);
      const id = game.metadata.gameId;
      const previous = seen.get(id);
      if (previous !== undefined) {
        throw new GameError(
          'E_DUPLICATE_GAME_ID',
          'metadata.gameId',
          `gameId '${id}' duplicated across batch (${previous} and ${filePath})`,
        );
      }
      seen.set(id, filePath);
      games.push(game);
    }
    return games;
  }

  /** Load every `*.json` in a directory, sorted, as one batch. */
  static loadDirectory(dir: string): GameJson[] {
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => path.join(dir, f));
    return GameLoader.loadBatch(files);
  }
}
