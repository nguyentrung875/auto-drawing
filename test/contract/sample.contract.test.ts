import { describe, it } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import type { IMechanicDefinition } from '../../src/core/registry/MechanicRegistry';

describe('Mechanic Contract Suite Harness', () => {
  it('successfully audits compliant mechanic lifecycle', () => {
    const compliantMechanic: IMechanicDefinition<any> = {
      id: 'COMPLIANT_GAME',
      name: 'Compliant Game',
      defaultTotalRounds: 1,
      createState: (input) => ({
        gameId: 'cg_1',
        mechanicId: 'COMPLIANT_GAME',
        seed: 123,
        roundIndex: 1,
        totalRounds: 1,
        entities: input.entities,
        choices: [
          { id: 'A', label: 'Choice A' },
          { id: 'B', label: 'Choice B' },
        ],
        answer: { winningChoiceId: 'A', revealPayload: { kind: 'HI_LO' } },
        difficulty: { global: { priceProximity: 0.5, familiarity: 0.5, visualDeception: 0.5 } },
        metadata: { createdAt: Date.now() },
      }),
      validateState: () => {},
      compileQuestion: (state) => ({
        mechanicId: state.mechanicId,
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Headline',
        entities: state.entities.map((e) => ({
          productId: e.productId,
          name: e.name,
          image: e.image,
          price: { kind: 'hidden', label: '???' },
        })),
        choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
      }),
      compileReveal: (state) => ({
        winningChoiceId: 'A',
        headlineBanner: '🎉 BẠN ĐÃ THẮNG',
        subDetailBanner: 'Mô tả',
        payload: state.answer.revealPayload,
      }),
      getDifficultyModel: (state) => state.difficulty,
      getScriptContext: () => ({ productNames: ['P1'] }),
    };

    const entities = [
      { productId: 'p001', name: 'Product 1', price: 100000, image: 'p1.png', category: 'cat' },
    ];

    verifyMechanicContract(compliantMechanic, entities);
  });
});
