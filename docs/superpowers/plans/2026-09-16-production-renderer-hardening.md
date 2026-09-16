# Production Renderer Hardening & Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate P0 compile/runtime errors, remove all fabricated fallback pricing/marketing data, introduce a job-level asset cache for 30 FPS rendering, clean up dead code, and transition mechanic detection from string-matching to type-safe enums.

**Architecture:** Refactor `src/render/scenePainter.ts` to strictly separate presentation from inference, introduce a lightweight `RenderAssetCache` to prevent disk I/O bottlenecks across 700+ frames per video, and enrich `ChallengeRound` in `src/challenge/types.ts` with explicit `mechanic` identifiers so renderers do not inspect Vietnamese question strings.

**Tech Stack:** TypeScript 5+, Vitest, Node.js 22+, Canvas software rasterizer.

**Spec:** Review report and triage findings from 2026-09-16 review session.

## Global Constraints
- Node engine: `>=22.12`
- Zero data invention: No fabricated prices, discounts, or arbitrary `'A'` fallback answers.
- Presentation only: Renderer must not alter or deduce answers.
- 9:16 safe zones: Keep interactive elements within `y: 360px - 1580px`.

---

### Task 1: Fix P0 Compilation Errors & Remove Fabricated Fallbacks

**Files:**
- Modify: `src/render/scenePainter.ts:1775-1785`
- Modify: `src/render/scenePainter.ts:457-580`
- Modify: `test/cli/all-mechanics-multi-cli.test.ts:6-18`
- Test: `test/render/all-mechanics-painter.test.ts`

**Interfaces:**
- Consumes: `round.revealText`, `round.correctAnswer`
- Produces: Type-checked, safe reveal text and validated choices without invented fallback prices.

- [ ] **Step 1: Write tests for reveal text fallback and invalid data handling**

```ts
it('falls back safely to round.correctAnswer when revealText is empty without throwing ReferenceError', () => {
  const challenge = curator.curate(g1Definition, catalog, 12345, { totalRounds: 1 });
  challenge.rounds[0]!.revealText = '';
  const scene = new AllInOneScene(challenge);
  const canvas = new Canvas(1080, 1920);
  expect(() => paintMultiRoundFrame(canvas, scene, 6.5)).not.toThrow();
});
```

- [ ] **Step 2: Run test to confirm behavior / typecheck**
Run: `npx tsc --noEmit`
Expected: Fails with TS2304 `Cannot find name 'firstProduct'`.

- [ ] **Step 3: Fix `scenePainter.ts` and `all-mechanics-multi-cli.test.ts`**
In `src/render/scenePainter.ts:1775-1780`:
```ts
const revealText =
  round.revealText ||
  `Đáp án: ${round.correctAnswer}`;
```
In `src/render/scenePainter.ts:457-575`:
Remove invented prices (`500000`, `150000`, `85`, `189000`). If price is missing or invalid, throw error or use actual entity data.
Remove `?? 'A'` fallbacks in winner selection.
In `test/cli/all-mechanics-multi-cli.test.ts`:
Add missing properties to `RenderStageOutput` mock (`fileSize: 1000, frameCount: 30, warnings: [], slow: false`).

- [ ] **Step 4: Run typecheck and tests**
Run: `npx tsc --noEmit && npx vitest run test/render/all-mechanics-painter.test.ts test/cli/all-mechanics-multi-cli.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/render/scenePainter.ts test/cli/all-mechanics-multi-cli.test.ts test/render/all-mechanics-painter.test.ts
git commit -m "fix(render): resolve firstProduct compile error and remove invented price fallbacks"
```

---

### Task 2: Implement RenderAssetCache & Clean Up Dead Code

**Files:**
- Create: `src/render/assetCache.ts`
- Modify: `src/render/scenePainter.ts`
- Modify: `src/cli/render.ts`
- Test: `test/render/asset-cache.test.ts`

**Interfaces:**
- Produces: `RenderAssetCache` with `getImage(path: string): Image | null`
- Consumes: `loadPng` from `src/render/image.ts`

- [ ] **Step 1: Write test for RenderAssetCache**
```ts
describe('RenderAssetCache', () => {
  it('caches loaded PNG images across repeated requests', () => {
    const cache = new RenderAssetCache();
    // Verify cached retrieval avoids repeated loadPng calls
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run test/render/asset-cache.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `RenderAssetCache` and integrate into painter**
Implement `RenderAssetCache` in `src/render/assetCache.ts`.
Remove dead `drawChoices()` in `src/render/scenePainter.ts:235-267`.
Replace `.replaceAll('//', '/')` with `path.join()`.
Pass `cache` through `paintMultiRoundFrame` options or context.

- [ ] **Step 4: Run tests**
Run: `npx vitest run test/render/asset-cache.test.ts test/render/all-mechanics-painter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/render/assetCache.ts src/render/scenePainter.ts src/cli/render.ts test/render/asset-cache.test.ts
git commit -m "perf(render): add RenderAssetCache and remove dead drawChoices code"
```

---

### Task 3: Typed Mechanic Enum & Safe Zone Alignment

**Files:**
- Modify: `src/challenge/types.ts`
- Modify: `src/challenge/ChallengeCurator.ts`
- Modify: `src/render/scenePainter.ts`
- Test: `test/challenge/all-mechanics-curator.test.ts`
- Test: `test/render/all-mechanics-painter.test.ts`

**Interfaces:**
- Consumes: `dsl.id`, `round.mechanic`
- Produces: Strongly-typed mechanic on `ChallengeRound`, removing `round.question.includes('che')`.

- [ ] **Step 1: Add failing test for `round.mechanic`**
```ts
it('assigns explicit mechanic string to each curated round', () => {
  const challenge = curator.curate(g5Definition, catalog, 12345);
  expect(challenge.rounds[0]!.mechanic).toBe('one_away');
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run test/challenge/all-mechanics-curator.test.ts`
Expected: FAIL (`mechanic is undefined`).

- [ ] **Step 3: Update `ChallengeRound` schema and `ChallengeCurator`**
Add `mechanic: string;` to `ChallengeRound`.
In `ChallengeCurator.ts`, populate `mechanic: dsl.id.replace(/^g\d+_/, '')` (e.g. `'hi_lo'`, `'deal_or_scam'`).
In `scenePainter.ts:1367`, switch on `round.mechanic === 'one_away'` instead of `round.question.includes('che')`.
Ensure interactive card deck and countdown bar stay within `y <= 1580px`.

- [ ] **Step 4: Run full verification**
Run: `npm run verify`
Expected: `tsc --noEmit`, `eslint`, and all tests pass with 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/challenge/types.ts src/challenge/ChallengeCurator.ts src/render/scenePainter.ts
git commit -m "refactor(challenge): add explicit mechanic to ChallengeRound and eliminate stringly-typed checks"
```
