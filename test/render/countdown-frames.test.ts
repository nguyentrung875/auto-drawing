/**
 * Regression guard for the countdown.
 *
 * The software renderer cached one raster per *scene name*. The countdown scene
 * emits six frames (one per half-second tick), so all six reused the first
 * tick's image: the ring animated while the number sat frozen on "3" for the
 * entire countdown. Every existing test passed, because the scene data was
 * correct — only the pixels were wrong.
 *
 * These tests pin both halves: distinct ticks must rasterise distinctly, and
 * the digits a viewer reads must be whole seconds counting down to 1.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Canvas } from '../../src/render/canvas';
import { paintFrame } from '../../src/render/scenePainter';
import { GameEngine, MechanicRegistry } from '../../src/game';
import { SceneSystem } from '../../src/scene';
import type { RenderFrame, RenderGameView, RenderSceneDataView } from '../../src/render/types';
import { product } from '../helpers/products';

const products = [product('p001', 189000), product('p042', 720000)];

function countdownFrames() {
  const output = MechanicRegistry.get('HI_LO').create({ products, seed: 839271 });
  const computed = GameEngine.compute(output.game, products);
  const scenes = SceneSystem.render(output.game, {
    products,
    computed,
    sceneData: output.sceneData,
    timeline: computed.timeline,
  });
  const countdown = scenes.scenes.find((scene) => scene.name === 'countdown');
  expect(countdown).toBeDefined();
  return { game: output.game, frames: countdown!.frames };
}

function paint(game: unknown, frame: unknown): Canvas {
  const canvas = new Canvas(1080, 1920);
  paintFrame(canvas, frame as RenderFrame, {
    game: game as RenderGameView,
    products: products as unknown as never,
    sceneData: (frame as { data?: unknown }).data as RenderSceneDataView,
    diversification: { bgColor: '#111827', tilt: 0, bgm: 'calm' },
    variant: 'in_video',
    rootDir: process.cwd(),
    tilt: false,
    warnings: [],
  });
  return canvas;
}

describe('countdown', () => {
  it('counts down in whole seconds and never shows a fractional tick', () => {
    const { frames } = countdownFrames();
    const shown = frames.map((frame) => {
      const element = (frame.elements as Array<Record<string, unknown>>).find(
        (candidate) => candidate.kind === 'countdown',
      );
      return String(element?.text ?? '');
    });

    expect(shown.length).toBeGreaterThan(1);
    for (const value of shown) {
      // "2.5" or "0.5" on screen reads as a stopwatch, not a countdown.
      expect(value).toMatch(/^[1-9]\d*$/);
    }
    // Monotonically non-increasing, ending on 1 — never 0.
    const numbers = shown.map(Number);
    for (let i = 1; i < numbers.length; i += 1) {
      expect(numbers[i]!).toBeLessThanOrEqual(numbers[i - 1]!);
    }
    expect(numbers.at(-1)).toBe(1);
    expect(new Set(numbers).size).toBeGreaterThan(1);
  });

  it('rasterises each tick differently (the cache must not collapse them)', () => {
    const { game, frames } = countdownFrames();
    // Hash the whole buffer: sampling a corner only compares background pixels.
    const digests = frames.map((frame) =>
      createHash('sha256').update(paint(game, frame).data).digest('hex'),
    );

    // The first and last tick show different numbers, so their pixels differ.
    expect(digests[0]).not.toBe(digests.at(-1));
    expect(new Set(digests).size).toBeGreaterThan(1);
  });
});
