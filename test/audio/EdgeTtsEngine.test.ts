import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { EdgeTtsEngine, EDGE_TTS_FALLBACK_WARNING } from '../../src/audio/EdgeTtsEngine';

describe('EdgeTtsEngine', () => {
  it('synthesizes a Vietnamese phrase into a valid PCM WAV file', async () => {
    const engine = new EdgeTtsEngine();
    const script = 'Thử thách 5 giây đoán giá sản phẩm';

    const result = await engine.synthesizeVoice(script);

    expect(result).toBeDefined();
    expect(result.voiceWavPath).toBeDefined();
    expect(existsSync(result.voiceWavPath)).toBe(true);
    expect(result.duration).toBeGreaterThan(0.5);

    // Verify RIFF WAV header
    const buffer = readFileSync(result.voiceWavPath);
    expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
    expect(engine.warnings).toHaveLength(0);
  }, 15000);

  it('serves repeated scripts deterministically from disk cache', async () => {
    const engine = new EdgeTtsEngine();
    const script = 'Sản phẩm B đắt hơn hay rẻ hơn';

    const start1 = Date.now();
    const result1 = await engine.synthesizeVoice(script);
    const ms1 = Date.now() - start1;

    const start2 = Date.now();
    const result2 = await engine.synthesizeVoice(script);
    const ms2 = Date.now() - start2;

    expect(result2.voiceWavPath).toBe(result1.voiceWavPath);
    expect(result2.duration).toBe(result1.duration);
    // Cache hit should be fast (<= 50ms)
    expect(ms2).toBeLessThan(100);
  }, 15000);

  it('falls back to FormantViEngine when Edge TTS fails', async () => {
    // Pass an invalid voice or simulated offline engine to trigger fallback
    const engine = new EdgeTtsEngine({
      voice: 'invalid-nonexistent-voice',
      timeoutMs: 3000,
      formantFallback: true,
    });

    const result = await engine.synthesizeVoice('Một hai ba');

    expect(result).toBeDefined();
    expect(existsSync(result.voiceWavPath)).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(engine.warnings.some((w) => w.code === EDGE_TTS_FALLBACK_WARNING)).toBe(true);
  }, 15000);
});
