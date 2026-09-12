import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFixture } from '../helpers/render';
import { generateRenderHtml } from '../../src/render/template/renderTemplate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('generateRenderHtml', () => {
  it('generates HTML containing 1080x1920 viewport and window.__SEEK_FRAME__ for HI_LO', async () => {
    const input = await renderFixture({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p002'],
      seed: 839271,
      rootDir: ROOT,
    });

    const html = generateRenderHtml(input);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('1080');
    expect(html).toContain('1920');
    expect(html).toContain('__SEEK_FRAME__');
    expect(html).toContain(input.game.content.question);
    expect(html).toContain(input.products[0].name);
    expect(html).toContain(input.products[1].name);
    expect(html).toContain('hook');
    expect(html).toContain('countdown');
    expect(html).toContain('reveal');
  });

  it('generates HTML for ONE_AWAY with masked digit reveal', async () => {
    const input = await renderFixture({
      mechanic: 'ONE_AWAY',
      productIds: ['p001'],
      seed: 839273,
      rootDir: ROOT,
    });

    const html = generateRenderHtml(input);

    expect(html).toContain('__SEEK_FRAME__');
    expect(html).toContain(input.products[0].name);
    expect(html).toContain('one-away');
  });

  it('generates HTML for MOST_EXPENSIVE with 3 cards', async () => {
    const input = await renderFixture({
      mechanic: 'MOST_EXPENSIVE',
      productIds: ['p001', 'p002', 'p003'],
      seed: 839272,
      rootDir: ROOT,
    });

    const html = generateRenderHtml(input);

    expect(html).toContain('__SEEK_FRAME__');
    expect(html).toContain(input.products[0].name);
    expect(html).toContain(input.products[1].name);
    expect(html).toContain(input.products[2].name);
  });
});
