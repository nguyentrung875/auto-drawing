import { describe, it, expect } from 'vitest';
import { DiversityManager } from '../../../src/core/diversity/DiversityManager';
import { DEFAULT_DIVERSITY_POLICY } from '../../../src/core/policy';

describe('DiversityManager', () => {
  it('enforces product tuple cooldown window', () => {
    const manager = new DiversityManager({ ...DEFAULT_DIVERSITY_POLICY, cooldownProductTuple: 2 });
    const tuple = ['p001', 'p002'];

    expect(manager.canAcceptProductTuple(tuple)).toBe(true);
    manager.recordTuple(tuple);

    // Immediate duplicate blocked
    expect(manager.canAcceptProductTuple(tuple)).toBe(false);

    // Push 2 other tuples
    manager.recordTuple(['p003', 'p004']);
    manager.recordTuple(['p005', 'p006']);

    // Cooldown expired -> accepted again
    expect(manager.canAcceptProductTuple(tuple)).toBe(true);
  });

  it('prevents consecutive same answer bias (e.g. max 3 A in a row)', () => {
    const manager = new DiversityManager({ ...DEFAULT_DIVERSITY_POLICY, maxConsecutiveSameAnswer: 3 });
    manager.recordAnswer('A');
    manager.recordAnswer('A');
    manager.recordAnswer('A');

    // 4th A in a row must be rejected
    expect(manager.canAcceptAnswer('A')).toBe(false);
    expect(manager.canAcceptAnswer('B')).toBe(true);
  });

  it('enforces hero SKU cooldown window', () => {
    const manager = new DiversityManager({ ...DEFAULT_DIVERSITY_POLICY, cooldownHeroSku: 2 });
    expect(manager.canAcceptHeroSku('p001')).toBe(true);
    manager.recordHero('p001');
    expect(manager.canAcceptHeroSku('p001')).toBe(false);

    manager.recordHero('p002');
    manager.recordHero('p003');
    expect(manager.canAcceptHeroSku('p001')).toBe(true);
  });
});
