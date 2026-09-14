import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { FormantViEngine } from './FormantViEngine';
import type { IAudioEngine, VoiceOptions, VoiceResult } from './AudioEngine';

export const EDGE_TTS_FALLBACK_WARNING = 'W_VOICE_EDGE_FALLBACK';
export const EDGE_DEFAULT_VOICE = 'vi-VN-HoaiMyNeural';

export interface EdgeTtsOptions {
  /** Voice model name. Defaults to 'vi-VN-HoaiMyNeural'. */
  voice?: string;
  /** Speaking rate string, e.g. '+0%', '+10%'. Defaults to '+0%'. */
  rate?: string;
  /** Pitch adjustment, e.g. '+0Hz'. Defaults to '+0Hz'. */
  pitch?: string;
  /** Volume adjustment, e.g. '+0%'. Defaults to '+0%'. */
  volume?: string;
  /** Cache directory for synthesized WAV files. */
  cacheDir?: string;
  /** Network timeout in milliseconds. Defaults to 10,000ms. */
  timeoutMs?: number;
  /** Target duration ceiling in seconds (e.g. 1.9s for Single Round FR-9). */
  maxDuration?: number;
  /** Fall back to FormantViEngine when Edge TTS fails. Defaults to true. */
  formantFallback?: boolean;
}

/** Duration in seconds of a RIFF/WAVE file, or null when unreadable. */
function wavDuration(filePath: string): number | null {
  try {
    const buffer = readFileSync(filePath);
    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
    const byteRate = buffer.readUInt32LE(28);
    if (byteRate <= 0) return null;
    let offset = 12;
    while (offset + 8 <= buffer.length) {
      const id = buffer.toString('ascii', offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      if (id === 'data') return size / byteRate;
      offset += 8 + size + (size % 2);
    }
    return null;
  } catch {
    return null;
  }
}

function buildAtempoFilter(factor: number): string {
  const filters: string[] = [];
  let remaining = factor;
  while (remaining > 2.0) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${Number(remaining.toFixed(3))}`);
  return filters.join(',');
}

function safeScript(script: string): string {
  return script.trim().replace(/\s+/g, ' ');
}

export class EdgeTtsEngine implements IAudioEngine {
  readonly warnings: Array<{ code: string; hint: string }> = [];
  private readonly options: EdgeTtsOptions;

  constructor(options: EdgeTtsOptions = {}) {
    this.options = options;
  }

  async synthesizeVoice(script: string, voiceOptions?: VoiceOptions): Promise<VoiceResult> {
    this.warnings.length = 0;
    const normalized = safeScript(script);
    const voice = this.options.voice ?? process.env.EDGE_TTS_VOICE ?? EDGE_DEFAULT_VOICE;
    const rate = this.options.rate ?? '+0%';
    const pitch = this.options.pitch ?? '+0Hz';
    const volume = this.options.volume ?? '+0%';
    const timeoutMs = this.options.timeoutMs ?? 10_000;

    const cacheDir =
      this.options.cacheDir ?? path.join(os.tmpdir(), 'auto-drawing-audio');
    mkdirSync(cacheDir, { recursive: true });

    const maxDur = voiceOptions?.targetDuration ?? this.options.maxDuration;
    const digest = createHash('sha256')
      .update(`${voice}:${rate}:${pitch}:${volume}:${maxDur ?? 'none'}:${normalized}`, 'utf8')
      .digest('hex')
      .slice(0, 16);

    const voiceWavPath = path.join(cacheDir, `voice-edge-${digest}.wav`);

    // 1. Cache hit check
    if (existsSync(voiceWavPath)) {
      try {
        const stats = statSync(voiceWavPath);
        if (stats.size > 44) {
          const duration = wavDuration(voiceWavPath);
          if (duration !== null && duration > 0) {
            return { voiceWavPath, duration: Number(duration.toFixed(3)) };
          }
        }
      } catch {
        // Fall through to synthesis if cache file is unreadable
      }
    }

    // 2. Synthesize with MsEdgeTTS via WebSocket stream converted to PCM WAV via FFmpeg
    let tts: MsEdgeTTS | null = null;
    try {
      tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const synthesizePromise = new Promise<void>((resolve, reject) => {
        const { audioStream } = tts!.toStream(normalized, {
          rate,
          pitch,
          volume,
        });

        const ff = spawn('ffmpeg', [
          '-y',
          '-v',
          'error',
          '-i',
          'pipe:0',
          '-ac',
          '1',
          '-ar',
          '24000',
          voiceWavPath,
        ]);

        audioStream.pipe(ff.stdin);

        audioStream.once('error', (err) => {
          try {
            ff.kill();
          } catch {}
          try {
            if (existsSync(voiceWavPath)) unlinkSync(voiceWavPath);
          } catch {}
          reject(err);
        });

        ff.stdin.on('error', (err) => {
          reject(err);
        });

        ff.once('close', (code) => {
          if (code === 0 && existsSync(voiceWavPath)) {
            resolve();
          } else {
            try {
              if (existsSync(voiceWavPath)) unlinkSync(voiceWavPath);
            } catch {}
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });

        ff.once('error', (err) => {
          try {
            if (existsSync(voiceWavPath)) unlinkSync(voiceWavPath);
          } catch {}
          reject(err);
        });
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Edge-TTS timeout after ${timeoutMs}ms`)), timeoutMs),
      );

      await Promise.race([synthesizePromise, timeoutPromise]);

      if (existsSync(voiceWavPath)) {
        let duration = wavDuration(voiceWavPath);
        if (duration !== null && duration > 0) {
          if (typeof maxDur === 'number' && maxDur > 0 && duration > maxDur) {
            const tempo = (duration / maxDur) * 1.05;
            if (tempo > 1.0) {
              const tempoWavPath = `${voiceWavPath}.tempo.wav`;
              const tempoProcess = spawn('ffmpeg', [
                '-y',
                '-v',
                'error',
                '-i',
                voiceWavPath,
                '-filter:a',
                buildAtempoFilter(tempo),
                '-ac',
                '1',
                '-ar',
                '24000',
                tempoWavPath,
              ]);
              await new Promise<void>((resolve, reject) => {
                tempoProcess.once('close', (code) => {
                  if (code === 0 && existsSync(tempoWavPath)) {
                    copyFileSync(tempoWavPath, voiceWavPath);
                    try {
                      unlinkSync(tempoWavPath);
                    } catch {}
                    resolve();
                  } else {
                    reject(new Error(`atempo ffmpeg exited with ${code}`));
                  }
                });
                tempoProcess.once('error', reject);
              });
              duration = wavDuration(voiceWavPath) ?? duration;
            }
          }
          return { voiceWavPath, duration: Number(duration.toFixed(3)) };
        }
      }
      throw new Error('Synthesized WAV file is empty or corrupted');
    } catch (error) {
      this.warnings.push({
        code: EDGE_TTS_FALLBACK_WARNING,
        hint: `Edge-TTS synthesis failed (${String(error)}); falling back to Formant voice`,
      });
    } finally {
      try {
        tts?.close();
      } catch {}
    }

    // 3. Fallback: Formant voice
    if (this.options.formantFallback !== false) {
      try {
        return await new FormantViEngine().synthesizeVoice(normalized);
      } catch {
        // Fall through to silent placeholder
      }
    }

    // 4. Silent fallback
    const duration = Math.min(1.9, Math.max(0.35, normalized.length / 90));
    return { voiceWavPath, duration };
  }
}
