import { describe, expect, it } from 'vitest';
import {
  CANONICAL_18S_PROFILE,
  MECHANIC_TIMING_PROFILES,
  getTimingProfileForMechanic,
  getSceneDuration,
  buildSceneTimeline,
  validateSceneTimeline,
} from '../../src/scene';
import type { SceneName } from '../../src/scene/types';

describe('SceneTimingProfiles (V2 Architecture)', () => {
  it('returns canonical 18s profile when mechanic is undefined or unknown', () => {
    expect(getTimingProfileForMechanic(undefined)).toEqual(CANONICAL_18S_PROFILE);
    expect(getTimingProfileForMechanic('UNKNOWN_MECHANIC')).toEqual(CANONICAL_18S_PROFILE);
    expect(getSceneDuration('hook', CANONICAL_18S_PROFILE)).toBe(2.0);
    expect(getSceneDuration('product', CANONICAL_18S_PROFILE)).toBe(3.0);
  });

  it('provides specialized profiles for fast A/B games (HI_LO: 12s, GUESS_THE_PRICE: 12s)', () => {
    const hiLo = getTimingProfileForMechanic('HI_LO');
    expect(hiLo.totalDuration).toBe(12.0);
    expect(hiLo.countdown).toBe(2.5);
    expect(hiLo.hook).toBe(1.5);

    const gtp = getTimingProfileForMechanic('GUESS_THE_PRICE');
    expect(gtp.totalDuration).toBe(12.0);
  });

  it('provides extra cognitive time for calculation games (GROCERY_BASKET: 16s, countdown: 4s)', () => {
    const grocery = getTimingProfileForMechanic('GROCERY_BASKET');
    expect(grocery.totalDuration).toBe(16.0);
    expect(grocery.countdown).toBe(4.0);
    expect(grocery.product).toBe(3.0);
  });

  it('builds a 12s timeline for HI_LO and a 16s timeline for GROCERY_BASKET', () => {
    const scenes: SceneName[] = ['hook', 'product', 'question', 'countdown', 'reveal', 'result', 'cta'];
    const hiLoTimeline = buildSceneTimeline(scenes, 'HI_LO');
    expect(hiLoTimeline.totalDuration).toBe(12.0);
    expect(() => validateSceneTimeline(scenes, hiLoTimeline, 'HI_LO')).not.toThrow();

    const groceryTimeline = buildSceneTimeline(scenes, 'GROCERY_BASKET');
    expect(groceryTimeline.totalDuration).toBe(16.0);
    expect(() => validateSceneTimeline(scenes, groceryTimeline, 'GROCERY_BASKET')).not.toThrow();
  });

  it('accepts legacy 18s timeline even when a mechanic is specified (backward compatibility)', () => {
    const scenes: SceneName[] = ['hook', 'product', 'question', 'countdown', 'reveal', 'result', 'cta'];
    const legacyTimeline = buildSceneTimeline(scenes); // 18s
    expect(legacyTimeline.totalDuration).toBe(18.0);
    expect(() => validateSceneTimeline(scenes, legacyTimeline, 'HI_LO')).not.toThrow();
  });
});
