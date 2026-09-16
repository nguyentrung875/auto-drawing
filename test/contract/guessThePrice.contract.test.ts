import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { GuessThePriceDefinition } from '../../src/core/mechanics/GuessThePriceDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('GUESS_THE_PRICE Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p301', name: 'Bình giữ nhiệt Lock&Lock 500ml', price: 289000, image: 'flask.jpg', category: 'home' },
  ];

  it('fulfills mechanic contract with zero price leakage', () => {
    verifyMechanicContract(GuessThePriceDefinition, sampleEntities, 777);
  });

  it('generates two valid brackets and hides price in question', () => {
    const rng = new ForkableRng(42);
    const state = GuessThePriceDefinition.createState({ entities: sampleEntities, rng });
    expect(['A', 'B']).toContain(state.answer.winningChoiceId);
    expect(state.choices).toHaveLength(2);

    const question = GuessThePriceDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.entities[0].price.kind).toBe('hidden');

    const reveal = GuessThePriceDefinition.compileReveal(state);
    expect(reveal.subDetailBanner).toContain('289.000₫');
  });
});
