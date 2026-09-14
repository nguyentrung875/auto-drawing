/**
 * Affiliate-link burn check (AD-4 / Story 4.1 AC 3).
 *
 * The link may only live in `caption.json`/comment, never in the pixels. This
 * module scans the bottom band of the *encoded* MP4 (not the in-memory canvas,
 * so encoder/codec regressions are caught too):
 *
 *   1. Extract the bottom band (`1080×360` at y=1560) at native resolution for
 *      a few timestamps spread across the clip.
 *   2. Binarize it.
 *   3. For each candidate glyph height, render the link text with the same text
 *      engine and slide that bitmap over the band. A match means the link was
 *      burned in, anywhere in the band, at (almost) any size.
 *
 * Detection is deliberately sensitive (a false positive fails the render and
 * asks a human to look) because the failure it prevents — publishing a video
 * with the affiliate link burned in — is silent and costly.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Canvas } from './canvas';
import { RENDER_ERROR_CODES, RenderError } from './errors';
import { decodePng } from './png';
import { resolveBinary, runProcess } from './process';
import { TextRenderer } from './text';

/** Bottom band inspected by the scan (y offset / height, stage pixels). */
export const SCAN_BAND = { top: 1560, height: 360 };
/** Timestamps sampled across the clip (seconds). */
export const SCAN_TIMESTAMPS = [0.5, 6.5, 12.5, 17.5];
/** Candidate glyph heights (px) — geometric-ish coverage from tiny to huge. */
export const SCAN_HEIGHTS = [10, 12, 14, 17, 20, 24, 28, 34, 40, 48, 58, 70, 84, 100, 120];
/** Allowed mismatch share of the pattern's ink pixels. */
export const MATCH_TOLERANCE = 0.12;
/** Minimum row-profile correlation for a vertical offset to be worth matching. */
const MIN_PROFILE_SCORE = 0.35;
/** Cap on negative samples per pattern (keeps matching O(1) per position). */
const MAX_NEGATIVE_SAMPLES = 4000;

export interface BurnScanRequest {
  videoPath: string;
  affiliateLink: string;
  ffmpegPath?: string;
  timeoutsMs?: number;
  /** Band/timestamps/heights overrides (tests). */
  band?: { top: number; height: number };
  timestamps?: number[];
  heights?: number[];
}

export interface BurnScanTier {
  height: number;
  timestamp: number;
  bestDistance: number;
  inkPixels: number;
  variant: string;
}

/**
 * A rendered text bitmap plus the *negative* samples used to reject solid ink
 * regions: without them a fully-painted bar would "contain" any small pattern.
 */
export interface TextPattern extends BinaryImage {
  ink: number;
  /** Per-row x offsets of background pixels adjacent to ink. */
  negativeRows: Array<Int32Array>;
}

export interface BurnScanResult {
  scanned: number;
  tiers: BurnScanTier[];
  burned: boolean;
  matchedAt: { height: number; timestamp: number; x: number; variant: string } | null;
  /** Debug frame extracted by the scan (only when `keepFrames` is set). */
  sampledBandPath?: string;
}

/** Candidate text forms a burnt link may use. */
export function linkVariants(link: string): string[] {
  const trimmed = link.trim();
  if (trimmed.length < 8) return [];
  const variants = new Set<string>([
    trimmed,
    trimmed.toLowerCase(),
    trimmed.replace(/^https?:\/\//i, ''),
    trimmed.split('?')[0]!,
    trimmed.replace(/^https?:\/\//i, '').split('?')[0]!,
  ]);
  return [...variants].filter((variant) => variant.length >= 8);
}

interface BinaryImage {
  width: number;
  height: number;
  /** `bits[y * width + x]` → 0 | 1. */
  bits: Uint8Array;
}

function luma(data: Buffer, index: number): number {
  return 0.299 * data[index]! + 0.587 * data[index + 1]! + 0.114 * data[index + 2]!;
}

function binarize(image: { width: number; height: number; data: Buffer }, threshold = 128): BinaryImage {
  const bits = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      bits[y * image.width + x] = luma(image.data, (y * image.width + x) * 4) > threshold ? 1 : 0;
    }
  }
  return { width: image.width, height: image.height, bits };
}

/** A pattern plus its precomputed ink rows (reused across timestamps). */
interface PreparedPattern {
  pattern: TextPattern;
  rows: Int32Array[];
  profile: number[];
}

/** Render `text` and return its binary bitmap cropped to the ink bounding box. */
export function textPattern(text: string, height: number, renderer = new TextRenderer()): TextPattern {
  const canvas = new Canvas(1400, height * 2 + 16, renderer);
  canvas.drawText(text, { x: 4, y: 2, size: height, weight: 600, color: '#ffffff' });
  const raw = binarize({ width: canvas.width, height: canvas.height, data: canvas.data }, 128);
  return withSamples(cropToInk(raw));
}

