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
});
