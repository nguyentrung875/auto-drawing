import { expect } from 'vitest';
import type { IMechanicDefinition } from '../../src/core/registry/MechanicRegistry';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';
import { GameplayValidator } from '../../src/validator/GameplayValidator';

export function verifyMechanicContract(
  mechanic: IMechanicDefinition<any>,
  entities: RawEntity[],
  seed = 839271,
): void {
  const rng = new ForkableRng(seed);
  const state = mechanic.createState({ entities, rng });
  mechanic.validateState(state);

  expect(state.mechanicId).toBe(mechanic.id);
  expect(state.choices.length).toBeGreaterThanOrEqual(2);
  expect(state.answer.winningChoiceId).toBeDefined();

  const question = mechanic.compileQuestion(state, 'tv_game_show');
  const reveal = mechanic.compileReveal(state);

  const presentation = {
    question,
    reveal,
    cta: {
      bannerText: 'CTA Banner',
      subText: 'Comment below',
      variant: state.totalRounds > 1 ? ('multi_round_scorecard' as const) : ('single_round_challenge' as const),
    },
  };

  // Must pass zero-leakage validator
  GameplayValidator.validate(presentation);
}
