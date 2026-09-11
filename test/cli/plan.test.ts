/** Epic 2 — `game plan` CLI (validator + engine, no render). */
import { describe, expect, it } from 'vitest';
import { parsePlanArgs, plan } from '../../src/cli/plan';

describe('game plan (Epic 2)', () => {
  it('parses flags', () => {
    const args = parsePlanArgs([
      '--mechanic', 'one_away',
      '--products', 'p001',
      '--seed', '839273',
      '--result-variant', 'comment',
      '--hidden-index', '3',
    ]);
    expect(args).toMatchObject({
      mechanic: 'ONE_AWAY',
      productIds: ['p001'],
      seed: 839273,
      resultVariant: 'comment',
      hiddenIndex: 3,
    });
  });

  it('plans a HI_LO round from real product files', () => {
    const result = plan({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p002'],
      seed: 839271,
      resultVariant: 'in_video',
    }) as Record<string, any>;
    expect(result.ok).toBe(true);
    expect(result.answer).toBe('higher');
    expect(result.timeline.totalDuration).toBeCloseTo(18.0, 2);
  });

  it('returns a code/field/hint error for an unknown product', () => {
    const result = plan({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p999'],
      seed: 1,
      resultVariant: 'in_video',
    }) as any;
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('E_PRICE_SOURCE_INVALID');
    expect(result.errors[0].hint).toMatch(/p999/);
  });

  it('returns E_GAME_LOGIC_INVALID for a wrong product count', () => {
    const result = plan({
      mechanic: 'MOST_EXPENSIVE',
      productIds: ['p001', 'p002'],
      seed: 1,
      resultVariant: 'in_video',
    }) as any;
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('E_GAME_LOGIC_INVALID');
  });
});
