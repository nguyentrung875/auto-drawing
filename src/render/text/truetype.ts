/**
 * Dependency-free TrueType outline rasterizer.
 *
 * The renderer must draw localised (Vietnamese) text at 1080×1920 without a
 * browser, a GPU, FreeType, or any native module. This module parses the subset
 * of the TrueType specification that text needs — `head`, `hhea`, `hmtx`,
 * `maxp`, `loca`, `glyf`, `cmap` — flattens quadratic outlines (including
 * composite glyphs, which is how Vietnamese precomposed characters are stored)
 * and scanline-fills them into a coverage mask.
 *
 * Everything here is deterministic: fixed subdivision counts, fixed
 * supersampling, no environment-dependent behaviour.
 */
import { readFileSync } from 'node:fs';
import type { Point } from '../geometry';
import { fillPolygons } from '../raster';

export interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineGap: number;
}

/** A flattened outline (straight-line polyline, px). */
export interface Contour {
  points: Point[];
}

/** Raw TrueType point: `on` marks on-curve (quadratic spline otherwise). */
interface RawPoint {
  x: number;
  y: number;
  on: boolean;
}

interface RawContour {
  points: RawPoint[];
}

export interface RasterGlyph {
  /** Coverage 0..1, `width * height` samples, row-major. */
  mask: Float32Array;
  width: number;
  height: number;
  /** Left bearing and top bearing in px, relative to the text origin/baseline. */
  bearingX: number;
  bearingY: number;
  /** Advance width in px. */
  advance: number;
}

/** Quadratic Bézier flattening tolerance (px) — smaller is smoother/slower. */
const FLATTEN_STEP_PX = 3;

const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME_OR_POSITIVE = 0x10;
const Y_SAME_OR_POSITIVE = 0x20;

const ARG_1_AND_2_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

interface Table {
  offset: number;
  length: number;
}

