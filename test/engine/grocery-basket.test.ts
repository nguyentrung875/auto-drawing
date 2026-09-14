import { describe, it, expect } from 'vitest';
import { MechanicRegistry, cardsOverlap } from '../../src/game/mechanics';
import { Validator } from '../../src/validator';
import { GameEngine } from '../../src/game';
import type { Product } from '../../src/product/schema';

describe('G7 — GROCERY_BASKET (BOOLEAN)', () => {
  const basketUnder: Product[] = [
    {
      productId: 'p001',
      name: 'Nước giặt Omo',
      image: 'assets/p1.png',
      price: 189000,
      currency: 'VND',
      source: 'mock',
      updatedAt: '2026-09-14T00:00:00Z',
      category: 'home',
      brand: 'Omo',
      affiliate_link: 'https://shopee.vn/p1',
    },
    {
      productId: 'p002',
      name: 'Nước rửa chén Sunlight',
      image: 'assets/p2.png',
      price: 35000,
      currency: 'VND',
      source: 'mock',
      updatedAt: '2026-09-14T00:00:00Z',
      category: 'home',
      brand: 'Sunlight',
      affiliate_link: 'https://shopee.vn/p2',
    },
    {
      productId: 'p003',
      name: 'Khăn lau đa năng',
      image: 'assets/p3.png',
      price: 25000,
      currency: 'VND',
      source: 'mock',
      updatedAt: '2026-09-14T00:00:00Z',
      category: 'home',
      brand: 'OEM',
      affiliate_link: 'https://shopee.vn/p3',
    },
  ]; // Total: 249,000 VND <= 300,000 VND -> 'under'

  const basketOver: Product[] = [
    { ...basketUnder[0]!, price: 189000 },
    { ...basketUnder[1]!, price: 150000 },
    { ...basketUnder[2]!, price: 25000 },
  ]; // Total: 364,000 VND > 300,000 VND -> 'over'

  it('computes answer "under" when total bill is under budget 300K', () => {
    const { game, sceneData } = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketUnder,
      seed: 123456,
    });
    expect(game.gameplay.answer).toBe('under');
    expect(game.gameplay.choices).toEqual([
      { id: 'under', label: 'ĐỦ TIỀN (DƯỚI BUDGET)' },
      { id: 'over', label: 'CHÁY TÚI (TRÊN BUDGET)' },
    ]);
    expect(sceneData.cards.length).toBe(3);
    expect(cardsOverlap(sceneData.cards)).toBe(false);

    const validation = Validator.validate(game, basketUnder);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, basketUnder, 123456);
    expect(computed.answer).toBe('under');
    expect(computed.detail.total).toBe(249000);
    expect(computed.detail.budget).toBe(300000);
    expect(computed.detail.isUnderBudget).toBe(true);
  });

  it('computes answer "over" when total bill is over budget 300K', () => {
    const { game } = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketOver,
      seed: 654321,
    });
    expect(game.gameplay.answer).toBe('over');

    const validation = Validator.validate(game, basketOver);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, basketOver, 654321);
    expect(computed.answer).toBe('over');
    expect(computed.detail.total).toBe(364000);
    expect(computed.detail.isUnderBudget).toBe(false);
  });

  it('rejects product counts other than exactly 3', () => {
    expect(() =>
      MechanicRegistry.get('GROCERY_BASKET').create({
        products: basketUnder.slice(0, 2),
        seed: 1,
      }),
    ).toThrowError(/E_GAME_LOGIC_INVALID/);

    const twoProductGame = {
      ...MechanicRegistry.get('GROCERY_BASKET').create({
        products: basketUnder,
        seed: 1,
      }).game,
      entities: [{ productId: 'p001' }, { productId: 'p002' }],
    };
    const validation = Validator.validate(twoProductGame, basketUnder.slice(0, 2));
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]?.code).toBe('E_GAME_LOGIC_INVALID');

    expect(() =>
      GameEngine.compute(twoProductGame, basketUnder.slice(0, 2), 1),
    ).toThrowError(/E_GAME_LOGIC_INVALID/);
  });

  it('throws E_GAME_LOGIC_INVALID when authored answer contradicts Engine answer', () => {
    const { game } = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketUnder,
      seed: 123456,
    });
    const tampered = {
      ...game,
      gameplay: {
        ...game.gameplay,
        answer: 'over', // authored contradiction: 249K is actually under 300K
      },
    };

    expect(() => GameEngine.compute(tampered, basketUnder, 123456)).toThrowError(
      /E_GAME_LOGIC_INVALID/,
    );
  });

  it('allows duplicate prices in the basket without failing validation', () => {
    const basketWithDuplicatePrices: Product[] = [
      { ...basketUnder[0]!, price: 100000 },
      { ...basketUnder[1]!, price: 50000 },
      { ...basketUnder[2]!, price: 50000 }, // same price as item 2
    ];
    const { game } = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketWithDuplicatePrices,
      seed: 999,
    });
    const validation = Validator.validate(game, basketWithDuplicatePrices);
    expect(validation.ok).toBe(true);
  });

  it('supports custom budget from input', () => {
    // 249K is over 200K budget
    const { game } = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketUnder,
      seed: 123456,
      budget: 200000,
    });
    expect(game.gameplay.answer).toBe('over');
    const computed = GameEngine.compute(game, basketUnder, 123456);
    expect(computed.answer).toBe('over');
    expect(computed.detail.budget).toBe(200000);
  });

  it('produces deterministic output for the same seed', () => {
    const run1 = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketUnder,
      seed: 888,
    });
    const run2 = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basketUnder,
      seed: 888,
    });
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('is registered in MechanicRegistry', () => {
    expect(MechanicRegistry.has('GROCERY_BASKET')).toBe(true);
    expect(MechanicRegistry.ids()).toContain('GROCERY_BASKET');
  });
});
