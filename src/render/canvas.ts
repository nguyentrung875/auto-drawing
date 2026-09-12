/**
 * Software drawing surface: RGBA buffer + the primitives the seven scenes need
 * (solid/gradient background, rounded cards, tilted cards, text).
 *
 * The canvas is renderer-neutral — it is what the PNG encoder consumes and what
 * the pixel scan inspects.
 */
import type { Point } from './geometry';
import { fillPolygons, rectPolygon, rotatePolygon, roundRectPolygon } from './raster';
import { TextRenderer, type TextStyle } from './text';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  transparent: '#00000000',
};

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(r,g,b)`, `rgba(...)` or a name. */
export function parseColor(input: string): Rgb & { a: number } {
  const value = NAMED[input.trim().toLowerCase()] ?? input.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split('');
      return {
        r: parseInt(`${r}${r}`, 16),
        g: parseInt(`${g}${g}`, 16),
        b: parseInt(`${b}${b}`, 16),
        a: a === undefined ? 1 : parseInt(`${a}${a}`, 16) / 255,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
    throw new Error(`parseColor: unsupported hex colour '${input}'`);
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (match) {
    const parts = match[1]!.split(',').map((part) => Number.parseFloat(part.trim()));
    return {
      r: parts[0] ?? 0,
      g: parts[1] ?? 0,
      b: parts[2] ?? 0,
      a: parts[3] === undefined ? 1 : parts[3],
    };
  }
  throw new Error(`parseColor: unsupported colour '${input}'`);
}

export class Canvas {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
  readonly text: TextRenderer;

  constructor(width: number, height: number, text = new TextRenderer()) {
    this.width = width;
    this.height = height;
    // Zero-filled RGBA (opaque black is applied by the scene background pass).
    this.data = Buffer.alloc(width * height * 4);
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;
    this.text = text;
  }

  /** Overwrite this canvas with `source` (used to reuse a rasterized base frame). */
  copyFrom(source: Canvas): void {
    if (source.width !== this.width || source.height !== this.height) {
      throw new Error('Canvas.copyFrom: size mismatch');
    }
    source.data.copy(this.data);
  }

  /** Blend a colour over a rectangle with alpha compositing. */
  fill(x: number, y: number, width: number, height: number, color: string, alpha = 1): void {
    const rgb = parseColor(color);
    const factor = alpha * rgb.a;
    if (factor <= 0) return;
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + width));
    const y1 = Math.min(this.height, Math.ceil(y + height));
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        this.blendPixel(px, py, rgb, factor);
      }
    }
  }

  /** Vertical linear gradient (background wash). */
  fillGradientV(
    x: number,
    y: number,
    width: number,
    height: number,
    top: string,
    bottom: string,
    alpha = 1,
  ): void {
    const from = parseColor(top);
    const to = parseColor(bottom);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + width));
    const y1 = Math.min(this.height, Math.ceil(y + height));
    const span = Math.max(1, height);
    // Rows share one colour, so resolve it once per row and write bytes inline.
    for (let py = y0; py < y1; py += 1) {
      const t = Math.min(1, Math.max(0, (py - y) / span));
      const rowAlpha = alpha * (from.a + (to.a - from.a) * t);
      if (rowAlpha <= 0) continue;
      const r = Math.round(from.r + (to.r - from.r) * t);
      const g = Math.round(from.g + (to.g - from.g) * t);
      const b = Math.round(from.b + (to.b - from.b) * t);
      let index = (py * this.width + x0) * 4;
      for (let px = x0; px < x1; px += 1) {
        this.data[index] = Math.round(this.data[index]! * (1 - rowAlpha) + r * rowAlpha);
        this.data[index + 1] = Math.round(this.data[index + 1]! * (1 - rowAlpha) + g * rowAlpha);
        this.data[index + 2] = Math.round(this.data[index + 2]! * (1 - rowAlpha) + b * rowAlpha);
        index += 4;
      }
    }
  }

  /** Paint an anti-aliased polygon (already in canvas coordinates). */
  fillPolygon(points: Point[], color: string, alpha = 1): void {
    if (points.length < 3) return;
    const minX = Math.floor(Math.min(...points.map((p) => p.x)));
    const minY = Math.floor(Math.min(...points.map((p) => p.y)));
    const maxX = Math.ceil(Math.max(...points.map((p) => p.x)));
    const maxY = Math.ceil(Math.max(...points.map((p) => p.y)));
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (width <= 0 || height <= 0) return;
    const local = points.map((point) => ({ x: point.x - minX, y: point.y - minY }));
    const coverage = fillPolygons([local], width, height);
    this.paintCoverage(coverage, width, height, minX, minY, color, alpha);
  }

  fillRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string,
    alpha = 1,
  ): void {
    this.fillPolygon(roundRectPolygon(x, y, width, height, radius), color, alpha);
  }

  strokeRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string,
    thickness = 4,
    alpha = 1,
  ): void {
    const outer = roundRectPolygon(x, y, width, height, radius);
    const inner = roundRectPolygon(
      x + thickness,
      y + thickness,
      Math.max(1, width - thickness * 2),
      Math.max(1, height - thickness * 2),
      Math.max(0, radius - thickness),
    );
    // Even-odd effect via two consecutive nonzero fills is not possible, so
    // paint the ring as a polygon with a reversed inner contour.
    const ring = [outer, [...inner].reverse()];
    const minX = Math.floor(Math.min(...outer.map((p) => p.x)));
    const minY = Math.floor(Math.min(...outer.map((p) => p.y)));
    const maxX = Math.ceil(Math.max(...outer.map((p) => p.x)));
    const maxY = Math.ceil(Math.max(...outer.map((p) => p.y)));
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const coverage = fillPolygons(
      ring.map((contour) => contour.map((point) => ({ x: point.x - minX, y: point.y - minY }))),
      w,
      h,
    );
    this.paintCoverage(coverage, w, h, minX, minY, color, alpha);
  }

  /** Rotated rectangle — used for the ±2° diversification tilt. */
  fillTiltedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    degrees: number,
    color: string,
    alpha = 1,
  ): void {
    this.fillPolygon(rotatePolygon(rectPolygon(x, y, width, height), degrees), color, alpha);
  }

  /**
   * Draw text anchored by its top-left (or top-centre) corner.
   * Returns the metrics of the painted block so callers can stack content.
   */
  drawText(
    value: string,
    style: TextStyle & { x: number; y: number },
  ): { x: number; y: number; width: number; height: number; lines: string[] } {
    const block = this.text.layout(value, style);
    const padding = 2;
    if (block.width === 0 || block.height === 0) {
      return { x: style.x, y: style.y, width: 0, height: 0, lines: block.lines };
    }
    // `style.x` is the anchor: the left edge, the centre, or the right edge.
    const anchorOffset =
      style.align === 'center'
        ? Math.round(block.textWidth / 2)
        : style.align === 'right'
          ? Math.round(block.textWidth)
          : 0;
    const originX = Math.round(style.x) - anchorOffset - padding;
    const originY = Math.round(style.y) - padding;
    this.paintCoverage(
      block.mask,
      block.width,
      block.height,
      originX,
      originY,
      style.color ?? '#ffffff',
      1,
    );
    return {
      x: style.x,
      y: style.y,
      width: block.textWidth,
      height: block.height - padding * 2,
      lines: block.lines,
    };
  }

  /** Composite a coverage mask (text, glyph, shape) with alpha. */
  paintCoverage(
    mask: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number,
    color: string,
    alpha = 1,
  ): void {
    const rgb = parseColor(color);
    for (let row = 0; row < height; row += 1) {
      const py = y + row;
      if (py < 0 || py >= this.height) continue;
      for (let column = 0; column < width; column += 1) {
        const coverage = mask[row * width + column]!;
        if (coverage <= 0) continue;
        const px = x + column;
        if (px < 0 || px >= this.width) continue;
        this.blendPixel(px, py, rgb, alpha * rgb.a * coverage);
      }
    }
  }

  private blendPixel(px: number, py: number, rgb: Rgb, alpha: number): void {
    if (alpha <= 0) return;
    const index = (py * this.width + px) * 4;
    const inverse = 1 - alpha;
    this.data[index] = Math.round(this.data[index]! * inverse + rgb.r * alpha);
    this.data[index + 1] = Math.round(this.data[index + 1]! * inverse + rgb.g * alpha);
    this.data[index + 2] = Math.round(this.data[index + 2]! * inverse + rgb.b * alpha);
    this.data[index + 3] = 255;
  }
}
