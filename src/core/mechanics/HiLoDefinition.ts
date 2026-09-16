import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { HiLoReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export const HiLoDefinition: IMechanicDefinition<HiLoReveal> = {
  id: 'HI_LO',
  name: 'Hi-Lo Price Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<HiLoReveal> {
    if (input.entities.length !== 2) {
      throw new Error(`HI_LO requires exactly 2 products, received ${input.entities.length}`);
    }

    const [a, b] = input.entities as [RawEntity, RawEntity];
    if (a.price === b.price) {
      throw new Error(`HI_LO rejects identical price entities (${a.price}đ)`);
    }

    const comparison: 'higher' | 'lower' = b.price > a.price ? 'higher' : 'lower';
    const priceProximity = 1 - Math.min(Math.abs(b.price - a.price) / Math.max(a.price, b.price), 1);

    return {
      gameId: `hilo_${Date.now()}`,
      mechanicId: 'HI_LO',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [a, b],
      choices: [
        { id: 'higher', label: 'CAO HƠN ⬆️' },
        { id: 'lower', label: 'THẤP HƠN ⬇️' },
      ],
      answer: {
        winningChoiceId: comparison,
        revealPayload: {
          kind: 'HI_LO',
          priceA: a.price,
          priceB: b.price,
          comparison,
        },
      },
      difficulty: {
        global: {
          priceProximity,
          familiarity: 0.8,
          visualDeception: 0.3,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<HiLoReveal>): void {
    if (state.entities.length !== 2) throw new Error('HI_LO must have 2 entities');
    if (!['higher', 'lower'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<HiLoReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const [a, b] = state.entities as [RawEntity, RawEntity];
    return {
      mechanicId: 'HI_LO',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `${b.name} CAO HƠN hay THẤP HƠN ${a.name}?`,
      entities: [
        {
          productId: a.productId,
          name: a.name,
          image: a.image,
          brand: a.brand,
          price: {
            kind: 'reference',
            value: a.price,
            label: `${a.price.toLocaleString('vi-VN')}₫`,
            role: 'anchor_benchmark',
          },
          badgeTag: 'MỐC CHUẨN',
        },
        {
          productId: b.productId,
          name: b.name,
          image: b.image,
          brand: b.brand,
          price: { kind: 'hidden', label: '???' },
          badgeTag: 'ĐOÁN GIÁ',
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<HiLoReveal>): RevealRenderModel<HiLoReveal> {
    const [a, b] = state.entities as [RawEntity, RawEntity];
    const compText = state.answer.winningChoiceId === 'higher' ? 'CAO HƠN' : 'THẤP HƠN';
    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 ${compText} LÀ CHÍNH XÁC!`,
      subDetailBanner: `${b.name} (${b.price.toLocaleString('vi-VN')}₫) ${compText.toLowerCase()} ${a.name} (${a.price.toLocaleString('vi-VN')}₫)`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<HiLoReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<HiLoReveal>): MechanicScriptContext {
    const [a, b] = state.entities as [RawEntity, RawEntity];
    return {
      productNames: [a.name, b.name],
      benchmarkPriceLabel: `${a.price.toLocaleString('vi-VN')}₫`,
    };
  },
};
