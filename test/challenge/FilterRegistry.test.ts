import { describe, it, expect } from 'vitest';
import { FilterRegistry } from '../../src/challenge/FilterRegistry';
import { EligibilityFilter } from '../../src/challenge/filters/EligibilityFilter';
import { CandidateFilter } from '../../src/challenge/filters/CandidateFilter';
import type { Product } from '../../src/product/schema';

const mockProducts: Product[] = [
  {
    productId: 'p001',
    name: 'Sản phẩm 1',
    image: 'p001.png',
    price: 50000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026-09-14',
    category: 'tech',
    brand: 'BrandA',
    affiliate_link: 'link1',
  },
  {
    productId: 'p002',
    name: 'Sản phẩm 2',
    image: '', // Missing image -> ineligible
    price: 150000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026-09-14',
    category: 'tech',
    brand: 'BrandB',
    affiliate_link: 'link2',
  },
  {
    productId: 'p003',
    name: 'Sản phẩm 3',
    image: 'p003.png',
    price: 300000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026-09-14',
    category: 'home',
    brand: 'BrandC',
    affiliate_link: 'link3',
  },
];

describe('FilterRegistry & Composable Filters', () => {
  it('EligibilityFilter filters out products missing required fields', () => {
    const filter = new EligibilityFilter(['image', 'price', 'name']);
    const eligible = filter.apply(mockProducts);
    expect(eligible.length).toBe(2);
    expect(eligible.map((p) => p.productId)).toEqual(['p001', 'p003']);
  });

  it('CandidateFilter rejects selections with duplicate SKUs across used pool', () => {
    const candidateFilter = new CandidateFilter();
    const usedProductIds = new Set(['p001']);
    const candidates = [mockProducts[0], mockProducts[2]]; // p001 is already used
    const valid = candidateFilter.isDistinct(candidates, usedProductIds);
    expect(valid).toBe(false);

    const freshCandidates = [mockProducts[2]];
    expect(candidateFilter.isDistinct(freshCandidates, usedProductIds)).toBe(true);
  });

  it('FilterRegistry stores and retrieves named filters', () => {
    const registry = new FilterRegistry();
    const eligibility = new EligibilityFilter(['image', 'price']);
    registry.register('eligibility', eligibility);
    expect(registry.get('eligibility')).toBe(eligibility);
    expect(registry.get('unknown')).toBeUndefined();
  });
});
