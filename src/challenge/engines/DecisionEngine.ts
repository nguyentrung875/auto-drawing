import type { Product } from '../../product/schema';
import { createRng } from '../../game/rng';

export interface DecisionEvaluation {
  price: number;
  originalPrice: number;
  discountPercent: number;
  classification: 'deal' | 'scam';
  rationale: string;
}

export class DecisionEngine {
  /**
   * Resolves the original price for a product.
   * Uses product.originalPrice if present and valid (> price),
   * otherwise synthesizes deterministically based on seed.
   */
  resolveOriginalPrice(product: Product, seed = 42): number {
    if (product.originalPrice && product.originalPrice > product.price) {
      return product.originalPrice;
    }
    const rng = createRng(seed, 'decision_engine:original_price');
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
   * Classifies whether a product's sale price vs original price represents a real deal or a scam.
   * Rules:
   * 1. If original price <= sale price => 'scam' (fake sale).
   * 2. Extreme discount >= 80% on tech/electronics/luxury => 'scam'.
   * 3. Price < 50,000 VND on high-value item (original >= 500,000 VND or tech) => 'scam'.
   * 4. General extreme discount >= 85% => 'scam'.
   * 5. Otherwise => 'deal'.
   */
  classifyDealOrScam(product: Product, originalPrice: number): 'deal' | 'scam' {
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

    if (discount >= 0.8 && isTechOrLuxury) {
      return 'scam';
    }

    if (price < 50000 && isHighValue) {
      return 'scam';
    }

    if (discount >= 0.85) {
      return 'scam';
    }

    return 'deal';
  }

  /**
   * Evaluates an offer completely and returns structured decision metadata.
   */
  evaluateOffer(product: Product, originalPrice?: number, seed = 42): DecisionEvaluation {
    const orig = originalPrice ?? this.resolveOriginalPrice(product, seed);
    const classification = this.classifyDealOrScam(product, orig);
    const discount = Math.round(((orig - product.price) / orig) * 100);

    const rationale =
      classification === 'scam'
        ? discount >= 80
          ? `Cảnh báo giá ảo: Mức giảm sốc ${discount}% bất thường so với giá trị thực (Red Flag)`
          : 'Cảnh báo: Giá bán bất thường so với phân khúc chính hãng'
        : `Mức giảm giá hợp lý ${discount}% từ nhà phân phối chính hãng`;

    return {
      price: product.price,
      originalPrice: orig,
      discountPercent: discount,
      classification,
      rationale,
    };
  }
}
