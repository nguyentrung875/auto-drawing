/**
 * Flagship P0.1 — GUESS_THE_PRICE (G9).
 *
 * "Giá sản phẩm này là bao nhiêu? [A] hay [B]?"
 * Single product showcase with two distinct price brackets generated deterministically.
 */
import { GameError } from '../errors';
import type { Product } from '../../product/schema';
import { buildBaseGame, layoutCards } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';
import { NumericEngine } from '../../challenge/engines/NumericEngine';

export class GuessThePriceMechanic implements IMechanic {
  readonly id = 'GUESS_THE_PRICE' as const;
  readonly interaction = 'BOOLEAN' as const;
  readonly revealType = 'PriceReveal' as const;
  private readonly numericEngine = new NumericEngine();

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length < 1) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `GUESS_THE_PRICE needs at least 1 product, got ${products.length}`,
      );
    }
    const [product] = products as [Product, ...Product[]];
    const brackets = this.numericEngine.generatePriceBrackets(product.price, 2.5, seed);
    const gameId = input.gameId ?? `g9_${seed}`;

    const question = `Giá của ${product.name} là bao nhiêu?`;
    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: `5 Giây Đoán Giá — ${product.name}`,
      hook: '29K hay 299K? Đoán trúng ngay trong 3 giây!',
      question,
      cta: 'Comment xem bạn đúng hay sai!',
      voiceScript: `${product.name}. Giá là ${brackets.choiceA.label} hay ${brackets.choiceB.label}?`,
      products: [product],
    });

    game.gameplay.answer = brackets.correctChoice;
    game.gameplay.choices = [
      { id: 'A', label: brackets.choiceA.label },
      { id: 'B', label: brackets.choiceB.label },
    ];

    return {
      game,
      sceneData: {
        cards: layoutCards([product], ['???']),
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}
