/**
 * Regression guard for narration honesty (FR-9 / AR-7).
 *
 * `ViPiperEngine` used to write a silent WAV unconditionally and report nothing,
 * so a batch of 50 "ready to post" videos had no voice track while every gate
 * stayed green. Synthesis may still degrade offline, but it must now say so
 * with `W_VOICE_SILENT_STUB`, and the warning must reach the caller.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AudioEngine,
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

/** True when the WAV payload is pure digital silence. */
function isSilent(filePath: string): boolean {
  const buffer = readFileSync(filePath);
  return buffer.subarray(44).every((byte) => byte === 0);
}

describe('ViPiperEngine voice fallback', () => {
  it('reports W_VOICE_SILENT_STUB when Piper cannot synthesise', async () => {
    const engine = new ViPiperEngine({ binaryPath: '/nonexistent/piper' });
    const voice = await engine.synthesizeVoice('Cao hơn hay thấp hơn?');

    expect(engine.warnings.map((warning) => warning.code)).toContain(VOICE_STUB_WARNING);
    // The stub stays valid so the pipeline still renders offline …
    expect(voice.duration).toBeGreaterThan(0);
    // … but it is silent, which is exactly what the warning is for.
    expect(isSilent(voice.voiceWavPath)).toBe(true);
  });

  it('surfaces the degraded voice through AudioEngine.synthesize', async () => {
    const engine = new ViPiperEngine({ binaryPath: '/nonexistent/piper' });
    const segment = await new AudioEngine(engine).synthesize(game());

    expect(segment.warnings?.map((warning) => warning.code)).toContain(VOICE_STUB_WARNING);
    expect(segment.warnings?.[0]?.hint).toMatch(/no narration/i);
  });

  it('does not invent a warning when the adapter provides real audio', async () => {
    const segment = await new AudioEngine({
      synthesizeVoice: async () => {
        const engine = new ViPiperEngine({ binaryPath: '/nonexistent/piper' });
        const stub = await engine.synthesizeVoice('x');
        return { voiceWavPath: stub.voiceWavPath, duration: 1.2 };
      },
    }).synthesize(game());

    // A custom adapter exposes no `warnings` field → nothing is reported.
    expect(segment.warnings ?? []).toHaveLength(0);
    expect(segment.duration).toBe(1.2);
  });
});
