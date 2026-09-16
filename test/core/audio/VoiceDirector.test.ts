import { describe, it, expect } from 'vitest';
import { VoiceDirector } from '../../../src/core/audio/VoiceDirector';
import { DEFAULT_AUDIO_MIX_POLICY } from '../../../src/core/policy';

describe('VoiceDirector', () => {
  it('exports correct ducking filter parameters based on AudioMixPolicy', () => {
    const director = new VoiceDirector(DEFAULT_AUDIO_MIX_POLICY);
    const filter = director.buildDuckingFilter('[voice]', '[bgm]');
    expect(filter).toContain('sidechaincompress');
    expect(filter).toContain('ratio=');
  });

  it('allocates speech audio duration and buffer padding correctly', () => {
    const director = new VoiceDirector(DEFAULT_AUDIO_MIX_POLICY);
    const slot = director.computeSpeechSlot(2.45);
    // 2.45s voice + 0.3s breathing buffer = 2.75s
    expect(slot.totalSlotDurationSec).toBe(2.75);
    expect(slot.bufferSec).toBe(0.3);
  });
});
