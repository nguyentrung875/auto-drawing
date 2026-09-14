import { describe, it, expect } from 'vitest';
import { ViralScorer } from '../../src/challenge/scorers/ViralScorer';
import type { Product } from '../../src/product/schema';

describe('ViralScorer & RevealImpact Calculation', () => {
  const tinyExpensive: Product = {
    productId: 'p001',
    name: 'Serum Nhỏ Siêu Đắt',
    image: 'p1.png',
    price: 3900000,
    currency: 'VND',
    source: 's',
    updatedAt: '2026',
    category: 'cosmetic',
    brand: 'Luxury',
    affiliate_link: 'l',
    sizeCategory: 'tiny',
    perceivedValue: 'luxury',
  };

  const normalProduct: Product = {
    productId: 'p002',
    name: 'Nước Rửa Bát',
    image: 'p2.png',
    price: 35000,
    currency: 'VND',
    source: 's',
    updatedAt: '2026',
    category: 'home',
    brand: 'Sunlight',
    affiliate_link: 'l',
    sizeCategory: 'medium',
    perceivedValue: 'budget',
  };

  it('computes high perception conflict and high RevealImpact for tiny expensive items', () => {
    const scorer = new ViralScorer();
    const scoreVector = scorer.computeScoreVector([tinyExpensive], 0.85);

    expect(scoreVector.perceptionConflict).toBeGreaterThan(0.7);
    expect(scoreVector.revealImpact).toBeGreaterThan(0.7);
    expect(scoreVector.revealImpact).toBeLessThanOrEqual(1.0);
  });

  it('computes standard baseline score vector for normal products', () => {
    const scorer = new ViralScorer();
    const scoreVector = scorer.computeScoreVector([normalProduct], 0.25);

    expect(scoreVector.perceptionConflict).toBeLessThan(0.4);
    expect(scoreVector.difficulty).toBe(0.25);
  });

  it('implements dynamic twist policy correctly for round 3 variety', () => {
    const scorer = new ViralScorer();
    const twist1 = scorer.getTwistType(12345);
    const twist2 = scorer.getTwistType(99999);
    expect(['type_a_size_disparity', 'type_b_reverse_trap', 'type_c_real_deal']).toContain(twist1);
    expect(['type_a_size_disparity', 'type_b_reverse_trap', 'type_c_real_deal']).toContain(twist2);
  });
});
