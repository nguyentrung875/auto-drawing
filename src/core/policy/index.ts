import type { DiversityPolicy, AudioPolicy, AudioMixPolicy, LayoutPolicy } from './types';
export * from './types';

export const DEFAULT_DIVERSITY_POLICY: DiversityPolicy = {
  cooldownProductTuple: 50,
  cooldownHeroSku: 10,
  maxConsecutiveSameAnswer: 3,
  targetAnswerRatio: 0.5,
  answerRatioTolerance: 0.05,
};

export const DEFAULT_AUDIO_POLICY: AudioPolicy = {
  targetLufs: -14.0,
  lufsTolerance: 2.0,
  maxTruePeakDbTp: -1.0,
  maxSilenceDurationSec: 1.2,
  duckingRatio: 0.3,
};

export const DEFAULT_AUDIO_MIX_POLICY: AudioMixPolicy = {
  targetLufs: -14.0,
  lufsTolerance: 1.5,
  maxTruePeakDbTp: -1.0,
  maxLra: 12.0,
  maxSilenceDurationSec: 1.2,
  voiceDuckDb: -8.0,
  duckAttackMs: 150,
  duckReleaseMs: 300,
};

export const DEFAULT_LAYOUT_POLICY: LayoutPolicy = {
  safeZoneTop: 150,
  safeZoneBottom: 1480,
  cardMaxWidth: 400,
  gutter: 60,
};

export function validateDiversityPolicy(policy: DiversityPolicy): void {
  if (policy.cooldownProductTuple < 0 || policy.cooldownHeroSku < 0) {
    throw new Error('Cooldowns must be non-negative');
  }
  if (policy.targetAnswerRatio <= 0 || policy.targetAnswerRatio >= 1) {
    throw new Error('targetAnswerRatio must be between 0 and 1');
  }
}
