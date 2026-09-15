import { describe, expect, it } from 'vitest';
import { selectVoiceScript, calculateScriptQualityScore } from '../../src/audio/voiceSelector';
import { VoiceHistoryStore } from '../../src/audio/voiceHistoryStore';
import { VOICE_RULEBOOK } from '../../src/audio/voiceRulebook';

describe('VoiceSelector', () => {
  it('deterministically selects candidates for the same seed', () => {
    const result1 = selectVoiceScript({ mechanic: 'MOST_EXPENSIVE', seed: 12345 });
    const result2 = selectVoiceScript({ mechanic: 'MOST_EXPENSIVE', seed: 12345 });
    expect(result1.script).toBe(result2.script);
    expect(result1.intent).toBe(result2.intent);
    expect(result1.templateId).toBe(result2.templateId);
    expect(result1.visualDependency).toBe('MEDIUM');
  });

  it('switches candidates when shared history penalizes repetition', () => {
    const history = new VoiceHistoryStore();
    const result1 = selectVoiceScript({ mechanic: 'MOST_EXPENSIVE', seed: 12345, history });
    const result2 = selectVoiceScript({ mechanic: 'MOST_EXPENSIVE', seed: 12345, history });
    // result2 should not repeat result1 because result1 was recorded
    expect(result2.templateId).not.toBe(result1.templateId);
  });

  it('rejects candidates tripping static anti-spoiler filters', () => {
    const history = new VoiceHistoryStore();
    const custom = [
      { id: 'bad_01', intent: 'CHALLENGE' as const, script: 'Kết quả là món bên trái đắt nhất' },
      { id: 'good_01', intent: 'CHALLENGE' as const, script: 'Món nào đắt nhất?' },
    ];
    const res = selectVoiceScript({
      mechanic: 'MOST_EXPENSIVE',
      seed: 999,
      history,
      customCandidates: custom,
    });
    expect(res.templateId).toBe('good_01');
  });

  it('calculates multi-dimensional ScriptQualityScore properly', () => {
    const history = new VoiceHistoryStore();
    const rule = VOICE_RULEBOOK.HI_LO;
    const cand = { id: 'test_01', intent: 'CHALLENGE' as const, script: 'Cao hay thấp?' };
    const score = calculateScriptQualityScore(cand, rule, history);
    expect(score.mechanicFit).toBe(25);
    expect(score.antiSpoilerPassed).toBe(true);
    expect(score.total).toBeGreaterThanOrEqual(80);
  });
});
