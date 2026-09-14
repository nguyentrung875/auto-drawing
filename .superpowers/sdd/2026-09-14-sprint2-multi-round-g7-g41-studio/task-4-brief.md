# Task 4: CLI Multi-Round Render Pipeline & Sample MP4 Generation

## Files
- Modify: `src/cli/render.ts`
- Create: `test/cli/multi-render-cli.test.ts`
- Render outputs to: `video_ouput/g7_grocery_basket_123456.mp4` and `video_ouput/g41_deal_or_scam_789012.mp4`

## Interfaces
- Consumes: `src/cli/render.ts`, `QueueJob['mechanic']`, `ProductProvider`
- Produces: CLI support for G7 and G41 aliases and `--mode multi`, rendering full video MP4s to `video_ouput/`.

## Steps
1. Write failing test in `test/cli/multi-render-cli.test.ts`:
   - Test `normalizeMechanic('g7')` returns `'GROCERY_BASKET'`.
   - Test `normalizeMechanic('g41')` returns `'DEAL_OR_SCAM'`.
   - Test `parseRenderArgs(['--mechanic', 'g7', '--mode', 'multi'])` parses flags correctly.
2. In `src/cli/render.ts`:
   - Add aliases to `MECHANIC_ALIASES`:
     - `g7: 'GROCERY_BASKET'`, `grocery: 'GROCERY_BASKET'`, `grocery_basket: 'GROCERY_BASKET'`
     - `g41: 'DEAL_OR_SCAM'`, `deal: 'DEAL_OR_SCAM'`, `deal_or_scam: 'DEAL_OR_SCAM'`
   - In auto-picking products:
     - `needed = (mechanic === 'GROCERY_BASKET' ? 3 : (mechanic === 'MOST_EXPENSIVE' || mechanic === 'ODD_ONE_OUT') ? 4 : mechanic === 'HI_LO' ? 2 : 1)`.
   - In `expected`:
     - `mechanic === 'GROCERY_BASKET' ? 3 : mechanic === 'HI_LO' ? 2 : (mechanic === 'ONE_AWAY' || mechanic === 'GUESS_THE_PRICE' || mechanic === 'DEAL_OR_SCAM') ? 1 : undefined`.
3. Verify tests pass: `npx vitest run test/cli/multi-render-cli.test.ts`.
4. Render MP4 sample video for G7:
   `node bin/game.js render --mechanic g7 --seed 123456`
   Copy exported video to `video_ouput/g7_grocery_basket_123456.mp4`.
5. Render MP4 sample video for G41:
   `node bin/game.js render --mechanic g41 --seed 789012`
   Copy exported video to `video_ouput/g41_deal_or_scam_789012.mp4`.
6. Run `npm run build` and `npm run lint`.
7. Commit: `git commit -m "feat(cli): support G7 and G41 CLI rendering with sample MP4 outputs"`
