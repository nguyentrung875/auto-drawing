import { describe, it, expect } from 'vitest';
import { gameDefinitionSchema } from '../../src/challenge/types';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';
import { g1Definition } from '../../src/definitions/g1_hi_lo';
import { g2Definition } from '../../src/definitions/g2_most_expensive';
import { g5Definition } from '../../src/definitions/g5_one_away';
import { g3Definition } from '../../src/definitions/g3_odd_one_out';

describe('All 7 Game Definitions DSL', () => {
  const definitions = [
    { name: 'G9 Guess The Price', dsl: g9Definition, expectedFamily: 'numeric_single_bracket', count: 1 },
    { name: 'G7 Grocery Basket', dsl: g7Definition, expectedFamily: 'numeric_knapsack', count: 3 },
    { name: 'G41 Deal Or Scam', dsl: g41Definition, expectedFamily: 'commerce_decision', count: 1 },
    { name: 'G1 Hi-Lo', dsl: g1Definition, expectedFamily: 'numeric_comparison', count: 2 },
    { name: 'G2 Most Expensive', dsl: g2Definition, expectedFamily: 'multiple_choice_max', count: 4 },
    { name: 'G5 One Away', dsl: g5Definition, expectedFamily: 'numeric_digit', count: 1 },
    { name: 'G3 Odd One Out', dsl: g3Definition, expectedFamily: 'semantic_outlier', count: 4 },
  ];

  for (const def of definitions) {
    it(`validates ${def.name} matches gameDefinitionSchema`, () => {
      const parsed = gameDefinitionSchema.parse(def.dsl);
      expect(parsed.id).toBeTruthy();
      expect(parsed.family).toBe(def.expectedFamily);
      expect(parsed.inputs.countPerRound).toBe(def.count);
      expect(parsed.rounds.length).toBeGreaterThanOrEqual(3);
      for (const r of parsed.rounds) {
        expect(r.timerSeconds).toBeGreaterThanOrEqual(4.0);
      }
    });
  }
});
