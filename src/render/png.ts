/**
 * Minimal PNG codec used by the frame renderer.
 *
 * Motion Canvas / FFmpeg both speak PNG, so the renderer keeps its frame I/O in
 * one place: a deterministic encoder (filter 0, 8-bit truecolour) and a decoder
 * for the same dialect (used by the affiliate-link pixel scan, which must
 * inspect the *encoded artifact*, not the in-memory buffer).
 *
 * Only 8-bit, non-interlaced, colour type 2 (RGB) / 6 (RGBA) PNGs are
 * supported — exactly the format the renderer emits.
 */
import { deflateSync, inflateSync } from 'node:zlib';

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

export function crc32(buffer: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ buffer[i]!) & 0xff]!);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export interface PngImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Buffer;
}

/**
 * Encode an RGBA buffer as an 8-bit truecolour PNG (filter 0 per scanline).
 *
 * Frames are written to `temp/<jobId>/`, encoded by ffmpeg and then deleted, so
 * the default compression level trades a few KB for encode speed (`level: 1` is
 * ~3× faster than 6 on these mostly-flat UI frames at this resolution).
 */
export function encodePng(
  image: PngImage,
  options: { alpha?: boolean; compressionLevel?: number } = {},
): Buffer {
  const { width, height, data } = image;
  if (data.length !== width * height * 4) {
    throw new Error(
      `encodePng: buffer is ${data.length} bytes; expected ${width * height * 4} for ${width}x${height} RGBA`,
    );
  }
  const withAlpha = options.alpha ?? true;
  const channels = withAlpha ? 4 : 3;
  const raw = Buffer.alloc((width * channels + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: None
    offset += 1;
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const src = rowStart + x * 4;
      raw[offset] = data[src]!;
      raw[offset + 1] = data[src + 1]!;
      raw[offset + 2] = data[src + 2]!;
      offset += 3;
      if (withAlpha) {
        raw[offset] = data[src + 3]!;
        offset += 1;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = withAlpha ? 6 : 2; // colour type: RGBA | RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: options.compressionLevel ?? 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decode an 8-bit truecolour (RGB/RGBA, non-interlaced) PNG to RGBA. */
export function decodePng(buffer: Buffer): PngImage {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('decodePng: not a PNG (bad signature)');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8]!;
      const colourType = data[9]!;
      if (bitDepth !== 8) throw new Error(`decodePng: unsupported bit depth ${bitDepth}`);
      if (colourType === 2) channels = 3;
      else if (colourType === 6) channels = 4;
      else throw new Error(`decodePng: unsupported colour type ${colourType}`);
      if (data[12] !== 0) throw new Error('decodePng: interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels]! : 0;
      const up = previous[i]!;
      const upLeft = i >= channels ? previous[i - channels]! : 0;
      const value = src[i]!;
      switch (filter) {
        case 0:
          row[i] = value;
          break;
        case 1:
          row[i] = (value + left) & 0xff;
          break;
        case 2:
          row[i] = (value + up) & 0xff;
          break;
        case 3:
          row[i] = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          row[i] = (value + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`decodePng: unsupported filter type ${filter}`);
      }
    }
    for (let x = 0; x < width; x += 1) {
      const srcIndex = x * channels;
      const dstIndex = (y * width + x) * 4;
      out[dstIndex] = row[srcIndex]!;
      out[dstIndex + 1] = row[srcIndex + 1]!;
      out[dstIndex + 2] = row[srcIndex + 2]!;
      out[dstIndex + 3] = channels === 4 ? row[srcIndex + 3]! : 255;
    }
    previous = row;
  }

  return { width, height, data: out };
}

/** Read width/height without inflating the pixel data. */
export function pngSize(buffer: Buffer): { width: number; height: number } {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('pngSize: not a PNG (bad signature)');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
