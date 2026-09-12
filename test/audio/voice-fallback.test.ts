/**
 * Regression guard for narration honesty (FR-9 / AR-7).
 *
 * `ViPiperEngine` used to write a silent WAV unconditionally and report nothing,
 * so a batch of 50 "ready to post" videos had no voice track while every gate
 * stayed green. The adapter now degrades in ordered steps — Piper → built-in
 * Vietnamese formant voice → silence — and every step below Piper is reported.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AudioEngine,
  FormantViEngine,
  VOICE_FORMANT_WARNING,
  VOICE_STUB_WARNING,
  ViPiperEngine,
} from '../../src/audio';
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

/** Count non-zero PCM frames — the difference between speech and silence. */
function audibleFrames(filePath: string): number {
  const data = readFileSync(filePath).subarray(44);
  let count = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    if (data.readInt16LE(i) !== 0) count += 1;
  }
  return count;
}

describe('ViPiperEngine voice fallback chain', () => {
  it('falls back to an AUDIBLE formant voice when Piper is unavailable', async () => {
    const engine = new ViPiperEngine({ binaryPath: '/nonexistent/piper' });
    const voice = await engine.synthesizeVoice('Cao hơn hay thấp hơn?');

    expect(engine.warnings.map((warning) => warning.code)).toContain(VOICE_FORMANT_WARNING);
    // The whole point of the fallback: this must not be silence.
    expect(audibleFrames(voice.voiceWavPath)).toBeGreaterThan(1000);
    expect(voice.duration).toBeGreaterThan(0);
    expect(voice.duration).toBeLessThan(2);
  });

  it('only reports the silent stub when the formant voice is disabled', async () => {
    const engine = new ViPiperEngine({
      binaryPath: '/nonexistent/piper',
      formantFallback: false,
    });
    const voice = await engine.synthesizeVoice('Cao hơn hay thấp hơn?');

    expect(engine.warnings.map((warning) => warning.code)).toContain(VOICE_STUB_WARNING);
    expect(audibleFrames(voice.voiceWavPath)).toBe(0);
  });

  it('surfaces the degraded voice through AudioEngine.synthesize', async () => {
    const engine = new ViPiperEngine({ binaryPath: '/nonexistent/piper' });
    const segment = await new AudioEngine(engine).synthesize(game());

    expect(segment.warnings?.map((warning) => warning.code)).toContain(VOICE_FORMANT_WARNING);
    expect(audibleFrames(segment.voiceWavPath)).toBeGreaterThan(1000);
  });

  it('does not invent a warning when the adapter provides its own audio', async () => {
    const segment = await new AudioEngine({
      synthesizeVoice: async () => {
        const voice = await new FormantViEngine().synthesizeVoice('xin chào');
        return { voiceWavPath: voice.voiceWavPath, duration: 1.2 };
      },
    }).synthesize(game());

    expect(segment.warnings ?? []).toHaveLength(0);
    expect(segment.duration).toBe(1.2);
  });
});

describe('FormantViEngine', () => {
  it('is deterministic — the same script yields byte-identical audio', () => {
    const engine = new FormantViEngine();
    const a = engine.synthesizeToBuffer('Món nào đắt nhất?');
    const b = engine.synthesizeToBuffer('Món nào đắt nhất?');
    expect(a.buffer.equals(b.buffer)).toBe(true);
    expect(a.duration).toBe(b.duration);
  });

  it('renders different scripts differently and stays under the 2s budget', () => {
    const engine = new FormantViEngine();
    const short = engine.synthesizeToBuffer('Cao hơn');
    const long = engine.synthesizeToBuffer(
      'Nồi cơm điện một triệu bốn trăm chín mươi nghìn đồng, đắt nhất trong ba món',
    );
    expect(short.buffer.equals(long.buffer)).toBe(false);
    expect(long.duration).toBeLessThan(2);
    expect(short.duration).toBeGreaterThan(0);
  });

  it('distinguishes Vietnamese tones — the same syllable differs by diacritic', () => {
    const engine = new FormantViEngine();
    const level = engine.synthesizeToBuffer('ma');
    const falling = engine.synthesizeToBuffer('mà');
    const rising = engine.synthesizeToBuffer('má');
    expect(level.buffer.equals(falling.buffer)).toBe(false);
    expect(falling.buffer.equals(rising.buffer)).toBe(false);
  });

  it('never emits an empty clip, even for a script with no syllables', () => {
    const { buffer, duration } = new FormantViEngine().synthesizeToBuffer('!!! ???');
    expect(duration).toBeGreaterThan(0);
    expect(buffer.length).toBeGreaterThan(44);
  });
});
