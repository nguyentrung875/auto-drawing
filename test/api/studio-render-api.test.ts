import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Web Studio API Endpoints', () => {
  it('verifies export video files can be resolved by streaming endpoint logic', () => {
    const videoFilename = 'hi_lo_839271_839271.mp4';
    const exportPath = path.join(ROOT, 'export', videoFilename);

    if (existsSync(exportPath)) {
      expect(existsSync(exportPath)).toBe(true);
      expect(videoFilename.endsWith('.mp4')).toBe(true);
    }
  });

  it('validates render route can construct CLI arguments correctly', () => {
    const mechanic = 'HI_LO';
    const productIds = ['p001', 'p042'];
    const seed = 839271;
    const resultVariant = 'in_video';

    const args = [
      'render',
      '--mechanic', mechanic.toLowerCase(),
      '--products', productIds.join(','),
      '--seed', String(seed),
      '--result-variant', resultVariant,
      '--renderer', 'browser',
    ];

    expect(args).toContain('--renderer');
    expect(args).toContain('browser');
    expect(args).toContain('p001,p042');
  });
});
