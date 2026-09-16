import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { ProductProvider } from '../../src/product/ProductProvider';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';
import { g1Definition } from '../../src/definitions/g1_hi_lo';
import { g2Definition } from '../../src/definitions/g2_most_expensive';
import { g5Definition } from '../../src/definitions/g5_one_away';
import { g3Definition } from '../../src/definitions/g3_odd_one_out';

describe('ChallengeCurator — All 7 Mechanics Support', () => {
  const provider = new ProductProvider(path.resolve(process.cwd(), 'products'), { watch: false });
  const catalog = provider.getAll();
  const curator = new ChallengeCurator();

  const gameDefs = [
    { id: 'g9', dsl: g9Definition, expectedProductsPerRound: 1, minChoices: 2 },
    { id: 'g7', dsl: g7Definition, expectedProductsPerRound: 3, minChoices: 2 },
    { id: 'g41', dsl: g41Definition, expectedProductsPerRound: 1, minChoices: 2 },
    { id: 'g1', dsl: g1Definition, expectedProductsPerRound: 2, minChoices: 2 },
    { id: 'g2', dsl: g2Definition, expectedProductsPerRound: 4, minChoices: 4 },
    { id: 'g5', dsl: g5Definition, expectedProductsPerRound: 1, minChoices: 2 },
    { id: 'g3', dsl: g3Definition, expectedProductsPerRound: 4, minChoices: 4 },
  ];

  for (const { id, dsl, expectedProductsPerRound, minChoices } of gameDefs) {
    it(`curates 3 rounds for ${id} (${dsl.name}) with valid choices, answers, and >=5s timer`, () => {
      const challenge = curator.curate(dsl, catalog, 839271, { totalRounds: 3, timerSeconds: 6.0 });
      expect(challenge.gameId).toBe(dsl.id);
      expect(challenge.rounds).toHaveLength(3);

      challenge.rounds.forEach((round, i) => {
        expect(round.roundIndex).toBe(i + 1);
        expect(round.timerSeconds).toBe(6.0);
        expect(round.products).toHaveLength(expectedProductsPerRound);
        expect(round.choices.length).toBeGreaterThanOrEqual(minChoices);
        expect(round.correctAnswer).toBeDefined();
        expect(round.choices.some((c) => c.isCorrect)).toBe(true);
        expect(round.revealText).toBeTruthy();
        expect(round.question).toBeTruthy();
      });
    });
  }
});
