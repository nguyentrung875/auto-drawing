/**
 * Text layout + glyph rasterization for the offline frame renderer.
 *
 * `TextRenderer` owns font discovery, Unicode sanitising (no `.notdef` boxes in
 * a published video), greedy word wrapping and glyph compositing into a single
 * coverage mask that `Canvas` can paint in any colour.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { TrueTypeFont } from './truetype';

export interface TextStyle {
  /** Font size in px (em size). */
  size: number;
  weight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface TextBlock {
  /** Coverage 0..1, `width * height` samples, row-major. */
  mask: Float32Array;
  width: number;
  height: number;
  lines: string[];
  /** Total advance width of the text (px). */
  textWidth: number;
  /** Advancement between consecutive baselines (px). */
  lineStep: number;
}

const FONT_CANDIDATES: Record<'regular' | 'bold', string[]> = {
  regular: [
    'assets/fonts/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
  ],
  bold: [
    'assets/fonts/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode Bold.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
  ],
};

/** Find a usable font file for `weight`, honouring the env override first. */
export function resolveFontFile(
  weight: 'regular' | 'bold' = 'regular',
  root = process.cwd(),
): string | null {
  const override = weight === 'bold' ? process.env.RENDER_FONT_BOLD_PATH : process.env.RENDER_FONT_PATH;
  const fallbackOverride = weight === 'bold' ? process.env.RENDER_FONT_PATH : undefined;
  for (const candidate of [override, fallbackOverride, ...FONT_CANDIDATES[weight]]) {
    if (!candidate) continue;
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
    if (existsSync(resolved)) return resolved;
  }
  return null;
}

export class TextRenderer {
  private readonly fonts = new Map<string, TrueTypeFont>();
  private readonly glyphCache = new Map<string, { mask: Float32Array; width: number; height: number; bearingX: number; bearingY: number; advance: number }>();
  private readonly blockCache = new Map<string, TextBlock>();

  constructor(private readonly fontFiles?: Partial<Record<'regular' | 'bold', string | null>>) {}

  /** Font file backing a weight, or null when no font could be found. */
  fontFile(weight: 'regular' | 'bold' = 'regular'): string | null {
    if (this.fontFiles && weight in this.fontFiles) return this.fontFiles[weight] ?? null;
    return resolveFontFile(weight);
  }

  private font(weight: 'regular' | 'bold'): TrueTypeFont | null {
    const file = this.fontFile(weight);
    if (!file) return null;
    const cached = this.fonts.get(file);
    if (cached) return cached;
    const font = TrueTypeFont.load(file);
    this.fonts.set(file, font);
    return font;
  }

  /**
   * Drop code points the font cannot draw (emoji, exotic symbols) instead of
   * publishing `.notdef` rectangles, and collapse whitespace runs.
   */
  sanitize(text: string, weight: 'regular' | 'bold' = 'regular'): string {
    const font = this.font(weight);
    if (!font) return text.replace(/\s+/g, ' ').trim();
    let out = '';
    for (const char of text.replace(/\s+/g, ' ').trim()) {
      const codePoint = char.codePointAt(0)!;
      if (char === '\n' || char === ' ') {
        out += char;
        continue;
      }
      if (font.hasGlyph(codePoint)) out += char;
    }
    // Trim again: dropped emoji may have left a trailing space.
    return out.replace(/\s+/g, ' ').trim();
  }

  private glyph(font: TrueTypeFont, codePoint: number, size: number) {
    const key = `${codePoint}@${size}@${font.metrics.unitsPerEm}`;
    const cached = this.glyphCache.get(key);
    if (cached) return cached;
    const rasterized = font.rasterize(codePoint, size);
    this.glyphCache.set(key, rasterized);
    return rasterized;
  }

  private measureLine(font: TrueTypeFont, line: string, size: number, letterSpacing: number): number {
    let width = 0;
    let previous = -1;
    for (const char of line) {
      const codePoint = char.codePointAt(0)!;
      const glyph = font.glyphIndex(codePoint);
      if (previous >= 0) {
        width += (font.kerning(previous, glyph) * size) / font.metrics.unitsPerEm;
      }
      width += font.advanceWidth(codePoint) * (size / font.metrics.unitsPerEm) + letterSpacing;
      previous = glyph;
    }
    return Math.max(0, width - letterSpacing);
  }

