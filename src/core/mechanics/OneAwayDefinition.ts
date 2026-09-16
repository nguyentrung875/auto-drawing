import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { OneAwayReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

function maskPrice(price: number, hiddenIndex: number): string {
  const formatted = price.toLocaleString('vi-VN');
  let digitIdx = 0;
  let result = '';
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i]!;
    if (/\d/.test(ch)) {
      if (digitIdx === hiddenIndex) {
        result += '?';
      } else {
        result += ch;
      }
      digitIdx++;
    } else {
      result += ch;
    }
  }
  return `${result}₫`;
}

export const OneAwayDefinition: IMechanicDefinition<OneAwayReveal> = {
  id: 'ONE_AWAY',
  name: 'One Away Digit Guess',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<OneAwayReveal> {
    if (input.entities.length !== 1) {
      throw new Error(`ONE_AWAY requires exactly 1 product, received ${input.entities.length}`);
    }

    const product = input.entities[0]!;
    const priceStr = String(product.price);
    const hiddenDigitIndex = 1; // Default to 2nd significant digit
    const correctDigit = Number(priceStr[hiddenDigitIndex]);

    const choices = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      label: String(i),
    }));
    const winningChoiceId = String(correctDigit);

    return {
      gameId: `one_away_${Date.now()}`,
      mechanicId: 'ONE_AWAY',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [product],
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'ONE_AWAY',
          fullPrice: product.price,
          revealedDigit: correctDigit,
          hiddenDigitIndex,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.9,
          familiarity: 0.8,
          visualDeception: 0.3,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<OneAwayReveal>): void {
    if (state.entities.length !== 1) throw new Error('ONE_AWAY must have 1 entity');
    const validDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    if (!validDigits.includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<OneAwayReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const product = state.entities[0]!;
    const masked = maskPrice(product.price, state.answer.revealPayload.hiddenDigitIndex);

    return {
      mechanicId: 'ONE_AWAY',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `Chữ số bị che trong giá ${masked} là số mấy?`,
      entities: [
        {
          productId: product.productId,
          name: product.name,
          image: product.image,
          brand: product.brand,
          price: { kind: 'hidden', label: '???' },
          badgeTag: `GIÁ CHE: ${masked}`,
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<OneAwayReveal>): RevealRenderModel<OneAwayReveal> {
    const product = state.entities[0]!;
    const { revealedDigit, fullPrice } = state.answer.revealPayload;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 CHỮ SỐ CHÍNH XÁC LÀ: ${revealedDigit}!`,
      subDetailBanner: `${product.name}: ${fullPrice.toLocaleString('vi-VN')}₫`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<OneAwayReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<OneAwayReveal>): MechanicScriptContext {
    return {
      productNames: [state.entities[0]!.name],
      benchmarkPriceLabel: `${state.answer.revealPayload.fullPrice.toLocaleString('vi-VN')}₫`,
    };
  },
};
