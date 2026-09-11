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
  /** Epic 2 — answer computed by the Engine (never by an LLM). */
  answer?: string | number;
  /** ONE_AWAY — the masked digit as a string, e.g. "0". */
  correct_digit?: string;
  /** ONE_AWAY — the two digit options (correct + delta 1), seeded order. */
  options?: number[];
  /** BOOLEAN / MULTIPLE_CHOICE — the choices presented to the viewer. */
  choices?: Array<{ id: string; label: string }>;
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

/** Epic 2 — Reveal scene variants (AR-6). */
export type RevealType = 'PriceReveal' | 'DigitReveal';

export interface TimelineSlot {
  type: string;
  duration: number;
  start: number;
  end: number;
}

export interface Timeline {
  slots: TimelineSlot[];
  totalDuration: number;
}

export interface Diversification {
  bgColor: string;
  tilt: number;
  bgm: string;
}

export interface ComputedGame {
  gameId: string;
  mechanic: Mechanic;
  seed: number;
  /** Answer computed deterministically by the Engine. */
  answer: string | number;
  /** Extra mechanic-specific detail (prices, digits, options...). */
  detail: Record<string, unknown>;
  timeline: Timeline;
  revealType: RevealType;
  diversification: Diversification;
}
