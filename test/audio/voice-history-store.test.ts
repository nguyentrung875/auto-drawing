import { describe, expect, it } from 'vitest';
import { VoiceHistoryStore } from '../../src/audio/voiceHistoryStore';

describe('VoiceHistoryStore', () => {
  it('tracks history and calculates repetition penalties accurately', () => {
    const store = new VoiceHistoryStore({ maxCapacity: 10 });

    // Initial penalty for fresh candidate is 0
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_01', 'Cao hay thấp?', 'CHALLENGE')).toBe(0);

    // Record usage
    store.record({
      mechanic: 'HI_LO',
      templateId: 'HL_CHALLENGE_01',
      script: 'Cao hay thấp?',
      intent: 'CHALLENGE',
      timestamp: Date.now(),
    });

    // Immediate repeat of exact script -> penalty 100
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_01', 'Cao hay thấp?', 'CHALLENGE')).toBe(100);

    // Same templateId -> penalty 50
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_01', 'Khác text', 'CHALLENGE')).toBeGreaterThanOrEqual(50);

    // Different template, same intent -> smaller penalty (15)
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_02', 'Khác', 'CHALLENGE')).toBe(15);
  });

  it('penalizes when the same intent is repeated 3 times in a row', () => {
    const store = new VoiceHistoryStore({ maxCapacity: 10 });
    for (let i = 0; i < 3; i++) {
      store.record({
        mechanic: 'HI_LO',
        templateId: `HL_CHALLENGE_${i}`,
        script: `Khác ${i}`,
        intent: 'CHALLENGE',
        timestamp: Date.now() + i,
      });
    }
    // 3 times in a row -> penalty 30
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_99', 'Khác hoàn toàn', 'CHALLENGE')).toBe(30);
  });
});
