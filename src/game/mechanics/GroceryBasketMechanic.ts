/**
 * Flagship P0.2 — GROCERY_BASKET (G7).
 *
 * "ĐỦ TIỀN hay CHÁY TÚI?" with a 3-item grocery basket and a target budget (default 300,000 VND).
 * Evaluates whether the sum of items is under or over budget using KnapsackEngine.
 */
import { GameError } from '../errors';
import type { Product } from '../../product/schema';
import { buildBaseGame, groupDigits, layoutCards } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';
import { KnapsackEngine } from '../../challenge/engines/KnapsackEngine';

export const GROCERY_BASKET_CHOICES = [
  { id: 'under', label: 'ĐỦ TIỀN (DƯỚI BUDGET)' },
  { id: 'over', label: 'CHÁY TÚI (TRÊN BUDGET)' },
] as const;

export const DEFAULT_GROCERY_BUDGET = 300000;

export class GroceryBasketMechanic implements IMechanic {
  readonly id = 'GROCERY_BASKET' as const;
  readonly interaction = 'BOOLEAN' as const;
  readonly revealType = 'PriceReveal' as const;
  private readonly knapsackEngine = new KnapsackEngine();

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length !== 3) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `GROCERY_BASKET needs exactly 3 products, got ${products.length}`,
      );
    }

    const budget = input.budget ?? DEFAULT_GROCERY_BUDGET;
    const evaluation = this.knapsackEngine.evaluateBasket(products, budget);
    const answer = evaluation.isUnderBudget ? 'under' : 'over';

    const budgetStr =
      budget >= 1000 && budget % 1000 === 0
        ? `${groupDigits(budget / 1000)}K`
        : `${groupDigits(budget)}đ`;

    const gameId = input.gameId ?? `g7_${seed}`;
    const question = `Tổng giá trị giỏ hàng 3 món này ĐỦ TIỀN hay CHÁY TÚI với ngân sách ${budgetStr}?`;

    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: 'Thử Thách Đi Chợ — Giỏ Hàng 3 Món',
      hook: `3 món này có dưới ${budgetStr} không? Đoán trúng ngay!`,
      question,
      cta: 'Comment đáp án của bạn: Đủ tiền hay Cháy túi?',
      voiceScript: `Giỏ hàng gồm 3 món: ${products.map((p) => p.name).join(', ')}. Liệu tổng tiền có dưới ${budgetStr} không?`,
      products,
    });

    game.gameplay.budget = budget;
    game.gameplay.answer = answer;
    game.gameplay.choices = GROCERY_BASKET_CHOICES.map((c) => ({ ...c }));

    return {
      game,
      sceneData: {
        cards: layoutCards(products, ['???', '???', '???']),
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}
