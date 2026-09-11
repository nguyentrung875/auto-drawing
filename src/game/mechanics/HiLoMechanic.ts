/**
 * Story 2.3 — HI_LO (BOOLEAN).
 *
 * "Sản phẩm B CAO HƠN hay THẤP HƠN A?" — the answer is `higher` when
 * `priceB > priceA`, computed deterministically by the Engine.
 */
import { GameError } from '../errors';
import type { Product } from '../../product/schema';
import { buildBaseGame, groupDigits, layoutCards } from './shared';
import type { IMechanic, MechanicInput, MechanicOutput } from './types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './types';

export const HILO_CHOICES = [
  { id: 'higher', label: 'CAO HƠN' },
  { id: 'lower', label: 'THẤP HƠN' },
] as const;

export class HiLoMechanic implements IMechanic {
  readonly id = 'HI_LO' as const;
  readonly interaction = 'BOOLEAN' as const;
  readonly revealType = 'PriceReveal' as const;

  create(input: MechanicInput): MechanicOutput {
    const { products, seed } = input;
    if (products.length !== 2) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'entities',
        `HI_LO needs exactly 2 products, got ${products.length}`,
      );
    }
    const [a, b] = products as [Product, Product];
    const answer = b.price > a.price ? 'higher' : 'lower';
    const question = `Sản phẩm B CAO HƠN hay THẤP HƠN A?`;
    const gameId = input.gameId ?? `hi_lo_${seed}`;

    const game = buildBaseGame({
      gameId,
      mechanic: this.id,
      seed,
      resultVariant: input.resultVariant ?? 'in_video',
      interaction: this.interaction,
      title: `Đoán giá — ${a.name} vs ${b.name}`,
      hook: 'Bạn đoán đúng được mấy vòng?',
      question,
      cta: 'Comment số vòng bạn đúng!',
      voiceScript: `${a.name} ${groupDigits(a.price)} đồng. ${b.name} cao hơn hay thấp hơn?`,
      products,
    });
    game.gameplay.answer = answer;
    game.gameplay.choices = HILO_CHOICES.map((c) => ({ ...c }));

    return {
      game,
      sceneData: {
        cards: layoutCards(products, [groupDigits(a.price), '???']),
        revealType: this.revealType,
        stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
    };
  }
}
