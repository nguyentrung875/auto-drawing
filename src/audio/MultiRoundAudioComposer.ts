import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { MultiRoundChallenge } from '../challenge/types';
import type { Timeline } from '../types/game';
import { EdgeTtsEngine } from './EdgeTtsEngine';
import type { IAudioEngine, SfxCue } from './AudioEngine';
import { mixInto, readWav, synthesizeMusicBed, writeWav } from '../render/wav';

export interface VoicePlan {
  roundIndex: number;
  startAt: number;
  script: string;
  maxDuration: number;
}

export interface MultiRoundAudioPlan {
  voicePlans: VoicePlan[];
  sfxCues: SfxCue[];
}

export interface MultiRoundAudioOptions {
  rootDir?: string;
  outputPath: string;
  musicTrack?: string;
  musicVolume?: number;
  audioEngine?: IAudioEngine;
}

export interface MultiRoundAudioResult {
  audioPath: string;
  durationMs: number;
  warnings: Array<{ code: string; hint: string }>;
}

function sfxAsset(type: string, rootDir = process.cwd()): string {
  const bundled = path.resolve(rootDir, 'assets', 'sfx', `${type}.wav`);
  if (existsSync(bundled) && statSync(bundled).isFile()) return bundled;

  const digest = createHash('sha256').update(type, 'utf8').digest('hex').slice(0, 16);
  const directory = path.join(os.tmpdir(), 'auto-drawing-audio');
  mkdirSync(directory, { recursive: true });
  const stubPath = path.join(directory, `sfx-${digest}.wav`);
  if (!existsSync(stubPath)) {
    // Generate 0.1s silence WAV fallback
    const sampleRate = 44100;
    const frames = Math.round(0.1 * sampleRate);
    writeFileSync(stubPath, writeWav(new Float32Array(frames), sampleRate));
  }
  return stubPath;
}

export class MultiRoundAudioComposer {
  private readonly engine: IAudioEngine;

  constructor(engine: IAudioEngine = new EdgeTtsEngine()) {
    this.engine = engine;
  }

  planAudio(challenge: MultiRoundChallenge, timeline: Timeline, rootDir = process.cwd()): MultiRoundAudioPlan {
    const voicePlans: VoicePlan[] = [];
    const sfxCues: SfxCue[] = [];

    // 1. Intro transition cue at 0.0s
    sfxCues.push({
      type: 'transition',
      at: 0.0,
      assetPath: sfxAsset('transition', rootDir),
    });

    for (const round of challenge.rounds) {
      const playSlot = timeline.slots.find((s) => s.type === `round_${round.roundIndex}_play`);
      const revealSlot = timeline.slots.find((s) => s.type === `round_${round.roundIndex}_reveal`);
      const microSlot = timeline.slots.find((s) => s.type === `micro_hook_${round.roundIndex}`);

      if (playSlot) {
        // Voice starts 100ms after round begins
        const voiceStartAt = Number((playSlot.start + 0.1).toFixed(3));
        const script = round.question;
        const maxDuration = Math.max(1.5, playSlot.duration - 0.5);

        voicePlans.push({
          roundIndex: round.roundIndex,
          startAt: voiceStartAt,
          script,
          maxDuration,
        });

        // Countdown ticks: 80% regular (0.5s), 20% rush (0.2s)
        const rushThreshold = playSlot.start + playSlot.duration * 0.8;
        const regularStep = 0.5;
        const rushStep = 0.2;

        let t = playSlot.start + 0.5;
        while (t <= rushThreshold + 0.01) {
          sfxCues.push({
            type: 'tick',
            at: Number(t.toFixed(3)),
            assetPath: sfxAsset('tick', rootDir),
          });
          t += regularStep;
        }

        t = rushThreshold + rushStep;
        while (t <= playSlot.end - 0.1) {
          sfxCues.push({
            type: 'tick',
            at: Number(t.toFixed(3)),
            assetPath: sfxAsset('tick', rootDir),
          });
          t += rushStep;
        }
      }

      if (revealSlot) {
        sfxCues.push({
          type: 'reveal',
          at: Number(revealSlot.start.toFixed(3)),
          assetPath: sfxAsset('reveal', rootDir),
        });
      }

      if (microSlot) {
        sfxCues.push({
          type: 'transition',
          at: Number(microSlot.start.toFixed(3)),
          assetPath: sfxAsset('transition', rootDir),
        });
      }
    }

    return { voicePlans, sfxCues };
  }

