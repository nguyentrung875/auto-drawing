import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { SatoriFrameRenderer } from '../../src/render/satoriFrameRenderer';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { ProductProvider } from '../../src/product/ProductProvider';
import { g1Definition } from '../../src/definitions/g1_hi_lo';
import { g2Definition } from '../../src/definitions/g2_most_expensive';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import { DEFAULT_RENDER_CONFIG } from '../../src/render/types';

describe('SatoriFrameRenderer — Multi-Round Challenge Pipeline', () => {
  const rootDir = process.cwd();
  const provider = new ProductProvider(path.resolve(rootDir, 'products'), { watch: false });
  const products = provider.getAll();
  const curator = new ChallengeCurator();

  it('renders a multi-round video with dai_hoi_sieu_thi theme and flexible timer', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'satori-multi-test-'));
    const framesDir = path.join(tempDir, 'frames');

    try {
      const challenge = curator.curate(g1Definition, products, 839271, {
        totalRounds: 2,
        timerSeconds: 3.0,
      });

      expect(challenge.rounds).toHaveLength(2);
      expect(challenge.rounds[0]!.timerSeconds).toBe(3.0);

      const scene = new AllInOneScene(challenge);
      const timeline = scene.getTimeline();
      // Timeline duration: 1.0s (hook) + 2 * (3.0s + 2.0s) + 1.5s (scorecard) = 12.5s
      expect(timeline.totalDuration).toBe(12.5);

      const renderer = new SatoriFrameRenderer();
      const fps = 30;
      const frameCount = Math.round(timeline.totalDuration * fps);

      const renderInput = {
        challenge,
        game: {
          metadata: { gameId: challenge.gameId, mechanic: 'HI_LO' as any, seed: 839271 },
          content: { title: challenge.title },
          gameplay: {},
          entities: challenge.rounds.flatMap((r) => r.products),
          publishing: { caption: challenge.title, hashtags: ['#game', '#multi'] },
        },
        timeline: { slots: timeline.slots, totalDuration: timeline.totalDuration },
        theme: 'dai_hoi_sieu_thi',
        rootDir,
      };

      const result = await renderer.renderFrames(renderInput as any, {
        framesDir,
        width: 1080,
        height: 1920,
        fps,
        frameCount,
        config: DEFAULT_RENDER_CONFIG,
      });

      expect(result.renderedFrames).toBe(frameCount);
      expect(existsSync(path.join(framesDir, 'frame_00001.png'))).toBe(true);
      expect(existsSync(path.join(framesDir, `frame_${String(frameCount).padStart(5, '0')}.png`))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 90000);

  it('renders multi-round for 3-product mechanic (MOST_EXPENSIVE) with custom rounds', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'satori-multi-g2-'));
    const framesDir = path.join(tempDir, 'frames');

    try {
      const challenge = curator.curate(g2Definition, products, 42, {
        totalRounds: 3,
        timerSeconds: 4.0,
      });

      expect(challenge.rounds).toHaveLength(3);
      expect(challenge.rounds[0]!.timerSeconds).toBe(4.0);

      const scene = new AllInOneScene(challenge);
      const timeline = scene.getTimeline();
      // Timeline duration: 1.0s (hook) + 3 * (4.0s + 2.0s) + 1.5s (scorecard) = 20.5s
      expect(timeline.totalDuration).toBe(20.5);

      const renderer = new SatoriFrameRenderer();
      const fps = 30;
      // Test first 60 frames (2 seconds covering hook and start of round 1)
      const frameCount = 60;

      const renderInput = {
        challenge,
        game: {
          metadata: { gameId: challenge.gameId, mechanic: 'MOST_EXPENSIVE' as any, seed: 42 },
          content: { title: challenge.title },
          gameplay: {},
          entities: challenge.rounds.flatMap((r) => r.products),
          publishing: { caption: challenge.title, hashtags: ['#game', '#multi'] },
        },
        timeline: { slots: timeline.slots, totalDuration: timeline.totalDuration },
        theme: 'dai_hoi_sieu_thi',
        rootDir,
      };

      const result = await renderer.renderFrames(renderInput as any, {
        framesDir,
        width: 1080,
        height: 1920,
        fps,
        frameCount,
        config: DEFAULT_RENDER_CONFIG,
      });

      expect(result.renderedFrames).toBe(frameCount);
      expect(existsSync(path.join(framesDir, 'frame_00001.png'))).toBe(true);
      expect(existsSync(path.join(framesDir, 'frame_00060.png'))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
