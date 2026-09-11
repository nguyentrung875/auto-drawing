/** Stories 2.3 / 2.4 / 2.5 — HI_LO, MOST_EXPENSIVE, ONE_AWAY. */
import { describe, expect, it } from 'vitest';
import {
  GameEngine,
  MechanicRegistry,
  cardsOverlap,
  maskPrice,
  PRODUCT_CARD_MAX_WIDTH,
} from '../../src/game';
import { Validator } from '../../src/validator';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p042 = product('p042', 2490000);

describe('Story 2.3 — HI_LO (BOOLEAN)', () => {
  const { game, sceneData } = MechanicRegistry.get('HI_LO').create({
    products: [p001, p042],
    seed: 839271,
  });

  it('computes answer "higher" deterministically (2.49M > 189K)', () => {
    expect(game.gameplay.answer).toBe('higher');
    const again = MechanicRegistry.get('HI_LO').create({
      products: [p001, p042],
      seed: 839271,
    }).game;
    expect(JSON.stringify(again)).toBe(JSON.stringify(game));
  });

  it('generates the 7 MVP scenes and honours result_variant', () => {
    expect(game.scenes).toEqual([
      'hook',
      'product',
      'question',
      'countdown',
      'reveal',
      'result',
      'cta',
    ]);
    const commentGame = MechanicRegistry.get('HI_LO').create({
      products: [p001, p042],
      seed: 839271,
      resultVariant: 'comment',
    }).game;
    expect(commentGame.metadata.result_variant).toBe('comment');
    expect(game.metadata.result_variant).toBe('in_video');
  });

  it('uses the default BOOLEAN question with Higher/Lower choices', () => {
    expect(game.content.question).toBe('Sản phẩm B CAO HƠN hay THẤP HƠN A?');
    expect(game.gameplay.interaction).toBe('BOOLEAN');
    expect(game.gameplay.choices?.map((c) => c.id)).toEqual(['higher', 'lower']);
  });

  it('is rejected by the Validator when the delta is <5%', () => {
    const a = product('p001', 200000);
    const b = product('p042', 205000); // 2.5%
    const g = MechanicRegistry.get('HI_LO').create({ products: [a, b], seed: 1 }).game;
    const result = Validator.validate(g, [a, b]);
    expect(result.errors[0]?.code).toBe('E_HILO_EQUAL_PRICE');
    expect(result.errors[0]?.hint).toMatch(/<5%/);
  });

  it('uses PriceReveal', () => {
    expect(sceneData.revealType).toBe('PriceReveal');
  });
});

describe('Story 2.4 — MOST_EXPENSIVE (MULTIPLE_CHOICE)', () => {
  const products = [product('p001', 189000), product('p015', 890000), product('p028', 450000)];
  const { game, sceneData } = MechanicRegistry.get('MOST_EXPENSIVE').create({
    products,
    seed: 839272,
  });

  it('answers with the max-price productId (p015)', () => {
    expect(game.gameplay.answer).toBe('p015');
    expect(game.gameplay.interaction).toBe('MULTIPLE_CHOICE');
  });

  it('rejects a tie and a top-2 delta <2%', () => {
    const tie = [product('p1', 890000), product('p2', 890000), product('p3', 450000)];
    expect(
      Validator.validate(game, tie).errors.map((e) => e.code),
    ).toContain('E_MOST_EXPENSIVE_TIE');
    const close = [product('p1', 890000), product('p2', 880000), product('p3', 450000)];
    expect(Validator.validate(game, close).errors[0]?.hint).toMatch(/top2 delta 1\.1% <2%/);
  });

  it('rejects a product count outside 3-4', () => {
    expect(() =>
      MechanicRegistry.get('MOST_EXPENSIVE').create({ products: products.slice(0, 2), seed: 1 }),
    ).toThrowError(/E_GAME_LOGIC_INVALID/);
    expect(
      Validator.validate(game, [...products, product('p4', 10000), product('p5', 20000)]).errors[0]
        ?.code,
    ).toBe('E_GAME_LOGIC_INVALID');
  });

  it('lays out 3 ProductCards inside 1080×1920 without overlap', () => {
    expect(sceneData.cards).toHaveLength(3);
    expect(cardsOverlap(sceneData.cards)).toBe(false);
    expect(sceneData.stage).toEqual({ width: 1080, height: 1920 });
    for (const card of sceneData.cards) {
      expect(card.width).toBeLessThanOrEqual(PRODUCT_CARD_MAX_WIDTH);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.y).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(1080);
      expect(card.y + card.height).toBeLessThanOrEqual(1920);
    }
    expect(sceneData.cards.find((c) => c.productId === 'p015')?.highlight).toBe(true);
  });
});

