/**
 * Regression guard for the reveal scene.
 *
 * Two defects shipped through Epics 2–4 because every existing test asserted on
 * *scene data* while the bugs lived in what the frame actually showed:
 *
 *  1. The answer caption was painted at a fixed y=1300 while a 3-card
 *     MOST_EXPENSIVE layout ran down to y=1550 — the answer was drawn on top of
 *     the last card.
 *  2. Cards kept their pre-answer `???` / masked label at reveal, so a
 *     price-guessing video never showed the price it asked about.
 *
 * These tests pin both at the seam the painter consumes (`frame.data.cards`),
 * for every mechanic and every supported card count.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine, MechanicRegistry, groupDigits } from '../../src/game';
import { REVEAL_TEXT_BAND_TOP, SceneSystem } from '../../src/scene';
import type { Product } from '../../src/product/schema';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p015 = product('p015', 1490000);
const p028 = product('p028', 390000);
const p042 = product('p042', 2490000);

interface RevealCard {
  productId: string;
  priceLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function revealCards(
  mechanic: 'HI_LO' | 'MOST_EXPENSIVE' | 'ONE_AWAY',
  products: Product[],
): RevealCard[] {
  const output = MechanicRegistry.get(mechanic).create({
    products,
    seed: 839271,
    hiddenIndex: mechanic === 'ONE_AWAY' ? 3 : undefined,
  });
  const computed = GameEngine.compute(output.game, products);
  const scenes = SceneSystem.render(output.game, {
    products,
    computed,
    sceneData: output.sceneData,
    timeline: computed.timeline,
  });
  const reveal = scenes.scenes.find((scene) => scene.name === 'reveal');
  return (reveal?.frames[0]?.data.cards ?? []) as unknown as RevealCard[];
}

const priceRevealCases = [
  { mechanic: 'HI_LO' as const, products: [p001, p042] },
  { mechanic: 'MOST_EXPENSIVE' as const, products: [p001, p015, p028] },
  { mechanic: 'MOST_EXPENSIVE' as const, products: [p001, p015, p028, p042] },
];

describe('RevealScene layout (regression)', () => {
  it.each(priceRevealCases)(
    '$mechanic with $products.length products shows every real price at reveal',
    ({ mechanic, products }) => {
      const cards = revealCards(mechanic, products);
      expect(cards).toHaveLength(products.length);
      for (const source of products) {
        const card = cards.find((candidate) => candidate.productId === source.productId);
        expect(card?.priceLabel).toBe(groupDigits(source.price));
      }
      // The masked placeholder must be gone once the answer is revealed.
      expect(cards.map((card) => card.priceLabel)).not.toContain('???');
    },
  );

  it.each(priceRevealCases)(
    '$mechanic with $products.length products keeps cards clear of the answer caption',
    ({ mechanic, products }) => {
      const cards = revealCards(mechanic, products);
      const lowest = Math.max(...cards.map((card) => card.y + card.height));
      expect(lowest).toBeLessThanOrEqual(REVEAL_TEXT_BAND_TOP);
    },
  );

  it.each(priceRevealCases)(
    '$mechanic with $products.length products never overlaps two cards at reveal',
    ({ mechanic, products }) => {
      const cards = revealCards(mechanic, products);
      for (let i = 0; i < cards.length; i += 1) {
        for (let j = i + 1; j < cards.length; j += 1) {
          const a = cards[i] as RevealCard;
          const b = cards[j] as RevealCard;
          const disjoint =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y;
          expect(disjoint).toBe(true);
        }
      }
      // FR-5/FR-7: the ≤400px cap must survive the reveal re-layout.
      for (const card of cards) {
        expect(card.width).toBeGreaterThan(0);
        expect(card.width).toBeLessThanOrEqual(400);
        expect(card.x).toBeGreaterThanOrEqual(0);
        expect(card.x + card.width).toBeLessThanOrEqual(1080);
      }
    },
  );

  it('keeps the masked price on the ONE_AWAY card and reveals the digit separately', () => {
    const cards = revealCards('ONE_AWAY', [p001]);
    // ONE_AWAY reveals through DigitReveal (masked price → digit), so its card
    // list is not the price-reveal surface; the mechanic still carries the mask.
    const output = MechanicRegistry.get('ONE_AWAY').create({
      products: [p001],
      seed: 839271,
      hiddenIndex: 3,
    });
    expect(output.sceneData.maskedPrice).toBe('189,?00');
    expect(cards.length).toBeLessThanOrEqual(1);
  });
});

describe('DigitReveal completes the price (ONE_AWAY)', () => {
  it('substitutes the revealed digit back into the masked price', () => {
    const products = [product('p001', 2620000)];
    const output = MechanicRegistry.get('ONE_AWAY').create({
      products,
      seed: 841225,
      hiddenIndex: 2,
    });
    const computed = GameEngine.compute(output.game, products);
    const scenes = SceneSystem.render(output.game, {
      products,
      computed,
      sceneData: output.sceneData,
      timeline: computed.timeline,
    });
    const reveal = scenes.scenes.find((scene) => scene.name === 'reveal');
    const data = reveal?.frames[0]?.data as {
      maskedPrice?: string;
      resolvedPrice?: string;
    };

    expect(data?.maskedPrice).toContain('?');
    // The payoff must be a real, fully-formed price — no '?' left behind.
    expect(data?.resolvedPrice).toBeTruthy();
    expect(data?.resolvedPrice).not.toContain('?');
    expect(data?.resolvedPrice?.replace(/\D/g, '')).toBe('2620000');
  });
});
