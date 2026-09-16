import type { SceneName } from './types';

export interface SceneTimingProfile {
  hook: number;
  product: number;
  question: number;
  countdown: number;
  reveal: number;
  result: number;
  cta: number;
  totalDuration: number;
}

export const CANONICAL_18S_PROFILE: SceneTimingProfile = {
  hook: 2.0,
  product: 3.0,
  question: 3.0,
  countdown: 3.0,
  reveal: 2.0,
  result: 2.0,
  cta: 3.0,
  totalDuration: 18.0,
};

export const MECHANIC_TIMING_PROFILES: Record<string, SceneTimingProfile> = {
  HI_LO: {
    hook: 1.5,
    product: 2.0,
    question: 2.0,
    countdown: 2.5,
    reveal: 1.5,
    result: 1.0,
    cta: 1.5,
    totalDuration: 12.0,
  },
  MOST_EXPENSIVE: {
    hook: 1.5,
    product: 2.5,
    question: 2.0,
    countdown: 3.0,
    reveal: 2.0,
    result: 1.5,
    cta: 1.5,
    totalDuration: 14.0,
  },
  GUESS_THE_PRICE: {
    hook: 1.5,
    product: 2.0,
    question: 2.0,
    countdown: 2.5,
    reveal: 1.5,
    result: 1.0,
    cta: 1.5,
    totalDuration: 12.0,
  },
  GUESS_PRICE_2WAY: {
    hook: 1.5,
    product: 2.0,
    question: 2.0,
    countdown: 2.5,
    reveal: 1.5,
    result: 1.0,
    cta: 1.5,
    totalDuration: 12.0,
  },
  GUESS_PRICE_BRACKET: {
    hook: 1.5,
    product: 2.5,
    question: 2.0,
    countdown: 3.0,
    reveal: 1.5,
    result: 1.5,
    cta: 1.5,
    totalDuration: 13.5,
  },
  ODD_ONE_OUT: {
    hook: 1.5,
    product: 2.5,
    question: 2.5,
    countdown: 3.0,
    reveal: 2.0,
    result: 1.5,
    cta: 1.5,
    totalDuration: 14.5,
  },
  ONE_AWAY: {
    hook: 1.5,
    product: 2.5,
    question: 2.5,
    countdown: 3.5,
    reveal: 1.5,
    result: 1.5,
    cta: 1.5,
    totalDuration: 14.5,
  },
  GROCERY_BASKET: {
    hook: 1.5,
    product: 3.0,
    question: 2.5,
    countdown: 4.0,
    reveal: 2.0,
    result: 1.5,
    cta: 1.5,
    totalDuration: 16.0,
  },
  DEAL_OR_SCAM: {
    hook: 1.5,
    product: 2.5,
    question: 2.5,
    countdown: 3.0,
    reveal: 2.0,
    result: 1.5,
    cta: 1.5,
    totalDuration: 14.5,
  },
  DEAL_CHECK: {
    hook: 1.5,
    product: 2.5,
    question: 2.5,
    countdown: 3.0,
    reveal: 2.0,
    result: 1.5,
    cta: 1.5,
    totalDuration: 14.5,
  },
};

export function getTimingProfileForMechanic(mechanic?: string): SceneTimingProfile {
  if (mechanic && MECHANIC_TIMING_PROFILES[mechanic]) {
    return MECHANIC_TIMING_PROFILES[mechanic]!;
  }
  return CANONICAL_18S_PROFILE;
}

export function getSceneDuration(scene: SceneName, profile: SceneTimingProfile = CANONICAL_18S_PROFILE): number {
  return profile[scene] ?? 2.0;
}
