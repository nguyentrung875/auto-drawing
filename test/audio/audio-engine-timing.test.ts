import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { MechanicRegistry } from '../../src/game';
import { product } from '../helpers/products';

describe('AudioEngine Physical Gap Timing', () => {
  it('enforces revealGapMs micro-silence pause before reveal', async () => {
    const game = MechanicRegistry.get('HI_LO').create({
      products: [product('p1', 100000), product('p2', 200000)],
      seed: 839271,
    }).game;

    const result = await new AudioEngine().synthesize(game);
    const actualRevealGap = Number(
      (result.revealAt - (result.voiceStartAt + result.voiceDuration)).toFixed(3),
    );

    // Default target gap for HI_LO is 0.09s (90ms)
    expect(actualRevealGap).toBeCloseTo(0.09, 2);
    expect(result.voiceStartAt).toBeGreaterThanOrEqual(8.0); // Never before countdown
    expect(result.runtimeScore).toBeDefined();
    expect(result.runtimeScore?.gapErrorMs).toBeLessThanOrEqual(15);
    expect(result.runtimeScore?.pass).toBe(true);
  });
});
