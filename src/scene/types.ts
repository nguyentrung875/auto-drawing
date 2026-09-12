/**
 * Scene contracts shared by the seven renderable scene components.
 *
 * Frames are renderer-neutral. The preview can turn them into HTML while a
 * future Motion Canvas adapter can use the same deterministic data.
 */
import type { Product } from '../product/schema';
import type {
  ComputedGame,
  GameJson,
  ResultVariant,
  Timeline,
  TimelineSlot,
} from '../types/game';

export const SCENE_NAMES = [
  'hook',
  'product',
  'question',
  'countdown',
  'reveal',
  'result',
  'cta',
] as const;

export type SceneName = (typeof SCENE_NAMES)[number];
export type RevealImplementation = 'PriceReveal' | 'DigitReveal';

export interface SceneCard {
  productId: string;
  name: string;
  image: string;
  priceLabel: string;
  /** True price, substituted by the RevealScene (see `ProductCard`). */
  revealPriceLabel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  highlight?: boolean;
}

export interface SceneData {
  cards?: SceneCard[];
  maskedPrice?: string;
  resolvedPrice?: string;
  revealType?: RevealImplementation;
  stage?: { width: number; height: number };
}

export interface FrameElement {
  kind: string;
  text?: string;
  value?: string | number;
  visible?: boolean;
  [key: string]: unknown;
}

export interface Frame {
  scene: SceneName;
  start: number;
  duration: number;
  end: number;
  elements: FrameElement[];
  data: Record<string, unknown>;
}

export interface SceneContext {
  game: GameJson;
  timeline: Timeline;
  variant: ResultVariant;
  products?: Product[];
  computed?: ComputedGame;
  sceneData?: SceneData;
}

export interface IScene {
  readonly name: SceneName;
  render(ctx: SceneContext): Frame[];
}

export interface RenderedScene {
  name: SceneName;
  component: IScene;
  timeline: TimelineSlot;
  frames: Frame[];
}

export interface SceneRenderResult {
  gameId: string;
  variant: ResultVariant;
  timeline: Timeline;
  scenes: RenderedScene[];
  frames: Frame[];
}

export class SceneError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly hint?: string;

  constructor(code: string, field?: string, hint?: string) {
    super([code, field && `at ${field}`, hint].filter(Boolean).join(' — '));
    this.name = 'SceneError';
    this.code = code;
    this.field = field;
    this.hint = hint;
  }

  toJSON(): { code: string; field?: string; hint?: string } {
    return { code: this.code, field: this.field, hint: this.hint };
  }
}

export function slotFor(ctx: SceneContext, name: SceneName): TimelineSlot {
  const slot = ctx.timeline.slots.find((candidate) => candidate.type === name);
  if (!slot) {
    throw new SceneError(
      'E_MISSING_REQUIRED_SCENE',
      'scenes',
      `${name} required`,
    );
  }
  return slot;
}

export function frame(
  ctx: SceneContext,
  name: SceneName,
  elements: FrameElement[],
  data: Record<string, unknown> = {},
  start?: number,
  duration?: number,
): Frame {
  const slot = slotFor(ctx, name);
  const frameStart = start ?? slot.start;
  const frameDuration = duration ?? slot.duration;
  return {
    scene: name,
    start: frameStart,
    duration: frameDuration,
    end: Number((frameStart + frameDuration).toFixed(3)),
    elements,
    data,
  };
}

export function answerOf(ctx: SceneContext): string | number | undefined {
  return ctx.computed?.answer ?? ctx.game.gameplay.answer;
}

export function revealTypeOf(ctx: SceneContext): RevealImplementation {
  return (
    ctx.sceneData?.revealType ??
    (ctx.game.metadata.mechanic === 'ONE_AWAY' ? 'DigitReveal' : 'PriceReveal')
  );
}
