import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DIVERSITY_POLICY,
  DEFAULT_AUDIO_POLICY,
  DEFAULT_LAYOUT_POLICY,
  validateDiversityPolicy,
} from '../../../src/core/policy';

describe('Policy Module', () => {
  it('exports valid default policies', () => {
    expect(DEFAULT_DIVERSITY_POLICY.cooldownProductTuple).toBe(50);
    expect(DEFAULT_AUDIO_POLICY.targetLufs).toBe(-14.0);
    expect(DEFAULT_LAYOUT_POLICY.safeZoneTop).toBe(150);
  });

  it('validates custom diversity policy ranges', () => {
    expect(() => validateDiversityPolicy({ ...DEFAULT_DIVERSITY_POLICY, targetAnswerRatio: 1.5 })).toThrow();
    expect(() => validateDiversityPolicy({ ...DEFAULT_DIVERSITY_POLICY, cooldownProductTuple: -1 })).toThrow();
  });
});
