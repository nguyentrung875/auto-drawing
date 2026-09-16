import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { renderFixture } from '../helpers/render';
import { SatoriFrameRenderer } from '../../src/render/satoriFrameRenderer';
import { DEFAULT_RENDER_CONFIG } from '../../src/render/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('SatoriFrameRenderer', () => {
  it('identifies backend as satori', () => {
    const renderer = new SatoriFrameRenderer();
    expect(renderer.backend).toBe('satori');
  });

  it('renders frames using Satori and resvg producing valid 1080x1920 PNG files', async () => {
    const input = await renderFixture({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p002'],
      seed: 839271,
      rootDir: ROOT,
    });

    const renderer = new SatoriFrameRenderer();
    const testFramesDir = path.join(ROOT, 'temp', 'test_satori_frames');
    if (existsSync(testFramesDir)) {
      rmSync(testFramesDir, { recursive: true, force: true });
    }
    mkdirSync(testFramesDir, { recursive: true });

    const frameCount = 5;
    const fps = 30;
    const width = 1080;
    const height = 1920;

    try {
      const result = await renderer.renderFrames(input, {
        config: { ...DEFAULT_RENDER_CONFIG, width, height, fps },
        framesDir: testFramesDir,
        width,
        height,
        fps,
        frameCount,
      });

      expect(result.backend).toBe('satori');
      expect(result.frameCount).toBe(frameCount);
      expect(result.renderedFrames).toBe(frameCount);

      const files = readdirSync(testFramesDir).filter((f) => f.endsWith('.png'));
      expect(files.length).toBe(frameCount);
      expect(files[0]).toBe('frame_00001.png');

      const firstFileStats = statSync(path.join(testFramesDir, files[0]));
      expect(firstFileStats.size).toBeGreaterThan(10000);
    } finally {
      if (existsSync(testFramesDir)) {
        rmSync(testFramesDir, { recursive: true, force: true });
      }
    }
  }, 30000);

  it('renders MOST_EXPENSIVE mechanic cards cleanly', async () => {
    const input = await renderFixture({
      mechanic: 'MOST_EXPENSIVE',
      productIds: ['p001', 'p002', 'p003'],
      seed: 839271,
      rootDir: ROOT,
    });

    const renderer = new SatoriFrameRenderer();
    const testFramesDir = path.join(ROOT, 'temp', 'test_satori_most_expensive');
    if (existsSync(testFramesDir)) {
      rmSync(testFramesDir, { recursive: true, force: true });
    }
    mkdirSync(testFramesDir, { recursive: true });

    try {
      const result = await renderer.renderFrames(input, {
        config: { ...DEFAULT_RENDER_CONFIG, width: 1080, height: 1920, fps: 30 },
        framesDir: testFramesDir,
        width: 1080,
        height: 1920,
        fps: 30,
        frameCount: 2,
      });

      expect(result.backend).toBe('satori');
      expect(result.frameCount).toBe(2);
      const files = readdirSync(testFramesDir).filter((f) => f.endsWith('.png'));
      expect(files.length).toBe(2);
    } finally {
      if (existsSync(testFramesDir)) {
        rmSync(testFramesDir, { recursive: true, force: true });
      }
    }
  });

  it('renders ONE_AWAY digit grid layout cleanly', async () => {
    const input = await renderFixture({
      mechanic: 'ONE_AWAY',
      productIds: ['p001'],
      seed: 839271,
      rootDir: ROOT,
    });

    const renderer = new SatoriFrameRenderer();
    const testFramesDir = path.join(ROOT, 'temp', 'test_satori_one_away');
    if (existsSync(testFramesDir)) {
      rmSync(testFramesDir, { recursive: true, force: true });
    }
    mkdirSync(testFramesDir, { recursive: true });

    try {
      const result = await renderer.renderFrames(input, {
        config: { ...DEFAULT_RENDER_CONFIG, width: 1080, height: 1920, fps: 30 },
        framesDir: testFramesDir,
        width: 1080,
        height: 1920,
        fps: 30,
        frameCount: 2,
      });

      expect(result.backend).toBe('satori');
      expect(result.frameCount).toBe(2);
      const files = readdirSync(testFramesDir).filter((f) => f.endsWith('.png'));
      expect(files.length).toBe(2);
    } finally {
      if (existsSync(testFramesDir)) {
        rmSync(testFramesDir, { recursive: true, force: true });
      }
    }
  });
});
