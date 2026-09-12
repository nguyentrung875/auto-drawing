import { describe, expect, it } from 'vitest';
import { GameEngine, MechanicRegistry } from '../../src/game';
import type { ResultVariant } from '../../src/types/game';
import {
  DigitReveal,
  PriceReveal,
  RevealScene,
  SceneError,
  SceneSystem,
} from '../../src/scene';
import { Validator } from '../../src/validator';
import { product } from '../helpers/products';

const p001 = product('p001', 189000);
const p042 = product('p042', 2490000);

function rendered(mechanic: 'HI_LO' | 'MOST_EXPENSIVE' | 'ONE_AWAY', variant: ResultVariant = 'in_video') {
  const products = mechanic === 'HI_LO'
    ? [p001, p042]
    : mechanic === 'MOST_EXPENSIVE'
      ? [p001, product('p015', 890000), product('p028', 450000)]
      : [p001];
  const output = MechanicRegistry.get(mechanic).create({
    products,
    seed: 839271,
    hiddenIndex: mechanic === 'ONE_AWAY' ? 3 : undefined,
    resultVariant: variant,
  });
  const computed = GameEngine.compute(output.game, products);
  return { ...output, products, computed, result: SceneSystem.render(output.game, {
    products,
    computed,
    sceneData: output.sceneData,
    timeline: computed.timeline,
  }) };
}

describe('SceneSystem', () => {
  it('renders seven ordered scenes and six reusable component classes', () => {
    const hiLo = rendered('HI_LO');
    const mostExpensive = rendered('MOST_EXPENSIVE');
    expect(hiLo.result.scenes.map((scene) => scene.name)).toEqual([
      'hook', 'product', 'question', 'countdown', 'reveal', 'result', 'cta',
    ]);
    expect(hiLo.result.scenes[3]?.frames).toHaveLength(6);
    for (const name of ['hook', 'product', 'question', 'countdown', 'result', 'cta'] as const) {
      expect(hiLo.result.scenes.find((scene) => scene.name === name)?.component.constructor)
        .toBe(mostExpensive.result.scenes.find((scene) => scene.name === name)?.component.constructor);
    }
  });

  it('selects PriceReveal and DigitReveal without adding a scene', () => {
    const price = rendered('HI_LO');
    const digit = rendered('ONE_AWAY');
    expect((price.result.scenes[4]?.component as RevealScene).implementation).toBeInstanceOf(PriceReveal);
    expect((digit.result.scenes[4]?.component as RevealScene).implementation).toBeInstanceOf(DigitReveal);
    expect(digit.result.scenes).toHaveLength(7);
    expect(digit.result.scenes[1]?.frames[0]?.data.cards).toBeTruthy();
  });

  it('keeps the answer out of the comment Result variant', () => {
    const comment = rendered('HI_LO', 'comment');
    const resultFrame = comment.result.scenes.find((scene) => scene.name === 'result')?.frames;
    expect(JSON.stringify(resultFrame)).not.toContain('higher');
    expect(JSON.stringify(resultFrame)).toContain('Đáp án ở comment');
    expect(resultFrame?.[0]?.data.answerVisible).toBe(false);
  });

  it('rejects an authored scene sequence that is out of order', () => {
    const output = MechanicRegistry.get('HI_LO').create({ products: [p001, p042], seed: 1 });
    const broken = { ...output.game, scenes: [...output.game.scenes].reverse() };
    expect(() => SceneSystem.render(broken)).toThrowError(SceneError);
    expect(Validator.validate(broken, [p001, p042]).errors[0]?.code).toBe('E_SCHEMA_SCENE_INVALID');
  });

  it('rejects a supplied timeline whose duration or total drifts', () => {
    const output = MechanicRegistry.get('HI_LO').create({ products: [p001, p042], seed: 1 });
    const computed = GameEngine.compute(output.game, [p001, p042]);
    const timeline = structuredClone(computed.timeline);
    const countdown = timeline.slots.find((slot) => slot.type === 'countdown')!;
    countdown.duration = 4;
    countdown.end += 1;
    expect(() => SceneSystem.render(output.game, { timeline })).toThrowError(
      expect.objectContaining({ code: 'E_TIMELINE_DRIFT' }),
    );

    const totalDrift = structuredClone(computed.timeline);
    const cta = totalDrift.slots.at(-1)!;
    cta.duration += 0.06;
    cta.end += 0.06;
    totalDrift.totalDuration += 0.06;
    expect(() => SceneSystem.render(output.game, { timeline: totalDrift })).toThrowError(
      expect.objectContaining({ code: 'E_TIMELINE_DRIFT' }),
    );
  });

  it('rejects custom cards that overlap or exceed the 400px width limit', () => {
    const output = MechanicRegistry.get('HI_LO').create({ products: [p001, p042], seed: 1 });
    const baseCard = {
      productId: 'p001', name: 'A', image: '', priceLabel: '1',
      x: 100, y: 100, width: 500, height: 200,
    };
    expect(() => SceneSystem.render(output.game, {
      sceneData: { cards: [baseCard] },
    })).toThrowError(expect.objectContaining({ code: 'E_SCENE_LAYOUT_INVALID' }));

    expect(() => SceneSystem.render(output.game, {
      sceneData: {
        cards: [
          { ...baseCard, width: 300 },
          { ...baseCard, productId: 'p002', width: 300, x: 200 },
        ],
      },
    })).toThrowError(expect.objectContaining({ code: 'E_SCENE_LAYOUT_INVALID' }));
  });
});
