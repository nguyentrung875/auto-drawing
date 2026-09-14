/**
 * Audio bed assembly: voice + SFX + music → one WAV that matches the frames.
 *
 * Voice placement comes from `AudioSegment.voiceStartAt` (Epic 3 keeps the voice
 * within ±0.1s of the reveal), SFX cues are copied verbatim from the segment,
 * and music is ducked to the AD-7 level (0.18) so it cannot overpower the voice.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { RENDER_WARNING_CODES } from './errors';
import type { RenderAudioView, RenderWarning } from './types';
import { mixInto, readWav, synthesizeMusicBed, writeWav } from './wav';

export const AUDIO_BED_SAMPLE_RATE = 44_100;

export interface AudioBedRequest {
  audio: RenderAudioView;
  totalDuration: number;
  rootDir: string;
  outputPath: string;
  sampleRate?: number;
}

export interface AudioBedResult {
  wavPath: string;
  durationMs: number;
  sampleRate: number;
  peak: number;
  warnings: RenderWarning[];
}

const VOICE_GAIN = 1;
const SFX_GAIN = 0.85;
const COUNTDOWN_GAIN = 0.5;

/** Build the mixed WAV at `outputPath`; returns its peak level for diagnostics. */
export function buildAudioBed(request: AudioBedRequest): AudioBedResult {
  const started = performance.now();
  const sampleRate = request.sampleRate ?? AUDIO_BED_SAMPLE_RATE;
  const warnings: RenderWarning[] = [];
  const totalFrames = Math.max(1, Math.round((request.totalDuration + 0.4) * sampleRate));
  const bed = new Float32Array(totalFrames);

  const voice = readWav(request.audio.voiceWavPath);
  mixInto(
    bed,
    voice.samples[0]!,
    voice.sampleRate,
    sampleRate,
    Math.max(0, request.audio.voiceStartAt),
    VOICE_GAIN,
  );

  for (const cue of request.audio.sfxCues) {
    if (!existsSync(cue.assetPath)) {
      warnings.push({
        code: 'E_AUDIO_OUTPUT_MISSING',
        hint: `SFX '${cue.type}' asset missing at ${cue.assetPath}`,
      });
      continue;
    }
    const sfx = readWav(cue.assetPath);
    mixInto(
      bed,
      sfx.samples[0]!,
      sfx.sampleRate,
      sampleRate,
      Math.max(0, cue.at),
      cue.type === 'countdown' || cue.type === 'tick' ? COUNTDOWN_GAIN : SFX_GAIN,
    );
  }

  const musicPath = path.join(
    request.rootDir,
    'assets',
    'music',
    `${request.audio.music.track}.wav`,
  );
  const musicGain = request.audio.music.volume ?? 0.18;
  if (existsSync(musicPath)) {
    const music = readWav(musicPath);
    const loopLength = Math.max(0.5, music.duration);
    let offset = 0;
    while (offset < request.totalDuration) {
      mixInto(bed, music.samples[0]!, music.sampleRate, sampleRate, offset, musicGain);
      offset += loopLength;
    }
  } else {
    const track = synthesizeMusicBed(request.totalDuration + 0.4, sampleRate, request.audio.music.track, musicGain);
    for (let i = 0; i < bed.length; i += 1) bed[i] += track[i]!;
    warnings.push({
      code: RENDER_WARNING_CODES.MUSIC_MISSING,
      hint: `assets/music/${request.audio.music.track}.wav not found — a deterministic local bed was synthesised at volume ${musicGain}`,
    });
  }

  // Soft limiter: scale down rather than clip when the mix peaks above full scale.
  let peak = 0;
  for (let i = 0; i < bed.length; i += 1) {
    const magnitude = Math.abs(bed[i]!);
    if (magnitude > peak) peak = magnitude;
  }
  if (peak > 0.99) {
    const scale = 0.99 / peak;
    for (let i = 0; i < bed.length; i += 1) bed[i] *= scale;
    peak = 0.99;
  }

  mkdirSync(path.dirname(request.outputPath), { recursive: true });
  writeFileSync(request.outputPath, writeWav(bed, sampleRate));
  return {
    wavPath: request.outputPath,
    durationMs: Number((performance.now() - started).toFixed(2)),
    sampleRate,
    peak: Number(peak.toFixed(4)),
    warnings,
  };
}
