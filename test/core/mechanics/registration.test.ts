import { describe, it, expect, beforeEach } from 'vitest';
import { MechanicRegistry } from '../../../src/core/registry/MechanicRegistry';
import { registerAllMechanics } from '../../../src/core/mechanics';

describe('Mechanic Registration Barrel', () => {
  beforeEach(() => {
    MechanicRegistry.clear();
  });

  it('registers all 7 core game mechanics into MechanicRegistry', () => {
    registerAllMechanics();
    const list = MechanicRegistry.list();
    expect(list).toEqual(
      expect.arrayContaining([
        'HI_LO',
        'GROCERY_BASKET',
        'MOST_EXPENSIVE',
        'GUESS_THE_PRICE',
        'ONE_AWAY',
        'DEAL_OR_SCAM',
        'ODD_ONE_OUT',
      ]),
    );
    expect(list).toHaveLength(7);
  });
});
