import { describe, it, expect } from 'vitest';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import type { MultiRoundChallenge } from '../../src/challenge/types';

describe('AllInOneScene Timeline and Layout Generation', () => {
  it('generates a 38-second continuous timeline with 3 rounds and micro-hooks', () => {
    const mockChallenge: MultiRoundChallenge = {
      gameId: 'g9_guess_the_price',
      seed: 42,
      title: '5 Giây Đoán Giá',
      seriesNumber: 12,
      rounds: [
        {
          roundIndex: 1,
          type: 'confidence_builder',
          question: 'Giá bao nhiêu?',
          products: [
            {
              productId: 'p001',
              name: 'Item 1',
              image: 'p1.png',
              price: 29000,
              currency: 'VND',
              source: 's',
              updatedAt: '2026',
              category: 'c',
              brand: 'b',
              affiliate_link: 'l',
            },
          ],
          choices: [
            { id: 'A', label: '29K', isCorrect: true },
            { id: 'B', label: '290K', isCorrect: false },
          ],
          correctAnswer: 'A',
          timerSeconds: 4.0,
          scoreVector: {
            difficulty: 0.2,
            visualClarity: 1,
            curiosity: 0.5,
            surprise: 0.5,
            perceptionConflict: 0.1,
            debate: 0.3,
            identity: 0.8,
            familiarity: 0.9,
            commerceRelevance: 0.8,
            revealImpact: 0.4,
          },
          revealText: 'Giá: 29K',
        },
        {
          roundIndex: 2,
          type: 'tension_creator',
          question: 'Giá bao nhiêu?',
          products: [
            {
              productId: 'p002',
              name: 'Item 2',
              image: 'p2.png',
              price: 350000,
              currency: 'VND',
              source: 's',
              updatedAt: '2026',
              category: 'c',
              brand: 'b',
              affiliate_link: 'l',
            },
          ],
          choices: [
            { id: 'A', label: '350K', isCorrect: true },
            { id: 'B', label: '1.2 Tr', isCorrect: false },
          ],
          correctAnswer: 'A',
          timerSeconds: 5.0,
          scoreVector: {
            difficulty: 0.55,
            visualClarity: 1,
            curiosity: 0.7,
            surprise: 0.7,
            perceptionConflict: 0.4,
            debate: 0.6,
            identity: 0.8,
            familiarity: 0.8,
            commerceRelevance: 0.8,
            revealImpact: 0.6,
          },
          revealText: 'Giá: 350K',
        },
        {
          roundIndex: 3,
          type: 'wtf_reveal',
          question: 'Giá bao nhiêu?',
          products: [
            {
              productId: 'p003',
              name: 'Item 3',
              image: 'p3.png',
              price: 2500000,
              currency: 'VND',
              source: 's',
              updatedAt: '2026',
              category: 'c',
              brand: 'b',
              affiliate_link: 'l',
            },
          ],
          choices: [
            { id: 'A', label: '150K', isCorrect: false },
            { id: 'B', label: '2.5 Tr', isCorrect: true },
          ],
          correctAnswer: 'B',
          timerSeconds: 5.0,
          scoreVector: {
            difficulty: 0.85,
            visualClarity: 1,
            curiosity: 0.9,
            surprise: 0.95,
            perceptionConflict: 0.95,
            debate: 0.8,
            identity: 0.9,
            familiarity: 0.8,
            commerceRelevance: 0.9,
            revealImpact: 0.92,
          },
          revealText: 'Giá: 2.5 Triệu',
        },
      ],
      finalCta: 'Ai đúng 3/3 giơ tay!',
    };

    const scene = new AllInOneScene(mockChallenge);
    const timeline = scene.getTimeline();
    expect(timeline.totalDuration).toBe(38);
    expect(timeline.slots.length).toBeGreaterThan(5);
  });
});
