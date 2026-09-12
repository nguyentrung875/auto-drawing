import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GameJson, Timeline } from '../types/game';

export interface VoiceOptions {
  language?: string;
  revealAt?: number;
  targetDuration?: number;
}

export interface VoiceResult {
  voiceWavPath: string;
  duration: number;
}

export interface SfxCue {
  type: string;
  at: number;
  assetPath: string;
}

export interface MusicTrack {
  track: string;
  volume: number;
}

export interface AudioSegment {
  voiceWavPath: string;
  /** Voice duration in seconds. */
  duration: number;
  voiceDuration: number;
  voiceStartAt: number;
  revealAt: number;
  syncDelta: number;
  sfxCues: SfxCue[];
  music: MusicTrack;
}

export interface IAudioEngine {
  synthesizeVoice(script: string, options?: VoiceOptions): Promise<VoiceResult>;
}

export class AudioError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly hint?: string;

  constructor(code: string, field?: string, hint?: string) {
    super([code, field && `at ${field}`, hint].filter(Boolean).join(' — '));
    this.name = 'AudioError';
    this.code = code;
    this.field = field;
    this.hint = hint;
  }

  toJSON(): { code: string; field?: string; hint?: string } {
    return { code: this.code, field: this.field, hint: this.hint };
  }
}

const DURATIONS: Record<string, number> = {
  hook: 2,
  product: 3,
  question: 3,
  countdown: 3,
  reveal: 2,
  result: 2,
  cta: 3,
};

function revealStart(game: GameJson, timeline?: Timeline): number {
  const fromTimeline = timeline?.slots.find((slot) => slot.type === 'reveal')?.start;
  if (fromTimeline !== undefined) return fromTimeline;
  let cursor = 0;
  for (const scene of game.scenes) {
    if (scene === 'reveal') return cursor;
    cursor += DURATIONS[scene] ?? 0;
  }
  return cursor;
}

function countdownStart(game: GameJson, timeline?: Timeline): number {
  const fromTimeline = timeline?.slots.find((slot) => slot.type === 'countdown')?.start;
  if (fromTimeline !== undefined) return fromTimeline;
  let cursor = 0;
  for (const scene of game.scenes) {
    if (scene === 'countdown') return cursor;
    cursor += DURATIONS[scene] ?? 0;
  }
  return cursor;
}

