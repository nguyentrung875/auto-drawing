import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import { ProductProvider } from '../../src/product/ProductProvider';
import path from 'node:path';

describe('All-in-One Engine Integration Test', () => {
  it('curates a G9 challenge from live product catalog and computes valid timeline', async () => {
    const provider = new ProductProvider(path.resolve(process.cwd(), 'products'), { watch: false });
    const products = provider.getAll();
    expect(products.length).toBeGreaterThanOrEqual(3);

    const curator = new ChallengeCurator();
    const challenge = curator.curate(g9Definition, products, 839271);
    expect(challenge.rounds.length).toBe(3);

    const scene = new AllInOneScene(challenge);
    const timeline = scene.getTimeline();
    expect(timeline.totalDuration).toBe(23.5);
    expect(timeline.slots.length).toBeGreaterThanOrEqual(6);
  });
});