/** Compute ink count + per-row negative samples for a cropped pattern. */
function withSamples(image: BinaryImage): TextPattern {
  let ink = 0;
  for (let i = 0; i < image.bits.length; i += 1) ink += image.bits[i]!;
  const stride = Math.max(1, Math.ceil((image.width * image.height) / MAX_NEGATIVE_SAMPLES));
  const negativeRows: Array<Int32Array> = [];
  for (let y = 0; y < image.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < image.width; x += 1) {
      if (image.bits[y * image.width + x] === 1) continue;
      let adjacent = false;
      for (let dy = -1; dy <= 1 && !adjacent; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= image.height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= image.width) continue;
          if (image.bits[ny * image.width + nx] === 1) {
            adjacent = true;
            break;
          }
        }
      }
      if (adjacent && (x + y) % stride === 0) row.push(x);
    }
    negativeRows.push(Int32Array.from(row));
  }
  return { ...image, ink, negativeRows };
}

/** Row-major x offsets of the pattern's ink pixels, plus its row ink counts. */
function inkRows(pattern: TextPattern): { rows: Int32Array[]; profile: number[] } {
  const rows: Int32Array[] = [];
  const profile: number[] = [];
  for (let y = 0; y < pattern.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < pattern.width; x += 1) {
      if (pattern.bits[y * pattern.width + x] === 1) row.push(x);
    }
    rows.push(Int32Array.from(row));
    profile.push(row.length);
  }
  return { rows, profile };
}

function cropToInk(image: BinaryImage): BinaryImage {
  let minX = image.width;
  let maxX = -1;
  let minY = image.height;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.bits[y * image.width + x] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { width: 0, height: 0, bits: new Uint8Array(0) };
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const bits = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      bits[y * width + x] = image.bits[(y + minY) * image.width + (x + minX)]!;
    }
  }
  return { width, height, bits };
}

/** 2D prefix sums of the binary image — O(1) ink count for any rectangle. */
function integralImage(image: BinaryImage): Int32Array {
  const width = image.width + 1;
  const sums = new Int32Array(width * (image.height + 1));
  for (let y = 0; y < image.height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < image.width; x += 1) {
      rowSum += image.bits[y * image.width + x]!;
      sums[(y + 1) * width + (x + 1)] = sums[y * width + (x + 1)]! + rowSum;
    }
  }
  return sums;
}

function boxInk(sums: Int32Array, imageWidth: number, x: number, y: number, width: number, height: number): number {
  const stride = imageWidth + 1;
  const right = x + width;
  const bottom = y + height;
  return (
    sums[bottom * stride + right]! -
    sums[y * stride + right]! -
    sums[bottom * stride + x]! +
    sums[y * stride + x]!
  );
}

/** Prefix sums of the row ink profile — O(1) ink count for any vertical window. */
function profilePrefix(profile: number[]): number[] {
  const prefix = new Array<number>(profile.length + 1).fill(0);
  for (let i = 0; i < profile.length; i += 1) prefix[i + 1] = prefix[i]! + profile[i]!;
  return prefix;
}

/** Ink count per row — used to rank candidate vertical offsets cheaply. */
function rowProfile(image: BinaryImage): number[] {
  const profile = new Array<number>(image.height).fill(0);
  for (let y = 0; y < image.height; y += 1) {
    let count = 0;
    for (let x = 0; x < image.width; x += 1) count += image.bits[y * image.width + x]!;
    profile[y] = count;
  }
  return profile;
}

/** Normalized correlation between the pattern's row profile and a window. */
function profileScore(bandProfile: number[], patternProfile: number[], offset: number): number {
  let dot = 0;
  let patternEnergy = 0;
  let bandEnergy = 0;
  for (let i = 0; i < patternProfile.length; i += 1) {
    const p = patternProfile[i]!;
    const b = bandProfile[offset + i] ?? 0;
    dot += p * b;
    patternEnergy += p * p;
    bandEnergy += b * b;
  }
  if (patternEnergy === 0 || bandEnergy === 0) return 0;
  return dot / Math.sqrt(patternEnergy * bandEnergy);
}

/**
 * Slide `pattern` across `band` at the given vertical offset; returns the best
 * (lowest) mismatch count over all horizontal positions.
 */
