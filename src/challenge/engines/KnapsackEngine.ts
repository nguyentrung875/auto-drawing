import type { Product } from '../../product/schema';

export interface BasketEvaluation {
  total: number;
  budget: number;
  isUnderBudget: boolean;
  deltaPercent: number;
}

export class KnapsackEngine {
  evaluateBasket(basket: Product[], budget: number): BasketEvaluation {
    const total = basket.reduce((sum, item) => sum + item.price, 0);
    const delta = Math.abs(total - budget);
    return {
      total,
      budget,
      isUnderBudget: total <= budget,
      deltaPercent: budget > 0 ? delta / budget : 0,
    };
  }
}
