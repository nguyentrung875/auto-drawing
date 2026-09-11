/**
 * Epic 2 — Mechanic contract.
 *
 * A Mechanic turns raw inputs (products + seed) into a *valid* Game JSON with
 * the answer already computed by the Engine (never by an LLM, AD-4) plus the
 * scene data the Scene System (Epic 3) will render.
 */
import type { Product } from '../../product/schema';
import type { GameJson, Mechanic, ResultVariant, RevealType } from '../../types/game';

/** Canonical 1080×1920 stage (FR-5). */
export const STAGE_WIDTH = 1080;
export const STAGE_HEIGHT = 1920;
/** Max ProductCard width so nothing breaks at 1080×1920 (FR-5 / FR-7). */
export const PRODUCT_CARD_MAX_WIDTH = 400;

export interface ProductCard {
  productId: string;
  name: string;
  image: string;
  /** Price text — masked (`1,8?0,000`) for ONE_AWAY, plain otherwise. */
  priceLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** MOST_EXPENSIVE — the winning card the Reveal scene highlights. */
  highlight?: boolean;
}

export interface SceneData {
  /** ProductScene / ChoiceScene cards. */
  cards: ProductCard[];
  /** ONE_AWAY only. */
  maskedPrice?: string;
  /** Reveal implementation the RevealScene must instantiate (AR-6). */
  revealType: RevealType;
  stage: { width: number; height: number };
}

export interface MechanicInput {
  products: Product[];
  seed: number;
  resultVariant?: ResultVariant;
  /** ONE_AWAY only — index of the masked digit inside the raw price string. */
  hiddenIndex?: number;
  gameId?: string;
}

export interface MechanicOutput {
  game: GameJson;
  sceneData: SceneData;
}

export interface IMechanic {
  readonly id: Mechanic;
  readonly interaction: GameJson['gameplay']['interaction'];
  readonly revealType: RevealType;
  create(input: MechanicInput): MechanicOutput;
}

/** The 7 MVP scenes, in playback order. */
export const DEFAULT_SCENES = [
  'hook',
  'product',
  'question',
  'countdown',
  'reveal',
  'result',
  'cta',
] as const;
