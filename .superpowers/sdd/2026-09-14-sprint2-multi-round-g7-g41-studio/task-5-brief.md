# Task 5: Web Studio All-in-One Canvas Preview & Timeline Scrubbing

## Files
- Modify: `studio/src/types/game.ts` (Add `GUESS_THE_PRICE`, `GROCERY_BASKET`, `DEAL_OR_SCAM` to `Mechanic` union)
- Modify: `studio/src/app/studio/page.tsx` (Add G9, G7, G41 to `mechanicConfig` and UI buttons)
- Modify: `studio/src/components/GamePreview.tsx` (Add support for previewing G9, G7, G41 and 38s timeline scrub)
- Create: `test/preview/studio-multi-round.test.ts`

## Interfaces
- Consumes: `g9Definition`, `g7Definition`, `g41Definition`, `Mechanic`
- Produces: Web Studio interactive preview at `http://localhost:3000` supporting all 3 P0 Flagships (G9, G7, G41) with interactive controls.

## Steps
1. Write test in `test/preview/studio-multi-round.test.ts`:
   - Verify `g9Definition`, `g7Definition`, and `g41Definition` are exportable and valid.
2. Update `studio/src/types/game.ts`:
   - `export type Mechanic = 'HI_LO' | 'MOST_EXPENSIVE' | 'ONE_AWAY' | 'ODD_ONE_OUT' | 'GUESS_THE_PRICE' | 'GROCERY_BASKET' | 'DEAL_OR_SCAM';`
3. Update `studio/src/app/studio/page.tsx`:
   - Add entries for `GUESS_THE_PRICE`, `GROCERY_BASKET`, `DEAL_OR_SCAM` in `mechanicConfig`.
   - Update quick-select buttons so users can click G9, G7, G41 easily.
4. Update `studio/src/components/GamePreview.tsx`:
   - Display choices and question clearly for G9, G7, G41.
5. Verify `npm run studio:build` passes cleanly without type errors.
6. Commit: `git commit -m "feat(studio): add G9, G7, and G41 support to Web Studio"`
