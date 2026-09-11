import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { AudioEngine, AudioError, ViPiperEngine, type VoiceResult } from '../../src/audio';
import { MechanicRegistry } from '../../src/game';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p042 = product('p042', 2490000);

function game() {
  return MechanicRegistry.get('HI_LO').create({
    products: [p001, p042],
    seed: 839271,
  }).game;
}

describe('AudioEngine', () => {
  it('creates a deterministic offline WAV and six half-second countdown cues', async () => {
    const result = await new AudioEngine().synthesize(game());
    expect(existsSync(result.voiceWavPath)).toBe(true);
    expect(result.duration).toBeLessThan(2);
    expect(result.sfxCues.filter((cue) => cue.type === 'countdown')).toHaveLength(6);
    expect(result.music).toEqual({ track: 'tension_01', volume: 0.18 });
    expect(result.syncDelta).toBeLessThanOrEqual(0.1);
  });

  it('uses the adapter contract without changing the Game Engine', async () => {
    const voice: VoiceResult = { voiceWavPath: '/tmp/mock-voice.wav', duration: 1.2 };
    const synthesizeVoice = vi.fn(async () => voice);
    const result = await new AudioEngine({ synthesizeVoice }).synthesize(game());
    expect(synthesizeVoice).toHaveBeenCalledOnce();
    expect(result.voiceWavPath).toBe(voice.voiceWavPath);
    expect(result.duration).toBe(1.2);
  });

  it('fails early when the countdown cue is absent', async () => {
    const broken = game();
    broken.audio.sfx = [{ type: 'reveal', at: 11 }];
    await expect(new AudioEngine(new ViPiperEngine()).synthesize(broken)).rejects.toMatchObject({
      code: 'E_AUDIO_MISSING_SFX',
    } satisfies Partial<AudioError>);
  });
});