function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export class TrueTypeFont {
  readonly metrics: FontMetrics;

  private readonly buffer: Buffer;
  private readonly tables: Map<string, Table>;
  private readonly numGlyphs: number;
  private readonly indexToLocFormat: number;
  private readonly numberOfHMetrics: number;
  private readonly cmapOffset: number;
  private readonly cmapSubtable: number;
  private readonly glyphCache = new Map<number, RawContour[]>();
  private readonly advanceCache = new Map<number, number>();

  private constructor(buffer: Buffer) {
    this.buffer = buffer;
    const numTables = buffer.readUInt16BE(4);
    this.tables = new Map<string, Table>();
    for (let i = 0; i < numTables; i += 1) {
      const record = 12 + i * 16;
      const tag = buffer.toString('ascii', record, record + 4);
      this.tables.set(tag, {
        offset: buffer.readUInt32BE(record + 8),
        length: buffer.readUInt32BE(record + 12),
      });
    }

    const head = this.table('head');
    this.indexToLocFormat = buffer.readInt16BE(head.offset + 50);
    this.metrics = {
      unitsPerEm: buffer.readUInt16BE(head.offset + 18),
      ascender: buffer.readInt16BE(this.table('hhea').offset + 4),
      descender: buffer.readInt16BE(this.table('hhea').offset + 6),
      lineGap: buffer.readInt16BE(this.table('hhea').offset + 8),
    };
    this.numberOfHMetrics = buffer.readUInt16BE(this.table('hhea').offset + 34);
    this.numGlyphs = buffer.readUInt16BE(this.table('maxp').offset + 4);

    const { offset, format } = this.pickCmap();
    this.cmapOffset = offset;
    this.cmapSubtable = format;
  }

  static load(filePath: string): TrueTypeFont {
    return new TrueTypeFont(readFileSync(filePath));
  }

  static parse(buffer: Buffer): TrueTypeFont {
    return new TrueTypeFont(buffer);
  }

  private table(tag: string): Table {
    const table = this.tables.get(tag);
    if (!table) throw new Error(`TrueType: missing required '${tag}' table`);
    return table;
  }

  /** Pick the best `cmap` subtable: BMP+Unicode, preferring format 12. */
  private pickCmap(): { offset: number; format: number } {
    const cmap = this.table('cmap');
    const count = this.buffer.readUInt16BE(cmap.offset + 2);
    let best: { offset: number; format: number; score: number } | undefined;
    for (let i = 0; i < count; i += 1) {
      const record = cmap.offset + 4 + i * 8;
      const platformId = this.buffer.readUInt16BE(record);
      const encodingId = this.buffer.readUInt16BE(record + 2);
      const offset = cmap.offset + this.buffer.readUInt32BE(record + 4);
      const format = this.buffer.readUInt16BE(offset);
      if (format !== 4 && format !== 12) continue;
      // Unicode-first scoring: (3,10) full repertoire > (3,1) BMP >
      // (0,x) Unicode platform.
      let score = 0;
      if (platformId === 3 && encodingId === 10) score = 40;
      else if (platformId === 3 && encodingId === 1) score = 30;
      else if (platformId === 0) score = 20;
      else continue;
      if (format === 12) score += 5;
      if (!best || score > best.score) best = { offset, format, score };
    }
    if (!best) throw new Error('TrueType: no usable unicode cmap subtable');
    return { offset: best.offset, format: best.format };
  }

  /** Glyph id for a code point; 0 (`.notdef`) when the font has no glyph. */
  glyphIndex(codePoint: number): number {
    if (this.cmapSubtable === 12) {
      const groups = this.buffer.readUInt32BE(this.cmapOffset + 12);
      let low = 0;
      let high = groups - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const record = this.cmapOffset + 16 + mid * 12;
        const start = this.buffer.readUInt32BE(record);
        const end = this.buffer.readUInt32BE(record + 4);
        if (codePoint < start) high = mid - 1;
        else if (codePoint > end) low = mid + 1;
        else return this.buffer.readUInt32BE(record + 8) + (codePoint - start);
      }
      return 0;
    }

    if (codePoint > 0xffff) return 0;
    const segCount = this.buffer.readUInt16BE(this.cmapOffset + 6) / 2;
    const endCodes = this.cmapOffset + 14;
    const startCodes = endCodes + segCount * 2 + 2;
    const idDeltas = startCodes + segCount * 2;
    const idRangeOffsets = idDeltas + segCount * 2;
    for (let seg = 0; seg < segCount; seg += 1) {
      const end = this.buffer.readUInt16BE(endCodes + seg * 2);
      if (codePoint > end) continue;
      const start = this.buffer.readUInt16BE(startCodes + seg * 2);
      if (codePoint < start) return 0;
      const delta = this.buffer.readInt16BE(idDeltas + seg * 2);
      const rangeOffset = this.buffer.readUInt16BE(idRangeOffsets + seg * 2);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const address = idRangeOffsets + seg * 2 + rangeOffset + (codePoint - start) * 2;
      if (address + 1 >= this.buffer.length) return 0;
      const glyph = this.buffer.readUInt16BE(address);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  }

  hasGlyph(codePoint: number): boolean {
    return codePoint === 32 || this.glyphIndex(codePoint) !== 0;
  }

  /** Advance width in font units. */
  advanceWidth(codePoint: number): number {
    const glyph = this.glyphIndex(codePoint);
    const cached = this.advanceCache.get(glyph);
    if (cached !== undefined) return cached;
    const hmtx = this.table('hmtx').offset;
    const index = Math.min(glyph, this.numberOfHMetrics - 1);
    const advance = this.buffer.readUInt16BE(hmtx + index * 4);
    this.advanceCache.set(glyph, advance);
    return advance;
  }

  /** Kerning pairs (`kern` format 0) — improves the look of large headlines. */
  kerning(left: number, right: number): number {
    const table = this.tables.get('kern');
    if (!table) return 0;
    const base = table.offset;
    const version = this.buffer.readUInt16BE(base);
    if (version !== 0) return 0;
    const nTables = this.buffer.readUInt16BE(base + 2);
    let offset = base + 4;
    for (let t = 0; t < nTables; t += 1) {
      const length = this.buffer.readUInt16BE(offset + 2);
      const coverage = this.buffer.readUInt16BE(offset + 4);
      const format = coverage >> 8;
      if (format === 0) {
        const nPairs = this.buffer.readUInt16BE(offset + 6);
        for (let i = 0; i < nPairs; i += 1) {
          const record = offset + 14 + i * 6;
          if (
            this.buffer.readUInt16BE(record) === left &&
            this.buffer.readUInt16BE(record + 2) === right
          ) {
            return this.buffer.readInt16BE(record + 4);
          }
        }
      }
      offset += length;
    }
    return 0;
  }

  private loca(glyph: number): { start: number; end: number } {
    const loca = this.table('loca').offset;
    const glyf = this.table('glyf').offset;
    if (this.indexToLocFormat === 0) {
      return {
        start: glyf + this.buffer.readUInt16BE(loca + glyph * 2) * 2,
        end: glyf + this.buffer.readUInt16BE(loca + (glyph + 1) * 2) * 2,
      };
    }
    return {
      start: glyf + this.buffer.readUInt32BE(loca + glyph * 4),
      end: glyf + this.buffer.readUInt32BE(loca + (glyph + 1) * 4),
    };
  }

  /** Outline contours (font units, y-up) for a code point. */
  contours(codePoint: number, depth = 0): RawContour[] {
    const glyph = this.glyphIndex(codePoint);
    return this.glyphContours(glyph, depth);
  }

  private glyphContours(glyph: number, depth: number): RawContour[] {
    const cached = this.glyphCache.get(glyph);
    if (cached) return cached;
    if (glyph <= 0 || glyph >= this.numGlyphs || depth > 4) return [];
    const { start, end } = this.loca(glyph);
    if (end - start <= 0) {
      this.glyphCache.set(glyph, []);
      return [];
    }

    const contours = this.readGlyf(start, end, depth);
    this.glyphCache.set(glyph, contours);
    return contours;
  }

  private readGlyf(start: number, end: number, depth: number): RawContour[] {
    const numberOfContours = this.buffer.readInt16BE(start);
    if (numberOfContours >= 0) {
      return this.readSimpleGlyph(start, numberOfContours);
    }
    return this.readCompositeGlyph(start, end, depth);
  }

  private readSimpleGlyph(start: number, numberOfContours: number): RawContour[] {
    if (numberOfContours === 0) return [];
    let cursor = start + 10;
    const endPts: number[] = [];
    for (let i = 0; i < numberOfContours; i += 1) {
      endPts.push(this.buffer.readUInt16BE(cursor));
      cursor += 2;
    }
    const pointCount = (endPts[numberOfContours - 1] ?? 0) + 1;
    cursor += 2 + this.buffer.readUInt16BE(cursor); // skip instructions

    const flags: number[] = [];
    while (flags.length < pointCount) {
      const flag = this.buffer[cursor]!;
      cursor += 1;
      flags.push(flag);
      if (flag & REPEAT) {
        const repeat = this.buffer[cursor]!;
        cursor += 1;
        for (let i = 0; i < repeat; i += 1) flags.push(flag);
      }
    }

    const xs: number[] = [];
    let x = 0;
    for (const flag of flags) {
      if (flag & X_SHORT) {
        const delta = this.buffer[cursor]!;
        cursor += 1;
        x += flag & X_SAME_OR_POSITIVE ? delta : -delta;
      } else if (!(flag & X_SAME_OR_POSITIVE)) {
        x += this.buffer.readInt16BE(cursor);
        cursor += 2;
      }
      xs.push(x);
    }

    const ys: number[] = [];
    let y = 0;
    for (const flag of flags) {
      if (flag & Y_SHORT) {
        const delta = this.buffer[cursor]!;
        cursor += 1;
        y += flag & Y_SAME_OR_POSITIVE ? delta : -delta;
      } else if (!(flag & Y_SAME_OR_POSITIVE)) {
        y += this.buffer.readInt16BE(cursor);
        cursor += 2;
      }
      ys.push(y);
    }

    const points: RawPoint[] = flags.map((flag, index) => ({
      x: xs[index]!,
      y: ys[index]!,
      on: (flag & ON_CURVE) !== 0,
    }));

    const contours: RawContour[] = [];
    let contourStart = 0;
    for (const endPt of endPts) {
      contours.push({ points: points.slice(contourStart, endPt + 1) });
      contourStart = endPt + 1;
    }
    return contours;
  }

  private readCompositeGlyph(start: number, end: number, depth: number): RawContour[] {
    let cursor = start + 10;
    const contours: RawContour[] = [];
    let flags = MORE_COMPONENTS;
    while (flags & MORE_COMPONENTS) {
      if (cursor + 4 > end) break;
      flags = this.buffer.readUInt16BE(cursor);
      const glyph = this.buffer.readUInt16BE(cursor + 2);
      cursor += 4;

      let arg1: number;
      let arg2: number;
      if (flags & ARG_1_AND_2_ARE_WORDS) {
        arg1 = this.buffer.readInt16BE(cursor);
        arg2 = this.buffer.readInt16BE(cursor + 2);
        cursor += 4;
      } else {
        arg1 = this.buffer.readInt8(cursor);
        arg2 = this.buffer.readInt8(cursor + 1);
        cursor += 2;
      }

      let a = 1;
      let b = 0;
      let c = 0;
      let d = 1;
      if (flags & WE_HAVE_A_SCALE) {
        a = d = this.buffer.readInt16BE(cursor) / 16384;
        cursor += 2;
      } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
        a = this.buffer.readInt16BE(cursor) / 16384;
        d = this.buffer.readInt16BE(cursor + 2) / 16384;
        cursor += 4;
      } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
        a = this.buffer.readInt16BE(cursor) / 16384;
        b = this.buffer.readInt16BE(cursor + 2) / 16384;
        c = this.buffer.readInt16BE(cursor + 4) / 16384;
        d = this.buffer.readInt16BE(cursor + 6) / 16384;
        cursor += 8;
      }

      const component = this.glyphContours(glyph, depth + 1);
      // Composite transforms must preserve on/off-curve flags: precomposed
      // Vietnamese characters are composites of accented bases + diacritics.
      const transformed = component.map((contour) => ({
        points: contour.points.map((point) => ({
          x: a * point.x + c * point.y,
          y: b * point.x + d * point.y,
          on: point.on,
        })),
      }));

      let dx = 0;
      let dy = 0;
      if (flags & ARGS_ARE_XY_VALUES) {
        dx = arg1;
        dy = arg2;
      } else {
        // Point matching: align component point `arg2` on composite point `arg1`.
        const flatComposite = contours.flatMap((contour) => contour.points);
        const flatComponent = transformed.flatMap((contour) => contour.points);
        const target = flatComposite[arg1];
        const source = flatComponent[arg2];
        if (target && source) {
          dx = target.x - source.x;
          dy = target.y - source.y;
        }
      }

      for (const contour of transformed) {
        contours.push({
          points: contour.points.map((point) => ({ x: point.x + dx, y: point.y + dy, on: point.on })),
        });
      }
    }
    return contours;
  }

  /** Flatten contours into polylines (px, y-down, origin at the glyph box). */
  flatten(codePoint: number, sizePx: number): Contour[] {
    const scale = sizePx / this.metrics.unitsPerEm;
    const out: Contour[] = [];
    for (const contour of this.contours(codePoint)) {
      const points = contour.points.map((point) => ({
        x: point.x * scale,
        y: -point.y * scale,
        on: point.on,
      }));
      const polyline = flattenContour(points);
      if (polyline.length >= 3) out.push({ points: polyline });
    }
    return out;
  }

  /** Rasterize a code point at `sizePx` into a coverage mask. */
  rasterize(codePoint: number, sizePx: number): RasterGlyph {
    const scale = sizePx / this.metrics.unitsPerEm;
    const advance = this.advanceWidth(codePoint) * scale;
    const raw = this.contours(codePoint);
    if (raw.length === 0) {
      return { mask: new Float32Array(0), width: 0, height: 0, bearingX: 0, bearingY: 0, advance };
    }

    const polylines: Point[][] = [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const contour of raw) {
      const scaled = contour.points.map((point) => ({ x: point.x * scale, y: -point.y * scale, on: point.on }));
      const polyline = flattenContour(scaled);
      if (polyline.length < 3) continue;
      polylines.push(polyline);
      for (const point of polyline) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      }
    }
    if (polylines.length === 0) {
      return { mask: new Float32Array(0), width: 0, height: 0, bearingX: 0, bearingY: 0, advance };
    }

    const bearingX = Math.floor(minX) - 1;
    const top = Math.floor(minY) - 1;
    const width = Math.ceil(maxX) - bearingX + 2;
    const height = Math.ceil(maxY) - top + 2;
    const mask = fillPolygons(
      polylines.map((points) => points.map((point) => ({ x: point.x - bearingX, y: point.y - top }))),
      width,
      height,
    );
    return { mask, width, height, bearingX, bearingY: -top, advance };
  }
}

