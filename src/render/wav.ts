/**
 * WAV parsing/synthesis for the audio bed.
 *
 * The frame → MP4 mux needs a single audio track whose timeline matches the
 * frames exactly (voice at `voiceStartAt`, SFX cues, music ducked to 0.18), so
 * the renderer builds it itself instead of shelling out to a filter graph that
 * would need an extra `-shortest` guess.
 */
import { readFileSync } from 'node:fs';

export interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float32Array[];
  duration: number;
}

/** Decode a RIFF/WAVE file (PCM 8/16/32-bit or float32). */
export function readWav(filePath: string): WavData {
  const buffer = readFileSync(filePath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`readWav: '${filePath}' is not a RIFF/WAVE file`);
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let format = 1;
  let data: Buffer | undefined;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = buffer.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') {
      format = body.readUInt16LE(0);
      channels = body.readUInt16LE(2);
      sampleRate = body.readUInt32LE(4);
      bitsPerSample = body.readUInt16LE(14);
    } else if (id === 'data') {
      data = body;
    }
    offset += 8 + size + (size % 2);
  }
  if (!data || channels === 0 || sampleRate === 0) {
    throw new Error(`readWav: '${filePath}' has no fmt/data chunks`);
  }

  const samples: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(0));
  const frames = Math.floor(data.length / (channels * (bitsPerSample / 8)));
  const channelsOut = samples.map(() => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const index = (frame * channels + channel) * (bitsPerSample / 8);
      let value = 0;
      if (format === 3 && bitsPerSample === 32) value = data.readFloatLE(index);
      else if (bitsPerSample === 16) value = data.readInt16LE(index) / 32768;
      else if (bitsPerSample === 8) value = (data.readUInt8(index) - 128) / 128;
      else if (bitsPerSample === 32) value = data.readInt32LE(index) / 2147483648;
      else throw new Error(`readWav: unsupported bit depth ${bitsPerSample}`);
      channelsOut[channel]![frame] = value;
    }
  }
  return {
    sampleRate,
    channels,
    bitsPerSample,
    samples: channelsOut,
    duration: frames / sampleRate,
  };
}

/** Encode float samples as a 16-bit PCM mono WAV. */
export function writeWav(samples: Float32Array, sampleRate: number): Buffer {
  const frames = samples.length;
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
  for (let i = 0; i < frames; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

/** Mix `source` into `target` at `offsetSeconds` with linear resampling. */
export function mixInto(
  target: Float32Array,
  source: Float32Array,
  sourceRate: number,
  targetRate: number,
  offsetSeconds: number,
  gain = 1,
): void {
  const offset = Math.round(offsetSeconds * targetRate);
  const ratio = sourceRate / targetRate;
  for (let i = 0; i < target.length - offset; i += 1) {
    const sourceIndex = i * ratio;
    const index0 = Math.floor(sourceIndex);
    if (index0 >= source.length) break;
    const index1 = Math.min(index0 + 1, source.length - 1);
    const fraction = sourceIndex - index0;
    const value = source[index0]! * (1 - fraction) + source[index1]! * fraction;
    target[offset + i] += value * gain;
  }
}

/**
 * Deterministic music bed, used when no `assets/music/<track>.wav` exists.
 * A slow minor pad plus a soft pulse every 500ms — quiet enough (0.18 mix) to
 * sit under the voice and identical on every machine (no `Math.random()`).
 */
export function synthesizeMusicBed(
  durationSeconds: number,
  sampleRate: number,
  track: string,
  gain: number,
): Float32Array {
  const frames = Math.max(1, Math.round(durationSeconds * sampleRate));
  const out = new Float32Array(frames);
  const roots: Record<string, number[]> = {
    tension_01: [110, 164.81, 220],
    tension_02: [98, 146.83, 196],
    tension_03: [123.47, 185, 246.94],
  };
  const notes = roots[track] ?? roots.tension_01!;
  for (let i = 0; i < frames; i += 1) {
    const t = i / sampleRate;
    let value = 0;
    for (let n = 0; n < notes.length; n += 1) {
      const note = notes[n]!;
      value += Math.sin(2 * Math.PI * note * t) * (0.1 / (n + 1));
      // Slight detune for a wider, less synthetic pad.
      value += Math.sin(2 * Math.PI * (note * 1.004) * t) * (0.05 / (n + 1));
    }
    const tremolo = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.5 * t);
    const pulse = Math.exp(-8 * ((t * 2) % 1)) * 0.08 * Math.sin(2 * Math.PI * 880 * t);
    const fadeIn = Math.min(1, t / 0.4);
    const fadeOut = Math.min(1, Math.max(0, (durationSeconds - t) / 0.6));
    out[i] = (value * tremolo + pulse) * gain * fadeIn * fadeOut;
  }
  return out;
}
