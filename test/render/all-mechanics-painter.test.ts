import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { Canvas } from '../../src/render/canvas';
import { paintMultiRoundFrame, getChoicesForRenderGame, drawMultiRoundProducts } from '../../src/render/scenePainter';
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

  describe('drawMultiRoundProducts typed mechanic handling without keyword dependency', () => {
    const dummyProduct = {
      ...catalog[0],
      productId: 'prod-001',
      name: 'Bàn phím cơ không dây Bluetooth RGB cao cấp',
      price: 1500000,
      category: 'Công nghệ',
      brand: 'Keychron',
      features: ['Wireless'],
    };

    it('renders one_away statusLabel correctly even when question text has custom copy without "che"', () => {
      const canvasPlay = new Canvas(1080, 1920);
      const round = {
        roundIndex: 1,
        type: 'confidence_builder' as const,
        mechanic: 'one_away',
        question: 'Con số bí ẩn là gì?', // No keyword 'che'
        products: [dummyProduct],
        choices: [
          { id: '1', label: '1', isCorrect: true },
          { id: '2', label: '2', isCorrect: false },
        ],
        correctAnswer: '1',
        timerSeconds: 5,
        scoreVector: {
          difficulty: 0.5,
          visualClarity: 0.8,
          curiosity: 0.7,
          surprise: 0.6,
          perceptionConflict: 0.5,
          debate: 0.4,
          identity: 0.5,
          familiarity: 0.6,
          commerceRelevance: 0.8,
          revealImpact: 0.7,
        },
        revealText: 'Giá chính xác là 1.500.000₫',
      };

      // Play phase: should render "Chữ số bị che: ???"
      drawMultiRoundProducts(canvasPlay, round, 'play', process.cwd());
      const playText = canvasPlay.paintedText.find((t) => t.value === 'Chữ số bị che: ???');
      expect(playText).toBeDefined();

      // Reveal phase: should render "Giá thật: 1.500.000₫"
      const canvasReveal = new Canvas(1080, 1920);
      drawMultiRoundProducts(canvasReveal, round, 'reveal', process.cwd());
      const revealText = canvasReveal.paintedText.find((t) => t.value.startsWith('Giá thật:'));
      expect(revealText).toBeDefined();
      expect(revealText?.value).toContain('1.500.000');
    });

    it('renders deal_or_scam statusLabel correctly even when question text has custom copy without "sale"', () => {
      const canvas = new Canvas(1080, 1920);
      const round = {
        roundIndex: 1,
        type: 'confidence_builder' as const,
        mechanic: 'deal_or_scam',
        question: 'Món này mua được không bạn ơi?', // No keyword 'sale'
        products: [dummyProduct],
        choices: [
          { id: 'deal', label: 'DEAL HỜI', isCorrect: true },
          { id: 'scam', label: 'BẪY SCAM', isCorrect: false },
        ],
        correctAnswer: 'deal',
        timerSeconds: 5,
        scoreVector: {
          difficulty: 0.5,
          visualClarity: 0.8,
          curiosity: 0.7,
          surprise: 0.6,
          perceptionConflict: 0.5,
          debate: 0.4,
          identity: 0.5,
          familiarity: 0.6,
          commerceRelevance: 0.8,
          revealImpact: 0.7,
        },
        revealText: 'Đáp án: DEAL HỜI',
      };

      drawMultiRoundProducts(canvas, round, 'play', process.cwd());
      const statusText = canvas.paintedText.find((t) => t.value.startsWith('Giá niêm yết:'));
      expect(statusText).toBeDefined();
      expect(statusText?.value).toContain('1.500.000');
    });

    it('adjusts statusLabelY downward when product name is long to prevent text collision', () => {
      const shortRound = {
        roundIndex: 1,
        type: 'confidence_builder' as const,
        mechanic: 'guess_the_price',
        question: 'Giá của sản phẩm là bao nhiêu?',
        products: [{ ...dummyProduct, name: 'Sạc cáp' }],
        choices: [],
        correctAnswer: '',
        timerSeconds: 5,
        scoreVector: {
          difficulty: 0.5,
          visualClarity: 0.8,
          curiosity: 0.7,
          surprise: 0.6,
          perceptionConflict: 0.5,
          debate: 0.4,
          identity: 0.5,
          familiarity: 0.6,
          commerceRelevance: 0.8,
          revealImpact: 0.7,
        },
        revealText: '',
      };

      const canvasShort = new Canvas(1080, 1920);
      drawMultiRoundProducts(canvasShort, shortRound, 'play', process.cwd());
      const shortLabel = canvasShort.paintedText.find((t) => t.value.startsWith('Mốc so sánh:'));
      expect(shortLabel).toBeDefined();

      const longRound = {
        ...shortRound,
        products: [
          {
            ...dummyProduct,
            name: 'Điện thoại thông minh siêu phẩm thế hệ mới màn hình gập cao cấp kèm bút cảm ứng và bao da chính hãng phiên bản giới hạn',
          },
        ],
      };

      const canvasLong = new Canvas(1080, 1920);
      drawMultiRoundProducts(canvasLong, longRound, 'play', process.cwd());
      const longLabel = canvasLong.paintedText.find((t) => t.value.startsWith('Mốc so sánh:'));
      expect(longLabel).toBeDefined();

      // Long name pushes statusLabelY further down than short name
      expect(longLabel!.y).toBeGreaterThan(shortLabel!.y);
    });
  });
});
