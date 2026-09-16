import { describe, it, expect } from 'vitest';
import { PresentationCompiler } from '../../../src/core/compiler/PresentationCompiler';
import { MechanicRegistry } from '../../../src/core/registry/MechanicRegistry';
import { ForkableRng } from '../../../src/core/rng/ForkableRng';

describe('PresentationCompiler', () => {
  it('compiles presentation through registered mechanic hooks without if-else branching', () => {
    MechanicRegistry.clear();
    MechanicRegistry.register({
      id: 'DUMMY',
      name: 'Dummy',
      defaultTotalRounds: 1,
      createState: (input) => ({
        gameId: 'd1',
        mechanicId: 'DUMMY',
        seed: 1,
        roundIndex: 1,
        totalRounds: 1,
        entities: input.entities,
        choices: [{ id: 'A', label: 'A' }],
        answer: { winningChoiceId: 'A', revealPayload: {} },
        difficulty: { global: { priceProximity: 0, familiarity: 1, visualDeception: 0 } },
        metadata: { createdAt: Date.now() },
      }),
      validateState: () => {},
      compileQuestion: (s) => ({
        mechanicId: s.mechanicId,
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Q',
        entities: [],
        choices: [],
      }),
      compileReveal: () => ({
        winningChoiceId: 'A',
        headlineBanner: 'Win',
        subDetailBanner: '',
        payload: {},
      }),
      getDifficultyModel: (s) => s.difficulty,
      getScriptContext: () => ({ productNames: [] }),
    });

    const state = MechanicRegistry.get('DUMMY').createState({
      entities: [],
      rng: new ForkableRng(1),
    });

    const presentation = PresentationCompiler.compile(state, 'tv_game_show', 'single_round_challenge');
    expect(presentation.question.questionHeadline).toBe('Q');
    expect(presentation.reveal.winningChoiceId).toBe('A');
    expect(presentation.cta.variant).toBe('single_round_challenge');
  });
});