/** Convert a TrueType contour (on/off-curve points) into a polyline. */
function flattenContour(points: RawPoint[]): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [];
  if (points.every((point) => !point.on)) {
    // Degenerate: treat every off-curve point as on-curve.
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const count = points.length;
  let startIndex = points.findIndex((point) => point.on);
  if (startIndex === -1) startIndex = 0;
  const ordered = Array.from({ length: count }, (_, i) => points[(startIndex + i) % count]!);

  const out: Point[] = [];
  let current: Point = ordered[0]!;
  out.push({ x: current.x, y: current.y });
  let control: Point | undefined;

  for (let i = 1; i <= count; i += 1) {
    const point = ordered[i % count]!;
    if (point.on) {
      if (control) {
        appendQuadratic(out, current, control, point);
        control = undefined;
      } else {
        out.push({ x: point.x, y: point.y });
      }
      current = point;
    } else if (control) {
      const implied = midpoint(control, point);
      appendQuadratic(out, current, control, implied);
      current = implied;
      control = point;
    } else {
      control = point;
    }
  }
  const last = out[out.length - 1]!;
  if (Math.abs(last.x - out[0]!.x) > 1e-6 || Math.abs(last.y - out[0]!.y) > 1e-6) {
    out.push({ x: out[0]!.x, y: out[0]!.y });
  }
  return out;
}

function appendQuadratic(
  out: Point[],
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const approxLength =
    Math.hypot(control.x - from.x, control.y - from.y) +
    Math.hypot(to.x - control.x, to.y - control.y);
  const steps = Math.max(2, Math.min(24, Math.ceil(approxLength / FLATTEN_STEP_PX)));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const inv = 1 - t;
    out.push({
      x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
      y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
    });
  }
}
