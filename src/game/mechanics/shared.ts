/**
 * Epic 2 — helpers shared by the 3 mechanics: VND labels, digit masking,
 * non-overlapping 1080×1920 card layout, and the common Game JSON skeleton.
 */
import { GameError } from '../errors';
import { SCHEMA_VERSION } from '../schema';
import type { Product } from '../../product/schema';
import type { GameJson, Mechanic, ResultVariant } from '../../types/game';
import {
  DEFAULT_SCENES,
  PRODUCT_CARD_MAX_WIDTH,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type ProductCard,
} from './types';

/** 189000 → "189,000". */
export function groupDigits(price: number | string): string {
  return String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Mask one digit of a price and re-apply thousands separators. `hiddenIndex`
 * indexes the *raw* digit string, e.g. `maskPrice(1800000, 2)` → `"1,8?0,000"`
 * and `maskPrice(189000, 3)` → `"189,?00"`.
 */
export function maskPrice(price: number, hiddenIndex: number): string {
  const digits = String(price).split('');
  if (hiddenIndex < 0 || hiddenIndex >= digits.length) {
    throw new GameError(
      'E_GAME_LOGIC_INVALID',
      'gameplay.hidden_index',
      `hidden_index ${hiddenIndex} out of range for price '${digits.join('')}' (0..${digits.length - 1})`,
    );
  }
  digits[hiddenIndex] = '?';
  // Group in threes from the right (a regex \B lookahead breaks on '?').
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end).join(''));
  }
  return groups.join(',');
}

/**
 * Lay out N product cards inside 1080×1920 with a guaranteed gutter, so cards
 * never overlap and never exceed `PRODUCT_CARD_MAX_WIDTH` (FR-5, FR-7).
 */
export function layoutCards(
  products: Product[],
  priceLabels: string[],
): ProductCard[] {
  const n = products.length;
  const columns = n <= 1 ? 1 : 2;
  const rows = Math.ceil(n / columns);
  const gutter = 60;
  const width = Math.min(
    PRODUCT_CARD_MAX_WIDTH,
    Math.floor((STAGE_WIDTH - gutter * (columns + 1)) / columns),
  );
  const height = Math.min(560, Math.floor((STAGE_HEIGHT - 400) / rows) - gutter);
  const totalHeight = rows * height + (rows - 1) * gutter;
  const topOffset = Math.floor((STAGE_HEIGHT - totalHeight) / 2);

  return products.map((product, i) => {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const itemsInRow = Math.min(columns, n - row * columns);
    const rowWidth = itemsInRow * width + (itemsInRow - 1) * gutter;
    const left = Math.floor((STAGE_WIDTH - rowWidth) / 2);
    return {
      productId: product.productId,
      name: product.name,
      image: product.image,
      priceLabel: priceLabels[i] ?? groupDigits(product.price),
      // The reveal always shows the real price from the ProductProvider, even
      // when the pre-answer label is masked (`???` / `1,8?0,000`).
      revealPriceLabel: groupDigits(product.price),
      x: left + col * (width + gutter),
      y: topOffset + row * (height + gutter),
      width,
      height,
    };
  });
}

/** True when any two cards overlap (used by tests and the Scene System). */
export function cardsOverlap(cards: ProductCard[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i] as ProductCard;
      const b = cards[j] as ProductCard;
      const disjoint =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      if (!disjoint) return true;
    }
  }
  return false;
}

export interface BaseGameInput {
  gameId: string;
  mechanic: Mechanic;
  seed: number;
  resultVariant: ResultVariant;
  interaction: NonNullable<GameJson['gameplay']['interaction']>;
  question: string;
  hook: string;
  cta: string;
  title: string;
  voiceScript: string;
  products: Product[];
}

/** Build the Game JSON skeleton every mechanic shares (7 scenes, audio, publishing). */
export function buildBaseGame(input: BaseGameInput): GameJson {
  const hashtags = ['doangia', 'quiz'];
  return {
    metadata: {
      gameId: input.gameId,
      mechanic: input.mechanic,
      version: SCHEMA_VERSION,
      language: 'vi-VN',
      difficulty: 'medium',
      seed: input.seed,
      result_variant: input.resultVariant,
    },
    content: {
      title: input.title,
      hook: input.hook,
      question: input.question,
      cta: input.cta,
      caption: `${input.question} #doangia #quiz`,
      hashtags,
      voice_script: input.voiceScript,
    },
    entities: input.products.map((p) => ({ productId: p.productId })),
    gameplay: {
      mechanic: input.mechanic,
      interaction: input.interaction,
    },
    scenes: [...DEFAULT_SCENES],
    audio: {
      voice: { script: input.voiceScript, enabled: true },
      music: { track: 'tension_01', volume: 0.18 },
      sfx: [
        { type: 'countdown', at: 8 },
        { type: 'reveal', at: 11 },
        { type: 'correct', at: 13 },
      ],
    },
    publishing: {
      caption: input.question,
      hashtags,
      affiliate_link: input.products[0]?.affiliate_link,
      outputPath: `export/${input.gameId}_${input.seed}.mp4`,
    },
  };
}
