import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { GroceryBasketDefinition } from '../../src/core/mechanics/GroceryBasketDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('GROCERY_BASKET Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'item_1', name: 'Sữa tươi', price: 35000, image: 'milk.jpg', category: 'grocery' },
    { productId: 'item_2', name: 'Bánh mì sandwich', price: 25000, image: 'bread.jpg', category: 'grocery' },
    { productId: 'item_3', name: 'Trứng gà hộp 10 quả', price: 32000, image: 'eggs.jpg', category: 'grocery' },
  ];

  it('fulfills mechanic contract with zero premature price leakage', () => {
    verifyMechanicContract(GroceryBasketDefinition, sampleEntities, 54321);
  });

  it('evaluates under-budget basket correctly', () => {
    const rng = new ForkableRng(1);
    const state = GroceryBasketDefinition.createState({ entities: sampleEntities, rng });
    // Total = 92,000 <= 300,000 budget
    expect(state.answer.winningChoiceId).toBe('under');
    expect(state.answer.revealPayload.totalBill).toBe(92000);
    expect(state.answer.revealPayload.isUnderBudget).toBe(true);

    const question = GroceryBasketDefinition.compileQuestion(state, 'tv_game_show');
    // Ensure all 3 are hidden
    question.entities.forEach((e) => {
      expect(e.price.kind).toBe('hidden');
    });
  });
});
