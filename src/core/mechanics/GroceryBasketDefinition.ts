import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { GroceryBasketReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export const DEFAULT_GROCERY_BUDGET = 300000;

export const GroceryBasketDefinition: IMechanicDefinition<GroceryBasketReveal> = {
  id: 'GROCERY_BASKET',
  name: 'Grocery Basket Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<GroceryBasketReveal> {
    if (input.entities.length !== 3) {
      throw new Error(`GROCERY_BASKET requires exactly 3 products, received ${input.entities.length}`);
    }

    const budget = (input.difficultyTarget as any)?.budget ?? DEFAULT_GROCERY_BUDGET;
    const totalBill = input.entities.reduce((sum, item) => sum + item.price, 0);

    if (totalBill === budget) {
      throw new Error(`GROCERY_BASKET total bill matches budget exactly (${budget}đ)`);
    }

    const isUnderBudget = totalBill < budget;
    const winningChoiceId = isUnderBudget ? 'under' : 'over';
    const priceProximity = 1 - Math.min(Math.abs(totalBill - budget) / budget, 1);

    return {
      gameId: `grocery_${Date.now()}`,
      mechanicId: 'GROCERY_BASKET',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: input.entities,
      choices: [
        { id: 'under', label: 'ĐỦ TIỀN (DƯỚI BUDGET)' },
        { id: 'over', label: 'CHÁY TÚI (TRÊN BUDGET)' },
      ],
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'GROCERY_BASKET',
          budget,
          totalBill,
          isUnderBudget,
          itemPrices: input.entities.map((e) => ({ productId: e.productId, name: e.name, price: e.price })),
        },
      },
      difficulty: {
        global: {
          priceProximity,
          familiarity: 0.9,
          visualDeception: 0.4,
        },
        mechanicData: { budget, totalBill },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<GroceryBasketReveal>): void {
    if (state.entities.length !== 3) throw new Error('GROCERY_BASKET must have 3 entities');
    if (!['under', 'over'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<GroceryBasketReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const budgetStr = `${(state.answer.revealPayload.budget / 1000).toLocaleString('vi-VN')}K`;
    return {
      mechanicId: 'GROCERY_BASKET',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `Giỏ hàng 3 món này ĐỦ TIỀN hay CHÁY TÚI với ${budgetStr}?`,
      entities: state.entities.map((item) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        brand: item.brand,
        price: { kind: 'hidden', label: '???' },
        badgeTag: 'GIỎ HÀNG',
      })),
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<GroceryBasketReveal>): RevealRenderModel<GroceryBasketReveal> {
    const { isUnderBudget, totalBill, budget } = state.answer.revealPayload;
    const headlineBanner = isUnderBudget ? '🎉 ĐỦ TIỀN! CÒN DƯ NGÂN SÁCH' : '💥 CHÁY TÚI! VƯỢT NGÂN SÁCH';
    const subDetailBanner = `Tổng giỏ hàng: ${totalBill.toLocaleString('vi-VN')}₫ (Ngân sách: ${budget.toLocaleString('vi-VN')}₫)`;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner,
      subDetailBanner,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<GroceryBasketReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<GroceryBasketReveal>): MechanicScriptContext {
    return {
      productNames: state.entities.map((e) => e.name),
      benchmarkPriceLabel: `${state.answer.revealPayload.budget.toLocaleString('vi-VN')}₫`,
    };
  },
};
