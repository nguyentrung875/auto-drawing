/**
 * Flagship P0.3 — DEAL_OR_SCAM (G41).
 *
 * "KÈO THƠM hay CÚ LỪA?" with a single product exhibiting a real or fake discount.
 * Evaluates whether a heavily discounted item is a legitimate deal or a scam.
 */
import { GameError } from '../errors';
import type { Product } from '../../product/schema';
import { createRng } from '../rng';
import { buildBaseGame, groupDigits, layoutCards } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';
import { DecisionEngine } from '../../challenge/engines/DecisionEngine';

const decisionEngine = new DecisionEngine();

export const DEAL_OR_SCAM_CHOICES = [
  { id: 'deal', label: 'DEAL HỜI MÚC NGAY' },
  { id: 'scam', label: 'BẪY SALE ẢO / SCAM' },
] as const;

/**
 * Resolves the original price for a product.
 * Uses product.originalPrice if present, otherwise synthesizes deterministically based on seed.
 */
export function resolveOriginalPrice(product: Product, seed: number): number {
  return decisionEngine.resolveOriginalPrice(product, seed);
}

/**
 * Classifies whether a product's price vs original price represents a deal or a scam.
 * Rule: discount >= 80% on tech/luxury or price < 50,000 on high-value item => 'scam', otherwise 'deal'.
 */
export function classifyDealOrScam(product: Product, originalPrice: number): 'deal' | 'scam' {
  return decisionEngine.classifyDealOrScam(product, originalPrice);
}

export class DealOrScamMechanic implements IMechanic {
  readonly id = 'DEAL_OR_SCAM' as const;
  readonly interaction = 'BOOLEAN' as const;
  readonly revealType = 'PriceReveal' as const;

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length !== 1) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `DEAL_OR_SCAM needs exactly 1 product, got ${products.length}`,
      );
    }

    const product = products[0] as Product;
    const originalPrice = resolveOriginalPrice(product, seed);
    const answer = classifyDealOrScam(product, originalPrice);
    const discount = (originalPrice - product.price) / originalPrice;
    const discountPercent = Math.round(discount * 100);

    const origStr = `${groupDigits(originalPrice)}đ`;
    const saleStr = `${groupDigits(product.price)}đ`;
    const discountStr = `${discountPercent}%`;

    const gameId = input.gameId ?? `g41_${seed}`;
    const question = `${product.name} sale sốc -${discountStr} (từ ${origStr} còn ${saleStr}): KÈO THƠM hay CÚ LỪA?`;

    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: `Kèo Thơm Hay Cú Lừa — ${product.name}`,
      hook: `Giảm tới ${discountStr}! Deal hời hay bẫy sale ảo?`,
      question,
      cta: 'Comment đáp án của bạn: Kèo thơm hay Cú lừa?',
      voiceScript: `${product.name} giá gốc ${origStr} đang sale sốc còn ${saleStr}, giảm ${discountStr}. Liệu đây là deal hời múc ngay hay bẫy sale lừa đảo?`,
      products: [product],
    });

    game.gameplay.answer = answer;
    game.gameplay.choices = DEAL_OR_SCAM_CHOICES.map((c) => ({ ...c }));

    return {
      game,
      sceneData: {
        cards: layoutCards([product], [`Sale: ${saleStr} (Gốc: ${origStr})`]),
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}
