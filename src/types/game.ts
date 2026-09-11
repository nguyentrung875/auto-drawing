/**
 * Shared types for the Universal AI Game Video Engine.
 *
 * Story 1.1: canonical `GameJson` shape (metadata, content, entities, gameplay,
 * scenes, audio, publishing) with `seed: number`. `src/game/schema.ts` keeps a
 * zod schema that is compile-time checked against this type.
 */

export type Mechanic = 'HI_LO' | 'MOST_EXPENSIVE' | 'ONE_AWAY';
export type ResultVariant = 'in_video' | 'comment';
export type Interaction = 'BOOLEAN' | 'MULTIPLE_CHOICE' | 'DIGIT';

export interface GameMetadata {
  gameId: string;
  mechanic: Mechanic;
  version: string;
  language?: string;
  difficulty?: string;
  /** Deterministic seed — integer. */
  seed: number;
  result_variant?: ResultVariant;
}

export interface GameContent {
  title: string;
  hook: string;
  question: string;
  cta: string;
  caption: string;
  hashtags: string[];
  voice_script: string;
}

export interface GameEntity {
  productId: string;
}

export interface GameGameplay {
  mechanic: Mechanic;
  interaction?: Interaction;
  hidden_index?: number;
}

export interface GameAudio {
  voice: { script: string; enabled: boolean };
  music?: { track: string; volume: number };
  sfx: Array<{ type: string; at: number }>;
}

export interface GamePublishing {
  caption: string;
  hashtags: string[];
  affiliate_link?: string;
  outputPath?: string;
}

export interface GameJson {
  metadata: GameMetadata;
  content: GameContent;
  entities: GameEntity[];
  gameplay: GameGameplay;
  scenes: string[];
  audio: GameAudio;
  publishing: GamePublishing;
}
