/**
 * Product image compositing for the offline renderer.
 *
 * PNG SKUs are decoded with the built-in codec and drawn cover-fit with a
 * rounded-corner mask. Anything else (webp/jpeg without a native decoder) keeps
 * the deterministic placeholder, and the renderer reports it as
 * `W_ASSET_PLACEHOLDER` so the operator knows why a card is drawn as a stub.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { Canvas } from './canvas';
import { Canvas as CanvasClass } from './canvas';
import type { PngImage } from './png';
import { decodePng } from './png';
import { fillPolygons, roundRectPolygon } from './raster';

export function loadPng(filePath: string): PngImage | null {
  if (!existsSync(filePath)) return null;
  try {
    return decodePng(readFileSync(filePath));
  } catch {
    return null;
  }
}

export function isRenderableImage(filePath: string | undefined, rootDir: string): boolean {
  if (!filePath) return false;
  if (!/\.png$/i.test(filePath)) return false;
  return existsSync(`${rootDir}/${filePath}`.replaceAll('//', '/'));
}

/**
 * Draw `image` into the box using cover-fit (preserving aspect ratio, centre
 * crop) with anti-aliased rounded corners.
 */
export function drawImageCover(
  canvas: Canvas,
  image: PngImage,
  box: { x: number; y: number; width: number; height: number },
  radius = 0,
): void {
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const sourceWidth = box.width / scale;
  const sourceHeight = box.height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;

  const coverage =
    radius > 0
      ? fillPolygons(
          [
            roundRectPolygon(0, 0, Math.ceil(box.width), Math.ceil(box.height), radius).map(
              (point) => ({ x: point.x, y: point.y }),
            ),
          ],
          Math.ceil(box.width),
          Math.ceil(box.height),
        )
      : null;
  const coverageWidth = Math.ceil(box.width);

  for (let row = 0; row < Math.ceil(box.height); row += 1) {
    const targetY = Math.round(box.y) + row;
    if (targetY < 0 || targetY >= canvas.height) continue;
    const sampleY = sourceY + ((row + 0.5) * sourceHeight) / box.height;
    for (let column = 0; column < coverageWidth; column += 1) {
      const targetX = Math.round(box.x) + column;
      if (targetX < 0 || targetX >= canvas.width) continue;
      const alpha = coverage ? coverage[row * coverageWidth + column]! : 1;
      if (alpha <= 0.001) continue;
      const sampleX = sourceX + ((column + 0.5) * sourceWidth) / box.width;
      const { r, g, b } = bilinear(image, sampleX, sampleY);
      const target = (targetY * canvas.width + targetX) * 4;
      canvas.data[target] = Math.round(canvas.data[target]! * (1 - alpha) + r * alpha);
      canvas.data[target + 1] = Math.round(canvas.data[target + 1]! * (1 - alpha) + g * alpha);
      canvas.data[target + 2] = Math.round(canvas.data[target + 2]! * (1 - alpha) + b * alpha);
      canvas.data[target + 3] = 255;
    }
  }
}

function bilinear(image: PngImage, x: number, y: number): { r: number; g: number; b: number } {
  const clampedX = Math.min(Math.max(x, 0), image.width - 1);
  const clampedY = Math.min(Math.max(y, 0), image.height - 1);
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(x0 + 1, image.width - 1);
  const y1 = Math.min(y0 + 1, image.height - 1);
  const fx = clampedX - x0;
  const fy = clampedY - y0;
  const mix = (channel: number): number => {
    const topLeft = image.data[(y0 * image.width + x0) * 4 + channel]!;
    const topRight = image.data[(y0 * image.width + x1) * 4 + channel]!;
    const bottomLeft = image.data[(y1 * image.width + x0) * 4 + channel]!;
    const bottomRight = image.data[(y1 * image.width + x1) * 4 + channel]!;
    const top = topLeft + (topRight - topLeft) * fx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * fx;
    return top + (bottom - top) * fy;
  };
  return { r: mix(0), g: mix(1), b: mix(2) };
}

/** Shared empty-canvas factory (keeps `canvas` import cycle-free for callers). */
export function createCanvas(width: number, height: number): Canvas {
  return new CanvasClass(width, height);
}
