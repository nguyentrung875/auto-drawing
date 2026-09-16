import type { AudioMixPolicy } from '../policy/types';

export interface SpeechSlot {
  voiceDurationSec: number;
  bufferSec: number;
  totalSlotDurationSec: number;
}

export class VoiceDirector {
  constructor(private readonly policy: AudioMixPolicy) {}

  computeSpeechSlot(voiceDurationSec: number, bufferSec = 0.3): SpeechSlot {
    return {
      voiceDurationSec,
      bufferSec,
      totalSlotDurationSec: Number((voiceDurationSec + bufferSec).toFixed(3)),
    };
  }

  buildDuckingFilter(voiceInputTag: string, bgmInputTag: string): string {
    const ratio = Math.pow(10, Math.abs(this.policy.voiceDuckDb) / 20).toFixed(1);
    const attack = this.policy.duckAttackMs;
    const release = this.policy.duckReleaseMs;
    return `${bgmInputTag}${voiceInputTag}sidechaincompress=threshold=0.03:ratio=${ratio}:attack=${attack}:release=${release}`;
  }
}
