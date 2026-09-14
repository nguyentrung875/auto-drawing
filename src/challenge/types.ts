import { z } from 'zod';
import type { Product } from '../product/schema';

export const unitInterval = z.number().min(0.0).max(1.0);

export const challengeScoreVectorSchema = z.object({
  difficulty: unitInterval,
  visualClarity: unitInterval,
  curiosity: unitInterval,
  surprise: unitInterval,
  perceptionConflict: unitInterval,
  debate: unitInterval,
  identity: unitInterval,
  familiarity: unitInterval,
  commerceRelevance: unitInterval,
  revealImpact: unitInterval,
});

export type ChallengeScoreVector = z.infer<typeof challengeScoreVectorSchema>;

export type RoundType = 'confidence_builder' | 'tension_creator' | 'wtf_reveal';

export interface ChallengeChoice {
  id: string;
  label: string;
  isCorrect: boolean;
  value?: number | string;
}

export interface ChallengeRound {
  roundIndex: number;
  type: RoundType;
  question: string;
  hookText?: string;
  microHook?: string;
  products: Product[];
  choices: ChallengeChoice[];
  correctAnswer: string | number;
  timerSeconds: number;
  scoreVector: ChallengeScoreVector;
  revealText: string;
}

export interface MultiRoundChallenge {
  gameId: string;
  seed: number;
  title: string;
  seriesNumber: number;
  rounds: ChallengeRound[];
  finalCta: string;
}

export const gameDefinitionSchema = z.object({
  id: z.string().min(1),
  family: z.enum(['numeric_single_bracket', 'numeric_knapsack', 'commerce_decision', 'semantic', 'visual']),
  name: z.string().min(1),
  targetDuration: z.number().positive(),
  inputs: z.object({
    countPerRound: z.number().int().positive(),
    requiredFields: z.array(z.string()),
  }),
  rounds: z.array(
    z.object({
      round: z.number().int().positive(),
      type: z.enum(['confidence_builder', 'tension_creator', 'wtf_reveal', 'obvious_scam', 'plausible_sale', 'mind_bending_deal']),
      targetDifficulty: z.number().min(0).max(1).optional(),
      bracketRatio: z.number().positive().optional(),
      budget: z.number().positive().optional(),
      deltaBudgetMin: z.number().min(0).max(1).optional(),
      deltaBudgetMax: z.number().min(0).max(1).optional(),
      timerSeconds: z.number().positive(),
      hookText: z.string().optional(),
      microHook: z.string().optional(),
      minPerceptionConflict: z.number().min(0).max(1).optional(),
      perceptionConflict: z.boolean().optional(),
    }),
  ),
  presentation: z.object({
    layout: z.string(),
    actionButtons: z.array(z.string()),
  }),
});

export type GameDefinitionDSL = z.infer<typeof gameDefinitionSchema>;
