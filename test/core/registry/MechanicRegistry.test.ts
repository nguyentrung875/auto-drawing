import { describe, it, expect, beforeEach } from 'vitest';
import { MechanicRegistry, type IMechanicDefinition } from '../../../src/core/registry/MechanicRegistry';

describe('MechanicRegistry', () => {
  beforeEach(() => {
    MechanicRegistry.clear();
  });

  it('registers and retrieves a mechanic definition with lifecycle hooks', () => {
    const mockMechanic: IMechanicDefinition<{ winner: string }> = {
      id: 'TEST_GAME',
      name: 'Test Game',
      defaultTotalRounds: 1,
      createState: (input) => ({
        gameId: 'g_test',
        mechanicId: 'TEST_GAME',
        seed: 123,
        roundIndex: 1,
        totalRounds: 1,
        entities: input.entities,
        choices: [{ id: 'A', label: 'Option A' }],
        answer: { winningChoiceId: 'A', revealPayload: { winner: 'A' } },
        difficulty: { global: { priceProximity: 0.5, familiarity: 0.5, visualDeception: 0.5 } },
        metadata: { createdAt: Date.now() },
      }),
      validateState: () => {},
      compileQuestion: (state) => ({
        mechanicId: state.mechanicId,
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Test Question',
        entities: [],
        choices: [{ id: 'A', label: 'Option A' }],
      }),
      compileReveal: (state) => ({
        winningChoiceId: 'A',
        headlineBanner: 'Win',
        subDetailBanner: 'Detail',
        payload: state.answer.revealPayload,
      }),
      getDifficultyModel: (state) => state.difficulty,
      getScriptContext: () => ({ productNames: ['Item 1'] }),
    };

    MechanicRegistry.register(mockMechanic);
    expect(MechanicRegistry.list()).toContain('TEST_GAME');
    expect(MechanicRegistry.get('TEST_GAME').name).toBe('Test Game');
  });

  it('rejects duplicate mechanic registration', () => {
    const m = { id: 'DUP', name: 'Dup' } as any;
    MechanicRegistry.register(m);
    expect(() => MechanicRegistry.register(m)).toThrow(/already registered/);
  });
});
