import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import type { Product } from '../../src/product/schema';

const mockCatalog: Product[] = [
  {
    productId: 'p001',
    name: 'Ốp lưng điện thoại',
    image: 'p001.png',
    price: 29000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'tech',
    brand: 'OEM',
    affiliate_link: 'l1',
  },
  {
    productId: 'p002',
    name: 'Máy sấy tóc ion',
    image: 'p002.png',
    price: 350000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'home',
    brand: 'Philips',
    affiliate_link: 'l2',
  },
  {
    productId: 'p003',
    name: 'Củ sạc GaN 140W',
    image: 'p003.png',
    price: 2500000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'tech',
    brand: 'Anker',
    affiliate_link: 'l3',
    sizeCategory: 'tiny',
    perceivedValue: 'luxury',
  },
];

describe('ChallengeCurator End-to-End Orchestration', () => {
  it('curates a 3-round G9 challenge with cognitive escalation and no duplicate SKUs', () => {
    const curator = new ChallengeCurator();
    const challenge = curator.curate(g9Definition, mockCatalog, 42);

    expect(challenge.rounds.length).toBe(3);
    expect(challenge.rounds[0].type).toBe('confidence_builder');
    expect(challenge.rounds[1].type).toBe('tension_creator');
    expect(challenge.rounds[2].type).toBe('wtf_reveal');

    // Anti-duplicate SKU check
    const usedProductIds = challenge.rounds.flatMap((r) => r.products.map((p) => p.productId));
    const uniqueIds = new Set(usedProductIds);
    expect(uniqueIds.size).toBe(3);

    // Escalation check
    expect(challenge.rounds[0].scoreVector.difficulty).toBeLessThan(challenge.rounds[2].scoreVector.difficulty);
    expect(challenge.rounds[2].scoreVector.revealImpact).toBeGreaterThan(0.7);
  });

  it('validates DSL definitions for G9 and G7', () => {
    expect(g9Definition.id).toBe('g9_guess_the_price');
    expect(g7Definition.id).toBe('g7_grocery_basket');
    expect(g9Definition.rounds.length).toBe(3);
    expect(g7Definition.rounds.length).toBe(3);
  });
});
