# Sprint 2 Implementation Plan: Multi-Round 38s Video Pipeline, G7, G41 & Web Studio Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full continuous 38-second Multi-Round All-in-One Video Renderer on Canvas, complete P0.2 Flagship (G7 Grocery Basket) and P0.3 Flagship (G41 Deal or Scam), and integrate interactive 38s scrubbable preview in Web Studio.

**Architecture:** Extend `RenderEngine` and `scenePainter` to support rendering continuous multi-round timelines (Hook -> R1 -> Micro-hook 1 -> R2 -> Micro-hook 2 -> R3 -> Scorecard). Register `GROCERY_BASKET` (G7) and `DEAL_OR_SCAM` (G41) mechanics with dedicated canvas layouts (3-card basket tray, discount inspection deck). Connect Web Studio (`studio/`) to render isomorphic All-in-One previews directly in the browser.

**Tech Stack:** TypeScript 5.7, Node.js 22+, Vitest, Next.js 15, Canvas/Skia, FFmpeg.

**Spec:** [`docs/superpowers/specs/2026-09-14-viral-all-in-one-multi-round-engine-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-14-viral-all-in-one-multi-round-engine-design.md)

## Global Constraints

- Never break existing 28 test files (206 tests) or backwards compatibility for legacy mechanics.
- Maintain vertical 9:16 safe zones (Top 150px, Bottom 400px reserved for platform UI).
- Every video generated must adhere to Cognitive Escalation (R1: Confidence -> R2: Tension -> R3: WTF).
- All new mechanics must validate deterministically and support seeding.

---

### Task 1: Multi-Round 38s Frame Painter & Dynamic Timeline Rendering

**Files:**
- Modify: `src/render/scenePainter.ts`
- Create: `test/render/multi-round-painter.test.ts`

**Interfaces:**
- Consumes: `AllInOneScene`, `MultiRoundChallenge`, `src/render/canvas.ts`
- Produces: `paintMultiRoundFrame()` to render frames for any second `t` in `[0, 38]`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/render/multi-round-painter.test.ts
import { describe, it, expect } from 'vitest';
import { Canvas } from '../../src/render/canvas';
import { paintMultiRoundFrame } from '../../src/render/scenePainter';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import type { MultiRoundChallenge } from '../../src/challenge/types';

describe('paintMultiRoundFrame', () => {
  const mockChallenge: MultiRoundChallenge = {
    gameId: 'g9_test',
    seed: 42,
    title: '5 Giây Đoán Giá',
    seriesNumber: 15,
    rounds: [
      {
        roundIndex: 1,
        type: 'confidence_builder',
        question: 'Giá sản phẩm này là bao nhiêu?',
        products: [{ productId: 'p001', name: 'Sản phẩm 1', image: 'p1.png', price: 29000, currency: 'VND', source: 's', updatedAt: '2026', category: 'c', brand: 'b', affiliate_link: 'l' }],
        choices: [{ id: 'A', label: '29K', isCorrect: true }, { id: 'B', label: '290K', isCorrect: false }],
        correctAnswer: 'A',
        timerSeconds: 4.0,
        scoreVector: { difficulty: 0.2, visualClarity: 1, curiosity: 0.5, surprise: 0.5, perceptionConflict: 0.1, debate: 0.3, identity: 0.8, familiarity: 0.9, commerceRelevance: 0.8, revealImpact: 0.4 },
        revealText: 'Giá chính xác: 29K',
      },
      {
        roundIndex: 2,
        type: 'tension_creator',
        question: 'Giá sản phẩm này là bao nhiêu?',
        microHook: 'Câu 2 bắt đầu xoắn não rồi đây!',
        products: [{ productId: 'p002', name: 'Sản phẩm 2', image: 'p2.png', price: 350000, currency: 'VND', source: 's', updatedAt: '2026', category: 'c', brand: 'b', affiliate_link: 'l' }],
        choices: [{ id: 'A', label: '350K', isCorrect: true }, { id: 'B', label: '1.2 Tr', isCorrect: false }],
        correctAnswer: 'A',
        timerSeconds: 5.0,
        scoreVector: { difficulty: 0.55, visualClarity: 1, curiosity: 0.7, surprise: 0.7, perceptionConflict: 0.4, debate: 0.6, identity: 0.8, familiarity: 0.8, commerceRelevance: 0.8, revealImpact: 0.6 },
        revealText: 'Giá chính xác: 350K',
      },
      {
        roundIndex: 3,
        type: 'wtf_reveal',
        question: 'Giá sản phẩm này là bao nhiêu?',
        microHook: '⚠️ CÂU CUỐI: 95% NGƯỜI ĐOÁN SAI BÉT!',
        products: [{ productId: 'p003', name: 'Sản phẩm 3', image: 'p3.png', price: 2500000, currency: 'VND', source: 's', updatedAt: '2026', category: 'c', brand: 'b', affiliate_link: 'l' }],
        choices: [{ id: 'A', label: '150K', isCorrect: false }, { id: 'B', label: '2.5 Tr', isCorrect: true }],
        correctAnswer: 'B',
        timerSeconds: 5.0,
        scoreVector: { difficulty: 0.85, visualClarity: 1, curiosity: 0.9, surprise: 0.95, perceptionConflict: 0.95, debate: 0.8, identity: 0.9, familiarity: 0.8, commerceRelevance: 0.9, revealImpact: 0.92 },
        revealText: 'Giá chính xác: 2.5 Triệu',
      },
    ],
    finalCta: 'Ai đúng 3/3 giơ tay! Săn deal tại giỏ hàng bên dưới!',
  };

  it('paints hook, question, reveal, micro-hook, and scorecard frames without throwing', () => {
    const scene = new AllInOneScene(mockChallenge);
    const canvas = new Canvas(1080, 1920);

    // 0.5s: Hook
    expect(() => paintMultiRoundFrame(canvas, scene, 0.5)).not.toThrow();

    // 4.0s: Round 1 Play (Countdown)
    expect(() => paintMultiRoundFrame(canvas, scene, 4.0)).not.toThrow();

    // 9.0s: Round 1 Reveal
    expect(() => paintMultiRoundFrame(canvas, scene, 9.0)).not.toThrow();

    // 11.0s: Micro-hook 1
    expect(() => paintMultiRoundFrame(canvas, scene, 11.0)).not.toThrow();

    // 36.0s: Scorecard & CTA
    expect(() => paintMultiRoundFrame(canvas, scene, 36.0)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/render/multi-round-painter.test.ts`
Expected: FAIL with `paintMultiRoundFrame` not exported from `src/render/scenePainter`.

- [ ] **Step 3: Implement paintMultiRoundFrame in scenePainter.ts**

In `src/render/scenePainter.ts`:
Implement `paintMultiRoundFrame(canvas: Canvas, scene: AllInOneScene, timeSeconds: number)`:
- Determine slot in `scene.getTimeline()` for `timeSeconds`.
- Clear background with dark blue-black gradient (`#0b0f19` to `#020617`).
- Render appropriate layer:
  - If `slot.type === 'hook'`: Draw series badge, large title text, hook question.
  - If `slot.type.startsWith('round_')`:
    - Draw Series HUD (Series Badge, Round Dots).
    - Draw Question Box at y=320.
    - Draw Product Card at y=450 (700x700).
    - Draw Choice Deck at y=1220.
    - If phase is `play`: Draw Pill Countdown with time remaining.
    - If phase is `reveal`: Draw Reveal Banner with glowing border around winner and actual price.
  - If `slot.type.startsWith('micro_hook_')`:
    - Draw high-contrast flashing banner with micro-hook text.
  - If `slot.type === 'scorecard'`:
    - Draw 3 Stars (⭐⭐⭐), scorecard header ("BẠN ĐÚNG MẤY CÂU?"), and CTA ("Ai đúng 3/3 giơ tay!").

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render/multi-round-painter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/scenePainter.ts test/render/multi-round-painter.test.ts
git commit -m "feat(render): implement paintMultiRoundFrame for 38s continuous timeline"
```

---

### Task 2: P0.2 Flagship: G7 Grocery Basket Mechanic & 3-Card Tray Layout

**Files:**
- Modify: `src/types/game.ts` (Add `GROCERY_BASKET`)
- Modify: `src/game/schema.ts` (Add `GROCERY_BASKET`)
- Modify: `src/queue/schema.ts` (Add `GROCERY_BASKET`)
- Modify: `src/queue/BatchOrchestrator.ts` (Add `GROCERY_BASKET: 3`)
- Modify: `src/validator/Validator.ts` (Add `GROCERY_BASKET: 'BOOLEAN'`)
- Create: `src/game/mechanics/GroceryBasketMechanic.ts`
- Modify: `src/game/mechanics/index.ts`
- Modify: `src/render/scenePainter.ts` (Add `drawBasketTray`)
- Test: `test/engine/grocery-basket.test.ts`

**Interfaces:**
- Consumes: `KnapsackEngine`, `Product`
- Produces: `GROCERY_BASKET` mechanic with 3-Card Tray layout and Under/Over Budget choices

- [ ] **Step 1: Write the failing test**

```typescript
// test/engine/grocery-basket.test.ts
import { describe, it, expect } from 'vitest';
import { MechanicRegistry } from '../../src/game/mechanics';
import { Validator } from '../../src/validator';
import { GameEngine } from '../../src/game';
import type { Product } from '../../src/product/schema';

describe('G7 — GROCERY_BASKET (BOOLEAN)', () => {
  const basket: Product[] = [
    { productId: 'p001', name: 'Nước giặt', image: 'p1.png', price: 189000, currency: 'VND', source: 's', updatedAt: '2026', category: 'home', brand: 'Omo', affiliate_link: 'l' },
    { productId: 'p002', name: 'Nước rửa chén', image: 'p2.png', price: 35000, currency: 'VND', source: 's', updatedAt: '2026', category: 'home', brand: 'Sunlight', affiliate_link: 'l' },
    { productId: 'p003', name: 'Khăn lau', image: 'p3.png', price: 25000, currency: 'VND', source: 's', updatedAt: '2026', category: 'home', brand: 'OEM', affiliate_link: 'l' },
  ]; // Total: 249,000 VND

  it('computes answer "under" when total bill is under budget 300K', () => {
    const { game, sceneData } = MechanicRegistry.get('GROCERY_BASKET').create({
      products: basket,
      seed: 123456,
    });
    expect(game.gameplay.answer).toBe('under');
    expect(game.gameplay.choices?.map(c => c.id)).toEqual(['under', 'over']);
    expect(sceneData.cards.length).toBe(3);

    const validation = Validator.validate(game, basket);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, basket, 123456);
    expect(computed.answer).toBe('under');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/grocery-basket.test.ts`
Expected: FAIL with unknown mechanic `GROCERY_BASKET`.

- [ ] **Step 3: Implement GroceryBasketMechanic and register across schemas**

Update `src/types/game.ts`, `src/game/schema.ts`, `src/queue/schema.ts`, `src/validator/Validator.ts`, `src/queue/BatchOrchestrator.ts`.
Create `src/game/mechanics/GroceryBasketMechanic.ts`:
- Accepts 3 products in a basket.
- Evaluates total price against budget (default 300K, or seeded).
- Answer is `'under'` if total <= budget, else `'over'`.
- Layout 3 cards in horizontal tray inside 1080 stage width.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/engine/grocery-basket.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/mechanics/GroceryBasketMechanic.ts src/types/game.ts src/game/schema.ts src/queue/schema.ts src/validator/Validator.ts src/queue/BatchOrchestrator.ts src/game/mechanics/index.ts test/engine/grocery-basket.test.ts
git commit -m "feat(mechanics): implement P0.2 G7 GroceryBasketMechanic"
```

---

### Task 3: P0.3 Flagship: G41 Deal or Scam Mechanic & Discount Badge Layout

**Files:**
- Modify: `src/types/game.ts` (Add `DEAL_OR_SCAM`)
- Modify: `src/game/schema.ts` (Add `DEAL_OR_SCAM`)
- Modify: `src/queue/schema.ts` (Add `DEAL_OR_SCAM`)
- Modify: `src/queue/BatchOrchestrator.ts` (Add `DEAL_OR_SCAM: 1`)
- Modify: `src/validator/Validator.ts` (Add `DEAL_OR_SCAM: 'BOOLEAN'`)
- Create: `src/definitions/g41_deal_or_scam.ts`
- Create: `src/game/mechanics/DealOrScamMechanic.ts`
- Modify: `src/game/mechanics/index.ts`
- Test: `test/engine/deal-or-scam.test.ts`

**Interfaces:**
- Consumes: `Product`, `ViralScorer`
- Produces: `DEAL_OR_SCAM` mechanic with Fake/Real discount, choices [DEAL HỜI] vs [BẪY ẢO / SCAM].

- [ ] **Step 1: Write the failing test**

```typescript
// test/engine/deal-or-scam.test.ts
import { describe, it, expect } from 'vitest';
import { MechanicRegistry } from '../../src/game/mechanics';
import { Validator } from '../../src/validator';
import { GameEngine } from '../../src/game';
import type { Product } from '../../src/product/schema';

describe('G41 — DEAL_OR_SCAM (BOOLEAN)', () => {
  const p: Product = {
    productId: 'p001',
    name: 'Tai Nghe Bluetooth Pro',
    image: 'p1.png',
    price: 19000, // 19K for high-end earphone -> obvious scam
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'tech',
    brand: 'Apple Rep',
    affiliate_link: 'l',
    originalPrice: 1500000,
    discountPercent: 98,
  };

  it('computes answer "scam" for impossible discount', () => {
    const { game, sceneData } = MechanicRegistry.get('DEAL_OR_SCAM').create({
      products: [p],
      seed: 789012,
    });
    expect(game.gameplay.answer).toBe('scam');
    expect(game.gameplay.choices?.map(c => c.id)).toEqual(['deal', 'scam']);

    const validation = Validator.validate(game, [p]);
    expect(validation.ok).toBe(true);

    const computed = GameEngine.compute(game, [p], 789012);
    expect(computed.answer).toBe('scam');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/deal-or-scam.test.ts`
Expected: FAIL with unknown mechanic `DEAL_OR_SCAM`.

- [ ] **Step 3: Implement DealOrScamMechanic and DSL**

Create `src/definitions/g41_deal_or_scam.ts`.
Create `src/game/mechanics/DealOrScamMechanic.ts`:
- Compares original price vs sale price.
- If discount > 85% on premium categories, classifies as `'scam'`.
- Supports legitimate subsidized flash sale when tagged.
Register across `MechanicRegistry`, `Validator`, and schemas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/engine/deal-or-scam.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/definitions/g41_deal_or_scam.ts src/game/mechanics/DealOrScamMechanic.ts src/types/game.ts src/game/schema.ts src/queue/schema.ts src/validator/Validator.ts src/queue/BatchOrchestrator.ts src/game/mechanics/index.ts test/engine/deal-or-scam.test.ts
git commit -m "feat(mechanics): implement P0.3 G41 DealOrScamMechanic"
```

---

### Task 4: CLI Multi-Round Render Pipeline & Sample MP4 Generation

**Files:**
- Modify: `src/cli/render.ts`
- Modify: `src/cli/pipeline.ts`
- Test: `test/cli/multi-render-cli.test.ts`

**Interfaces:**
- Consumes: `AllInOneScene`, `ChallengeCurator`, `RenderEngine`
- Produces: CLI support for `--mode multi` generating full 38s video to `video_ouput/`.

- [ ] **Step 1: Write the integration test**

```typescript
// test/cli/multi-render-cli.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeMechanic, parseRenderArgs } from '../../src/cli/render';

describe('CLI Multi-Round Flags and Aliases', () => {
  it('parses --mechanic grocery_basket and --mode multi', () => {
    const args = parseRenderArgs(['--mechanic', 'g7', '--mode', 'multi', '--seed', '123456']);
    expect(args.mechanic).toBe('GROCERY_BASKET');
    expect(args.seed).toBe(123456);
  });

  it('parses --mechanic deal_or_scam', () => {
    const args = parseRenderArgs(['--mechanic', 'g41', '--seed', '789012']);
    expect(args.mechanic).toBe('DEAL_OR_SCAM');
  });
});
```

- [ ] **Step 2: Run test to verify it fails/passes**

Run: `npx vitest run test/cli/multi-render-cli.test.ts`

- [ ] **Step 3: Update `src/cli/render.ts` to support G7, G41, and Multi-Round rendering**

Update `MECHANIC_ALIASES`:
- `g7`, `grocery`, `grocery_basket` -> `GROCERY_BASKET`
- `g41`, `deal_or_scam`, `deal` -> `DEAL_OR_SCAM`
Render multi-round video when `--mode multi` is passed.

- [ ] **Step 4: Render sample MP4 videos for G7 and G41**

Execute:
```bash
node bin/game.js render --mechanic g7 --seed 123456
node bin/game.js render --mechanic g41 --seed 789012
```
Copy outputs to `video_ouput/`.

- [ ] **Step 5: Commit**

```bash
git add src/cli/render.ts test/cli/multi-render-cli.test.ts
git commit -m "feat(cli): support G7 and G41 CLI rendering with multi-round mode"
```

---

### Task 5: Web Studio All-in-One Canvas Preview & Timeline Scrubbing

**Files:**
- Modify: `studio/src/components/CanvasPreview.tsx`
- Modify: `studio/src/app/page.tsx`
- Test: `test/preview/studio-multi-round.test.ts`

**Interfaces:**
- Consumes: `AllInOneScene`, `paintMultiRoundFrame`
- Produces: Isomorphic Web Studio Canvas Preview supporting G9, G7, G41 with 0-38s scrubbing.

- [ ] **Step 1: Write the test**

```typescript
// test/preview/studio-multi-round.test.ts
import { describe, it, expect } from 'vitest';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';

describe('Web Studio DSL Registry', () => {
  it('provides game definitions for G9, G7, and G41', () => {
    expect(g9Definition.id).toBe('g9_guess_the_price');
    expect(g7Definition.id).toBe('g7_grocery_basket');
    expect(g41Definition.id).toBe('g41_deal_or_scam');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run test/preview/studio-multi-round.test.ts`

- [ ] **Step 3: Update Studio UI**

Update `studio/src/app/page.tsx` to include:
- Mode Switcher: "Single Question" vs "3-Round All-in-One Show".
- Mechanic Selector: G9 (Guess Price), G7 (Đi Siêu Thị), G41 (Deal or Scam).
- 38-second Timeline scrubber with markers for Hook, Round 1, Round 2, Round 3, Scorecard.

- [ ] **Step 4: Verify Studio Build**

Run: `npm run studio:build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add studio/ test/preview/studio-multi-round.test.ts
git commit -m "feat(studio): add All-in-One 38s timeline scrubber and G7/G41 support in Web Studio"
```
