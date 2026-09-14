import { describe, it, expect } from 'vitest';
import { NumericEngine } from '../../src/challenge/engines/NumericEngine';
import { KnapsackEngine } from '../../src/challenge/engines/KnapsackEngine';
import { DecisionEngine } from '../../src/challenge/engines/DecisionEngine';
import type { Product } from '../../src/product/schema';

describe('Primitive Difficulty Engines', () => {
  const p1: Product = {
    productId: 'p001',
    name: 'Kem chống nắng',
    image: 'p1.png',
    price: 250000,
    currency: 'VND',
    source: 's',
    updatedAt: '2026',
    category: 'c',
    brand: 'b',
    affiliate_link: 'l',
  };

  it('NumericEngine formats VND gracefully (K and TRIỆU)', () => {
    const engine = new NumericEngine();
    expect(engine.formatVND(250000)).toBe('250K');
    expect(engine.formatVND(1000000)).toBe('1 TRIỆU');
    expect(engine.formatVND(2500000)).toBe('2.5 TRIỆU');
    expect(engine.formatVND(3900000)).toBe('3.9 TRIỆU');
  });

  it('NumericEngine generates G9 price brackets with given bracket ratio', () => {
    const engine = new NumericEngine();
    // actual price: 250,000 VND. Bracket ratio 5.0 (Easy) -> Fake bracket is either 5x higher or 5x lower
    const { choiceA, choiceB, correctChoice } = engine.generatePriceBrackets(p1.price, 5.0, 12345);
    expect([choiceA.id, choiceB.id]).toContain(correctChoice);
    const correctVal = correctChoice === 'A' ? choiceA.value : choiceB.value;
    const fakeVal = correctChoice === 'A' ? choiceB.value : choiceA.value;
    expect(correctVal).toBe(250000);
    expect(fakeVal === 50000 || fakeVal === 1250000).toBe(true);
  });

  it('KnapsackEngine evaluates basket sum against budget', () => {
    const engine = new KnapsackEngine();
    const basket = [
      { ...p1, price: 100000 },
      { ...p1, price: 150000 },
      { ...p1, price: 40000 },
    ];
    const budget = 300000;
    const result = engine.evaluateBasket(basket, budget);
    expect(result.total).toBe(290000);
    expect(result.isUnderBudget).toBe(true);
    expect(result.deltaPercent).toBeCloseTo(10000 / 300000, 3);
  });

  it('DecisionEngine resolves original price and classifies deal vs scam', () => {
    const engine = new DecisionEngine();
    const techProduct: Product = {
      ...p1,
      name: 'Tai nghe Bluetooth Pro',
      category: 'tech',
      price: 50000, // cực rẻ cho tech
      originalPrice: 1000000, // giảm 95% -> scam
    };
    const evaluation = engine.evaluateOffer(techProduct, techProduct.originalPrice);
    expect(evaluation.classification).toBe('scam');
    expect(evaluation.discountPercent).toBe(95);

    const regularProduct: Product = {
      ...p1,
      name: 'Nồi inox 3 đáy',
      category: 'home',
      price: 280000,
      originalPrice: 350000, // giảm 20% -> deal
    };
    const eval2 = engine.evaluateOffer(regularProduct, regularProduct.originalPrice);
    expect(eval2.classification).toBe('deal');
    expect(eval2.discountPercent).toBe(20);
  });
});

