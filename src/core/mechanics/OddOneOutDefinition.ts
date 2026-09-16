import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { OddOneOutReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

const LABELS = ['A', 'B', 'C', 'D'];

export const OddOneOutDefinition: IMechanicDefinition<OddOneOutReveal> = {
  id: 'ODD_ONE_OUT',
  name: 'Odd One Out Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<OddOneOutReveal> {
    if (input.entities.length !== 4) {
      throw new Error(`ODD_ONE_OUT requires exactly 4 products, received ${input.entities.length}`);
    }

    // 1. Group by category
    const catMap = new Map<string, RawEntity[]>();
    input.entities.forEach((e) => {
      const list = catMap.get(e.category) ?? [];
      list.push(e);
      catMap.set(e.category, list);
    });

    let outlier: RawEntity | undefined;
    let reason: 'category' | 'brand' | 'price_outlier' = 'category';
    let explanation = '';

    for (const [, list] of catMap.entries()) {
      if (list.length === 1 && catMap.size === 2) {
        outlier = list[0]!;
        reason = 'category';
        explanation = `3 món còn lại cùng ngành hàng, riêng ${outlier.name} thuộc ngành hàng khác (${outlier.category})!`;
        break;
      }
    }

    // 2. Fallback: Price outlier
    if (!outlier) {
      const sorted = [...input.entities].sort((a, b) => a.price - b.price);
      const deltaLow = sorted[1]!.price - sorted[0]!.price;
      const deltaHigh = sorted[3]!.price - sorted[2]!.price;
      outlier = deltaHigh > deltaLow ? sorted[3]! : sorted[0]!;
      reason = 'price_outlier';
      explanation = `${outlier.name} có mức giá lệch hẳn so with 3 món còn lại!`;
    }

    const winningIndex = input.entities.findIndex((e) => e.productId === outlier!.productId);
    const winningChoiceId = LABELS[winningIndex]!;

    const choices = input.entities.map((e, idx) => ({
      id: LABELS[idx]!,
      label: `${LABELS[idx]}. ${e.name}`,
    }));

    return {
      gameId: `ooo_${Date.now()}`,
      mechanicId: 'ODD_ONE_OUT',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: input.entities,
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'ODD_ONE_OUT',
          oddProductId: outlier.productId,
          reason,
          explanation,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.6,
          familiarity: 0.8,
          visualDeception: 0.6,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<OddOneOutReveal>): void {
    if (state.entities.length !== 4) throw new Error('ODD_ONE_OUT must have 4 entities');
    if (!LABELS.includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<OddOneOutReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    return {
      mechanicId: 'ODD_ONE_OUT',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: 'Món nào là "KẺ LẠ" trong 4 món này?',
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

  compileReveal(state: GameState<OddOneOutReveal>): RevealRenderModel<OddOneOutReveal> {
    const winnerEntity = state.entities.find((e) => e.productId === state.answer.revealPayload.oddProductId)!;
    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 KẺ LẠ LÀ ${state.answer.winningChoiceId}: ${winnerEntity.name}!`,
      subDetailBanner: state.answer.revealPayload.explanation,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<OddOneOutReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<OddOneOutReveal>): MechanicScriptContext {
    return {
      productNames: state.entities.map((e) => e.name),
      bracketLabels: state.choices.map((c) => c.label),
    };
  },
};
