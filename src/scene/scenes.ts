import type { Product } from '../product/schema';
import {
  answerOf,
  frame,
  SceneError,
  slotFor,
  type Frame,
  type IScene,
  type SceneContext,
  type SceneName,
} from './types';

const STAGE_WIDTH = 1080;
const STAGE_HEIGHT = 1920;

function productCards(ctx: SceneContext): Array<Record<string, unknown>> {
  if (ctx.sceneData?.cards) return ctx.sceneData.cards.map((card) => ({ ...card }));
  return ((ctx.products && ctx.products.length > 0) ? ctx.products : ctx.game.entities.map((entity) => ({
    productId: entity.productId,
    name: entity.productId,
    image: '',
    price: 0,
  } as Product))).map((product, index, products) => {
    const columns = products.length > 1 ? 2 : 1;
    const width = Math.min(400, Math.floor((STAGE_WIDTH - 180) / columns));
    const height = Math.min(560, Math.floor((STAGE_HEIGHT - 400) / Math.ceil(products.length / columns)) - 60);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, products.length - row * columns);
    const rowWidth = rowCount * width + (rowCount - 1) * 60;
    return {
      productId: product.productId,
      name: product.name,
      image: product.image,
      priceLabel: product.price.toLocaleString('en-US'),
      x: Math.floor((STAGE_WIDTH - rowWidth) / 2) + column * (width + 60),
      y: 300 + row * (height + 60),
      width,
      height,
    };
  });
}

function validateProductCards(ctx: SceneContext, cards: Array<Record<string, unknown>>): void {
  const stage = ctx.sceneData?.stage ?? { width: STAGE_WIDTH, height: STAGE_HEIGHT };
  if (![stage.width, stage.height].every(Number.isFinite) || stage.width <= 0 || stage.height <= 0) {
    throw new SceneError('E_SCENE_LAYOUT_INVALID', 'sceneData.stage', 'stage dimensions must be finite and positive');
  }

  const boxes = cards.map((card, index) => {
    const box = {
      x: Number(card.x),
      y: Number(card.y),
      width: Number(card.width),
      height: Number(card.height),
    };
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
      throw new SceneError('E_SCENE_LAYOUT_INVALID', `sceneData.cards.${index}`, 'card geometry must be finite');
    }
    if (box.width <= 0 || box.width > 400 || box.height <= 0) {
      throw new SceneError(
        'E_SCENE_LAYOUT_INVALID',
        `sceneData.cards.${index}`,
        'card width must be 1..400px and height must be positive',
      );
    }
    if (box.x < 0 || box.y < 0 || box.x + box.width > stage.width || box.y + box.height > stage.height) {
      throw new SceneError('E_SCENE_LAYOUT_INVALID', `sceneData.cards.${index}`, 'card must stay inside the stage');
    }
    return box;
  });

  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left]!;
      const b = boxes[right]!;
      const disjoint =
        a.x + a.width <= b.x || b.x + b.width <= a.x ||
        a.y + a.height <= b.y || b.y + b.height <= a.y;
      if (!disjoint) {
        throw new SceneError('E_SCENE_LAYOUT_INVALID', 'sceneData.cards', `cards ${left} and ${right} overlap`);
      }
    }
  }
}

function answerLabel(ctx: SceneContext): string {
  const answer = answerOf(ctx);
  return answer === undefined ? '' : String(answer);
}

abstract class BaseScene implements IScene {
  abstract readonly name: SceneName;
  abstract render(ctx: SceneContext): Frame[];

  protected oneFrame(
    ctx: SceneContext,
    elements: Parameters<typeof frame>[2],
    data: Record<string, unknown> = {},
  ): Frame[] {
    return [frame(ctx, this.name, elements, data)];
  }
}

export class HookScene extends BaseScene {
  readonly name = 'hook' as const;

  render(ctx: SceneContext): Frame[] {
    return this.oneFrame(ctx, [
      { kind: 'badge', text: 'HOOK' },
      { kind: 'text', role: 'hook', text: ctx.game.content.hook },
    ], {
      text: ctx.game.content.hook,
    });
  }
}

export class ProductScene extends BaseScene {
  readonly name = 'product' as const;

  render(ctx: SceneContext): Frame[] {
    const cards = productCards(ctx);
    validateProductCards(ctx, cards);
    return this.oneFrame(ctx, [
      { kind: 'badge', text: 'PRODUCT' },
      { kind: 'product-cards', cards },
    ], {
      cards,
      stage: ctx.sceneData?.stage ?? { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      cardMaxWidth: 400,
    });
  }
}

export class QuestionScene extends BaseScene {
  readonly name = 'question' as const;

