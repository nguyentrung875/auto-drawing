/**
 * Layout gate for painted frames (the visual-regression check).
 *
 * Three blocking defects reached "done" epics with every test green, because
 * every test asserted on *scene data* while the bug lived in *pixels*:
 *
 *  1. the MOST_EXPENSIVE answer caption was painted on top of the third card;
 *  2. a card's name was painted on top of its own price once the card scaled;
 *  3. cards rendered the masked `???` label at reveal instead of the price.
 *
 * `validateProductCards()` compares card rectangles to each other, so it is
 * structurally blind to text-vs-card and text-vs-text overlap. This module
 * closes that gap by reading what the painter actually drew
 * (`Canvas.paintedText`) and asserting the properties a viewer would notice:
 * text must stay on screen, and must not collide with other text.
 *
 * It is intentionally geometric rather than a golden-image diff: golden images
 * break on every legitimate design change and get regenerated without being
 * read, which is how a "passing" snapshot suite hides a real regression.
 */
import type { Canvas, PaintedText } from './canvas';

export interface LayoutFinding {
  code: 'L_TEXT_OVERLAP' | 'L_TEXT_OFFSCREEN' | 'L_TEXT_CLIPPED';
  hint: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersection(a: Box, b: Box): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

function area(box: Box): number {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

function describe(text: PaintedText): string {
  const label = text.value.replace(/\s+/g, ' ').trim();
  const short = label.length > 28 ? `${label.slice(0, 25)}…` : label;
  return `'${short}' @ (${Math.round(text.x)},${Math.round(text.y)}) ${Math.round(text.width)}×${Math.round(text.height)}`;
}

export interface LayoutScanOptions {
  /**
   * Fraction of the smaller block that may overlap before it is a finding.
   * Antialiased glyph boxes touch by a pixel or two legitimately; a real
   * collision buries a meaningful share of one block.
   */
  overlapTolerance?: number;
}

/**
 * Inspect the text painted on `canvas` and return everything a viewer would
 * read as broken. An empty array means the frame is clean.
 */
export function scanLayout(canvas: Canvas, options: LayoutScanOptions = {}): LayoutFinding[] {
  const tolerance = options.overlapTolerance ?? 0.18;
  const findings: LayoutFinding[] = [];
  const blocks = canvas.paintedText.filter((text) => text.value.trim().length > 0 && area(text) > 0);

  for (const text of blocks) {
    if (
      text.x < 0 ||
      text.y < 0 ||
      text.x + text.width > canvas.width ||
      text.y + text.height > canvas.height
    ) {
      findings.push({
        code: 'L_TEXT_OFFSCREEN',
        hint: `text runs outside the ${canvas.width}×${canvas.height} frame: ${describe(text)}`,
      });
    }
  }

  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i]!;
      const b = blocks[j]!;
      const overlap = intersection(a, b);
      if (overlap === 0) continue;
      const smaller = Math.min(area(a), area(b));
      if (smaller === 0) continue;
      if (overlap / smaller > tolerance) {
        findings.push({
          code: 'L_TEXT_OVERLAP',
          hint:
            `text collides (${Math.round((overlap / smaller) * 100)}% of the smaller block): ` +
            `${describe(a)} vs ${describe(b)}`,
        });
      }
    }
  }

  return findings;
}

/** Throw when a painted frame has layout findings. Used by the render gate. */
export function assertLayoutClean(canvas: Canvas, context: string): void {
  const findings = scanLayout(canvas);
  if (findings.length === 0) return;
  const detail = findings.map((finding) => `  [${finding.code}] ${finding.hint}`).join('\n');
  throw new Error(`layout scan failed for ${context}:\n${detail}`);
}
