/**
 * The visual-regression gate.
 *
 * Every reveal frame of every mechanic, at every supported card count, is
 * painted and inspected for the defect class that scene-data tests cannot see:
 * text drawn on top of other text, or text drawn off the frame.
 *
 * The first two cases below are the two blockers that actually shipped. They
 * are pinned here at the pixel level so they cannot come back quietly.
 */
import { describe, expect, it } from 'vitest';
import { Canvas } from '../../src/render/canvas';
import { scanLayout } from '../../src/render/layoutScan';
import { paintFrame } from '../../src/render/scenePainter';
import { GameEngine, MechanicRegistry } from '../../src/game';
import { SceneSystem } from '../../src/scene';
import type { Product } from '../../src/product/schema';
import type { RenderFrame, RenderGameView, RenderSceneDataView } from '../../src/render/types';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p015 = product('p015', 450000);
const p028 = product('p028', 1250000);
const p042 = product('p042', 720000);

const STAGE_WIDTH = 1080;
const STAGE_HEIGHT = 1920;

function paintAllFrames(
  mechanic: 'HI_LO' | 'MOST_EXPENSIVE' | 'ONE_AWAY',
  products: Product[],
  variant: 'in_video' | 'comment' = 'in_video',
): Array<{ scene: string; canvas: Canvas }> {
  const output = MechanicRegistry.get(mechanic).create({
    products,
    seed: 839271,
    hiddenIndex: mechanic === 'ONE_AWAY' ? 3 : undefined,
  });
  const computed = GameEngine.compute(output.game, products);
  const scenes = SceneSystem.render(output.game, {
    products,
    computed,
    sceneData: output.sceneData,
    timeline: computed.timeline,
  });

  const painted: Array<{ scene: string; canvas: Canvas }> = [];
  for (const scene of scenes.scenes) {
    for (const frame of scene.frames) {
      const canvas = new Canvas(STAGE_WIDTH, STAGE_HEIGHT);
      paintFrame(canvas, frame as unknown as RenderFrame, {
        game: output.game as unknown as RenderGameView,
        products: products as unknown as never,
        sceneData: (frame.data ?? output.sceneData) as unknown as RenderSceneDataView,
        diversification: { bgColor: '#111827', tilt: 0, bgm: 'calm' },
        variant,
        rootDir: process.cwd(),
        tilt: false,
        warnings: [],
      });
      painted.push({ scene: scene.name, canvas });
    }
  }
  return painted;
}

const cases = [
  { mechanic: 'HI_LO' as const, products: [p001, p042], label: '2 cards' },
  { mechanic: 'MOST_EXPENSIVE' as const, products: [p001, p015, p028], label: '3 cards' },
  {
    mechanic: 'MOST_EXPENSIVE' as const,
    products: [p001, p015, p028, p042],
    label: '4 cards',
  },
  { mechanic: 'ONE_AWAY' as const, products: [p001], label: 'digit reveal' },
];

describe('layout gate — no painted frame has colliding or off-screen text', () => {
  for (const { mechanic, products, label } of cases) {
    for (const variant of ['in_video', 'comment'] as const) {
      it(`${mechanic} (${label}, ${variant}) paints every scene cleanly`, () => {
        const frames = paintAllFrames(mechanic, products, variant);
        expect(frames.length).toBeGreaterThan(0);

        const problems = frames.flatMap(({ scene, canvas }) =>
          scanLayout(canvas).map((finding) => `${scene}: [${finding.code}] ${finding.hint}`),
        );
        expect(problems).toEqual([]);
      });
    }
  }

  it('paints text on the reveal frame at all (the scan cannot pass vacuously)', () => {
    const frames = paintAllFrames('MOST_EXPENSIVE', [p001, p015, p028]);
    const reveal = frames.find((frame) => frame.scene === 'reveal');
    expect(reveal).toBeDefined();
    // A blank canvas would satisfy every overlap assertion above.
    expect(reveal!.canvas.paintedText.length).toBeGreaterThan(3);
  });
});

describe('layout gate — detects the defects that shipped', () => {
  it('flags text painted on top of other text', () => {
    const canvas = new Canvas(STAGE_WIDTH, STAGE_HEIGHT);
    // Reproduces blocker #1: the answer caption landing on a card's price.
    canvas.drawText('1,250,000', { x: 540, y: 1300, size: 44, weight: 700, align: 'center' });
    canvas.drawText('Nồi chiên không dầu', {
      x: 540,
      y: 1300,
      size: 44,
      weight: 700,
      align: 'center',
    });

    const findings = scanLayout(canvas);
    expect(findings.map((finding) => finding.code)).toContain('L_TEXT_OVERLAP');
  });

  it('flags text painted outside the frame', () => {
    const canvas = new Canvas(STAGE_WIDTH, STAGE_HEIGHT);
    canvas.drawText('Sản phẩm đắt nhất', {
      x: 540,
      y: STAGE_HEIGHT - 10,
      size: 96,
      weight: 700,
      align: 'center',
    });

    const findings = scanLayout(canvas);
    expect(findings.map((finding) => finding.code)).toContain('L_TEXT_OFFSCREEN');
  });

  it('tolerates adjacent text that merely touches', () => {
    const canvas = new Canvas(STAGE_WIDTH, STAGE_HEIGHT);
    canvas.drawText('Giá đúng', { x: 540, y: 1200, size: 48, weight: 400, align: 'center' });
    canvas.drawText('3,990,000', { x: 540, y: 1264, size: 48, weight: 700, align: 'center' });

    expect(scanLayout(canvas)).toEqual([]);
  });
});
