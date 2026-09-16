import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { GuessThePriceReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

function formatVndLabel(price: number): string {
  if (price >= 1000000) {
    const tr = price / 1000000;
    return `${tr % 1 === 0 ? tr : tr.toFixed(1)} TRIỆU`;
  }
  const k = Math.round(price / 1000);
  return `${k}K`;
}

export const GuessThePriceDefinition: IMechanicDefinition<GuessThePriceReveal> = {
  id: 'GUESS_THE_PRICE',
  name: 'Guess The Price Bracket',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<GuessThePriceReveal> {
    if (input.entities.length < 1) {
      throw new Error('GUESS_THE_PRICE requires at least 1 product');
    }

    const product = input.entities[0]!;
    const actualPrice = product.price;

    const rng = input.rng.fork('brackets');
    const ratio = 1.8 + rng.next() * 0.7; // 1.8 - 2.5x multiplier
    const higher = rng.boolean();
    const fakePrice = higher ? Math.round(actualPrice * ratio) : Math.round(actualPrice / ratio);

    const actualLabel = formatVndLabel(actualPrice);
    const fakeLabel = formatVndLabel(fakePrice);

    const correctIsA = rng.boolean();
    const winningChoiceId = correctIsA ? 'A' : 'B';

    const choices = [
      { id: 'A', label: correctIsA ? actualLabel : fakeLabel },
      { id: 'B', label: correctIsA ? fakeLabel : actualLabel },
    ];

    const correctBracketLabel = correctIsA ? actualLabel : fakeLabel;

    return {
      gameId: `gtp_${Date.now()}`,
      mechanicId: 'GUESS_THE_PRICE',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [product],
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'GUESS_THE_PRICE',
          actualPrice,
          correctBracketLabel,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.5,
          familiarity: 0.8,
          visualDeception: 0.4,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<GuessThePriceReveal>): void {
    if (state.entities.length < 1) throw new Error('GUESS_THE_PRICE must have 1 entity');
    if (!['A', 'B'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<GuessThePriceReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const product = state.entities[0]!;
    return {
      mechanicId: 'GUESS_THE_PRICE',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `Giá của ${product.name} là bao nhiêu?`,
      entities: [
        {
          productId: product.productId,
          name: product.name,
          image: product.image,
          brand: product.brand,
          price: { kind: 'hidden', label: '???' },
          badgeTag: 'ĐOÁN GIÁ',
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<GuessThePriceReveal>): RevealRenderModel<GuessThePriceReveal> {
    const product = state.entities[0]!;
    const winningChoice = state.choices.find((c) => c.id === state.answer.winningChoiceId)!;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 GIÁ CHÍNH XÁC: ${winningChoice.label}!`,
      subDetailBanner: `${product.name}: ${state.answer.revealPayload.actualPrice.toLocaleString('vi-VN')}₫`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<GuessThePriceReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<GuessThePriceReveal>): MechanicScriptContext {
    return {
      productNames: [state.entities[0]!.name],
      bracketLabels: state.choices.map((c) => c.label),
    };
  },
};
