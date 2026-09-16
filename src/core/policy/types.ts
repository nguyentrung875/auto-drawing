export interface DiversityPolicy {
  cooldownProductTuple: number;
  cooldownHeroSku: number;
  maxConsecutiveSameAnswer: number;
  targetAnswerRatio: number;
  answerRatioTolerance: number;
}

export interface AudioPolicy {
  targetLufs: number;
  lufsTolerance: number;
  maxTruePeakDbTp: number;
  maxSilenceDurationSec: number;
  duckingRatio: number;
}

export interface AudioMixPolicy {
  targetLufs: number;
  lufsTolerance: number;
  maxTruePeakDbTp: number;
  maxLra: number;
  maxSilenceDurationSec: number;
  voiceDuckDb: number;
  duckAttackMs: number;
  duckReleaseMs: number;
}

export interface LayoutPolicy {
  safeZoneTop: number;
  safeZoneBottom: number;
  cardMaxWidth: number;
  gutter: number;
}
