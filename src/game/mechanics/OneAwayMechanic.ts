/**
 * Story 2.5 — ONE_AWAY (DIGIT) + DigitReveal prep.
 *
 * One product, one masked digit (`1,8?0,000`). The viewer picks between the
 * correct digit and a "one away" (delta 1) decoy; the order is seeded.
 */
import { GameError } from '../errors';
import { createRng } from '../rng';
import type { Product } from '../../product/schema';
import { buildBaseGame, layoutCards, maskPrice } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';

export class OneAwayMechanic implements IMechanic {
  readonly id = 'ONE_AWAY' as const;
  readonly interaction = 'DIGIT' as const;
  readonly revealType = 'DigitReveal' as const;

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length !== 1) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `ONE_AWAY needs exactly 1 product, got ${products.length}`,
      );
    }
    const product = products[0] as Product;
    const priceStr = String(product.price);
    const hiddenIndex = input.hiddenIndex ?? 2;
    if (hiddenIndex < 0 || hiddenIndex >= priceStr.length) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'gameplay.hidden_index',
        `hidden_index ${hiddenIndex} out of range for price '${priceStr}' (0..${priceStr.length - 1})`,
      );
    }

    const correctDigit = priceStr[hiddenIndex] as string;
    const correct = Number(correctDigit);
    // "One away": a decoy digit exactly 1 apart, staying within 0..9.
    const decoy = correct === 9 ? 8 : correct + 1;
    const rng = createRng(seed, 'one_away:options');
    // Deterministic order: keep ascending unless the seeded draw says swap.
    const ascending = [correct, decoy].sort((a, b) => a - b);
    const options = rng() < 0.5 ? ascending : [...ascending].reverse();

    const maskedPrice = maskPrice(product.price, hiddenIndex);
    const gameId = input.gameId ?? `one_away_${seed}`;
    const question = `Chữ số bị che trong giá ${maskedPrice} là số mấy?`;

    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: `Đoán chữ số — ${product.name}`,
      hook: 'Một chữ số bị che — bạn đoán được không?',
      question,
      cta: 'Comment đáp án của bạn!',
      voiceScript: `${product.name} giá ${maskedPrice} đồng. Chữ số bị che là số mấy?`,
      products,
    });
    game.gameplay.hidden_index = hiddenIndex;
    game.gameplay.answer = correct;
    game.gameplay.correct_digit = correctDigit;
    game.gameplay.options = options;
    game.gameplay.choices = options.map((d) => ({
      id: String(d),
      label: String(d),
    }));

    return {
      game,
      sceneData: {
        cards: layoutCards(products, [maskedPrice]),
        maskedPrice,
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}
