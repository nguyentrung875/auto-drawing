import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { OneAwayDefinition } from '../../src/core/mechanics/OneAwayDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('ONE_AWAY Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p401', name: 'Giày chạy bộ Ultraboost', price: 3800000, image: 'shoes.jpg', category: 'fashion' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(OneAwayDefinition, sampleEntities, 333);
  });

  it('masks one digit and provides 10 digit choices 0-9', () => {
    const rng = new ForkableRng(12);
    const state = OneAwayDefinition.createState({ entities: sampleEntities, rng });
    expect(state.choices).toHaveLength(10);
    expect(state.choices.map((c) => c.id)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(state.answer.revealPayload.fullPrice).toBe(3800000);
    expect(state.answer.winningChoiceId).toBe('8');

    const question = OneAwayDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.questionHeadline).toContain('Chữ số bị che');
  });
});
