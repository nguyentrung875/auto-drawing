/**
 * Built-in offline Vietnamese voice (FR-9 fallback, AR-7 adapter).
 *
 * `ViPiperEngine` prefers the real Piper neural voice. When Piper is not
 * installed — and in environments where its release binaries cannot be fetched —
 * the choice used to be "ship silence". This adapter is the honest middle
 * ground: a deterministic **formant synthesiser** that actually speaks the
 * script, so the MP4 carries audible narration instead of a dead track.
 *
 * It is a source-filter model, not a neural vocoder:
 *   - the script is split into Vietnamese syllables and each is mapped to an
 *     (onset, nucleus, coda) triple;
 *   - the nucleus drives three formants (F1–F3) resonating a glottal pulse
 *     train, so vowels are distinguishable;
 *   - the diacritic selects one of the six Vietnamese tone contours, applied as
 *     an F0 curve over the syllable — the feature that makes Vietnamese
 *     intelligible at all;
 *   - onsets are rendered as a short burst / fricative noise, codas as a stop or
 *     nasal tail.
 *
 * It sounds synthetic and robotic. It is *not* a replacement for Piper for a
 * published video — but it is real speech-shaped audio, fully offline, MIT-clean,
 * dependency-free and byte-identical on every machine (no `Math.random()`).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IAudioEngine, VoiceOptions, VoiceResult } from './AudioEngine';

const SAMPLE_RATE = 22_050;

/** Vietnamese tone contours as F0 multipliers sampled across the syllable. */
const TONE_CONTOURS: Record<string, number[]> = {
  // ngang (level)
  level: [1.0, 1.01, 1.0, 0.99],
  // huyền (low falling)
  falling: [0.92, 0.88, 0.83, 0.78],
  // sắc (high rising)
  rising: [1.0, 1.08, 1.18, 1.28],
  // hỏi (dipping-rising)
  dipping: [1.0, 0.9, 0.86, 1.02],
  // ngã (creaky rising, glottalised)
  creaky: [1.02, 0.94, 1.12, 1.24],
  // nặng (low, short, glottal stop)
  heavy: [0.9, 0.84, 0.78, 0.7],
};

/** Diacritic → tone. Index by the combining mark carried on the vowel. */
const TONE_BY_CHAR: Record<string, keyof typeof TONE_CONTOURS | undefined> = {};
(() => {
  const table: Array<[string, keyof typeof TONE_CONTOURS]> = [
    ['àằầèềìòồờùừỳ', 'falling'],
    ['áắấéếíóốớúứý', 'rising'],
    ['ảẳẩẻểỉỏổởủửỷ', 'dipping'],
    ['ãẵẫẽễĩõỗỡũữỹ', 'creaky'],
    ['ạặậẹệịọộợụựỵ', 'heavy'],
  ];
  for (const [chars, tone] of table) {
    for (const char of chars) TONE_BY_CHAR[char] = tone;
  }
})();

/** Strip tone marks so the vowel identity can be looked up. */
const BASE_VOWEL: Record<string, string> = {};
(() => {
  const groups: Array<[string, string]> = [
    ['a', 'àáảãạ'],
    ['ă', 'ăằắẳẵặ'],
    ['â', 'âầấẩẫậ'],
    ['e', 'eèéẻẽẹ'],
    ['ê', 'êềếểễệ'],
    ['i', 'iìíỉĩị'],
    ['o', 'oòóỏõọ'],
    ['ô', 'ôồốổỗộ'],
    ['ơ', 'ơờớởỡợ'],
    ['u', 'uùúủũụ'],
    ['ư', 'ưừứửữự'],
    ['y', 'yỳýỷỹỵ'],
  ];
  for (const [base, chars] of groups) {
    BASE_VOWEL[base] = base;
    for (const char of chars) BASE_VOWEL[char] = base;
  }
})();

/** Formant triples (Hz) for the Vietnamese vowel inventory. */
const VOWEL_FORMANTS: Record<string, [number, number, number]> = {
  a: [800, 1300, 2600],
  ă: [760, 1350, 2600],
  â: [640, 1250, 2500],
  e: [560, 1900, 2550],
  ê: [430, 2100, 2700],
  i: [300, 2300, 3000],
  o: [520, 900, 2400],
  ô: [430, 780, 2400],
  ơ: [560, 1150, 2450],
  u: [330, 720, 2300],
  ư: [330, 1500, 2300],
  y: [300, 2250, 3000],
};

const VOWELS = new Set(Object.keys(BASE_VOWEL));

interface Syllable {
  onset: string;
  nucleus: string;
  coda: string;
  tone: keyof typeof TONE_CONTOURS;
}

