import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { MostExpensiveDefinition } from '../../src/core/mechanics/MostExpensiveDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('MOST_EXPENSIVE Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p101', name: 'Tai nghe Bluetooth', price: 450000, image: 'headphones.jpg', category: 'audio' },
    { productId: 'p102', name: 'Loa không dây Marshall', price: 3200000, image: 'speaker.jpg', category: 'audio' },
    { productId: 'p103', name: 'Chuột Gaming không dây', price: 890000, image: 'mouse.jpg', category: 'accessories' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(MostExpensiveDefinition, sampleEntities, 999);
  });

  it('maps winning choice to clean letter B and strips raw SKUs', () => {
    const rng = new ForkableRng(1);
    const state = MostExpensiveDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('B');
    expect(state.answer.revealPayload.highestProductId).toBe('p102');

    const question = MostExpensiveDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.choices[1].label).toBe('B. Loa không dây Marshall');
    // Ensure no raw SKU leaks in choice labels
    question.choices.forEach((c) => {
      expect(c.label).not.toMatch(/\bp\d{3,}\b/i);
    });

    const reveal = MostExpensiveDefinition.compileReveal(state);
    expect(reveal.headlineBanner).not.toMatch(/\bp\d{3,}\b/i);
    expect(reveal.headlineBanner).toContain('Loa không dây Marshall');
  });

  it('rejects top-2 items with price tie or delta under 2%', () => {
    const closeEntities: RawEntity[] = [
      { productId: 'p201', name: 'Món A', price: 1000000, image: 'a.jpg', category: 'test' },
      { productId: 'p202', name: 'Món B', price: 1010000, image: 'b.jpg', category: 'test' }, // 1% delta
      { productId: 'p203', name: 'Món C', price: 500000, image: 'c.jpg', category: 'test' },
    ];
    const rng = new ForkableRng(1);
    expect(() => MostExpensiveDefinition.createState({ entities: closeEntities, rng })).toThrow(/delta < 2%/);
  });
});
