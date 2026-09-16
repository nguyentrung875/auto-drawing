import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { Canvas } from '../../src/render/canvas';
import { paintMultiRoundFrame, getChoicesForRenderGame } from '../../src/render/scenePainter';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { ProductProvider } from '../../src/product/ProductProvider';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';
import { g1Definition } from '../../src/definitions/g1_hi_lo';
import { g2Definition } from '../../src/definitions/g2_most_expensive';
import { g5Definition } from '../../src/definitions/g5_one_away';
import { g3Definition } from '../../src/definitions/g3_odd_one_out';

describe('scenePainter — MultiRoundFrame All 7 Mechanics Layouts', () => {
  const provider = new ProductProvider(path.resolve(process.cwd(), 'products'), { watch: false });
  const catalog = provider.getAll();
  const curator = new ChallengeCurator();

  const gameDefs = [
    { id: 'g9', dsl: g9Definition, expectedProducts: 1 },
    { id: 'g7', dsl: g7Definition, expectedProducts: 3 },
    { id: 'g41', dsl: g41Definition, expectedProducts: 1 },
    { id: 'g1', dsl: g1Definition, expectedProducts: 2 },
    { id: 'g2', dsl: g2Definition, expectedProducts: 4 },
    { id: 'g5', dsl: g5Definition, expectedProducts: 1 },
    { id: 'g3', dsl: g3Definition, expectedProducts: 4 },
  ];

  for (const { id, dsl } of gameDefs) {
    it(`paints play and reveal frames without error for ${id} (${dsl.name})`, () => {
      const challenge = curator.curate(dsl, catalog, 839271, { totalRounds: 3, timerSeconds: 5.0 });
      const scene = new AllInOneScene(challenge);
      const timeline = scene.getTimeline();

      // Test 1: Hook phase frame (0.5s)
      const canvasHook = new Canvas(1080, 1920);
      expect(() => paintMultiRoundFrame(canvasHook, scene, 0.5)).not.toThrow();

      // Test 2: Round 1 Play phase frame (2.0s)
      const canvasPlay = new Canvas(1080, 1920);
      expect(() => paintMultiRoundFrame(canvasPlay, scene, 2.0)).not.toThrow();

      // Test 3: Round 1 Reveal phase frame (6.5s)
      const canvasReveal = new Canvas(1080, 1920);
      expect(() => paintMultiRoundFrame(canvasReveal, scene, 6.5)).not.toThrow();

      // Test 4: Scorecard phase frame (near end of video)
      const canvasEnd = new Canvas(1080, 1920);
      expect(() => paintMultiRoundFrame(canvasEnd, scene, timeline.totalDuration - 0.2)).not.toThrow();
    });
  }

  it('paints reveal frame cleanly when round.revealText is empty, falling back to round.correctAnswer', () => {
    const challenge = curator.curate(g9Definition, catalog, 839271, { totalRounds: 3, timerSeconds: 5.0 });
    for (const round of challenge.rounds) {
      round.revealText = '';
    }
    const scene = new AllInOneScene(challenge);
    const canvasReveal = new Canvas(1080, 1920);
    // 6.5s corresponds to round 1 reveal
    expect(() => paintMultiRoundFrame(canvasReveal, scene, 6.5)).not.toThrow();
  });

  describe('Hardened getChoicesForRenderGame validations', () => {
    it('throws when DEAL_OR_SCAM lacks originalPrice and salePrice data', () => {
      const game: any = {
        metadata: { mechanic: 'DEAL_OR_SCAM', seed: 1 },
        gameplay: {},
        entities: [],
      };
      expect(() => getChoicesForRenderGame(game)).toThrow(
        'DEAL_OR_SCAM requires originalPrice and salePrice data',
      );
    });

    it('throws when GROCERY_BASKET has non-positive budget and totalBill', () => {
      const game: any = {
        metadata: { mechanic: 'GROCERY_BASKET', seed: 1 },
        gameplay: { budget: 0, totalBill: 0 },
        entities: [],
      };
      expect(() => getChoicesForRenderGame(game)).toThrow(
        'GROCERY_BASKET requires valid budget or totalBill data',
      );
    });

    it('throws when ONE_AWAY has missing or invalid first product price', () => {
      const game: any = {
        metadata: { mechanic: 'ONE_AWAY', seed: 1 },
        gameplay: {},
        entities: [{ productId: 'p1' }],
      };
      expect(() => getChoicesForRenderGame(game)).toThrow(
        'ONE_AWAY requires valid first product price',
      );
    });

    it('throws when mechanic has no correct choice matching the answer', () => {
      const game: any = {
        metadata: { mechanic: 'MOST_EXPENSIVE', seed: 1 },
        gameplay: { answer: 'p_nonexistent' },
        entities: [{ productId: 'p1', name: 'P1', price: 100 }],
      };
      expect(() => getChoicesForRenderGame(game)).toThrow(
        'No correct choice found for mechanic MOST_EXPENSIVE',
      );
    });

    it('throws when mechanic is unsupported or unconfigured', () => {
      const game: any = {
        metadata: { mechanic: 'UNKNOWN_MECHANIC', seed: 1 },
        gameplay: {},
        entities: [],
      };
      expect(() => getChoicesForRenderGame(game)).toThrow(
        'Unsupported or unconfigured mechanic: UNKNOWN_MECHANIC',
      );
    });
  });
});
