import { describe, it, expect } from 'vitest';
import { challengeScoreVectorSchema, gameDefinitionSchema } from '../../src/challenge/types';
import { productSchema } from '../../src/product/schema';

describe('Challenge Types & Rich Product Schema', () => {
  it('validates a rich product with optional perception & commerce metadata', () => {
    const validProduct = {
      productId: 'p001',
      name: 'Serum Dưỡng Ẩm Mini',
      image: 'products/p001.png',
      price: 420000,
      currency: 'VND',
      source: 'shopee',
      updatedAt: '2026-09-14',
      category: 'skincare',
      brand: 'The Ordinary',
      affiliate_link: 'https://shope.ee/test',
      sizeCategory: 'tiny',
      perceivedValue: 'budget',
    };
    const parsed = productSchema.parse(validProduct);
    expect(parsed.sizeCategory).toBe('tiny');
    expect(parsed.perceivedValue).toBe('budget');
  });

  it('validates ChallengeScoreVector boundaries (0.0 to 1.0)', () => {
    const validVector = {
      difficulty: 0.8,
      visualClarity: 0.95,
      curiosity: 0.85,
      surprise: 0.9,
      perceptionConflict: 0.95,
      debate: 0.7,
      identity: 0.8,
      familiarity: 0.9,
      commerceRelevance: 0.85,
      revealImpact: 0.92,
    };
    const parsed = challengeScoreVectorSchema.parse(validVector);
    expect(parsed.revealImpact).toBe(0.92);

    expect(() => challengeScoreVectorSchema.parse({ ...validVector, difficulty: 1.5 })).toThrow();
  });
});
