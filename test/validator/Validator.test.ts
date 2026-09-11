/** Story 2.1 — Two-Layer Validator (Schema + Game Logic). */
import { describe, expect, it } from 'vitest';
import { Validator } from '../../src/validator';
import { MechanicRegistry } from '../../src/game';
import type { GameJson } from '../../src/types/game';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p042 = product('p042', 2490000);

function hiLoGame(): GameJson {
  return MechanicRegistry.get('HI_LO').create({
    products: [p001, p042],
    seed: 839271,
  }).game;
}

describe('Story 2.1 — Validator.validate', () => {
  it('accepts a valid HI_LO game', () => {
    const result = Validator.validate(hiLoGame(), [p001, p042]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a game missing the countdown scene', () => {
    const game = hiLoGame();
    game.scenes = game.scenes.filter((s) => s !== 'countdown');
    const result = Validator.validate(game, [p001, p042]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toEqual({
      code: 'E_MISSING_REQUIRED_SCENE',
      field: 'scenes',
      hint: 'countdown required',
    });
  });

  it('rejects a scene outside the 7 MVP scenes with E_SCHEMA_SCENE_INVALID', () => {
    const game = hiLoGame();
    game.scenes = [...game.scenes, 'score'];
    const result = Validator.validate(game, [p001, p042]);
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('E_SCHEMA_SCENE_INVALID');
    expect(result.errors[0]?.field).toBe('scenes.score');
  });

  it('rejects a missing required field with E_SCHEMA_MISSING_FIELD + field/hint', () => {
    const game = hiLoGame() as unknown as Record<string, any>;
    delete game.metadata.gameId;
    const result = Validator.validate(game as GameJson, [p001, p042]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('E_SCHEMA_MISSING_FIELD');
    expect(result.errors[0]?.field).toBe('metadata.gameId');
    expect(result.errors[0]?.hint).toBeTruthy();
  });

  it('rejects duplicate choice prices with E_GAME_LOGIC_INVALID', () => {
    const game = MechanicRegistry.get('MOST_EXPENSIVE').create({
      products: [product('p1', 500000), product('p2', 400000), product('p3', 300000)],
      seed: 1,
    }).game;
    const dup = [product('p1', 500000), product('p2', 400000), product('p3', 400000)];
    const result = Validator.validate(game, dup);
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('E_GAME_LOGIC_INVALID');
    expect(result.errors.some((e) => e.field === 'choices')).toBe(true);
  });

  it('rejects a mechanic/interaction mismatch (HI_LO with MULTIPLE_CHOICE)', () => {
    const game = hiLoGame();
    game.gameplay.interaction = 'MULTIPLE_CHOICE';
    const result = Validator.validate(game, [p001, p042]);
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('E_GAME_LOGIC_INVALID');
    expect(result.errors.find((e) => e.field === 'gameplay.interaction')).toBeTruthy();
  });

  it('warns W_AFFILIATE_MISSING without blocking (AD-4)', () => {
    const noLink = product('p042', 2490000, { affiliate_link: '' });
    const result = Validator.validate(hiLoGame(), [p001, noLink]);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('W_AFFILIATE_MISSING');
  });

  it('hard-fails when a price does not come from the ProductProvider', () => {
    const result = Validator.validate(hiLoGame(), [p001, null]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('E_PRICE_SOURCE_INVALID');
  });

  it('reports E_ASSET_MISSING when the image does not exist', () => {
    const result = Validator.validate(hiLoGame(), [p001, p042], {
      assetExists: (p) => p.productId !== 'p042',
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('E_ASSET_MISSING');
  });

  it('runs in <200ms (FR-3)', () => {
    const result = Validator.validate(hiLoGame(), [p001, p042]);
    expect(result.durationMs).toBeLessThan(200);
  });

  it('gives every error a code, field and hint for the CLI JSON output', () => {
    const game = hiLoGame();
    game.scenes = ['hook'];
    const result = Validator.validate(game, [p001, p042]);
    expect(result.errors.length).toBeGreaterThan(0);
    for (const err of result.errors) {
      expect(err.code).toMatch(/^E_/);
      expect(err.field).toBeTruthy();
      expect(err.hint).toBeTruthy();
    }
  });

  it('does not mutate the game (AR-3 — validator is a pure filter)', () => {
    const game = hiLoGame();
    const before = JSON.stringify(game);
    Validator.validate(game, [p001, p042]);
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe('Story 2.1 — mechanic-specific game logic', () => {
  it('rejects HI_LO delta <5% with E_HILO_EQUAL_PRICE and a delta hint', () => {
    const a = product('p001', 100000);
    const b = product('p042', 103000); // 3%
    const game = MechanicRegistry.get('HI_LO').create({ products: [a, b], seed: 1 }).game;
    const result = Validator.validate(game, [a, b]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('E_HILO_EQUAL_PRICE');
    expect(result.errors[0]?.hint).toMatch(/3\.0% <5%/);
  });

  it('rejects a MOST_EXPENSIVE tie', () => {
    const products = [
      product('p1', 890000),
      product('p2', 890000),
      product('p3', 450000),
    ];
    const game = MechanicRegistry.get('MOST_EXPENSIVE').create({ products, seed: 2 }).game;
    const result = Validator.validate(game, products);
    expect(result.errors.map((e) => e.code)).toContain('E_MOST_EXPENSIVE_TIE');
  });

  it('rejects a MOST_EXPENSIVE top-2 delta <2%', () => {
    const products = [
      product('p1', 890000),
      product('p2', 880000), // 1.1%
      product('p3', 450000),
    ];
    const game = MechanicRegistry.get('MOST_EXPENSIVE').create({ products, seed: 2 }).game;
    const result = Validator.validate(game, products);
    expect(result.errors[0]?.code).toBe('E_MOST_EXPENSIVE_TIE');
    expect(result.errors[0]?.hint).toMatch(/top2 delta 1\.1% <2%/);
  });

  it('rejects an out-of-range ONE_AWAY hidden_index', () => {
    const game = MechanicRegistry.get('ONE_AWAY').create({
      products: [p001],
      seed: 3,
      hiddenIndex: 3,
    }).game;
    game.gameplay.hidden_index = 99;
    const result = Validator.validate(game, [p001]);
    expect(result.errors[0]?.code).toBe('E_GAME_LOGIC_INVALID');
    expect(result.errors[0]?.hint).toMatch(/out of range/);
  });
});
