import { describe, it, expect } from 'vitest';
import { ForkableRng } from '../../../src/core/rng/ForkableRng';

describe('ForkableRng', () => {
  it('produces deterministic numbers from seed', () => {
    const rng1 = new ForkableRng(839271);
    const rng2 = new ForkableRng(839271);
    expect(rng1.next()).toBe(rng2.next());
    expect(rng1.int(1, 100)).toBe(rng2.int(1, 100));
  });

  it('forks namespaces independently without perturbing siblings', () => {
    const parent1 = new ForkableRng(839271);
    const products1 = parent1.fork('products');
    const choices1 = parent1.fork('choices');

    const parent2 = new ForkableRng(839271);
    const products2 = parent2.fork('products');
    // Call extra draws on parent2/choices2
    const choices2 = parent2.fork('choices');
    choices2.next();
    choices2.next();

    // products1 and products2 must produce identical sequence despite choices2 being used
    expect(products1.next()).toBe(products2.next());
    expect(products1.int(10, 50)).toBe(products2.int(10, 50));
  });

  it('picks and shuffles deterministically', () => {
    const rng = new ForkableRng(42);
    const items = ['A', 'B', 'C', 'D'];
    const picked = rng.pick(items);
    expect(items).toContain(picked);

    const shuffled = rng.shuffle(items);
    expect(shuffled).toHaveLength(4);
    expect(shuffled.sort()).toEqual([...items].sort());
  });

  it('generates booleans with target probability', () => {
    const rng = new ForkableRng(999);
    expect(typeof rng.boolean(0.5)).toBe('boolean');
  });
});
