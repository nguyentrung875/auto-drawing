/** Story 2.2 — Deterministic Answer & Timeline Engine. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GameEngine,
  MechanicRegistry,
  buildTimeline,
  createRng,
  diversification,
} from '../../src/game';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p042 = product('p042', 2490000);
const hiLo = MechanicRegistry.get('HI_LO').create({
  products: [p001, p042],
  seed: 839271,
}).game;

describe('Story 2.2 — GameEngine.compute determinism', () => {
  it('returns the same answer and an 18.0s ±0.05s timeline on repeated calls', () => {
    const a = GameEngine.compute(hiLo, [p001, p042], 839271);
    const b = GameEngine.compute(hiLo, [p001, p042], 839271);
    expect(a.answer).toBe('higher');
    expect(b.answer).toBe('higher');
    expect(a.timeline.totalDuration).toBeCloseTo(18.0, 2);
    expect(Math.abs(a.timeline.totalDuration - 18.0)).toBeLessThanOrEqual(0.05);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('keeps countdown at 3.0s ±0.1 and reveal at 2.0s ±0.1', () => {
    const { timeline } = GameEngine.compute(hiLo, [p001, p042]);
    const countdown = timeline.slots.find((s) => s.type === 'countdown');
    const reveal = timeline.slots.find((s) => s.type === 'reveal');
    expect(Math.abs((countdown?.duration ?? 0) - 3.0)).toBeLessThanOrEqual(0.1);
    expect(Math.abs((reveal?.duration ?? 0) - 2.0)).toBeLessThanOrEqual(0.1);
    expect(timeline.slots.map((s) => s.type)).toEqual([
      'hook',
      'product',
      'question',
      'countdown',
      'reveal',
      'result',
      'cta',
    ]);
    expect(timeline.slots[0]?.start).toBe(0);
    expect(timeline.slots.at(-1)?.end).toBeCloseTo(18.0, 2);
  });

  it('throws E_TIMELINE_DRIFT when the countdown scene is absent', () => {
    const broken = { ...hiLo, scenes: ['hook', 'product', 'question', 'reveal', 'result', 'cta'] };
    expect(() => buildTimeline(broken)).toThrowError(/E_TIMELINE_DRIFT/);
  });

  it('throws E_GAME_LOGIC_INVALID when the authored answer contradicts the Engine', () => {
    const broken = { ...hiLo, gameplay: { ...hiLo.gameplay, answer: 'lower' } };
    // p042 (2.49M) > p001 (189K), so the Engine must compute 'higher'.
    expect(() => GameEngine.compute(broken, [p001, p042], 839271)).toThrowError(
      /E_GAME_LOGIC_INVALID/,
    );
  });

  it('tolerates a type-only authored answer ("0" string vs numeric 0)', () => {
    const oneAway = MechanicRegistry.get('ONE_AWAY').create({
      products: [p001],
      seed: 839273,
      hiddenIndex: 3,
    }).game;
    oneAway.gameplay.answer = '0'; // same value, different type
    expect(() => GameEngine.compute(oneAway, [p001], 839273)).not.toThrow();
  });

  it('throws E_TIMELINE_DRIFT when the total duration leaves the 15-21s window', () => {
    const broken = { ...hiLo, scenes: ['countdown', 'reveal'] };
    expect(() => buildTimeline(broken)).toThrowError(/E_TIMELINE_DRIFT/);
  });

  it('answers correctly for 100 random seeds (answer === priceB > priceA)', () => {
    const rng = createRng(20260911, 'test:seeds');
    for (let i = 0; i < 100; i++) {
      const seed = Math.floor(rng() * 1_000_000);
      const priceA = 50_000 + Math.floor(rng() * 3_000_000);
      const priceB = 50_000 + Math.floor(rng() * 3_000_000);
      if (priceA === priceB) continue;
      const a = product('pA', priceA);
      const b = product('pB', priceB);
      const game = MechanicRegistry.get('HI_LO').create({ products: [a, b], seed }).game;
      const computed = GameEngine.compute(game, [a, b], seed);
      expect(computed.answer).toBe(priceB > priceA ? 'higher' : 'lower');
    }
  });

  it('derives diversification deterministically from the seed', () => {
    expect(diversification(839271)).toEqual(diversification(839271));
    const seeds = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(diversification(s))),
    );
    // Different seeds should not all collapse to a single variant.
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('bans Math.random() in src/ (AR-10 — enforced by eslint too)', () => {
    const files = [
      'src/game/GameEngine.ts',
      'src/game/rng.ts',
      'src/game/mechanics/OneAwayMechanic.ts',
      'src/validator/Validator.ts',
    ];
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/Math\.random\(/);
    }
  });
});
