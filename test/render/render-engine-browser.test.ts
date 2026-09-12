import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, rmSync } from 'node:fs';
import { renderFixture } from '../helpers/render';
import { RenderEngine } from '../../src/render/RenderEngine';
import { findBrowserExecutable } from '../../src/render/browserFrameRenderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('RenderEngine with Browser Frame Renderer', () => {
  it('selects browser frame renderer and produces high-quality video', async () => {
    const browserExec = findBrowserExecutable();
    if (!browserExec) {
      // Skip if environment has no Chrome/Edge
      return;
    }

    const input = await renderFixture({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p042'],
      seed: 839271,
      rootDir: ROOT,
      exportDir: `${ROOT}/temp/test_export`,
      tempDir: `${ROOT}/temp/test_tmp`,
    });

    const engine = new RenderEngine({
      rootDir: ROOT,
      config: {
        frameRenderer: 'browser',
      },
    });

    try {
      const output = await engine.render(input);
      expect(output.videoPath).toBeTruthy();
      expect(existsSync(output.videoPath)).toBe(true);
      expect(output.width).toBe(1080);
      expect(output.height).toBe(1920);
    } finally {
      if (existsSync(`${ROOT}/temp/test_export`)) {
        rmSync(`${ROOT}/temp/test_export`, { recursive: true, force: true });
      }
      if (existsSync(`${ROOT}/temp/test_tmp`)) {
        rmSync(`${ROOT}/temp/test_tmp`, { recursive: true, force: true });
      }
    }
  }, 120000);
});
