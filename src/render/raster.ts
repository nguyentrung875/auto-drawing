/**
 * Shared software rasterization helpers for the offline renderer.
 *
 * `fillPolygons` is a nonzero-winding scanline fill with 4× vertical
 * supersampling and exact horizontal coverage. Both the TrueType glyph
 * rasterizer and the canvas shape drawing rely on it, so shapes and text share
 * identical anti-aliasing behaviour.
 */
import type { Point } from './geometry';

const SUB_SCANLINES = 4;

export function fillPolygons(
  polylines: Point[][],
  width: number,
  height: number,
): Float32Array {
  const coverage = new Float32Array(width * height);
  if (width <= 0 || height <= 0) return coverage;

  const edges: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const points of polylines) {
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      if (a.y !== b.y) edges.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
    }
  }
  if (edges.length === 0) return coverage;

  const weight = 1 / SUB_SCANLINES;
  const crossings: Array<{ x: number; dir: number }> = [];
  for (let row = 0; row < height; row += 1) {
    for (let sub = 0; sub < SUB_SCANLINES; sub += 1) {
      const y = row + (sub + 0.5) / SUB_SCANLINES;
      crossings.length = 0;
      for (const edge of edges) {
        const minY = Math.min(edge.y0, edge.y1);
        const maxY = Math.max(edge.y0, edge.y1);
        if (y < minY || y >= maxY) continue;
        const t = (y - edge.y0) / (edge.y1 - edge.y0);
        crossings.push({ x: edge.x0 + t * (edge.x1 - edge.x0), dir: edge.y1 > edge.y0 ? 1 : -1 });
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a.x - b.x);
      let winding = 0;
      let spanStart = 0;
      for (const crossing of crossings) {
        if (winding === 0) spanStart = crossing.x;
        winding += crossing.dir;
        if (winding === 0) addSpan(coverage, width, row, spanStart, crossing.x, weight);
      }
    }
  }
  for (let i = 0; i < coverage.length; i += 1) {
    if (coverage[i]! > 1) coverage[i] = 1;
  }
  return coverage;
}

function addSpan(
  coverage: Float32Array,
  width: number,
  row: number,
  from: number,
  to: number,
  weight: number,
): void {
  if (!(to > from)) return;
  const rowOffset = row * width;
  const first = Math.max(0, Math.floor(from));
  const last = Math.min(width - 1, Math.ceil(to) - 1);
  for (let x = first; x <= last; x += 1) {
    const left = Math.max(from, x);
    const right = Math.min(to, x + 1);
    if (right > left) coverage[rowOffset + x] += weight * (right - left);
  }
}

/** Rectangle outline as a closed 4-point polyline. */
export function rectPolygon(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/** Rounded-rectangle outline (4 straight runs + 4 quadratic corners). */
export function roundRectPolygon(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): Point[] {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  if (r === 0) return rectPolygon(x, y, width, height);
  const points: Point[] = [];
  const corner = (
    cx: number,
    cy: number,
    fromAngle: number,
    toAngle: number,
  ): void => {
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const angle = fromAngle + ((toAngle - fromAngle) * i) / steps;
      points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
  };
  corner(x + width - r, y + r, -Math.PI / 2, 0);
  corner(x + width - r, y + height - r, 0, Math.PI / 2);
  corner(x + r, y + height - r, Math.PI / 2, Math.PI);
  corner(x + r, y + r, Math.PI, 1.5 * Math.PI);
  return points;
}

/** Rotate a polygon around its own centre (used for the ±2° diversification tilt). */
export function rotatePolygon(points: Point[], degrees: number): Point[] {
  if (degrees === 0) return points;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return points.map((point) => ({
    x: cx + (point.x - cx) * cos - (point.y - cy) * sin,
    y: cy + (point.x - cx) * sin + (point.y - cy) * cos,
  }));
}
