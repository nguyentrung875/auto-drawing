import { MechanicRegistry, type IMechanicDefinition } from '../registry/MechanicRegistry';
import { HiLoDefinition } from './HiLoDefinition';
import { GroceryBasketDefinition } from './GroceryBasketDefinition';
import { MostExpensiveDefinition } from './MostExpensiveDefinition';
import { GuessThePriceDefinition } from './GuessThePriceDefinition';
import { OneAwayDefinition } from './OneAwayDefinition';
import { DealOrScamDefinition } from './DealOrScamDefinition';
import { OddOneOutDefinition } from './OddOneOutDefinition';

export {
  HiLoDefinition,
  GroceryBasketDefinition,
  MostExpensiveDefinition,
  GuessThePriceDefinition,
  OneAwayDefinition,
  DealOrScamDefinition,
  OddOneOutDefinition,
};

export function registerAllMechanics(): void {
  const definitions: IMechanicDefinition<any>[] = [
    HiLoDefinition,
    GroceryBasketDefinition,
    MostExpensiveDefinition,
    GuessThePriceDefinition,
    OneAwayDefinition,
    DealOrScamDefinition,
    OddOneOutDefinition,
  ];

  for (const def of definitions) {
    try {
      MechanicRegistry.register(def);
    } catch {
      // Ignore if already registered
    }
  }
}
