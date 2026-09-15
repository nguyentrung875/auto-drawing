export type { AudioSegment, IAudioEngine, MusicTrack, SfxCue, VoiceOptions, VoiceResult } from './AudioEngine';
export { AudioError } from './AudioEngine';
export type { MechanicVoiceRule } from './voiceRulebook';

export type VoiceMode = 'SPOKEN' | 'SILENT';

export type VoiceIntent =
  | 'CHALLENGE'
  | 'CURIOSITY'
  | 'URGENCY'
  | 'DECISION';

export type VisualDependency = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VoiceCandidate {
  id: string;
  intent: VoiceIntent;
  script: string;
}

export interface VoiceMetadata {
  script: string;
  intent: VoiceIntent;
  templateId: string;
  visualDependency: VisualDependency;
}

export interface VoiceTimingConfig {
  defaultGapMs: number;
  minGapMs: number;
  maxGapMs: number;
  maxDurationSec: number;
}

export interface ScriptQualityScore {
  mechanicFit: number;        // 0-25
  naturalness: number;        // 0-20
  brevity: number;            // 0-15
  challengeStrength: number;  // 0-15
  novelty: number;            // 0-15
  commentPotential: number;   // 0-10
  total: number;              // 0-100
  antiSpoilerPassed: boolean;
}

export interface AudioRuntimeScore {
  score: number;              // 0-100
  actualDuration: number;
  actualRevealGapMs: number;
  gapErrorMs: number;
  collisionDetected: boolean;
  pass: boolean;
}