  render(ctx: SceneContext): Frame[] {
    return this.oneFrame(ctx, [
      { kind: 'badge', text: 'QUESTION' },
      { kind: 'text', role: 'question', text: ctx.game.content.question },
      { kind: 'choices', choices: ctx.game.gameplay.choices ?? [] },
    ], {
      question: ctx.game.content.question,
      interaction: ctx.game.gameplay.interaction,
      choices: ctx.game.gameplay.choices ?? [],
    });
  }
}

export class CountdownScene extends BaseScene {
  readonly name = 'countdown' as const;

  render(ctx: SceneContext): Frame[] {
    const slot = slotFor(ctx, this.name);
    const ticks = Math.max(1, Math.round(slot.duration / 0.5));
    return Array.from({ length: ticks }, (_, index) => {
      const start = Number((slot.start + index * 0.5).toFixed(3));
      const remaining = Number(Math.max(0, slot.duration - index * 0.5).toFixed(1));
      return frame(ctx, this.name, [
        { kind: 'badge', text: 'COUNTDOWN' },
        { kind: 'countdown', value: remaining, text: String(remaining) },
      ], {
        tick: index,
        remaining,
        interval: 0.5,
      }, start, 0.5);
    });
  }
}

export abstract class RevealImplementation {
  abstract readonly name: 'PriceReveal' | 'DigitReveal';
  abstract render(ctx: SceneContext): Frame[];
}

export class PriceReveal extends RevealImplementation {
  readonly name = 'PriceReveal' as const;

  render(ctx: SceneContext): Frame[] {
    const cards = productCards(ctx);
    const answer = answerLabel(ctx);
    return [frame(ctx, 'reveal', [
      { kind: 'badge', text: 'REVEAL' },
      { kind: 'price-reveal', text: answer, answer, cards },
    ], {
      revealType: this.name,
      answer,
      cards,
    })];
  }
}

export class DigitReveal extends RevealImplementation {
  readonly name = 'DigitReveal' as const;

  render(ctx: SceneContext): Frame[] {
    const answer = answerLabel(ctx);
    const maskedPrice = ctx.sceneData?.maskedPrice ?? '?';
    return [frame(ctx, 'reveal', [
      { kind: 'badge', text: 'REVEAL' },
      {
        kind: 'digit-reveal',
        animation: 'flip',
        maskedPrice,
        revealedDigit: answer,
        text: `${maskedPrice} → ${answer}`,
      },
    ], {
      revealType: this.name,
      animation: 'flip',
      maskedPrice,
      revealedDigit: answer,
    })];
  }
}

export class RevealScene extends BaseScene {
  readonly name = 'reveal' as const;
  readonly implementation: RevealImplementation;
  private readonly explicitImplementation: boolean;

  constructor(implementation?: RevealImplementation | 'PriceReveal' | 'DigitReveal') {
    super();
    this.explicitImplementation = implementation !== undefined;
    this.implementation =
      implementation instanceof RevealImplementation
        ? implementation
        : implementation === 'DigitReveal'
          ? new DigitReveal()
          : new PriceReveal();
  }

  render(ctx: SceneContext): Frame[] {
    const implementation = !this.explicitImplementation && ctx.game.metadata.mechanic === 'ONE_AWAY'
      ? new DigitReveal()
      : this.implementation;
    return implementation.render(ctx);
  }
}

export class ResultScene extends BaseScene {
  readonly name = 'result' as const;

  render(ctx: SceneContext): Frame[] {
    const variant = ctx.variant;
    if (variant === 'comment') {
      return this.oneFrame(ctx, [
        { kind: 'badge', text: 'RESULT' },
        { kind: 'comment-result', text: 'Đáp án ở comment 👇' },
      ], {
        variant,
        answerVisible: false,
      });
    }

    const answer = answerLabel(ctx);
    return this.oneFrame(ctx, [
      { kind: 'badge', text: 'RESULT' },
      { kind: 'result-badge', status: 'correct', text: `Đáp án: ${answer}` },
    ], {
      variant,
      answerVisible: true,
      answer,
    });
  }
}

export class CTAScene extends BaseScene {
  readonly name = 'cta' as const;

  render(ctx: SceneContext): Frame[] {
    return this.oneFrame(ctx, [
      { kind: 'badge', text: 'CTA' },
      { kind: 'text', role: 'cta', text: ctx.game.content.cta },
    ], {
      text: ctx.game.content.cta,
      affiliateLinkInCaptionOnly: true,
    });
  }
}
