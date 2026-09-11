/**
 * Story 2.4 — MOST_EXPENSIVE (MULTIPLE_CHOICE).
 *
 * "Món nào đắt nhất?" with 3–4 products; the answer is the productId with the
 * maximum price. Ties (or a top-2 delta <2%) are rejected by the Validator with
 * `E_MOST_EXPENSIVE_TIE`.
 */
import { GameError } from '../errors';
import type { Product } from '../../product/schema';
import { buildBaseGame, groupDigits, layoutCards } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';

const LABELS = ['A', 'B', 'C', 'D'];

export class MostExpensiveMechanic implements IMechanic {
  readonly id = 'MOST_EXPENSIVE' as const;
  readonly interaction = 'MULTIPLE_CHOICE' as const;
  readonly revealType = 'PriceReveal' as const;

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length < 3 || products.length > 4) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `MOST_EXPENSIVE needs 3-4 products, got ${products.length}`,
      );
    }
    let max = products[0] as Product;
    for (const p of products) if (p.price > max.price) max = p;

    const gameId = input.gameId ?? `most_expensive_${seed}`;
    const question = 'Món nào ĐẮT NHẤT?';
    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: 'Đoán món đắt nhất',
      hook: 'Món nào đắt nhất? Bạn có 3 giây!',
      question,
      cta: 'Comment đáp án của bạn!',
      voiceScript: `Trong ${products.length} món này, món nào đắt nhất?`,
      products,
    });
    game.gameplay.answer = max.productId;
    game.gameplay.choices = products.map((p, i) => ({
      id: p.productId,
      label: `${LABELS[i]}. ${p.name}`,
    }));

    return {
      game,
      sceneData: {
        cards: layoutCards(
          products,
          products.map(() => '???'),
        ).map((card) => ({
          ...card,
          // Highlight metadata for the Reveal scene (max price wins).
          ...(card.productId === max.productId ? { highlight: true } : {}),
        })),
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}

/** Exposed for the Reveal scene: the winning price label. */
export function maxPriceLabel(products: Product[]): string {
  return groupDigits(Math.max(...products.map((p) => p.price)));
}
