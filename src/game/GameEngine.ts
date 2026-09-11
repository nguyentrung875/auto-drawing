/**
 * Story 2.2 — Deterministic Answer & Timeline Engine.
 *
 * `GameEngine.compute(game, products, seed?)` is a pure function: the same
 * Game JSON + seed always yields the same answer, timeline and diversification
 * (NFR-1). Every random draw goes through `seedrandom` (AR-10).
 *
 * Timeline (18.0s total, within the 15–21s FR-4 window):
 *   hook 2 + product 3 + question 3 + countdown 3 + reveal 2 + result 2 + cta 3
 */
import { GameError } from './errors';
import { createRng, pick } from './rng';
import type { Product } from '../product/schema';
import type {
  ComputedGame,
  Diversification,
  GameJson,
  Timeline,
  TimelineSlot,
} from '../types/game';

/** Canonical scene durations in seconds. */
export const SCENE_DURATIONS: Record<string, number> = {
  hook: 2.0,
  product: 3.0,
  question: 3.0,
  countdown: 3.0,
  reveal: 2.0,
  result: 2.0,
  cta: 3.0,
};

export const COUNTDOWN_DURATION = 3.0;
export const REVEAL_DURATION = 2.0;
/** Tolerance for countdown/reveal drift (FR-4). */
export const DRIFT_TOLERANCE = 0.1;
/** Allowed total duration window (FR-4). */
export const MIN_TOTAL_DURATION = 15.0;
export const MAX_TOTAL_DURATION = 21.0;

const BG_COLORS = ['#fef3c7', '#fee2e2', '#dbeafe', '#dcfce7', '#f3e8ff'] as const;
const TILTS = [-2, -1, 0, 1, 2] as const;
const BGMS = ['tension_01', 'tension_02', 'tension_03'] as const;

/** Deterministic per-video diversification (avoids TikTok dedup). */
export function diversification(seed: number): Diversification {
  const rng = createRng(seed, 'diversification');
  return {
    bgColor: pick(rng, BG_COLORS),
    tilt: pick(rng, TILTS),
    bgm: pick(rng, BGMS),
  };
}

/** Build the timeline for `game.scenes`; throws `E_TIMELINE_DRIFT` on drift. */
export function buildTimeline(game: GameJson): Timeline {
  let cursor = 0;
  const slots: TimelineSlot[] = game.scenes.map((type) => {
    const duration = SCENE_DURATIONS[type];
    if (duration === undefined) {
      throw new GameError(
        'E_SCHEMA_SCENE_INVALID',
        `scenes.${type}`,
        `unknown scene '${type}' has no duration`,
      );
    }
    const start = cursor;
    cursor = Number((cursor + duration).toFixed(3));
    return { type, duration, start, end: cursor };
  });
  const totalDuration = cursor;

  const countdown = slots.find((s) => s.type === 'countdown');
  const reveal = slots.find((s) => s.type === 'reveal');
  if (!countdown || Math.abs(countdown.duration - COUNTDOWN_DURATION) > DRIFT_TOLERANCE) {
    throw new GameError(
      'E_TIMELINE_DRIFT',
      'timeline.countdown',
      `countdown must be ${COUNTDOWN_DURATION}s ±${DRIFT_TOLERANCE}s, got ${countdown?.duration ?? 'none'}`,
    );
  }
  if (!reveal || Math.abs(reveal.duration - REVEAL_DURATION) > DRIFT_TOLERANCE) {
    throw new GameError(
      'E_TIMELINE_DRIFT',
      'timeline.reveal',
      `reveal must be ${REVEAL_DURATION}s ±${DRIFT_TOLERANCE}s, got ${reveal?.duration ?? 'none'}`,
    );
  }
  if (totalDuration < MIN_TOTAL_DURATION || totalDuration > MAX_TOTAL_DURATION) {
    throw new GameError(
      'E_TIMELINE_DRIFT',
      'timeline.totalDuration',
      `total duration ${totalDuration}s outside ${MIN_TOTAL_DURATION}-${MAX_TOTAL_DURATION}s`,
    );
  }
  return { slots, totalDuration };
}

export class GameEngine {
  /**
   * Compute the answer + timeline for a validated Game JSON.
   * `products` must already be resolved from the ProductProvider (AD-4: prices
   * never come from the Game JSON itself).
   */
  static compute(
    game: GameJson,
    products: Product[],
    seed: number = game.metadata.seed,
  ): ComputedGame {
    const mechanic = game.metadata.mechanic;
    let answer: string | number;
    let detail: Record<string, unknown>;
    let revealType: ComputedGame['revealType'] = 'PriceReveal';

    if (mechanic === 'HI_LO') {
      if (products.length !== 2) {
        throw new GameError(
          'E_GAME_LOGIC_INVALID',
          'entities',
          `HI_LO needs exactly 2 products, got ${products.length}`,
        );
      }
      const [a, b] = products as [Product, Product];
      answer = b.price > a.price ? 'higher' : 'lower';
      detail = { priceA: a.price, priceB: b.price };
    } else if (mechanic === 'MOST_EXPENSIVE') {
      if (products.length < 3 || products.length > 4) {
        throw new GameError(
          'E_GAME_LOGIC_INVALID',
          'entities',
          `MOST_EXPENSIVE needs 3-4 products, got ${products.length}`,
        );
      }
      let max = products[0] as Product;
      for (const p of products) if (p.price > max.price) max = p;
      answer = max.productId;
      detail = {
        prices: products.map((p) => ({ id: p.productId, price: p.price })),
        maxPrice: max.price,
      };
    } else {
      if (products.length !== 1) {
        throw new GameError(
          'E_GAME_LOGIC_INVALID',
          'entities',
          `ONE_AWAY needs exactly 1 product, got ${products.length}`,
        );
      }
      revealType = 'DigitReveal';
      const product = products[0] as Product;
      const priceStr = String(product.price);
      const hiddenIndex = game.gameplay.hidden_index ?? 2;
      if (hiddenIndex < 0 || hiddenIndex >= priceStr.length) {
        throw new GameError(
          'E_GAME_LOGIC_INVALID',
          'gameplay.hidden_index',
          `hidden_index ${hiddenIndex} out of range for price '${priceStr}' (0..${priceStr.length - 1})`,
        );
      }
      const correctDigit = priceStr[hiddenIndex] as string;
      answer = Number(correctDigit);
      const decoy = answer === 9 ? 8 : (answer as number) + 1;
      const rng = createRng(seed, 'one_away:options');
      const ascending = [answer as number, decoy].sort((x, y) => x - y);
      const options = rng() < 0.5 ? ascending : [...ascending].reverse();
      detail = {
        correct_digit: correctDigit,
        hidden_index: hiddenIndex,
        price: product.price,
        options,
      };
    }

    return {
      gameId: game.metadata.gameId,
      mechanic,
      seed,
      answer,
      detail,
      timeline: buildTimeline(game),
      revealType,
      diversification: diversification(seed),
    };
  }
}
