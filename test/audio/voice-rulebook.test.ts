import { describe, expect, it } from 'vitest';
import { VOICE_RULEBOOK } from '../../src/audio/voiceRulebook';
import { MECHANICS } from '../../src/game/schema';

describe('VoiceRulebook', () => {
  it('defines valid voice rules for all 7 MVP mechanics', () => {
    for (const mechanic of MECHANICS) {
      const rule = VOICE_RULEBOOK[mechanic];
      expect(rule).toBeDefined();
      expect(rule.mechanic).toBe(mechanic);
      expect(rule.allowedIntents.length).toBeGreaterThan(0);

      // Distributions must sum to ~1.0
      const totalWeight = Object.values(rule.intentDistribution).reduce((a, b) => a + b, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);

      // Timing bounds
      expect(rule.timing.defaultGapMs).toBeGreaterThanOrEqual(rule.timing.minGapMs);
      expect(rule.timing.defaultGapMs).toBeLessThanOrEqual(rule.timing.maxGapMs);
      expect(rule.timing.maxDurationSec).toBeGreaterThanOrEqual(1.5);

      // Offline pool non-empty and compliant
      expect(rule.offlinePool.length).toBeGreaterThanOrEqual(4);
      for (const cand of rule.offlinePool) {
        expect(cand.id).toBeDefined();
        expect(rule.allowedIntents).toContain(cand.intent);
        expect(cand.script.length).toBeGreaterThan(0);
        // None of the pool candidates should trip their own static forbidden patterns
        for (const pattern of rule.staticForbiddenPatterns) {
          expect(pattern.test(cand.script)).toBe(false);
        }
      }
    }
  });
});
