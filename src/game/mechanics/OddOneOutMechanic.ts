/**
 * G3 — ODD_ONE_OUT (MULTIPLE_CHOICE).
 *
 * "Món nào là kẻ lạ?" with 4 products in a 2x2 grid.
 * Identifies the outlier product by category, brand, or price distribution.
 */
import { GameError } from '../errors';
import type { Product } from '../../product/schema';
import { buildBaseGame, layoutCards } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';

const LABELS = ['A', 'B', 'C', 'D'];

export class OddOneOutMechanic implements IMechanic {
  readonly id = 'ODD_ONE_OUT' as const;
  readonly interaction = 'MULTIPLE_CHOICE' as const;
  readonly revealType = 'PriceReveal' as const;

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length !== 4) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `ODD_ONE_OUT requires exactly 4 products, got ${products.length}`,
      );
    }

    // Determine the outlier product
    // 1. By Category (3 in one category, 1 in another)
    const categoryCounts = new Map<string, Product[]>();
    for (const p of products) {
      const list = categoryCounts.get(p.category) ?? [];
      list.push(p);
      categoryCounts.set(p.category, list);
    }

    let oddProduct: Product | undefined;

    for (const [, list] of categoryCounts.entries()) {
      if (list.length === 1 && categoryCounts.size === 2) {
        oddProduct = list[0];
        break;
      }
    }

    // 2. If not found by category, try Brand (3 in one brand, 1 in another)
    if (!oddProduct) {
      const brandCounts = new Map<string, Product[]>();
      for (const p of products) {
        const list = brandCounts.get(p.brand) ?? [];
        list.push(p);
        brandCounts.set(p.brand, list);
      }
      for (const [, list] of brandCounts.entries()) {
        if (list.length === 1 && brandCounts.size === 2) {
          oddProduct = list[0];
          break;
        }
      }
    }

    // 3. Fallback: Price outlier
    if (!oddProduct) {
      const sorted = [...products].sort((a, b) => a.price - b.price);
      const deltaLow = sorted[1].price - sorted[0].price;
      const deltaHigh = sorted[3].price - sorted[2].price;
      oddProduct = deltaHigh > deltaLow ? sorted[3] : sorted[0];
    }

    const gameId = input.gameId ?? `odd_one_out_${seed}`;
    const question = 'Món nào là "KẺ LẠ" trong 4 món này?';
    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: 'Tìm món khác biệt',
      hook: 'Tìm ra KẺ LẠ trong 3 giây!',
      question,
      cta: 'Bạn đoán đúng không? Comment nhé!',
      voiceScript: `Trong 4 món này, có một kẻ lạc loài! Bạn tìm ra không?`,
      products,
    });

    game.gameplay.answer = oddProduct.productId;
    game.gameplay.choices = products.map((p, i) => ({
      id: p.productId,
      label: `${LABELS[i]}. ${p.name}`,
    }));

    return {
      game,
      sceneData: {
        cards: layoutCards(
          products,
          products.map((p) => `${p.price.toLocaleString('vi-VN')}₫`),
        ).map((card) => ({
          ...card,
          ...(card.productId === oddProduct.productId ? { highlight: true } : {}),
        })),
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}