  async composeAudio(
    challenge: MultiRoundChallenge,
    timeline: Timeline,
    options: MultiRoundAudioOptions,
  ): Promise<MultiRoundAudioResult> {
    const started = performance.now();
    const rootDir = options.rootDir ?? process.cwd();
    const sampleRate = 44_100;
    const warnings: Array<{ code: string; hint: string }> = [];

    const plan = this.planAudio(challenge, timeline, rootDir);
    const totalFrames = Math.max(1, Math.round((timeline.totalDuration + 0.4) * sampleRate));
    const masterBed = new Float32Array(totalFrames);

    // Track voice intervals for auto-ducking
    const voiceIntervals: Array<{ startAt: number; endAt: number }> = [];

    // Synthesize & mix each voice plan
    for (const vp of plan.voicePlans) {
      try {
        const result = await this.engine.synthesizeVoice(vp.script, {
          targetDuration: vp.maxDuration,
        });
        if (existsSync(result.voiceWavPath)) {
          const wav = readWav(result.voiceWavPath);
          mixInto(masterBed, wav.samples[0]!, wav.sampleRate, sampleRate, vp.startAt, 1.0);
          voiceIntervals.push({
            startAt: vp.startAt,
            endAt: vp.startAt + (result.duration || wav.duration),
          });
        }
      } catch (err) {
        warnings.push({
          code: 'W_VOICE_SYNTHESIS_FAILED',
          hint: `Voice synthesis for round ${vp.roundIndex} failed: ${String(err)}`,
        });
      }
    }

    // Mix SFX cues
    const COUNTDOWN_GAINS = [0.30, 0.35, 0.42, 0.50, 0.62, 0.75, 0.90];
    let tickIdx = 0;
    for (const cue of plan.sfxCues) {
      if (existsSync(cue.assetPath)) {
        const sfx = readWav(cue.assetPath);
        let gain = 0.85;
        if (cue.type === 'tick' || cue.type === 'countdown') {
          gain = COUNTDOWN_GAINS[tickIdx % COUNTDOWN_GAINS.length] ?? 0.5;
          tickIdx++;
        } else if (cue.type === 'reveal') {
          gain = 0.95;
        }
        mixInto(masterBed, sfx.samples[0]!, sfx.sampleRate, sampleRate, cue.at, gain);
      }
    }

    // Music track & auto-ducking
    const musicBed = new Float32Array(totalFrames);
    const musicTrack = options.musicTrack ?? 'tension_01';
    const musicGain = options.musicVolume ?? 0.18;
    const musicPath = path.resolve(rootDir, 'assets', 'music', `${musicTrack}.wav`);

    if (existsSync(musicPath)) {
      const music = readWav(musicPath);
      const loopLen = Math.max(0.5, music.duration);
      let offset = 0;
      while (offset < timeline.totalDuration) {
        mixInto(musicBed, music.samples[0]!, music.sampleRate, sampleRate, offset, musicGain);
        offset += loopLen;
      }
    } else {
      const synth = synthesizeMusicBed(timeline.totalDuration + 0.4, sampleRate, musicTrack, musicGain);
      for (let i = 0; i < musicBed.length; i++) musicBed[i] = synth[i] ?? 0;
    }

    // Auto-ducking: 75% attenuation during any active voice interval (floor: 0.25)
    const attackSec = 0.08;
    const releaseSec = 0.20;
    const duckFloor = 0.25;

    for (let i = 0; i < totalFrames; i++) {
      const t = i / sampleRate;
      let multiplier = 1.0;
      for (const interval of voiceIntervals) {
        if (t >= interval.startAt - attackSec && t <= interval.endAt + releaseSec) {
          if (t < interval.startAt) {
            const prog = (t - (interval.startAt - attackSec)) / attackSec;
            multiplier = Math.min(multiplier, 1.0 - prog * (1.0 - duckFloor));
          } else if (t <= interval.endAt) {
            multiplier = Math.min(multiplier, duckFloor);
          } else {
            const prog = (t - interval.endAt) / releaseSec;
            multiplier = Math.min(multiplier, duckFloor + prog * (1.0 - duckFloor));
          }
        }
      }
      masterBed[i] = (masterBed[i] ?? 0) + (musicBed[i] ?? 0) * multiplier;
    }

    // Soft limiter peak normalization
    let peak = 0;
    for (let i = 0; i < masterBed.length; i++) {
      const mag = Math.abs(masterBed[i]!);
      if (mag > peak) peak = mag;
    }
    if (peak > 0.99) {
      const scale = 0.99 / peak;
      for (let i = 0; i < masterBed.length; i++) masterBed[i]! *= scale;
    }

    mkdirSync(path.dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, writeWav(masterBed, sampleRate));

    return {
      audioPath: options.outputPath,
      durationMs: Number((performance.now() - started).toFixed(2)),
      warnings,
    };
  }
}
