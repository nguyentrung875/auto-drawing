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

export const DEAL_OR_SCAM_CHOICES = [
  { id: 'deal', label: 'DEAL HỜI MÚC NGAY' },
  { id: 'scam', label: 'BẪY SALE ẢO / SCAM' },
] as const;

/**
 * Resolves the original price for a product.
 * Uses product.originalPrice if present, otherwise synthesizes deterministically based on seed.
 */
export function resolveOriginalPrice(product: Product, seed: number): number {
  if (product.originalPrice && product.originalPrice > 0) {
    return product.originalPrice;
  }
  const rng = createRng(seed, 'deal_or_scam:original_price');
  const isDeal = rng() < 0.5;
  if (isDeal) {
    // 15% to 40% discount
    const discountRatio = 0.15 + rng() * 0.25;
    const raw = Math.round(product.price / (1 - discountRatio));
    return Math.max(product.price + 10000, Math.round(raw / 1000) * 1000);
  } else {
    // Impossible discount: 80% to 95% discount (multiplier 5x to 15x)
    const multiplier = 5 + Math.floor(rng() * 10);
    return product.price * multiplier;
  }
}

/**
 * Classifies whether a product's price vs original price represents a deal or a scam.
 * Rule: discount >= 80% on tech/luxury or price < 50,000 on high-value item => 'scam', otherwise 'deal'.
 */
export function classifyDealOrScam(product: Product, originalPrice: number): 'deal' | 'scam' {
  const price = product.price;
  if (originalPrice <= price) {
    return 'scam';
  }

  const discount = (originalPrice - price) / originalPrice;
  const category = (product.category ?? '').toLowerCase();
  const perceived = product.perceivedValue;
  const isTechOrLuxury =
    category.includes('tech') ||
    category.includes('elec') ||
    category.includes('phone') ||
    category.includes('laptop') ||
    category.includes('audio') ||
    category.includes('luxury') ||
    perceived === 'luxury' ||
    perceived === 'premium';

  const isHighValue = originalPrice >= 500000 || isTechOrLuxury;

  // discount >= 80% on tech/luxury
  if (discount >= 0.80 && isTechOrLuxury) {
    return 'scam';
  }

  // price < 50,000 on high-value item
  if (price < 50000 && isHighValue) {
    return 'scam';
  }

  // General extreme discount >= 85% is a scam
  if (discount >= 0.85) {
    return 'scam';
  }

  return 'deal';
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
