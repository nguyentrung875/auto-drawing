import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameLoader } from '../../src/game/GameLoader';
import { GameError, isGameError } from '../../src/game/errors';
import { MVP_SCENES } from '../../src/game/schema';
import type { GameJson } from '../../src/types/game';

function validGame(overrides: Partial<GameJson> = {}): GameJson {
  return {
    metadata: {
      gameId: 'test_001',
      mechanic: 'HI_LO',
      version: 'v1',
      seed: 42,
      result_variant: 'in_video',
    },
    content: {
      title: 't',
      hook: 'h',
      question: 'q',
      cta: 'c',
      caption: 'cap',
      hashtags: ['x'],
      voice_script: 'v',
    },
    entities: [{ productId: 'p001' }, { productId: 'p002' }],
    gameplay: { mechanic: 'HI_LO', interaction: 'BOOLEAN' },
    scenes: ['hook', 'product', 'question', 'countdown', 'reveal', 'result', 'cta'],
    audio: {
      voice: { script: 'v', enabled: true },
      sfx: [{ type: 'countdown', at: 1 }],
    },
    publishing: { caption: 'cap', hashtags: ['x'] },
    ...overrides,
  };
}

function expectThrows(fn: () => unknown): GameError {
  try {
    fn();
  } catch (err) {
    expect(isGameError(err)).toBe(true);
    return err as GameError;
  }
  throw new Error('expected fn to throw a GameError, but it did not');
}

describe('GameLoader (Story 1.2)', () => {
  it('loads the sample games/hi_lo.json into a typed GameJson', () => {
    const game = GameLoader.load('games/hi_lo.json');
    expect(game.metadata.gameId).toBe('hi_lo_001');
    expect(Number.isInteger(game.metadata.seed)).toBe(true);
    expect(game.metadata.seed).toBe(839271);
    expect(game.metadata.mechanic).toBe('HI_LO');
    for (const scene of game.scenes) {
      expect(MVP_SCENES).toContain(scene);
    }
  });

  it('rejects JSON missing metadata.gameId with E_SCHEMA_MISSING_FIELD + field/hint', () => {
    const raw = JSON.parse(JSON.stringify(validGame())) as Record<string, unknown>;
    const meta = raw.metadata as Record<string, unknown>;
    delete meta.gameId;
    const e = expectThrows(() => GameLoader.parse(JSON.stringify(raw)));
    expect(e.code).toBe('E_SCHEMA_MISSING_FIELD');
    expect(e.field).toBe('metadata.gameId');
    expect(e.hint).toBeTruthy();
  });

  it('rejects a Phase-2 scene (score) with E_SCHEMA_SCENE_INVALID', () => {
    const game = validGame({ scenes: ['hook', 'score'] });
    const e = expectThrows(() => GameLoader.parse(JSON.stringify(game)));
    expect(e.code).toBe('E_SCHEMA_SCENE_INVALID');
    expect(e.field).toBe('scenes.score');
  });

  it('rejects a non-integer seed', () => {
    const raw = JSON.parse(JSON.stringify(validGame())) as Record<string, unknown>;
    (raw.metadata as Record<string, unknown>).seed = 1.5;
    expect(() => GameLoader.parse(JSON.stringify(raw))).toThrowError(GameError);
  });

  it('rejects an invalid mechanic (not in the enum)', () => {
    const raw = JSON.parse(JSON.stringify(validGame())) as Record<string, unknown>;
    (raw.metadata as Record<string, unknown>).mechanic = 'CHECK_OUT';
    const e = expectThrows(() => GameLoader.parse(JSON.stringify(raw)));
    expect(e.code).toBe('E_SCHEMA_MISSING_FIELD');
    expect(e.field).toBe('metadata.mechanic');
  });

  it('rejects a missing required scene with E_MISSING_REQUIRED_SCENE', () => {
    const game = validGame({
      scenes: ['hook', 'product', 'question', 'reveal', 'result', 'cta'],
    });
    const e = expectThrows(() => GameLoader.parse(JSON.stringify(game)));
    expect(e.code).toBe('E_MISSING_REQUIRED_SCENE');
  });

  it('rejects a missing file with E_GAME_FILE_NOT_FOUND', () => {
    const e = expectThrows(() => GameLoader.load('no-such-file.json'));
    expect(e.code).toBe('E_GAME_FILE_NOT_FOUND');
    expect(e.field).toBe('no-such-file.json');
    expect(e.hint).toBeTruthy();
  });

  it('rejects duplicate gameId across a batch with E_DUPLICATE_GAME_ID', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'game-loader-'));
    try {
      const a = validGame({
        metadata: { gameId: 'dup_001', mechanic: 'HI_LO', version: 'v1', seed: 1 },
      });
      const b = validGame({
        metadata: { gameId: 'dup_001', mechanic: 'HI_LO', version: 'v1', seed: 2 },
      });
      const aPath = path.join(tmp, 'a.json');
      const bPath = path.join(tmp, 'b.json');
      writeFileSync(aPath, JSON.stringify(a));
      writeFileSync(bPath, JSON.stringify(b));

      const e = expectThrows(() => GameLoader.loadBatch([aPath, bPath]));
      expect(e.code).toBe('E_DUPLICATE_GAME_ID');
      expect(e.field).toBe('metadata.gameId');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('loads a directory of unique games via loadDirectory', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'game-loader-dir-'));
    try {
      writeFileSync(path.join(tmp, 'g1.json'), JSON.stringify(validGame({ metadata: { gameId: 'g1', mechanic: 'HI_LO', version: 'v1', seed: 1 } })));
      writeFileSync(path.join(tmp, 'g2.json'), JSON.stringify(validGame({ metadata: { gameId: 'g2', mechanic: 'HI_LO', version: 'v1', seed: 2 } })));
      const games = GameLoader.loadDirectory(tmp);
      expect(games.map((g) => g.metadata.gameId).sort()).toEqual(['g1', 'g2']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
