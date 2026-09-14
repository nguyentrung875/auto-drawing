# Task 2: P0.2 Flagship: G7 Grocery Basket Mechanic & 3-Card Tray Layout

## Files
- Modify: `src/types/game.ts` (Add `GROCERY_BASKET` to `Mechanic` union)
- Modify: `src/game/schema.ts` (Add `GROCERY_BASKET` to `MECHANICS` array)
- Modify: `src/queue/schema.ts` (Add `GROCERY_BASKET` to `queueJobSchema.mechanic` enum)
- Modify: `src/queue/BatchOrchestrator.ts` (Add `GROCERY_BASKET: 3` to `DEFAULT_PRODUCTS_PER_JOB`)
- Modify: `src/validator/Validator.ts` (Add `GROCERY_BASKET: 'BOOLEAN'` to `EXPECTED_INTERACTIONS`)
- Modify: `src/game/GameEngine.ts` (Add `else if (mechanic === 'GROCERY_BASKET')` in `compute()`)
- Create: `src/game/mechanics/GroceryBasketMechanic.ts`
- Modify: `src/game/mechanics/index.ts` (Register `GroceryBasketMechanic`)
- Create: `test/engine/grocery-basket.test.ts`

## Interfaces
- Consumes: `KnapsackEngine`, `Product`, `buildBaseGame`, `layoutCards`
- Produces: `GROCERY_BASKET` mechanic with 3-Card Tray layout and Under/Over Budget choices

## Steps
1. Write failing test in `test/engine/grocery-basket.test.ts`:
   - Test basket with 3 products (e.g. 189K + 35K + 25K = 249K).
   - Verify `game.gameplay.answer` is `'under'` when total <= budget (300K).
   - Verify `game.gameplay.choices` are `[{ id: 'under', label: 'ĐỦ TIỀN (DƯỚI BUDGET)' }, { id: 'over', label: 'CHÁY TÚI (TRÊN BUDGET)' }]`.
   - Verify `Validator.validate(game, products).ok` is `true`.
   - Verify `GameEngine.compute(game, products, seed).answer` is `'under'`.
2. Implement schema updates in `types/game.ts`, `game/schema.ts`, `queue/schema.ts`, `queue/BatchOrchestrator.ts`, and `validator/Validator.ts`.
3. Implement `src/game/mechanics/GroceryBasketMechanic.ts`:
   - Requires 3 products in basket.
   - Computes total price vs budget (default 300K or from seed/input).
   - Layouts 3 cards across stage width with `layoutCards` or horizontal spacing.
4. Implement `GameEngine.compute()` branch for `GROCERY_BASKET`:
   - Calculates total price of basket items.
   - Answer is `'under'` if total <= budget, else `'over'`.
5. Register in `src/game/mechanics/index.ts`.
6. Run `npx vitest run test/engine/grocery-basket.test.ts` and verify it passes.
7. Run `npm run build` and `npm run lint`.
8. Commit: `git add src/ types/ test/ ...; git commit -m "feat(mechanics): implement P0.2 G7 GroceryBasketMechanic"`