function wavSilence(duration: number, sampleRate = 16_000): Buffer {
  const frames = Math.max(1, Math.round(duration * sampleRate));
  const dataSize = frames * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function safeScript(script: string): string {
  return script.trim().replace(/\s+/g, ' ');
}

/** Offline adapter. It produces a valid deterministic WAV when Piper is not installed. */
export class ViPiperEngine implements IAudioEngine {
  async synthesizeVoice(script: string): Promise<VoiceResult> {
    const normalized = safeScript(script);
    const digest = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
    const duration = Math.min(1.9, Math.max(0.35, normalized.length / 90));
    const directory = path.join(os.tmpdir(), 'auto-drawing-audio');
    mkdirSync(directory, { recursive: true });
    const voiceWavPath = path.join(directory, `voice-${digest}.wav`);
    if (!existsSync(voiceWavPath)) {
      writeFileSync(voiceWavPath, wavSilence(duration));
    }
    return { voiceWavPath, duration };
  }

  async synthesize(game: GameJson, timeline?: Timeline): Promise<AudioSegment> {
    return new AudioEngine(this).synthesize(game, timeline);
  }
}

function sfxAsset(type: string): string {
  if (/^[a-z0-9_-]+$/i.test(type)) {
    const bundledPath = path.resolve('assets', 'sfx', `${type}.wav`);
    if (existsSync(bundledPath) && statSync(bundledPath).isFile()) return bundledPath;
  }

  // Development fallback: keep every cue playable even when binary assets are
  // not checked out. The hash also prevents an authored cue type becoming a path.
  const digest = createHash('sha256').update(type, 'utf8').digest('hex').slice(0, 16);
  const directory = path.join(os.tmpdir(), 'auto-drawing-audio');
  mkdirSync(directory, { recursive: true });
  const stubPath = path.join(directory, `sfx-${digest}.wav`);
  if (!existsSync(stubPath)) writeFileSync(stubPath, wavSilence(0.1));
  return stubPath;
}

function makeCountdownCues(start: number): SfxCue[] {
  const assetPath = sfxAsset('countdown');
  return Array.from({ length: 6 }, (_, index) => ({
    type: 'countdown',
    at: Number((start + index * 0.5).toFixed(3)),
    assetPath,
  }));
}

function configuredCues(game: GameJson): SfxCue[] {
  return (game.audio.sfx ?? [])
    .filter((cue) => cue.type !== 'countdown' && cue.type !== 'tick')
    .map((cue) => ({
      type: cue.type,
      at: cue.at,
      assetPath: sfxAsset(cue.type),
    }));
}

export class AudioEngine {
  readonly adapter: IAudioEngine;

  static synthesize(game: GameJson, timeline?: Timeline): Promise<AudioSegment> {
    return new AudioEngine().synthesize(game, timeline);
  }

  constructor(adapter: IAudioEngine = new ViPiperEngine()) {
    this.adapter = adapter;
  }

  async synthesize(game: GameJson, timeline?: Timeline): Promise<AudioSegment> {
    const configuredSfx = game.audio?.sfx ?? [];
    if (!configuredSfx.some((cue) => cue.type === 'countdown' || cue.type === 'tick')) {
      throw new AudioError(
        'E_AUDIO_MISSING_SFX',
        'audio.sfx',
        'countdown SFX is required for the CountdownScene',
      );
    }

    const revealAt = revealStart(game, timeline);
    const countdownAt = countdownStart(game, timeline);
    const script = game.audio?.voice?.script || game.content.voice_script;
    const voice = await this.adapter.synthesizeVoice(script, {
      language: game.metadata.language ?? 'vi-VN',
      revealAt,
      targetDuration: 1.9,
    });
    if (!Number.isFinite(voice.duration) || voice.duration <= 0 || voice.duration >= 2) {
      throw new AudioError(
        'E_AUDIO_DURATION_INVALID',
        'audio.voice',
        `voice duration must be finite, positive, and <2s; received ${voice.duration}`,
      );
    }
    const duration = Number(voice.duration.toFixed(3));
    if (duration >= 2) {
      throw new AudioError(
        'E_AUDIO_DURATION_INVALID',
        'audio.voice',
        `voice duration rounds to ${duration}s and must remain <2s`,
      );
    }
    let outputIsFile = false;
    try {
      outputIsFile = Boolean(voice.voiceWavPath) && statSync(voice.voiceWavPath).isFile();
    } catch {
      outputIsFile = false;
    }
    if (!outputIsFile) {
      throw new AudioError(
        'E_AUDIO_OUTPUT_MISSING',
        'audio.voice',
        `voice WAV is not a regular file at '${voice.voiceWavPath}'`,
      );
    }
    const voiceStartAt = Number((revealAt - duration).toFixed(3));
    const syncDelta = Number(Math.abs(voiceStartAt + duration - revealAt).toFixed(3));
    if (syncDelta > 0.1) {
      throw new AudioError(
        'E_AUDIO_SYNC_DRIFT',
        'audio.voice',
        `voice/reveal sync drift ${syncDelta}s exceeds 0.1s`,
      );
    }

    return {
      voiceWavPath: voice.voiceWavPath,
      duration,
      voiceDuration: duration,
      voiceStartAt,
      revealAt,
      syncDelta,
      sfxCues: [...makeCountdownCues(countdownAt), ...configuredCues(game)],
      music: {
        track: game.audio?.music?.track ?? 'tension_01',
        // FR-9 fixes the mix level so music cannot overpower narration.
        volume: 0.18,
      },
    };
  }
}

export async function synthesizeAudio(
  game: GameJson,
  adapter: IAudioEngine = new ViPiperEngine(),
  timeline?: Timeline,
): Promise<AudioSegment> {
  return new AudioEngine(adapter).synthesize(game, timeline);
}
