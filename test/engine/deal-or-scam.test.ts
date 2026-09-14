import { describe, it, expect } from 'vitest';
import { MechanicRegistry, cardsOverlap } from '../../src/game/mechanics';
import { Validator } from '../../src/validator';
import { GameEngine } from '../../src/game';
import type { Product } from '../../src/product/schema';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';
import { gameDefinitionSchema } from '../../src/challenge/types';

describe('G41 — DEAL_OR_SCAM (BOOLEAN)', () => {
  const scamProduct: Product = {
    productId: 'p001',
    name: 'Tai Nghe Bluetooth Pro Không Dây',
    image: 'assets/p1.png',
    price: 19000, // 19K for high-value item -> 98% discount => obvious scam
    currency: 'VND',
    source: 'mock',
    updatedAt: '2026-09-14T00:00:00Z',
    category: 'tech',
    brand: 'Apple Rep',
    affiliate_link: 'https://shopee.vn/p1',
    originalPrice: 1500000,
    discountPercent: 98,
  };

  const dealProduct: Product = {
    productId: 'p002',
    name: 'Nồi Cơm Điện Mini Đa Năng',
    image: 'assets/p2.png',
    price: 150000, // 150K with original 200K -> 25% discount => legitimate deal
    currency: 'VND',
    source: 'mock',
    updatedAt: '2026-09-14T00:00:00Z',
    category: 'home',
    brand: 'Sunhouse',
    affiliate_link: 'https://shopee.vn/p2',
    originalPrice: 200000,
    discountPercent: 25,
  };

  it('computes answer "scam" for impossible discount', () => {
    const { game, sceneData } = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [scamProduct],
      seed: 789012,
    });
    expect(game.gameplay.answer).toBe('scam');
    expect(game.gameplay.choices).toEqual([
      { id: 'deal', label: 'DEAL HỜI MÚC NGAY' },
      { id: 'scam', label: 'BẪY SALE ẢO / SCAM' },
    ]);
    expect(sceneData.cards.length).toBe(1);
    expect(cardsOverlap(sceneData.cards)).toBe(false);

    const validation = Validator.validate(game, [scamProduct]);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, [scamProduct], 789012);
    expect(computed.answer).toBe('scam');
    expect(computed.detail.verdict).toBe('scam');
    expect(computed.detail.originalPrice).toBe(1500000);
    expect(computed.detail.price).toBe(19000);
  });

  it('computes answer "deal" for legitimate deal', () => {
    const { game, sceneData } = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [dealProduct],
      seed: 123456,
    });
    expect(game.gameplay.answer).toBe('deal');
    expect(game.gameplay.choices).toEqual([
      { id: 'deal', label: 'DEAL HỜI MÚC NGAY' },
      { id: 'scam', label: 'BẪY SALE ẢO / SCAM' },
    ]);
    expect(sceneData.cards.length).toBe(1);

    const validation = Validator.validate(game, [dealProduct]);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, [dealProduct], 123456);
    expect(computed.answer).toBe('deal');
    expect(computed.detail.verdict).toBe('deal');
    expect(computed.detail.originalPrice).toBe(200000);
    expect(computed.detail.price).toBe(150000);
  });

  it('synthesizes originalPrice when missing from product based on seed', () => {
    const productWithoutOriginal: Product = {
      productId: 'p003',
      name: 'Chuột Không Dây Silent',
      image: 'assets/p3.png',
      price: 89000,
      currency: 'VND',
      source: 'mock',
      updatedAt: '2026-09-14T00:00:00Z',
      category: 'tech',
      brand: 'Logitech',
      affiliate_link: 'https://shopee.vn/p3',
    };

    const { game } = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [productWithoutOriginal],
      seed: 55555,
    });

    const validation = Validator.validate(game, [productWithoutOriginal]);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, [productWithoutOriginal], 55555);
    expect(computed.answer).toBe(game.gameplay.answer);
    expect(typeof computed.detail.originalPrice).toBe('number');
    expect((computed.detail.originalPrice as number)).toBeGreaterThan(productWithoutOriginal.price);
  });

  it('rejects product counts other than exactly 1', () => {
    expect(() =>
      MechanicRegistry.get('DEAL_OR_SCAM').create({
        products: [],
        seed: 1,
      }),
    ).toThrowError(/E_GAME_LOGIC_INVALID/);

    expect(() =>
      MechanicRegistry.get('DEAL_OR_SCAM').create({
        products: [scamProduct, dealProduct],
        seed: 1,
      }),
    ).toThrowError(/E_GAME_LOGIC_INVALID/);

    const twoProductGame = {
      ...MechanicRegistry.get('DEAL_OR_SCAM').create({
        products: [scamProduct],
        seed: 1,
      }).game,
      entities: [{ productId: 'p001' }, { productId: 'p002' }],
    };
    const validation = Validator.validate(twoProductGame, [scamProduct, dealProduct]);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]?.code).toBe('E_GAME_LOGIC_INVALID');

    expect(() =>
      GameEngine.compute(twoProductGame, [scamProduct, dealProduct], 1),
    ).toThrowError(/E_GAME_LOGIC_INVALID/);
  });

  it('throws E_GAME_LOGIC_INVALID when authored answer contradicts Engine answer', () => {
    const { game } = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [scamProduct],
      seed: 789012,
    });
    const tampered = {
      ...game,
      gameplay: {
        ...game.gameplay,
        answer: 'deal', // authored contradiction: 19K for 1.5M is scam
      },
    };

    expect(() => GameEngine.compute(tampered, [scamProduct], 789012)).toThrowError(
      /E_GAME_LOGIC_INVALID/,
    );
  });

  it('produces deterministic output for the same seed', () => {
    const run1 = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [dealProduct],
      seed: 987654,
    });
    const run2 = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [dealProduct],
      seed: 987654,
    });
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('is registered in MechanicRegistry', () => {
    expect(MechanicRegistry.has('DEAL_OR_SCAM')).toBe(true);
    expect(MechanicRegistry.ids()).toContain('DEAL_OR_SCAM');
  });

  it('validates g41Definition against gameDefinitionSchema', () => {
    expect(g41Definition.id).toBe('g41_deal_or_scam');
    expect(g41Definition.family).toBe('commerce_decision');
    const parsed = gameDefinitionSchema.safeParse(g41Definition);
    expect(parsed.success).toBe(true);
  });
});