export function bestHorizontalMatch(
  band: BinaryImage,
  pattern: TextPattern,
  offsetY: number,
  patternRows?: { rows: Int32Array[]; profile: number[] },
  tolerateDilation = true,
  sums?: Int32Array,
): { mismatch: number; x: number; ink: number } {
  if (pattern.ink === 0) return { mismatch: Number.POSITIVE_INFINITY, x: -1, ink: 0 };
  const rows = patternRows ?? inkRows(pattern);
  const limit = Math.max(3, Math.floor(pattern.ink * MATCH_TOLERANCE));
  // Positions are abandoned after a small number of mismatches: a real match
  // differs only by codec/anti-aliasing noise (single digits), so a generous
  // abort keeps detection sound while capping the cost of "almost" positions.
  const abortLimit = Math.min(limit, 32);
  // A text box is ~20–45% ink; anything sparser cannot contain the pattern and
  // anything much denser is a solid region (a bar), not glyphs. O(1).
  const minBoxInk = Math.round(pattern.ink * 0.55);
  const maxBoxInk = Math.round(pattern.ink * 1.8) + limit;
  let best = Number.POSITIVE_INFINITY;
  let bestX = -1;

  for (let offsetX = 0; offsetX <= band.width - pattern.width; offsetX += 1) {
    if (sums) {
      const box = boxInk(sums, band.width, offsetX, offsetY, pattern.width, pattern.height);
      if (box < minBoxInk || box > maxBoxInk) continue;
    }
    let mismatch = 0;
    let abandoned = false;
    for (let y = 0; y < pattern.height; y += 1) {
      const bandRow = (offsetY + y) * band.width + offsetX;
      // Positive evidence: pattern ink must exist in the band (±1px drift).
      const ink = rows.rows[y]!;
      for (let i = 0; i < ink.length; i += 1) {
        const x = ink[i]!;
        if (band.bits[bandRow + x] === 1) continue;
        if (tolerateDilation && hasNeighbourInk(band, offsetY + y, offsetX + x)) continue;
        mismatch += 1;
      }
      // Negative evidence: glyph gaps must be background, otherwise a solid bar
      // would "contain" any pattern. Interleaving per row keeps the early exit.
      const negatives = pattern.negativeRows[y]!;
      for (let i = 0; i < negatives.length; i += 1) {
        const x = negatives[i]!;
        if (band.bits[bandRow + x] === 0) continue;
        if (hasNeighbourBackground(band, offsetY + y, offsetX + x)) continue;
        mismatch += 1;
      }
      if (mismatch > abortLimit) {
        abandoned = true;
        break;
      }
    }
    if (abandoned) continue;
    if (mismatch < best) {
      best = mismatch;
      bestX = offsetX;
      if (best === 0) break;
    }
  }
  return { mismatch: best, x: bestX, ink: pattern.ink };
}

/** True when a pixel's 4-neighbourhood contains a background pixel (tolerance). */
function hasNeighbourBackground(band: BinaryImage, y: number, x: number): boolean {
  const candidates: Array<[number, number]> = [
    [y - 1, x],
    [y + 1, x],
    [y, x - 1],
    [y, x + 1],
  ];
  for (const [ny, nx] of candidates) {
    if (ny < 0 || ny >= band.height || nx < 0 || nx >= band.width) return true;
    if (band.bits[ny * band.width + nx] === 0) return true;
  }
  return false;
}

/** 8-neighbour dilation check (tolerates ±1px encoder/anti-aliasing drift). */
function hasNeighbourInk(band: BinaryImage, y: number, x: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    const ny = y + dy;
    if (ny < 0 || ny >= band.height) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      if (nx < 0 || nx >= band.width) continue;
      if (band.bits[ny * band.width + nx] === 1) return true;
    }
  }
  return false;
}

/** Extract one bottom-band frame at `timestamp` (seconds) at native resolution. */
async function extractBand(
  ffmpeg: string,
  request: BurnScanRequest,
  timestamp: number,
  outputPath: string,
  band: { top: number; height: number },
): Promise<BinaryImage | null> {
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', timestamp.toFixed(2),
    '-i', request.videoPath,
    '-frames:v', '1',
    '-vf', `crop=iw:${band.height}:0:${band.top}`,
    outputPath,
  ];
  const result = await runProcess(ffmpeg, args, { timeoutMs: request.timeoutsMs ?? 20_000 });
  if (result.code !== 0) return null;
  let bytes: Buffer;
  try {
    bytes = readFileSync(outputPath);
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  const image = decodePng(bytes);
  return binarize(image, 128);
}

/**
 * Run the scan. Returns the verdict plus per-tier diagnostics; throws
 * `E_FFMPEG_MISSING` when ffmpeg is unavailable (the check must never be skipped
 * silently — an unverified video is not a passing video).
 */
