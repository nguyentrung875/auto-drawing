import { describe, it, expect } from 'vitest';
import { Canvas } from '../../src/render/canvas';
import { paintMultiRoundFrame } from '../../src/render/scenePainter';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import type { MultiRoundChallenge } from '../../src/challenge/types';

describe('paintMultiRoundFrame', () => {
  const mockChallenge: MultiRoundChallenge = {
    gameId: 'g9_test',
    seed: 42,
    title: '5 Giây Đoán Giá',
    seriesNumber: 15,
    rounds: [
      {
        roundIndex: 1,
        type: 'confidence_builder',
        question: 'Giá sản phẩm này là bao nhiêu?',
        products: [
          {
            productId: 'p001',
            name: 'Sản phẩm 1',
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
        revealText: 'Giá chính xác: 29K',
      },
      {
        roundIndex: 2,
        type: 'tension_creator',
        question: 'Giá sản phẩm này là bao nhiêu?',
        microHook: 'Câu 2 bắt đầu xoắn não rồi đây!',
        products: [
          {
            productId: 'p002',
            name: 'Sản phẩm 2',
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
        revealText: 'Giá chính xác: 350K',
      },
      {
        roundIndex: 3,
        type: 'wtf_reveal',
        question: 'Giá sản phẩm này là bao nhiêu?',
        microHook: '⚠️ CÂU CUỐI: 95% NGƯỜI ĐOÁN SAI BÉT!',
        products: [
          {
            productId: 'p003',
            name: 'Sản phẩm 3',
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
        revealText: 'Giá chính xác: 2.5 Triệu',
      },
    ],
    finalCta: 'Ai đúng 3/3 giơ tay! Săn deal tại giỏ hàng bên dưới!',
  };

  it('paints hook, question, reveal, micro-hook, and scorecard frames without throwing', () => {
    const scene = new AllInOneScene(mockChallenge);
    const canvas = new Canvas(1080, 1920);

    // 0.5s: Hook
    expect(() => paintMultiRoundFrame(canvas, scene, 0.5)).not.toThrow();
    expect(canvas.paintedText.some((t) => t.value.includes('TẬP #15'))).toBe(true);

    // 3.0s: Round 1 Play (Instant Countdown)
    const playCanvas = new Canvas(1080, 1920);
    expect(() => paintMultiRoundFrame(playCanvas, scene, 3.0)).not.toThrow();
    expect(playCanvas.paintedText.some((t) => t.value.includes('Giá sản phẩm này'))).toBe(true);
    expect(playCanvas.paintedText.some((t) => t.value.includes('Còn 3.0s...'))).toBe(true);

    // 7.0s: Round 1 Reveal
    const revealCanvas = new Canvas(1080, 1920);
    expect(() => paintMultiRoundFrame(revealCanvas, scene, 7.0)).not.toThrow();
    expect(revealCanvas.paintedText.some((t) => t.value.includes('Giá chính xác: 29K'))).toBe(true);

    // 8.2s: Micro-hook 1
    const microCanvas = new Canvas(1080, 1920);
    expect(() => paintMultiRoundFrame(microCanvas, scene, 8.2)).not.toThrow();
    expect(microCanvas.paintedText.some((t) => t.value.includes('xoắn não'))).toBe(true);

    // 24.0s: Scorecard & CTA
    const scoreCanvas = new Canvas(1080, 1920);
    expect(() => paintMultiRoundFrame(scoreCanvas, scene, 24.0)).not.toThrow();
    expect(scoreCanvas.paintedText.some((t) => t.value.includes('BẠN ĐÚNG MẤY CÂU?'))).toBe(true);
    expect(scoreCanvas.paintedText.some((t) => t.value.includes('Ai đúng 3/3 giơ tay!'))).toBe(true);
  });

  it('correctly paints 4 choices in 2x2 grid without throwing', () => {
    const fourChoiceChallenge = {
      ...mockChallenge,
      rounds: [
        {
          ...mockChallenge.rounds[0]!,
          choices: [
            { id: 'A', label: '10K - 20K', isCorrect: false },
            { id: 'B', label: '21K - 30K', isCorrect: true },
            { id: 'C', label: '31K - 40K', isCorrect: false },
            { id: 'D', label: 'Trên 40K', isCorrect: false },
          ],
        },
      ],
    };

    const scene = new AllInOneScene(fourChoiceChallenge);
    const canvas = new Canvas(1080, 1920);

    expect(() => paintMultiRoundFrame(canvas, scene, 4.0)).not.toThrow();
    expect(canvas.paintedText.some((t) => t.value.includes('[ A ]'))).toBe(true);
    expect(canvas.paintedText.some((t) => t.value.includes('[ D ]'))).toBe(true);
    expect(canvas.paintedText.some((t) => t.value.includes('Còn'))).toBe(true);
  });
});
