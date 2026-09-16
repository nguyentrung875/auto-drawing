import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { MostExpensiveReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

const LABELS = ['A', 'B', 'C', 'D'];

export const MostExpensiveDefinition: IMechanicDefinition<MostExpensiveReveal> = {
  id: 'MOST_EXPENSIVE',
  name: 'Most Expensive Item Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<MostExpensiveReveal> {
    const len = input.entities.length;
    if (len < 3 || len > 4) {
      throw new Error(`MOST_EXPENSIVE requires 3-4 products, received ${len}`);
    }

    const sortedByPrice = [...input.entities].sort((a, b) => b.price - a.price);
    const highest = sortedByPrice[0]!;
    const runnerUp = sortedByPrice[1]!;

    const delta = (highest.price - runnerUp.price) / highest.price;
    if (delta < 0.02) {
      throw new Error(`MOST_EXPENSIVE rejected due to tie or top-2 delta < 2% (${(delta * 100).toFixed(1)}%)`);
    }

    const winningIndex = input.entities.findIndex((e) => e.productId === highest.productId);
    const winningChoiceId = LABELS[winningIndex]!;

    const choices = input.entities.map((e, idx) => ({
      id: LABELS[idx]!,
      label: `${LABELS[idx]}. ${e.name}`,
    }));

    return {
      gameId: `most_exp_${Date.now()}`,
      mechanicId: 'MOST_EXPENSIVE',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: input.entities,
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'MOST_EXPENSIVE',
          prices: input.entities.map((e) => ({ productId: e.productId, name: e.name, price: e.price })),
          highestProductId: highest.productId,
        },
      },
      difficulty: {
        global: {
          priceProximity: 1 - delta,
          familiarity: 0.8,
          visualDeception: 0.5,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<MostExpensiveReveal>): void {
    if (state.entities.length < 3 || state.entities.length > 4) {
      throw new Error('MOST_EXPENSIVE must have 3-4 entities');
    }
    if (!LABELS.slice(0, state.entities.length).includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<MostExpensiveReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    return {
      mechanicId: 'MOST_EXPENSIVE',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: 'Món nào ĐẮT NHẤT trong các món sau?',
      entities: state.entities.map((item, idx) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        brand: item.brand,
        price: { kind: 'hidden', label: '???' },
        badgeTag: `MÓN ${LABELS[idx]}`,
      })),
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<MostExpensiveReveal>): RevealRenderModel<MostExpensiveReveal> {
    const winnerEntity = state.entities.find((e) => e.productId === state.answer.revealPayload.highestProductId)!;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 ĐẮT NHẤT LÀ ${state.answer.winningChoiceId}: ${winnerEntity.name}!`,
      subDetailBanner: `Giá chính xác: ${winnerEntity.price.toLocaleString('vi-VN')}₫`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<MostExpensiveReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<MostExpensiveReveal>): MechanicScriptContext {
    return {
      productNames: state.entities.map((e) => e.name),
      bracketLabels: state.choices.map((c) => c.label),
    };
  },
};
