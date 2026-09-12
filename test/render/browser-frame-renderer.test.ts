import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { renderFixture } from '../helpers/render';
import { BrowserFrameRenderer, findBrowserExecutable } from '../../src/render/browserFrameRenderer';
import { DEFAULT_RENDER_CONFIG } from '../../src/render/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('BrowserFrameRenderer', () => {
  it('identifies backend as browser', () => {
    const renderer = new BrowserFrameRenderer();
    expect(renderer.backend).toBe('browser');
  });

  it('detects system Chrome or Edge executable', () => {
    const execPath = findBrowserExecutable();
    // On Windows development machines, Chrome or Edge is typically installed
    if (process.platform === 'win32') {
      expect(execPath).not.toBeNull();
      expect(existsSync(execPath!)).toBe(true);
    }
  });

  it('renders frames using headless browser when available, producing PNG frames', async () => {
    const execPath = findBrowserExecutable();
    if (!execPath) {
      // Skip test if environment has no browser
      return;
    }

    const input = await renderFixture({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p042'],
      seed: 839271,
      rootDir: ROOT,
    });

    const renderer = new BrowserFrameRenderer();
    const testFramesDir = path.join(ROOT, 'temp', 'test_browser_frames');
    if (existsSync(testFramesDir)) {
      rmSync(testFramesDir, { recursive: true, force: true });
    }
    mkdirSync(testFramesDir, { recursive: true });

    // Render a short snippet (e.g. 5 frames) to verify headless browser capture
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

      expect(result.frameCount).toBe(frameCount);
      expect(result.width).toBe(width);
      expect(result.height).toBe(height);

      const files = readdirSync(testFramesDir).filter((f) => f.endsWith('.png'));
      expect(files.length).toBe(frameCount);
      expect(files[0]).toBe('frame_00000.png');
    } finally {
      if (existsSync(testFramesDir)) {
        rmSync(testFramesDir, { recursive: true, force: true });
      }
    }
  });
});
