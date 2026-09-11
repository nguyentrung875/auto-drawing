/**
 * Epic 2 — MechanicRegistry.
 *
 * `MechanicRegistry.get('HI_LO').create({products, seed})`. Adding a mechanic
 * means registering one class — the Engine, Validator and Scene System stay
 * untouched (NFR-5 extensibility).
 */
import { GameError } from '../errors';
import type { Mechanic } from '../../types/game';
import { HiLoMechanic } from './HiLoMechanic';
import { MostExpensiveMechanic } from './MostExpensiveMechanic';
import { OneAwayMechanic } from './OneAwayMechanic';
import type { IMechanic } from './types';

const registry = new Map<Mechanic, IMechanic>([
  ['HI_LO', new HiLoMechanic()],
  ['MOST_EXPENSIVE', new MostExpensiveMechanic()],
  ['ONE_AWAY', new OneAwayMechanic()],
]);

export const MechanicRegistry = {
  get(id: Mechanic): IMechanic {
    const mechanic = registry.get(id);
    if (!mechanic) {
      throw new GameError(
        'E_GAME_LOGIC_INVALID',
        'metadata.mechanic',
        `unknown mechanic '${id}' (expected ${[...registry.keys()].join(', ')})`,
      );
    }
    return mechanic;
  },
  has(id: string): id is Mechanic {
    return registry.has(id as Mechanic);
  },
  ids(): Mechanic[] {
    return [...registry.keys()];
  },
};

export { HiLoMechanic, MostExpensiveMechanic, OneAwayMechanic };
export * from './types';
export {
  buildBaseGame,
  cardsOverlap,
  groupDigits,
  layoutCards,
  maskPrice,
} from './shared';
