import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameEngine, MechanicRegistry } from '../../src/game';
import { generatePreviewHtml, writePreviewFile } from '../../src/preview';
import { product } from '../helpers/products';

describe('HTML preview', () => {
  it('generates an autoplaying 18-second preview for all seven scenes', () => {
    const products = [product('p001', 189000), product('p042', 2490000)];
    const output = MechanicRegistry.get('HI_LO').create({
      products,
      seed: 839271,
    });
    const computed = GameEngine.compute(output.game, products);
    const html = generatePreviewHtml(output.game, products, {
      computed,
      sceneData: output.sceneData,
    });
    expect(html).toContain('data-scene="countdown"');
    expect(html).toContain('requestAnimationFrame');
    expect(html).toContain('countdown ticks: 6');
    expect(html).toContain('data-reveal-type="PriceReveal"');
    expect(html).toContain('18s');
  });

  it('writes a mechanic-named file and keeps a comment answer hidden', () => {
    const products = [product('p001', 189000), product('p015', 890000), product('p028', 450000)];
    const output = MechanicRegistry.get('MOST_EXPENSIVE').create({
      products,
      seed: 839272,
      resultVariant: 'comment',
    });
    const computed = GameEngine.compute(output.game, products);
    const directory = mkdtempSync(path.join(os.tmpdir(), 'auto-drawing-preview-'));
    const file = writePreviewFile(output.game, products, {
      outputDir: directory,
      computed,
      sceneData: output.sceneData,
    });
    const html = readFileSync(file, 'utf8');
    expect(file).toBe(path.join(directory, 'preview_most_expensive.html'));
    expect(html).toContain('Đáp án ở comment');
    expect(html).not.toContain('Đáp án: p015');
  });
});
