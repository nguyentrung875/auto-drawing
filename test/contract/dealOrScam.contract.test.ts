import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { DealOrScamDefinition } from '../../src/core/mechanics/DealOrScamDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('DEAL_OR_SCAM Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p501', name: 'iPhone 15 Pro Max 256GB', price: 49000, image: 'iphone.jpg', category: 'tech' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(DealOrScamDefinition, sampleEntities, 555);
  });

  it('classifies luxury tech sold at 49k as scam', () => {
    const rng = new ForkableRng(1);
    const state = DealOrScamDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('scam');
    expect(state.answer.revealPayload.verdict).toBe('scam');

    const reveal = DealOrScamDefinition.compileReveal(state);
    expect(reveal.headlineBanner).toContain('CÚ LỪA');
  });
});
