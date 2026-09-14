import { z } from 'zod';

export type PlatformType = 'tiktok' | 'youtube_shorts' | 'reels';

export interface VideoAnalyticsRecord {
  videoId: string;
  platform: PlatformType;
  gameId?: string;
  holdRate3s: number;
  completionRate: number;
  dropOffRounds: [number, number, number];
  commentRate: number;
  shareRatio: number;
  replayRatio: number;
  scores?: {
    revealImpact?: number;
    perceptionConflict?: number;
    curiosity?: number;
    debate?: number;
    identity?: number;
    familiarity?: number;
  };
}

export interface ViralScorerWeights {
  revealImpact: number;
  perceptionConflict: number;
  curiosity: number;
  debate: number;
  identity: number;
  familiarity: number;
}

export const DEFAULT_VIRAL_WEIGHTS: ViralScorerWeights = {
  revealImpact: 0.25,
  perceptionConflict: 0.20,
  curiosity: 0.15,
  debate: 0.15,
  identity: 0.15,
  familiarity: 0.10,
};

export interface RetentionCurveAnalysis {
  avgHoldRate3s: number;
  avgCompletionRate: number;
  avgCommentRate: number;
  dropOffAtRound1: number;
  dropOffAtRound2: number;
  dropOffAtRound3: number;
  biggestDropOffRound: 1 | 2 | 3;
}

export const videoAnalyticsRecordSchema = z.object({
  videoId: z.string().min(1),
  platform: z.enum(['tiktok', 'youtube_shorts', 'reels']),
  gameId: z.string().optional(),
  holdRate3s: z.number().min(0).max(1),
  completionRate: z.number().min(0).max(1),
  dropOffRounds: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]),
  commentRate: z.number().min(0).max(1),
  shareRatio: z.number().min(0).max(1),
  replayRatio: z.number().min(0).max(1),
  scores: z
    .object({
      revealImpact: z.number().min(0).max(1).optional(),
      perceptionConflict: z.number().min(0).max(1).optional(),
      curiosity: z.number().min(0).max(1).optional(),
      debate: z.number().min(0).max(1).optional(),
      identity: z.number().min(0).max(1).optional(),
      familiarity: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
