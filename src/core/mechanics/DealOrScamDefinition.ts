import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { DealOrScamReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';
import { DecisionEngine } from '../../challenge/engines/DecisionEngine';
import type { Product } from '../../product/schema';

const decisionEngine = new DecisionEngine();

export const DealOrScamDefinition: IMechanicDefinition<DealOrScamReveal> = {
  id: 'DEAL_OR_SCAM',
  name: 'Deal Or Scam Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<DealOrScamReveal> {
    if (input.entities.length !== 1) {
      throw new Error(`DEAL_OR_SCAM requires exactly 1 product, received ${input.entities.length}`);
    }

    const rawEntity = input.entities[0]!;
    const product = rawEntity as Product;
    const seed = input.rng.int(1, 1000000);

    const evaluation = decisionEngine.evaluateOffer(product, rawEntity.originalPrice, seed);
    const { originalPrice, discountPercent, classification, rationale } = evaluation;

    return {
      gameId: `dos_${Date.now()}`,
      mechanicId: 'DEAL_OR_SCAM',
      seed,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [rawEntity],
      choices: [
        { id: 'deal', label: 'DEAL THẬT MÚC NGAY' },
        { id: 'scam', label: 'BẪY GIÁ ẢO / RED FLAG' },
      ],
      answer: {
        winningChoiceId: classification,
        revealPayload: {
          kind: 'DEAL_OR_SCAM',
          originalPrice,
          salePrice: rawEntity.price,
          discountPercent,
          verdict: classification,
          explanation: rationale,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.7,
          familiarity: 0.9,
          visualDeception: classification === 'scam' ? 0.9 : 0.4,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<DealOrScamReveal>): void {
    if (state.entities.length !== 1) throw new Error('DEAL_OR_SCAM must have 1 entity');
    if (!['deal', 'scam'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<DealOrScamReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const product = state.entities[0]!;
    const { discountPercent, originalPrice, salePrice } = state.answer.revealPayload;

    return {
      mechanicId: 'DEAL_OR_SCAM',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `${product.name} sale -${discountPercent}%: KÈO THƠM hay CÚ LỪA?`,
      entities: [
        {
          productId: product.productId,
          name: product.name,
          image: product.image,
          brand: product.brand,
          price: {
            kind: 'reference',
            value: salePrice,
            label: `${salePrice.toLocaleString('vi-VN')}₫ (Gốc: ${originalPrice.toLocaleString('vi-VN')}₫)`,
            role: 'original_price',
          },
          badgeTag: `SALE -${discountPercent}%`,
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<DealOrScamReveal>): RevealRenderModel<DealOrScamReveal> {
    const { verdict, explanation } = state.answer.revealPayload;
    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: verdict === 'deal' ? '🎉 KÈO THƠM CHÍNH HÃNG!' : '⚠️ CÚ LỪA! BẪY SALE ẢO',
      subDetailBanner: explanation,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<DealOrScamReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<DealOrScamReveal>): MechanicScriptContext {
    return {
      productNames: [state.entities[0]!.name],
      discountRateLabel: `${state.answer.revealPayload.discountPercent}%`,
    };
  },
};
