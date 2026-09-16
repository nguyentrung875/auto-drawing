import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { HiLoDefinition } from '../../src/core/mechanics/HiLoDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('HI_LO Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'prod_a', name: 'Nồi chiên không dầu', price: 1500000, image: 'a.jpg', category: 'appliances' },
    { productId: 'prod_b', name: 'Lò vi sóng', price: 2200000, image: 'b.jpg', category: 'appliances' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(HiLoDefinition, sampleEntities, 12345);
  });

  it('correctly compiles higher answer and reveal payload', () => {
    const rng = new ForkableRng(100);
    const state = HiLoDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('higher');
    expect(state.answer.revealPayload.comparison).toBe('higher');
    expect(state.answer.revealPayload.priceA).toBe(1500000);
    expect(state.answer.revealPayload.priceB).toBe(2200000);

    const question = HiLoDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.entities[0].price.kind).toBe('reference');
    expect(question.entities[1].price.kind).toBe('hidden');
    expect(question.choices.map((c) => c.id)).toEqual(['higher', 'lower']);
  });

  it('rejects identical price entities (tie)', () => {
    const tiedEntities: RawEntity[] = [
      { productId: 'prod_a', name: 'Nồi chiên', price: 1000000, image: 'a.jpg', category: 'appliances' },
      { productId: 'prod_b', name: 'Lò nướng', price: 1000000, image: 'b.jpg', category: 'appliances' },
    ];
    const rng = new ForkableRng(100);
    expect(() => HiLoDefinition.createState({ entities: tiedEntities, rng })).toThrow(/identical price/);
  });
});
