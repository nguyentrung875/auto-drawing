import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { OddOneOutDefinition } from '../../src/core/mechanics/OddOneOutDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('ODD_ONE_OUT Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p601', name: 'Nồi cơm điện Cuckoo', price: 1800000, image: 'cuckoo.jpg', category: 'kitchen' },
    { productId: 'p602', name: 'Chảo chống dính Tefal', price: 650000, image: 'pan.jpg', category: 'kitchen' },
    { productId: 'p603', name: 'Nồi áp suất Philips', price: 2100000, image: 'cooker.jpg', category: 'kitchen' },
    { productId: 'p604', name: 'Bàn phím cơ không dây', price: 1200000, image: 'keyboard.jpg', category: 'gaming' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(OddOneOutDefinition, sampleEntities, 888);
  });

  it('identifies gaming item as outlier by category', () => {
    const rng = new ForkableRng(1);
    const state = OddOneOutDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('D');
    expect(state.answer.revealPayload.reason).toBe('category');

    const reveal = OddOneOutDefinition.compileReveal(state);
    expect(reveal.headlineBanner).toContain('Bàn phím cơ');
    expect(reveal.subDetailBanner).toContain('gaming');
  });
});