  /** Greedy word wrap; a word longer than `maxWidth` is kept on its own line. */
  private wrap(font: TrueTypeFont, text: string, size: number, letterSpacing: number, maxWidth?: number): string[] {
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ').filter((word) => word.length > 0);
      if (words.length === 0) {
        lines.push('');
        continue;
      }
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (maxWidth && current && this.measureLine(font, candidate, size, letterSpacing) > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  /** Lay out + rasterize text into one coverage mask. */
  layout(text: string, style: TextStyle): TextBlock {
    const weight: 'regular' | 'bold' = (style.weight ?? 400) >= 600 ? 'bold' : 'regular';
    const font = this.font(weight);
    const size = Math.max(1, Math.round(style.size));
    const letterSpacing = style.letterSpacing ?? 0;
    const raw = style.uppercase ? text.toUpperCase() : text;
    const sanitized = this.sanitize(raw, weight);
    if (!font || sanitized.length === 0) {
      return {
        mask: new Float32Array(0),
        width: 0,
        height: 0,
        lines: sanitized ? [sanitized] : [],
        textWidth: 0,
        lineStep: 0,
      };
    }

    const cacheKey = `${weight}|${size}|${letterSpacing}|${style.maxWidth ?? 0}|${sanitized}`;
    const cached = this.blockCache.get(cacheKey);
    if (cached) return cached;

    const lines = this.wrap(font, sanitized, size, letterSpacing, style.maxWidth);
    const lineStep = Math.round(size * (style.lineHeight ?? 1.25));
    const unit = size / font.metrics.unitsPerEm;
    const lineWidths = lines.map((line) => this.measureLine(font, line, size, letterSpacing));
    const textWidth = Math.max(0, ...lineWidths);
    const ascent = Math.ceil(font.metrics.ascender * unit);
    // Room for descenders and diacritics above cap height.
    const top = Math.ceil(font.metrics.ascender * unit);
    const bottom = Math.ceil(-font.metrics.descender * unit);
    const width = Math.ceil(textWidth) + 4;
    const height = (lines.length - 1) * lineStep + top + bottom + 4;
    const mask = new Float32Array(width * height);

    lines.forEach((line, lineIndex) => {
      const baseline = top + 2 + lineIndex * lineStep;
      const align = style.align ?? 'left';
      let penX =
        align === 'center'
          ? Math.round((width - lineWidths[lineIndex]!) / 2)
          : align === 'right'
            ? width - 2 - Math.round(lineWidths[lineIndex]!)
            : 2;
      let previous = -1;
      for (const char of line) {
        const codePoint = char.codePointAt(0)!;
        const glyphIndex = font.glyphIndex(codePoint);
        if (previous >= 0) penX += font.kerning(previous, glyphIndex) * unit;
        if (char !== ' ') {
          const glyph = this.glyph(font, codePoint, size);
          composite(mask, width, height, glyph, penX, baseline - glyph.bearingY);
        }
        penX += font.advanceWidth(codePoint) * unit + letterSpacing;
        previous = glyphIndex;
      }
    });

    const block: TextBlock = { mask, width, height, lines, textWidth, lineStep };
    this.blockCache.set(cacheKey, block);
    return block;
  }
}

function composite(
  target: Float32Array,
  targetWidth: number,
  targetHeight: number,
  glyph: { mask: Float32Array; width: number; height: number; bearingX: number; bearingY: number },
  originX: number,
  originY: number,
): void {
  if (glyph.mask.length === 0) return;
  for (let row = 0; row < glyph.height; row += 1) {
    const y = Math.round(originY) + row;
    if (y < 0 || y >= targetHeight) continue;
    for (let column = 0; column < glyph.width; column += 1) {
      const coverage = glyph.mask[row * glyph.width + column]!;
      if (coverage <= 0) continue;
      const x = Math.round(originX) + glyph.bearingX + column;
      if (x < 0 || x >= targetWidth) continue;
      const index = y * targetWidth + x;
      target[index] = Math.min(1, target[index]! + coverage);
    }
  }
}
