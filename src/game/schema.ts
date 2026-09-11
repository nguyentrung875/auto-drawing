/**
 * Story 1.2 — Universal Game JSON Schema (v1), zod.
 *
 * Strict structural schema for a Game JSON. Semantic scene checks live in
 * GameLoader so each error maps to its exact code (E_SCHEMA_SCENE_INVALID,
 * E_MISSING_REQUIRED_SCENE) with a precise field + hint.
 */
import { z } from 'zod';
import type { GameJson } from '../types/game';

export const MECHANICS = ['HI_LO', 'MOST_EXPENSIVE', 'ONE_AWAY'] as const;
export const RESULT_VARIANTS = ['in_video', 'comment'] as const;
export const INTERACTIONS = ['BOOLEAN', 'MULTIPLE_CHOICE', 'DIGIT'] as const;

/** The 7 MVP scenes (addendum §2). Phase-2 scenes are rejected. */
export const MVP_SCENES = [
  'hook',
  'product',
  'question',
  'countdown',
  'reveal',
  'result',
  'cta',
] as const;

/** Scenes that must always be present (FR-5). */
export const REQUIRED_SCENES = ['countdown', 'reveal'] as const;

/** Current Game JSON schema version. */
export const SCHEMA_VERSION = 'v1';

export const gameSchema = z.object({
  metadata: z.object({
    gameId: z.string().min(1),
    mechanic: z.enum(MECHANICS),
    version: z.literal(SCHEMA_VERSION),
    language: z.string().optional(),
    difficulty: z.string().optional(),
    seed: z.number().int(),
    result_variant: z.enum(RESULT_VARIANTS).optional(),
  }),
  content: z.object({
    title: z.string(),
    hook: z.string(),
    question: z.string(),
    cta: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    voice_script: z.string(),
  }),
  entities: z.array(z.object({ productId: z.string().min(1) })).min(1),
  gameplay: z.object({
    mechanic: z.enum(MECHANICS),
    interaction: z.enum(INTERACTIONS).optional(),
    hidden_index: z.number().int().optional(),
    answer: z.union([z.string(), z.number()]).optional(),
    correct_digit: z.string().optional(),
    options: z.array(z.number().int()).optional(),
    choices: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .optional(),
  }),
  scenes: z.array(z.string()).min(1),
  audio: z.object({
    voice: z.object({ script: z.string(), enabled: z.boolean() }),
    music: z.object({ track: z.string(), volume: z.number() }).optional(),
    sfx: z.array(z.object({ type: z.string(), at: z.number() })),
  }),
  publishing: z.object({
    caption: z.string(),
    hashtags: z.array(z.string()),
    affiliate_link: z.string().optional(),
    outputPath: z.string().optional(),
  }),
});

export type GameJsonParsed = z.infer<typeof gameSchema>;

// Compile-time proof that the zod schema's output matches the canonical
// GameJson type in src/types/game.ts (Story 1.1). If these drift, `tsc` fails.
type _SchemaAssignableToGameJson = GameJsonParsed extends GameJson ? true : never;
export type SchemaMatchesGameJson = _SchemaAssignableToGameJson;
