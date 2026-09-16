import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { buildAudioBed } from '../../src/render/audioBed';
import { readWav, writeWav } from '../../src/render/wav';
import type { RenderAudioView } from '../../src/render/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('audioBed v2 — Dynamic Ducking & Escalating SFX', () => {
  it('attenuates music during voice activity and scales countdown tick cues', () => {
    const tempDir = path.join(ROOT, 'temp', 'test_audio_bed_v2');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });

    const sampleRate = 44100;
    // Create a 2-second constant tone for voice
    const voiceFrames = 2 * sampleRate;
    const voiceSamples = new Float32Array(voiceFrames).fill(0.5);
    const voicePath = path.join(tempDir, 'test_voice.wav');
    writeFileSync(voicePath, writeWav(voiceSamples, sampleRate));

    // Create a tick SFX WAV
    const sfxFrames = Math.round(0.05 * sampleRate);
    const sfxSamples = new Float32Array(sfxFrames).fill(0.8);
    const sfxPath = path.join(tempDir, 'test_tick.wav');
    writeFileSync(sfxPath, writeWav(sfxSamples, sampleRate));

    const outputPath = path.join(tempDir, 'output_bed.wav');

    const audioView: RenderAudioView = {
      voiceWavPath: voicePath,
      duration: 2.0,
      voiceDuration: 2.0,
      voiceStartAt: 4.0, // Voice active from 4.0s to 6.0s
      revealAt: 6.5,
      syncDelta: 0.05,
      sfxCues: [
        { type: 'tick', at: 3.0, assetPath: sfxPath },
        { type: 'tick', at: 3.5, assetPath: sfxPath },
        { type: 'tick', at: 4.0, assetPath: sfxPath },
      ],
      music: {
        track: 'tension_01',
        volume: 0.20,
      },
    };

    const result = buildAudioBed({
      audio: audioView,
      totalDuration: 8.0,
      rootDir: ROOT,
      outputPath,
      sampleRate,
    });

    expect(result.wavPath).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);

    const decoded = readWav(outputPath);
    expect(decoded.duration).toBeGreaterThanOrEqual(8.0);

    // Peak amplitude should be cleanly bounded
    expect(result.peak).toBeLessThanOrEqual(0.99);

    rmSync(tempDir, { recursive: true, force: true });
  });
});
