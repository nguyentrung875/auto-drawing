import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';
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
  {
    productId: 'p004',
    name: 'Mì ăn liền Hảo Hảo',
    image: 'p004.png',
    price: 4500,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'grocery',
    brand: 'Acecook',
    affiliate_link: 'l4',
  },
  {
    productId: 'p005',
    name: 'Sữa tươi tiệt trùng 1L',
    image: 'p005.png',
    price: 38000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'grocery',
    brand: 'Vinamilk',
    affiliate_link: 'l5',
  },
  {
    productId: 'p006',
    name: 'Dầu ăn đậu nành 1L',
    image: 'p006.png',
    price: 52000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'grocery',
    brand: 'Simply',
    affiliate_link: 'l6',
  },
  {
    productId: 'p007',
    name: 'Bột giặt Omo 3kg',
    image: 'p007.png',
    price: 165000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'home',
    brand: 'Omo',
    affiliate_link: 'l7',
  },
  {
    productId: 'p008',
    name: 'Nồi cơm điện mini',
    image: 'p008.png',
    price: 450000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'home',
    brand: 'Sunhouse',
    affiliate_link: 'l8',
  },
  {
    productId: 'p009',
    name: 'Thùng bia Tiger 24 lon',
    image: 'p009.png',
    price: 395000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'beverage',
    brand: 'Tiger',
    affiliate_link: 'l9',
  },
  {
    productId: 'p010',
    name: 'Tai nghe Bluetooth 5k',
    image: 'p010.png',
    price: 19000,
    originalPrice: 850000, // 98% fake discount -> scam
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'tech',
    brand: 'OEM',
    affiliate_link: 'l10',
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

  it('curates a 3-round G7 Grocery Basket challenge with 3 items per round', () => {
    const curator = new ChallengeCurator();
    const challenge = curator.curate(g7Definition, mockCatalog, 42);

    expect(challenge.rounds.length).toBe(3);
    expect(challenge.rounds[0].products.length).toBe(3);
    expect(challenge.rounds[1].products.length).toBe(3);
    expect(challenge.rounds[2].products.length).toBe(3);

    // All 9 products used across 3 rounds must be distinct
    const usedProductIds = challenge.rounds.flatMap((r) => r.products.map((p) => p.productId));
    const uniqueIds = new Set(usedProductIds);
    expect(uniqueIds.size).toBe(9);

    // Choices must be Under / Over budget
    expect(challenge.rounds[0].choices.map((c) => c.id)).toEqual(['under', 'over']);
    expect(['under', 'over']).toContain(challenge.rounds[0].correctAnswer);
  });

  it('curates a 3-round G41 Deal or Scam challenge', () => {
    const curator = new ChallengeCurator();
    const challenge = curator.curate(g41Definition, mockCatalog, 123);

    expect(challenge.rounds.length).toBe(3);
    expect(challenge.rounds[0].products.length).toBe(1);

    const usedProductIds = challenge.rounds.flatMap((r) => r.products.map((p) => p.productId));
    const uniqueIds = new Set(usedProductIds);
    expect(uniqueIds.size).toBe(3);

    // Choices must be Deal / Scam
    expect(challenge.rounds[0].choices.map((c) => c.id)).toEqual(['deal', 'scam']);
    expect(['deal', 'scam']).toContain(challenge.rounds[0].correctAnswer);
  });

  it('validates DSL definitions for G9, G7, G41', () => {
    expect(g9Definition.id).toBe('g9_guess_the_price');
    expect(g7Definition.id).toBe('g7_grocery_basket');
    expect(g41Definition.id).toBe('g41_deal_or_scam');
    expect(g9Definition.rounds.length).toBe(3);
    expect(g7Definition.rounds.length).toBe(3);
    expect(g41Definition.rounds.length).toBe(3);
  });
});

