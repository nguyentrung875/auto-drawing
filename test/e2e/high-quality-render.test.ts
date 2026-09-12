import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync, rmSync } from 'node:fs';
import { renderFixture, probeVideoInfo, scanForBurn } from '../helpers/render';
import { RenderEngine } from '../../src/render/RenderEngine';
import { findBrowserExecutable } from '../../src/render/browserFrameRenderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('E2E High-Quality 1080x1920 Browser Video Render', () => {
  it('renders a full vertical MP4 with 1080x1920 resolution, audio track, and clean safe area', async () => {
    const browserExec = findBrowserExecutable();
    if (!browserExec) {
      console.log('Skipping E2E browser test: No Chrome/Edge binary found.');
      return;
    }

    const exportDir = `${ROOT}/temp/e2e_export_${Date.now()}`;
    const tempDir = `${ROOT}/temp/e2e_tmp_${Date.now()}`;

    const input = await renderFixture({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p042'],
      seed: 123456,
      rootDir: ROOT,
      exportDir,
      tempDir,
    });

    const engine = new RenderEngine({
      rootDir: ROOT,
      config: {
        frameRenderer: 'browser',
      },
    });

    try {
      const output = await engine.render(input);

      // 1. Output file exists
      expect(output.videoPath).toBeTruthy();
      expect(existsSync(output.videoPath)).toBe(true);

      // 2. File size is realistic for 1080x1920 video (> 500 KB)
      const stats = statSync(output.videoPath);
      expect(stats.size).toBeGreaterThan(500 * 1024);

      // 3. Probing streams
      const probe = await probeVideoInfo(output.videoPath);
      if (probe) {
        expect(probe.width).toBe(1080);
        expect(probe.height).toBe(1920);
        expect(probe.durationMs).toBeGreaterThanOrEqual(15000);
        expect(Boolean(probe.audioCodec)).toBe(true);
      }

      // 4. Safe area and affiliate link burn scan
      const scanResult = await scanForBurn(output.videoPath, 'https://shope.ee/sample-affiliate-link');
      expect(scanResult.burned).toBe(false);
    } finally {
      if (existsSync(exportDir)) {
        rmSync(exportDir, { recursive: true, force: true });
      }
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }, 120000);
});