/** Split a word into (onset, nucleus, coda) and read its tone. */
function parseSyllable(word: string): Syllable | null {
  const lower = word.toLowerCase();
  let tone: keyof typeof TONE_CONTOURS = 'level';
  let firstVowel = -1;
  let lastVowel = -1;
  for (let i = 0; i < lower.length; i += 1) {
    const char = lower[i]!;
    if (VOWELS.has(char)) {
      if (firstVowel === -1) firstVowel = i;
      lastVowel = i;
      const marked = TONE_BY_CHAR[char];
      if (marked) tone = marked;
    }
  }
  if (firstVowel === -1) return null;
  const nucleusRaw = lower.slice(firstVowel, lastVowel + 1);
  // Use the final vowel of a diphthong as the steady target.
  const nucleusChar = nucleusRaw[nucleusRaw.length - 1]!;
  return {
    onset: lower.slice(0, firstVowel),
    nucleus: BASE_VOWEL[nucleusChar] ?? 'a',
    coda: lower.slice(lastVowel + 1),
    tone,
  };
}

/** Deterministic 0..1 noise source — `Math.random()` is banned (AR-10). */
function noise(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const FRICATIVES = new Set(['s', 'x', 'h', 'ph', 'th', 'kh', 'ch', 'tr', 'v', 'gi', 'r']);
const NASAL_CODAS = new Set(['m', 'n', 'ng', 'nh']);
const STOP_CODAS = new Set(['p', 't', 'c', 'ch', 'k']);

/**
 * Render one syllable into `out` at `start` (samples). Returns samples written.
 */
function renderSyllable(
  out: Float32Array,
  start: number,
  syllable: Syllable,
  baseF0: number,
  durationSeconds: number,
): number {
  const total = Math.round(durationSeconds * SAMPLE_RATE);
  const onsetLength = syllable.onset ? Math.round(0.035 * SAMPLE_RATE) : 0;
  const codaStop = STOP_CODAS.has(syllable.coda);
  // A stop coda clips the rhyme short (the hallmark of `nặng` + -c/-t/-p).
  const voicedLength = Math.max(
    Math.round(0.05 * SAMPLE_RATE),
    total - onsetLength - (codaStop ? Math.round(0.03 * SAMPLE_RATE) : 0),
  );

  const [f1, f2, f3] = VOWEL_FORMANTS[syllable.nucleus] ?? VOWEL_FORMANTS.a!;
  const contour = TONE_CONTOURS[syllable.tone]!;

  // --- onset -------------------------------------------------------------
  if (onsetLength > 0) {
    const fricative = FRICATIVES.has(syllable.onset);
    for (let i = 0; i < onsetLength; i += 1) {
      const index = start + i;
      if (index >= out.length) return i;
      const t = i / onsetLength;
      const envelope = fricative ? Math.sin(Math.PI * t) : Math.exp(-6 * t);
      out[index] += noise(index) * envelope * (fricative ? 0.11 : 0.07);
    }
  }

  // --- voiced rhyme ------------------------------------------------------
  let phase = 0;
  let r1 = 0;
  let r1p = 0;
  let r2 = 0;
  let r2p = 0;
  let r3 = 0;
  let r3p = 0;
  const bw = (hz: number, q: number) => Math.exp((-Math.PI * hz) / (q * SAMPLE_RATE));

  for (let i = 0; i < voicedLength; i += 1) {
    const index = start + onsetLength + i;
    if (index >= out.length) break;
    const t = i / voicedLength;

    // Tone contour: piecewise-linear through the 4 control points.
    const position = t * (contour.length - 1);
    const left = Math.min(contour.length - 1, Math.floor(position));
    const right = Math.min(contour.length - 1, left + 1);
    const frac = position - left;
    const f0 = baseF0 * (contour[left]! * (1 - frac) + contour[right]! * frac);

    // Glottal pulse train (a sawtooth-ish impulse is enough to excite formants).
    phase += f0 / SAMPLE_RATE;
    let excitation = 0;
    if (phase >= 1) {
      phase -= 1;
      excitation = 1;
    }
    // `ngã` is creaky: drop every other pulse in the middle of the syllable.
    if (syllable.tone === 'creaky' && t > 0.3 && t < 0.6 && Math.floor(t * 40) % 2 === 0) {
      excitation *= 0.35;
    }
    excitation += noise(index) * 0.012; // breath

    // Three resonators in parallel → vowel colour.
    const a1 = 2 * bw(90, 1) * Math.cos((2 * Math.PI * f1) / SAMPLE_RATE);
    const b1 = bw(90, 1) * bw(90, 1);
    const y1 = excitation + a1 * r1 - b1 * r1p;
    r1p = r1;
    r1 = y1;

    const a2 = 2 * bw(110, 1) * Math.cos((2 * Math.PI * f2) / SAMPLE_RATE);
    const b2 = bw(110, 1) * bw(110, 1);
    const y2 = excitation + a2 * r2 - b2 * r2p;
    r2p = r2;
    r2 = y2;

    const a3 = 2 * bw(170, 1) * Math.cos((2 * Math.PI * f3) / SAMPLE_RATE);
    const b3 = bw(170, 1) * bw(170, 1);
    const y3 = excitation + a3 * r3 - b3 * r3p;
    r3p = r3;
    r3 = y3;

    // Attack/decay so syllables do not click into each other.
    const attack = Math.min(1, t / 0.08);
    const release = Math.min(1, (1 - t) / 0.18);
    const nasal = NASAL_CODAS.has(syllable.coda) && t > 0.75 ? 0.55 : 1;
    out[index] += (y1 * 0.5 + y2 * 0.3 + y3 * 0.14) * 0.055 * attack * release * nasal;
  }

  // --- stop coda: a short silence then a release burst --------------------
  if (codaStop) {
    const burstStart = start + onsetLength + voicedLength + Math.round(0.018 * SAMPLE_RATE);
    const burstLength = Math.round(0.012 * SAMPLE_RATE);
    for (let i = 0; i < burstLength; i += 1) {
      const index = burstStart + i;
      if (index >= out.length) break;
      out[index] += noise(index) * Math.exp(-9 * (i / burstLength)) * 0.06;
    }
  }

  return total;
}

function encodeWav(samples: Float32Array): Buffer {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

export interface FormantViOptions {
  /** Base pitch in Hz (default 165 — a mid Vietnamese speaking voice). */
  baseF0?: number;
  /** Hard ceiling on the clip length in seconds (FR-9 requires <2s). */
  maxDuration?: number;
}

/**
 * Offline Vietnamese formant voice. Audible, deterministic, dependency-free.
 */
export class FormantViEngine implements IAudioEngine {
  constructor(private readonly options: FormantViOptions = {}) {}

  synthesizeToBuffer(script: string): { buffer: Buffer; duration: number } {
    const baseF0 = this.options.baseF0 ?? 165;
    const maxDuration = this.options.maxDuration ?? 1.9;

    const words = script
      .trim()
      .replace(/[^\p{L}\p{N}\s?.,!]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const syllables = words
      .map((word) => parseSyllable(word))
      .filter((value): value is Syllable => value !== null);

    if (syllables.length === 0) {
      const frames = Math.round(0.35 * SAMPLE_RATE);
      return { buffer: encodeWav(new Float32Array(frames)), duration: 0.35 };
    }

    // Fit every syllable inside the budget, but keep them intelligible.
    const gap = 0.012;
    const perSyllable = Math.min(
      0.22,
      Math.max(0.085, maxDuration / syllables.length - gap),
    );
    const duration = Math.min(maxDuration, syllables.length * (perSyllable + gap) + 0.06);
    const out = new Float32Array(Math.round(duration * SAMPLE_RATE));

    let cursor = Math.round(0.02 * SAMPLE_RATE);
    for (const syllable of syllables) {
      const written = renderSyllable(out, cursor, syllable, baseF0, perSyllable);
      cursor += written + Math.round(gap * SAMPLE_RATE);
      if (cursor >= out.length) break;
    }

    // Normalise to a consistent peak so the mux level is predictable.
    let peak = 0;
    for (let i = 0; i < out.length; i += 1) peak = Math.max(peak, Math.abs(out[i]!));
    if (peak > 0) {
      const gain = 0.82 / peak;
      for (let i = 0; i < out.length; i += 1) out[i]! *= gain;
    }

    return { buffer: encodeWav(out), duration: Number(duration.toFixed(3)) };
  }

  async synthesizeVoice(script: string, _options?: VoiceOptions): Promise<VoiceResult> {
    const { buffer, duration } = this.synthesizeToBuffer(script);
    const digest = createHash('sha256').update(script, 'utf8').digest('hex').slice(0, 16);
    const directory = path.join(os.tmpdir(), 'auto-drawing-audio');
    mkdirSync(directory, { recursive: true });
    const voiceWavPath = path.join(directory, `voice-formant-${digest}.wav`);
    if (!existsSync(voiceWavPath)) writeFileSync(voiceWavPath, buffer);
    return { voiceWavPath, duration };
  }
}