describe('Story 2.5 — ONE_AWAY (DIGIT)', () => {
  const { game, sceneData } = MechanicRegistry.get('ONE_AWAY').create({
    products: [p001],
    seed: 839273,
    hiddenIndex: 3,
  });

  it('masks digit 3 of 189000 → correct_digit "0", options [0,1]', () => {
    expect(game.gameplay.correct_digit).toBe('0');
    expect([...(game.gameplay.options ?? [])].sort()).toEqual([0, 1]);
    expect(game.gameplay.answer).toBe(0);
    expect(game.gameplay.interaction).toBe('DIGIT');
  });

  it('orders the options deterministically from the seed', () => {
    const again = MechanicRegistry.get('ONE_AWAY').create({
      products: [p001],
      seed: 839273,
      hiddenIndex: 3,
    }).game;
    expect(again.gameplay.options).toEqual(game.gameplay.options);
  });

  it('rejects hidden_index out of range', () => {
    expect(() =>
      MechanicRegistry.get('ONE_AWAY').create({ products: [p001], seed: 1, hiddenIndex: 9 }),
    ).toThrowError(/out of range/);
  });

  it('produces a masked price in ProductScene data', () => {
    expect(sceneData.maskedPrice).toBe('189,?00');
    expect(sceneData.cards[0]?.priceLabel).toBe('189,?00');
    // AC example shape: 1,800,000 masked at index 2 → 1,8?0,000
    expect(maskPrice(1800000, 2)).toBe('1,8?0,000');
  });

  it('uses DigitReveal while HI_LO / MOST_EXPENSIVE use PriceReveal', () => {
    expect(sceneData.revealType).toBe('DigitReveal');
    expect(MechanicRegistry.get('ONE_AWAY').revealType).toBe('DigitReveal');
    expect(MechanicRegistry.get('HI_LO').revealType).toBe('PriceReveal');
    expect(MechanicRegistry.get('MOST_EXPENSIVE').revealType).toBe('PriceReveal');
    expect(GameEngine.compute(game, [p001]).revealType).toBe('DigitReveal');
  });
});

describe('Epic 2 — end-to-end: 3 mechanics validate + compute', () => {
  const cases = [
    { mechanic: 'HI_LO' as const, products: [p001, p042], seed: 839271 },
    {
      mechanic: 'MOST_EXPENSIVE' as const,
      products: [product('p001', 189000), product('p015', 890000), product('p028', 450000)],
      seed: 839272,
    },
    { mechanic: 'ONE_AWAY' as const, products: [p001], seed: 839273, hiddenIndex: 3 },
  ];

  it.each(cases)('$mechanic passes the Validator and the Engine', (c) => {
    const { game } = MechanicRegistry.get(c.mechanic).create({
      products: c.products,
      seed: c.seed,
      hiddenIndex: 'hiddenIndex' in c ? c.hiddenIndex : undefined,
    });
    const validation = Validator.validate(game, c.products);
    expect(validation.ok).toBe(true);
    const computed = GameEngine.compute(game, c.products, c.seed);
    expect(computed.answer).toBe(game.gameplay.answer);
    expect(computed.timeline.totalDuration).toBeCloseTo(18.0, 2);
  });
});
