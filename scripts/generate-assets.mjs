// Deterministic generator for the local asset pack (DF9).
//
// Product imagery, SFX and music beds are binary and are NOT committed
// (`.gitignore` keeps `/assets/` out of the repo), but the factory should never
// depend on a human finding them. This script rebuilds the whole pack from
// source data, byte-identical on every machine:
//
//   assets/pXXX.png          one card image per SKU (category palette + initials)
//   assets/sfx/<type>.wav    countdown, tick, reveal, correct, wrong, transition
//   assets/music/<track>.wav tension_01..03 loopable beds
//
// Re-run with: npm run assets:generate
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'assets');
const productsDir = path.join(root, 'products');

// ---------------------------------------------------------------- PNG encoder

function crcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
const CRC = crcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), body])), 0);
  return Buffer.concat([head, body, crcBuf]);
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    rgb.copy(raw, offset, y * width * 3, (y + 1) * width * 3);
    offset += width * 3;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- WAV encoder

const SAMPLE_RATE = 22050;

function encodeWav(samples) {
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
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buffer;
}

/** Deterministic hash → 0..1, so every asset is stable across machines. */
function hash01(text, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ------------------------------------------------------------ product imagery

// Every category in products/ must appear here. A missing entry silently falls
// back to one shared hue, which makes whole grids of cards look identical —
// exactly the bug that shipped in the first pass (21/50 SKUs rendered blue).
const CATEGORY_HUE = {
  'gia dụng': 205,
  bếp: 25,
  'điện tử': 265,
  'sức khỏe': 150,
  'thể thao': 95,
  'thời trang': 330,
  'sắc đẹp': 300,
  'mẹ & bé': 55,
  'đồ chơi': 180,
  'văn phòng': 230,
};

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

/**
 * A card image for one SKU: a category-hued gradient, a soft radial vignette and
 * a deterministic geometric motif. Not photography — but real, distinct,
 * decodable imagery so `ProductCard` stops rendering the grey placeholder.
 */
function productImage(product, size = 512) {
  const baseHue = CATEGORY_HUE[product.category];
  if (baseHue === undefined) {
    throw new Error(
      `no hue mapped for category '${product.category}' (${product.productId}); ` +
        'add it to CATEGORY_HUE — an unmapped category makes every card in it look identical',
    );
  }
  const hue = baseHue + hash01(product.productId, 7) * 26 - 13;
  const rgb = Buffer.alloc(size * size * 3);
  const motif = 3 + Math.floor(hash01(product.productId, 11) * 4);
  const rotate = hash01(product.productId, 3) * Math.PI * 2;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const ny = y / size;
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) + rotate;

      // Base vertical gradient, lighter at the top.
      let lightness = 0.34 - ny * 0.16;
      // Petal motif: a smooth angular ripple that fades out toward the edge.
      const petal = Math.cos(angle * motif) * 0.5 + 0.5;
      lightness += petal * Math.max(0, 1 - radius * 1.15) * 0.2;
      // Vignette.
      lightness -= Math.max(0, radius - 0.55) * 0.22;

      const saturation = 0.32 + Math.max(0, 1 - radius) * 0.2;
      const [r, g, b] = hslToRgb(hue, saturation, Math.max(0.05, Math.min(0.75, lightness)));
      const i = (y * size + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  return encodePng(size, size, rgb);
}

// ------------------------------------------------------------------------ SFX

const envelope = (t, duration, attack = 0.005) =>
  Math.min(1, t / attack) * Math.exp((-4 * t) / duration);

/** Short percussive cues, synthesised so the mux has real audio to place. */
function sfx(type) {
  const specs = {
    // Dry, clicky tick for each half-second of the countdown.
    countdown: { duration: 0.12, build: (t, d) => Math.sin(2 * Math.PI * 880 * t) * envelope(t, d) },
    tick: { duration: 0.12, build: (t, d) => Math.sin(2 * Math.PI * 880 * t) * envelope(t, d) },
    // Rising sweep for the answer.
    reveal: {
      duration: 0.55,
      build: (t, d) => Math.sin(2 * Math.PI * (440 + 520 * (t / d)) * t) * envelope(t, d, 0.01),
    },
    // Major third stab.
    correct: {
      duration: 0.45,
      build: (t, d) =>
        (Math.sin(2 * Math.PI * 660 * t) + Math.sin(2 * Math.PI * 830 * t) * 0.7) *
        0.6 * envelope(t, d, 0.008),
    },
    // Falling minor second.
    wrong: {
      duration: 0.45,
      build: (t, d) => Math.sin(2 * Math.PI * (320 - 90 * (t / d)) * t) * envelope(t, d, 0.008),
    },
    // Airy noise swish between scenes.
    transition: {
      duration: 0.35,
      build: (t, d, i) =>
        Math.sin(2 * Math.PI * 200 * t) * 0.3 * envelope(t, d, 0.02) +
        (hash01(`swish${i}`, 5) * 2 - 1) * 0.18 * envelope(t, d, 0.02),
    },
  };
  const spec = specs[type];
  const frames = Math.round(spec.duration * SAMPLE_RATE);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) out[i] = spec.build(i / SAMPLE_RATE, spec.duration, i) * 0.7;
  return encodeWav(out);
}

// ---------------------------------------------------------------------- music

/** 8s loopable minor pad; whole cycles only, so the loop seam is silent. */
function musicBed(track) {
  const chords = {
    tension_01: [110, 164.81, 220],
    tension_02: [98, 146.83, 196],
    tension_03: [123.47, 185, 246.94],
  }[track];
  const duration = 8;
  const frames = Math.round(duration * SAMPLE_RATE);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    const t = i / SAMPLE_RATE;
    let value = 0;
    chords.forEach((note, n) => {
      // Round each partial to a whole number of cycles over the loop so the
      // end joins the start without a click.
      const cycles = Math.round((note * duration) / 1) / duration;
      value += Math.sin(2 * Math.PI * cycles * t) * (0.1 / (n + 1));
      value += Math.sin(2 * Math.PI * Math.round(cycles * 1.004 * duration) / duration * t) * (0.05 / (n + 1));
    });
    const tremolo = 0.78 + 0.22 * Math.sin((2 * Math.PI * 2 * t) / duration);
    out[i] = value * tremolo;
  }
  return encodeWav(out);
}

// ----------------------------------------------------------------------- main

mkdirSync(assetsDir, { recursive: true });
mkdirSync(path.join(assetsDir, 'sfx'), { recursive: true });
mkdirSync(path.join(assetsDir, 'music'), { recursive: true });

const skus = readdirSync(productsDir).filter((f) => /^p\d+\.json$/.test(f)).sort();
let images = 0;
for (const file of skus) {
  const product = JSON.parse(readFileSync(path.join(productsDir, file), 'utf8'));
  const target = path.join(root, product.image);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, productImage(product));
  images += 1;
}

const sfxTypes = ['countdown', 'tick', 'reveal', 'correct', 'wrong', 'transition'];
for (const type of sfxTypes) writeFileSync(path.join(assetsDir, 'sfx', `${type}.wav`), sfx(type));

const tracks = ['tension_01', 'tension_02', 'tension_03'];
for (const track of tracks) writeFileSync(path.join(assetsDir, 'music', `${track}.wav`), musicBed(track));

console.log(
  `assets: ${images} product images, ${sfxTypes.length} sfx, ${tracks.length} music beds → ${path.relative(root, assetsDir)}/`,
);