export async function scanForAffiliateBurn(request: BurnScanRequest): Promise<BurnScanResult> {
  const ffmpeg = resolveBinary('ffmpeg', request.ffmpegPath);
  if (!ffmpeg) {
    throw new RenderError(
      RENDER_ERROR_CODES.FFMPEG_MISSING,
      'ffmpeg',
      'ffmpeg is required to verify that the affiliate link was not burned into the video',
    );
  }

  const variants = linkVariants(request.affiliateLink);
  if (variants.length === 0) {
    // Nothing to look for: a link shorter than 8 chars cannot be recognised.
    return { scanned: 0, tiers: [], burned: false, matchedAt: null };
  }
  const band = request.band ?? SCAN_BAND;
  const timestamps = request.timestamps ?? SCAN_TIMESTAMPS;
  const heights = request.heights ?? SCAN_HEIGHTS;
  const renderer = new TextRenderer();
  const patternCache = new Map<string, PreparedPattern>();
  const cachedPattern = (variant: string, height: number): PreparedPattern => {
    const key = `${variant}|${height}`;
    const hit = patternCache.get(key);
    if (hit) return hit;
    const pattern = textPattern(variant, height, renderer);
    const created: PreparedPattern = { pattern, ...inkRows(pattern) };
    patternCache.set(key, created);
    return created;
  };
  const directory = mkdtempSync(path.join(tmpdir(), 'burn-scan-'));
  const tiers: BurnScanTier[] = [];
  let burned = false;
  let matchedAt: BurnScanResult['matchedAt'] = null;
  let sampledBandPath: string | undefined;

  try {
    for (const timestamp of timestamps) {
      const samplePath = path.join(directory, `band-${timestamp}.png`);
      const image = await extractBand(ffmpeg, request, timestamp, samplePath, band);
      if (!image) continue;
      if (!sampledBandPath) sampledBandPath = samplePath;
      const profile = rowProfile(image);
      const prefix = profilePrefix(profile);
      const sums = integralImage(image);

      for (const variant of variants) {
        for (const height of heights) {
          const { pattern, rows, profile: patternProfile } = cachedPattern(variant, height);
          if (pattern.width === 0 || pattern.height === 0) continue;
          if (pattern.width > image.width || pattern.height > image.height) continue;

          const limit = Math.max(3, Math.floor(pattern.ink * MATCH_TOLERANCE));
          // Top-4 candidate offsets by row-profile correlation (O(n) select —
          // a full sort of every offset dominates the scan otherwise).
          const top: Array<{ offset: number; score: number }> = [];
          for (let offset = 0; offset <= image.height - pattern.height; offset += 1) {
            const windowInk = prefix[offset + pattern.height]! - prefix[offset]!;
            if (windowInk < pattern.ink - limit) continue;
            const score = profileScore(profile, patternProfile, offset);
            if (top.length < 4) {
              top.push({ offset, score });
              top.sort((a, b) => b.score - a.score);
            } else if (score > top[3]!.score) {
              top[3] = { offset, score };
              top.sort((a, b) => b.score - a.score);
            }
          }
          if (top.length === 0 || top[0]!.score < MIN_PROFILE_SCORE) continue;

          let best = Number.POSITIVE_INFINITY;
          let bestX = -1;
          for (const candidate of top) {
            if (candidate.score < MIN_PROFILE_SCORE) break;
            const match = bestHorizontalMatch(image, pattern, candidate.offset, { rows, profile: patternProfile }, true, sums);
            tiers.push({
              height,
              timestamp,
              bestDistance: match.mismatch,
              inkPixels: match.ink,
              variant,
            });
            if (match.mismatch < best) {
              best = match.mismatch;
              bestX = match.x;
              if (best === 0) break;
            }
          }
          if (best <= limit) {
            burned = true;
            matchedAt = { height, timestamp, x: bestX, variant };
            break;
          }
        }
        if (burned) break;
      }
      if (burned) break;
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  return { scanned: timestamps.length, tiers, burned, matchedAt, sampledBandPath };
}

/** Throws `E_AFFILIATE_BURNED_IN` when the link is found in the video pixels. */
export async function assertNoAffiliateBurn(request: BurnScanRequest): Promise<BurnScanResult> {
  const result = await scanForAffiliateBurn(request);
  if (result.burned && result.matchedAt) {
    const match = result.matchedAt;
    throw new RenderError(
      RENDER_ERROR_CODES.AFFILIATE_BURNED,
      'video.pixels',
      `affiliate link glyphs found in the bottom band at t=${match.timestamp}s, y-height ${match.height}px, x=${match.x} (link must live in caption.json/comment only)`,
    );
  }
  return result;
}
