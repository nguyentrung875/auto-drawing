# Task 3: P0.3 Flagship: G41 Deal or Scam Mechanic & Discount Badge Layout

## Files
- Modify: `src/types/game.ts` (Add `DEAL_OR_SCAM` to `Mechanic` union)
- Modify: `src/game/schema.ts` (Add `DEAL_OR_SCAM` to `MECHANICS` array)
- Modify: `src/queue/schema.ts` (Add `DEAL_OR_SCAM` to `queueJobSchema.mechanic` enum)
- Modify: `src/queue/BatchOrchestrator.ts` (Add `DEAL_OR_SCAM: 1` to `DEFAULT_PRODUCTS_PER_JOB`)
- Modify: `src/validator/Validator.ts` (Add `DEAL_OR_SCAM: 'BOOLEAN'` to `EXPECTED_INTERACTIONS`, 1 product requirement)
- Modify: `src/game/GameEngine.ts` (Add `else if (mechanic === 'DEAL_OR_SCAM')` in `compute()`)
- Create: `src/definitions/g41_deal_or_scam.ts` (DSL specification for G41)
- Create: `src/game/mechanics/DealOrScamMechanic.ts` (Mechanic implementing IMechanic)
- Modify: `src/game/mechanics/index.ts` (Register `DealOrScamMechanic`)
- Create: `test/engine/deal-or-scam.test.ts`

## Interfaces
- Consumes: `Product`, `buildBaseGame`, `layoutCards`, `IMechanic`
- Produces: `DEAL_OR_SCAM` mechanic, `g41Definition`

## Steps
1. Write failing test in `test/engine/deal-or-scam.test.ts`:
   - Test product with impossible discount (e.g. originalPrice: 1,500,000, price: 19,000 -> 98% discount) => answer is `'scam'`.
   - Test product with legitimate deal (e.g. originalPrice: 200,000, price: 150,000 -> 25% discount) => answer is `'deal'`.
   - Choices: `[{ id: 'deal', label: 'DEAL HỜI MÚC NGAY' }, { id: 'scam', label: 'BẪY SALE ẢO / SCAM' }]`.
   - Validator and GameEngine determinism checks.
2. Update schemas (`types/game.ts`, `game/schema.ts`, `queue/schema.ts`, `queue/BatchOrchestrator.ts`, `validator/Validator.ts`).
3. Create `src/definitions/g41_deal_or_scam.ts`.
4. Create `src/game/mechanics/DealOrScamMechanic.ts`:
   - Takes 1 product with `originalPrice` and `price`.
   - If `originalPrice` is missing, synthesize or compute discount based on seed.
   - Classification logic: discount >= 80% on tech/luxury or price < 50,000 on high-value item => `'scam'`, otherwise `'deal'`.
   - Format cards with masked/original price and sale price.
5. Update `GameEngine.compute()` branch for `DEAL_OR_SCAM`.
6. Register in `src/game/mechanics/index.ts`.
7. Run tests, `npm run build`, `npm run lint`.
8. Commit: `git commit -m "feat(mechanics): implement P0.3 G41 DealOrScamMechanic and DSL"`
