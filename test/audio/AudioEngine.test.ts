import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    expect(result.sfxCues.every((cue) => existsSync(cue.assetPath))).toBe(true);
    expect(result.music).toEqual({ track: 'tension_01', volume: 0.18 });
    expect(result.syncDelta).toBeLessThanOrEqual(0.1);
  });

  it('uses the adapter contract without changing the Game Engine', async () => {
    const voiceWavPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'mock-voice-')), 'voice.wav');
    writeFileSync(voiceWavPath, 'stub');
    const voice: VoiceResult = { voiceWavPath, duration: 1.2 };
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

  it.each([2, 1.9999, Number.NaN, -1])('rejects an invalid adapter duration (%s)', async (duration) => {
    const synthesizeVoice = vi.fn(async () => ({ voiceWavPath: '/unused.wav', duration }));
    await expect(new AudioEngine({ synthesizeVoice }).synthesize(game())).rejects.toMatchObject({
      code: 'E_AUDIO_DURATION_INVALID',
    } satisfies Partial<AudioError>);
  });

  it('rejects a missing adapter output and pins music to the safe mix level', async () => {
    const synthesizeVoice = vi.fn(async () => ({ voiceWavPath: '/missing.wav', duration: 1 }));
    await expect(new AudioEngine({ synthesizeVoice }).synthesize(game())).rejects.toMatchObject({
      code: 'E_AUDIO_OUTPUT_MISSING',
    } satisfies Partial<AudioError>);
    const directoryAdapter = vi.fn(async () => ({ voiceWavPath: os.tmpdir(), duration: 1 }));
    await expect(new AudioEngine({ synthesizeVoice: directoryAdapter }).synthesize(game()))
      .rejects.toMatchObject({ code: 'E_AUDIO_OUTPUT_MISSING' } satisfies Partial<AudioError>);

    const configured = game();
    configured.audio.music = { track: 'custom', volume: 1 };
    const result = await new AudioEngine().synthesize(configured);
    expect(result.music).toEqual({ track: 'custom', volume: 0.18 });
  });
});
