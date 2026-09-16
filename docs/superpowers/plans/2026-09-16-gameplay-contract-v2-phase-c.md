# Gameplay Contract v2 (Phase C: Refactoring 7 Core Mechanics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and register all 7 core game mechanics (`HI_LO`, `GROCERY_BASKET`, `MOST_EXPENSIVE`, `GUESS_THE_PRICE`, `ONE_AWAY`, `DEAL_OR_SCAM`, `ODD_ONE_OUT`) under the v2 `IMechanicDefinition` lifecycle with strict Information-Flow Security, clean letter choice IDs, zero leakage, and 100% passing contract tests.

**Architecture:** Each mechanic defines its pure `GameState`, validates inputs, compiles `QuestionRenderModel` with `QuestionPrice` (`HiddenPrice` or `ReferencePrice`), compiles type-safe `RevealRenderModel<TReveal>`, and exports difficulty and script contexts. All mechanics are validated against `GameplayValidator` in individual contract tests.

**Tech Stack:** TypeScript (strict mode), vitest, `ForkableRng`, `MechanicRegistry`, `GameplayValidator`.

**Spec:** [`docs/superpowers/specs/2026-09-16-gameplay-contract-v2-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-16-gameplay-contract-v2-design.md)

## Global Constraints
- Zero TypeScript errors: `npx tsc --noEmit` must always pass.
- Contract test for each mechanic must run and pass via `npx vitest run test/contract/<mechanic>.contract.test.ts`.
- Zero Price Leakage: `QuestionRenderModel.entities` must use `{ kind: 'hidden', label: '???' }` for any item being guessed.
- Zero Raw SKU Leakage: No `p\d{3,}` product IDs in choice labels or reveal banners.
- Multiple-choice choices must standardize on `'A'`, `'B'`, `'C'`, `'D'`.
- Frequent commits: commit after each completed task.

---

### Task 1: HI_LO Mechanic (`HiLoDefinition`)

**Files:**
- Create: `src/core/mechanics/HiLoDefinition.ts`
- Create: `test/contract/hilo.contract.test.ts`

**Interfaces:**
- Produces: `HiLoDefinition` implementing `IMechanicDefinition<HiLoReveal>`.
- Choice IDs: `'higher'` ("CAO HƠN ⬆️") and `'lower'` ("THẤP HƠN ⬇️").
- Entities in question: Card A is `ReferencePrice` (`role: 'anchor_benchmark'`), Card B is `HiddenPrice` (`label: '???'`).

- [ ] **Step 1: Write contract test in `test/contract/hilo.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { HiLoDefinition } from '../../src/core/mechanics/HiLoDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('HI_LO Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'prod_a', name: 'Nồi chiên không dầu', price: 1500000, image: 'a.jpg', category: 'appliances' },
    { productId: 'prod_b', name: 'Lò vi sóng', price: 2200000, image: 'b.jpg', category: 'appliances' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(HiLoDefinition, sampleEntities, 12345);
  });

  it('correctly compiles higher answer and reveal payload', () => {
    const rng = new ForkableRng(100);
    const state = HiLoDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('higher');
    expect(state.answer.revealPayload.comparison).toBe('higher');
    expect(state.answer.revealPayload.priceA).toBe(1500000);
    expect(state.answer.revealPayload.priceB).toBe(2200000);

    const question = HiLoDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.entities[0].price.kind).toBe('reference');
    expect(question.entities[1].price.kind).toBe('hidden');
    expect(question.choices.map((c) => c.id)).toEqual(['higher', 'lower']);
  });

  it('rejects identical price entities (tie)', () => {
    const tiedEntities: RawEntity[] = [
      { productId: 'prod_a', name: 'Nồi chiên', price: 1000000, image: 'a.jpg', category: 'appliances' },
      { productId: 'prod_b', name: 'Lò nướng', price: 1000000, image: 'b.jpg', category: 'appliances' },
    ];
    const rng = new ForkableRng(100);
    expect(() => HiLoDefinition.createState({ entities: tiedEntities, rng })).toThrow(/identical price/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/hilo.contract.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `src/core/mechanics/HiLoDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { HiLoReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export const HiLoDefinition: IMechanicDefinition<HiLoReveal> = {
  id: 'HI_LO',
  name: 'Hi-Lo Price Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<HiLoReveal> {
    if (input.entities.length !== 2) {
      throw new Error(`HI_LO requires exactly 2 products, received ${input.entities.length}`);
    }

    const [a, b] = input.entities as [RawEntity, RawEntity];
    if (a.price === b.price) {
      throw new Error(`HI_LO rejects identical price entities (${a.price}đ)`);
    }

    const comparison: 'higher' | 'lower' = b.price > a.price ? 'higher' : 'lower';
    const priceProximity = 1 - Math.min(Math.abs(b.price - a.price) / Math.max(a.price, b.price), 1);

    return {
      gameId: `hilo_${Date.now()}`,
      mechanicId: 'HI_LO',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [a, b],
      choices: [
        { id: 'higher', label: 'CAO HƠN ⬆️' },
        { id: 'lower', label: 'THẤP HƠN ⬇️' },
      ],
      answer: {
        winningChoiceId: comparison,
        revealPayload: {
          kind: 'HI_LO',
          priceA: a.price,
          priceB: b.price,
          comparison,
        },
      },
      difficulty: {
        global: {
          priceProximity,
          familiarity: 0.8,
          visualDeception: 0.3,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<HiLoReveal>): void {
    if (state.entities.length !== 2) throw new Error('HI_LO must have 2 entities');
    if (!['higher', 'lower'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<HiLoReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const [a, b] = state.entities as [RawEntity, RawEntity];
    return {
      mechanicId: 'HI_LO',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `${b.name} CAO HƠN hay THẤP HƠN ${a.name}?`,
      entities: [
        {
          productId: a.productId,
          name: a.name,
          image: a.image,
          brand: a.brand,
          price: {
            kind: 'reference',
            value: a.price,
            label: `${a.price.toLocaleString('vi-VN')}₫`,
            role: 'anchor_benchmark',
          },
          badgeTag: 'MỐC CHUẨN',
        },
        {
          productId: b.productId,
          name: b.name,
          image: b.image,
          brand: b.brand,
          price: { kind: 'hidden', label: '???' },
          badgeTag: 'ĐOÁN GIÁ',
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<HiLoReveal>): RevealRenderModel<HiLoReveal> {
    const [a, b] = state.entities as [RawEntity, RawEntity];
    const compText = state.answer.winningChoiceId === 'higher' ? 'CAO HƠN' : 'THẤP HƠN';
    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 ${compText} LÀ CHÍNH XÁC!`,
      subDetailBanner: `${b.name} (${b.price.toLocaleString('vi-VN')}₫) ${compText.toLowerCase()} ${a.name} (${a.price.toLocaleString('vi-VN')}₫)`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<HiLoReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<HiLoReveal>): MechanicScriptContext {
    const [a, b] = state.entities as [RawEntity, RawEntity];
    return {
      productNames: [a.name, b.name],
      benchmarkPriceLabel: `${a.price.toLocaleString('vi-VN')}₫`,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/hilo.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/HiLoDefinition.ts test/contract/hilo.contract.test.ts
git commit -m "feat(core): implement HiLoDefinition with Split-Card presentation and contract tests"
```

---

### Task 2: GROCERY_BASKET Mechanic (`GroceryBasketDefinition`)

**Files:**
- Create: `src/core/mechanics/GroceryBasketDefinition.ts`
- Create: `test/contract/groceryBasket.contract.test.ts`

**Interfaces:**
- Produces: `GroceryBasketDefinition` implementing `IMechanicDefinition<GroceryBasketReveal>`.
- 3 items in basket. All 3 items strictly have `price: { kind: 'hidden', label: '???' }` in `compileQuestion`.
- Choice IDs: `'under'` ("ĐỦ TIỀN (DƯỚI BUDGET)") and `'over'` ("CHÁY TÚI (TRÊN BUDGET)").
- Evaluates basket bill against target budget (default 300,000 VND).

- [ ] **Step 1: Write contract test in `test/contract/groceryBasket.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { GroceryBasketDefinition } from '../../src/core/mechanics/GroceryBasketDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('GROCERY_BASKET Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'item_1', name: 'Sữa tươi', price: 35000, image: 'milk.jpg', category: 'grocery' },
    { productId: 'item_2', name: 'Bánh mì sandwich', price: 25000, image: 'bread.jpg', category: 'grocery' },
    { productId: 'item_3', name: 'Trứng gà hộp 10 quả', price: 32000, image: 'eggs.jpg', category: 'grocery' },
  ];

  it('fulfills mechanic contract with zero premature price leakage', () => {
    verifyMechanicContract(GroceryBasketDefinition, sampleEntities, 54321);
  });

  it('evaluates under-budget basket correctly', () => {
    const rng = new ForkableRng(1);
    const state = GroceryBasketDefinition.createState({ entities: sampleEntities, rng });
    // Total = 92,000 <= 300,000 budget
    expect(state.answer.winningChoiceId).toBe('under');
    expect(state.answer.revealPayload.totalBill).toBe(92000);
    expect(state.answer.revealPayload.isUnderBudget).toBe(true);

    const question = GroceryBasketDefinition.compileQuestion(state, 'tv_game_show');
    // Ensure all 3 are hidden
    question.entities.forEach((e) => {
      expect(e.price.kind).toBe('hidden');
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/groceryBasket.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/GroceryBasketDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { GroceryBasketReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export const DEFAULT_GROCERY_BUDGET = 300000;

export const GroceryBasketDefinition: IMechanicDefinition<GroceryBasketReveal> = {
  id: 'GROCERY_BASKET',
  name: 'Grocery Basket Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<GroceryBasketReveal> {
    if (input.entities.length !== 3) {
      throw new Error(`GROCERY_BASKET requires exactly 3 products, received ${input.entities.length}`);
    }

    const budget = (input.difficultyTarget as any)?.budget ?? DEFAULT_GROCERY_BUDGET;
    const totalBill = input.entities.reduce((sum, item) => sum + item.price, 0);

    if (totalBill === budget) {
      throw new Error(`GROCERY_BASKET total bill matches budget exactly (${budget}đ)`);
    }

    const isUnderBudget = totalBill < budget;
    const winningChoiceId = isUnderBudget ? 'under' : 'over';
    const priceProximity = 1 - Math.min(Math.abs(totalBill - budget) / budget, 1);

    return {
      gameId: `grocery_${Date.now()}`,
      mechanicId: 'GROCERY_BASKET',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: input.entities,
      choices: [
        { id: 'under', label: 'ĐỦ TIỀN (DƯỚI BUDGET)' },
        { id: 'over', label: 'CHÁY TÚI (TRÊN BUDGET)' },
      ],
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'GROCERY_BASKET',
          budget,
          totalBill,
          isUnderBudget,
          itemPrices: input.entities.map((e) => ({ productId: e.productId, name: e.name, price: e.price })),
        },
      },
      difficulty: {
        global: {
          priceProximity,
          familiarity: 0.9,
          visualDeception: 0.4,
        },
        mechanicData: { budget, totalBill },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<GroceryBasketReveal>): void {
    if (state.entities.length !== 3) throw new Error('GROCERY_BASKET must have 3 entities');
    if (!['under', 'over'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<GroceryBasketReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const budgetStr = `${(state.answer.revealPayload.budget / 1000).toLocaleString('vi-VN')}K`;
    return {
      mechanicId: 'GROCERY_BASKET',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `Giỏ hàng 3 món này ĐỦ TIỀN hay CHÁY TÚI với ${budgetStr}?`,
      entities: state.entities.map((item) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        brand: item.brand,
        price: { kind: 'hidden', label: '???' },
        badgeTag: 'GIỎ HÀNG',
      })),
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<GroceryBasketReveal>): RevealRenderModel<GroceryBasketReveal> {
    const { isUnderBudget, totalBill, budget } = state.answer.revealPayload;
    const headlineBanner = isUnderBudget ? '🎉 ĐỦ TIỀN! CÒN DƯ NGÂN SÁCH' : '💥 CHÁY TÚI! VƯỢT NGÂN SÁCH';
    const subDetailBanner = `Tổng giỏ hàng: ${totalBill.toLocaleString('vi-VN')}₫ (Ngân sách: ${budget.toLocaleString('vi-VN')}₫)`;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner,
      subDetailBanner,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<GroceryBasketReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<GroceryBasketReveal>): MechanicScriptContext {
    return {
      productNames: state.entities.map((e) => e.name),
      benchmarkPriceLabel: `${state.answer.revealPayload.budget.toLocaleString('vi-VN')}₫`,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/groceryBasket.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/GroceryBasketDefinition.ts test/contract/groceryBasket.contract.test.ts
git commit -m "feat(core): implement GroceryBasketDefinition with zero price leakage and contract tests"
```

---

### Task 3: MOST_EXPENSIVE Mechanic (`MostExpensiveDefinition`)

**Files:**
- Create: `src/core/mechanics/MostExpensiveDefinition.ts`
- Create: `test/contract/mostExpensive.contract.test.ts`

**Interfaces:**
- Produces: `MostExpensiveDefinition` implementing `IMechanicDefinition<MostExpensiveReveal>`.
- 3–4 products. Winning choice mapped to letter (`'A'`, `'B'`, `'C'`, `'D'`).
- Strips any raw SKU (`p015`) from visible choice labels and reveal banner.
- Rejects close ties (<2% delta).

- [ ] **Step 1: Write contract test in `test/contract/mostExpensive.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { MostExpensiveDefinition } from '../../src/core/mechanics/MostExpensiveDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('MOST_EXPENSIVE Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p101', name: 'Tai nghe Bluetooth', price: 450000, image: 'headphones.jpg', category: 'audio' },
    { productId: 'p102', name: 'Loa không dây Marshall', price: 3200000, image: 'speaker.jpg', category: 'audio' },
    { productId: 'p103', name: 'Chuột Gaming không dây', price: 890000, image: 'mouse.jpg', category: 'accessories' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(MostExpensiveDefinition, sampleEntities, 999);
  });

  it('maps winning choice to clean letter B and strips raw SKUs', () => {
    const rng = new ForkableRng(1);
    const state = MostExpensiveDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('B');
    expect(state.answer.revealPayload.highestProductId).toBe('p102');

    const question = MostExpensiveDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.choices[1].label).toBe('B. Loa không dây Marshall');
    // Ensure no raw SKU leaks in choice labels
    question.choices.forEach((c) => {
      expect(c.label).not.toMatch(/\bp\d{3,}\b/i);
    });

    const reveal = MostExpensiveDefinition.compileReveal(state);
    expect(reveal.headlineBanner).not.toMatch(/\bp\d{3,}\b/i);
    expect(reveal.headlineBanner).toContain('Loa không dây Marshall');
  });

  it('rejects top-2 items with price tie or delta under 2%', () => {
    const closeEntities: RawEntity[] = [
      { productId: 'p201', name: 'Món A', price: 1000000, image: 'a.jpg', category: 'test' },
      { productId: 'p202', name: 'Món B', price: 1010000, image: 'b.jpg', category: 'test' }, // 1% delta
      { productId: 'p203', name: 'Món C', price: 500000, image: 'c.jpg', category: 'test' },
    ];
    const rng = new ForkableRng(1);
    expect(() => MostExpensiveDefinition.createState({ entities: closeEntities, rng })).toThrow(/delta < 2%/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/mostExpensive.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/MostExpensiveDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { MostExpensiveReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

const LABELS = ['A', 'B', 'C', 'D'];

export const MostExpensiveDefinition: IMechanicDefinition<MostExpensiveReveal> = {
  id: 'MOST_EXPENSIVE',
  name: 'Most Expensive Item Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<MostExpensiveReveal> {
    const len = input.entities.length;
    if (len < 3 || len > 4) {
      throw new Error(`MOST_EXPENSIVE requires 3-4 products, received ${len}`);
    }

    const sortedByPrice = [...input.entities].sort((a, b) => b.price - a.price);
    const highest = sortedByPrice[0]!;
    const runnerUp = sortedByPrice[1]!;

    const delta = (highest.price - runnerUp.price) / highest.price;
    if (delta < 0.02) {
      throw new Error(`MOST_EXPENSIVE rejected due to tie or top-2 delta < 2% (${(delta * 100).toFixed(1)}%)`);
    }

    const winningIndex = input.entities.findIndex((e) => e.productId === highest.productId);
    const winningChoiceId = LABELS[winningIndex]!;

    const choices = input.entities.map((e, idx) => ({
      id: LABELS[idx]!,
      label: `${LABELS[idx]}. ${e.name}`,
    }));

    return {
      gameId: `most_exp_${Date.now()}`,
      mechanicId: 'MOST_EXPENSIVE',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: input.entities,
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'MOST_EXPENSIVE',
          prices: input.entities.map((e) => ({ productId: e.productId, name: e.name, price: e.price })),
          highestProductId: highest.productId,
        },
      },
      difficulty: {
        global: {
          priceProximity: 1 - delta,
          familiarity: 0.8,
          visualDeception: 0.5,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<MostExpensiveReveal>): void {
    if (state.entities.length < 3 || state.entities.length > 4) {
      throw new Error('MOST_EXPENSIVE must have 3-4 entities');
    }
    if (!LABELS.slice(0, state.entities.length).includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<MostExpensiveReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    return {
      mechanicId: 'MOST_EXPENSIVE',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: 'Món nào ĐẮT NHẤT trong các món sau?',
      entities: state.entities.map((item, idx) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        brand: item.brand,
        price: { kind: 'hidden', label: '???' },
        badgeTag: `MÓN ${LABELS[idx]}`,
      })),
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<MostExpensiveReveal>): RevealRenderModel<MostExpensiveReveal> {
    const winnerEntity = state.entities.find((e) => e.productId === state.answer.revealPayload.highestProductId)!;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 ĐẮT NHẤT LÀ ${state.answer.winningChoiceId}: ${winnerEntity.name}!`,
      subDetailBanner: `Giá chính xác: ${winnerEntity.price.toLocaleString('vi-VN')}₫`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<MostExpensiveReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<MostExpensiveReveal>): MechanicScriptContext {
    return {
      productNames: state.entities.map((e) => e.name),
      bracketLabels: state.choices.map((c) => c.label),
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/mostExpensive.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/MostExpensiveDefinition.ts test/contract/mostExpensive.contract.test.ts
git commit -m "feat(core): implement MostExpensiveDefinition with clean letter choices and contract tests"
```

---

### Task 4: GUESS_THE_PRICE Mechanic (`GuessThePriceDefinition`)

**Files:**
- Create: `src/core/mechanics/GuessThePriceDefinition.ts`
- Create: `test/contract/guessThePrice.contract.test.ts`

**Interfaces:**
- Produces: `GuessThePriceDefinition` implementing `IMechanicDefinition<GuessThePriceReveal>`.
- 1 product. Generates 2 bracket options (Choice A vs Choice B) via `ForkableRng`.
- Voice and question copy align with bracket selection.
- Hides price completely during question phase.

- [ ] **Step 1: Write contract test in `test/contract/guessThePrice.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { GuessThePriceDefinition } from '../../src/core/mechanics/GuessThePriceDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('GUESS_THE_PRICE Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p301', name: 'Bình giữ nhiệt Lock&Lock 500ml', price: 289000, image: 'flask.jpg', category: 'home' },
  ];

  it('fulfills mechanic contract with zero price leakage', () => {
    verifyMechanicContract(GuessThePriceDefinition, sampleEntities, 777);
  });

  it('generates two valid brackets and hides price in question', () => {
    const rng = new ForkableRng(42);
    const state = GuessThePriceDefinition.createState({ entities: sampleEntities, rng });
    expect(['A', 'B']).toContain(state.answer.winningChoiceId);
    expect(state.choices).toHaveLength(2);

    const question = GuessThePriceDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.entities[0].price.kind).toBe('hidden');

    const reveal = GuessThePriceDefinition.compileReveal(state);
    expect(reveal.subDetailBanner).toContain('289.000₫');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/guessThePrice.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/GuessThePriceDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { GuessThePriceReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

function formatVndLabel(price: number): string {
  if (price >= 1000000) {
    const tr = price / 1000000;
    return `${tr % 1 === 0 ? tr : tr.toFixed(1)} TRIỆU`;
  }
  const k = Math.round(price / 1000);
  return `${k}K`;
}

export const GuessThePriceDefinition: IMechanicDefinition<GuessThePriceReveal> = {
  id: 'GUESS_THE_PRICE',
  name: 'Guess The Price Bracket',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<GuessThePriceReveal> {
    if (input.entities.length < 1) {
      throw new Error('GUESS_THE_PRICE requires at least 1 product');
    }

    const product = input.entities[0]!;
    const actualPrice = product.price;

    const rng = input.rng.fork('brackets');
    const ratio = 1.8 + rng.next() * 0.7; // 1.8 - 2.5x multiplier
    const higher = rng.boolean();
    const fakePrice = higher ? Math.round(actualPrice * ratio) : Math.round(actualPrice / ratio);

    const actualLabel = formatVndLabel(actualPrice);
    const fakeLabel = formatVndLabel(fakePrice);

    const correctIsA = rng.boolean();
    const winningChoiceId = correctIsA ? 'A' : 'B';

    const choices = [
      { id: 'A', label: correctIsA ? actualLabel : fakeLabel },
      { id: 'B', label: correctIsA ? fakeLabel : actualLabel },
    ];

    const correctBracketLabel = correctIsA ? actualLabel : fakeLabel;

    return {
      gameId: `gtp_${Date.now()}`,
      mechanicId: 'GUESS_THE_PRICE',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [product],
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'GUESS_THE_PRICE',
          actualPrice,
          correctBracketLabel,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.5,
          familiarity: 0.8,
          visualDeception: 0.4,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<GuessThePriceReveal>): void {
    if (state.entities.length < 1) throw new Error('GUESS_THE_PRICE must have 1 entity');
    if (!['A', 'B'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<GuessThePriceReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const product = state.entities[0]!;
    return {
      mechanicId: 'GUESS_THE_PRICE',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `Giá của ${product.name} là bao nhiêu?`,
      entities: [
        {
          productId: product.productId,
          name: product.name,
          image: product.image,
          brand: product.brand,
          price: { kind: 'hidden', label: '???' },
          badgeTag: 'ĐOÁN GIÁ',
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<GuessThePriceReveal>): RevealRenderModel<GuessThePriceReveal> {
    const product = state.entities[0]!;
    const winningChoice = state.choices.find((c) => c.id === state.answer.winningChoiceId)!;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 GIÁ CHÍNH XÁC: ${winningChoice.label}!`,
      subDetailBanner: `${product.name}: ${state.answer.revealPayload.actualPrice.toLocaleString('vi-VN')}₫`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<GuessThePriceReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<GuessThePriceReveal>): MechanicScriptContext {
    return {
      productNames: [state.entities[0]!.name],
      bracketLabels: state.choices.map((c) => c.label),
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/guessThePrice.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/GuessThePriceDefinition.ts test/contract/guessThePrice.contract.test.ts
git commit -m "feat(core): implement GuessThePriceDefinition with bracket choices and contract tests"
```

---

### Task 5: ONE_AWAY Mechanic (`OneAwayDefinition`)

**Files:**
- Create: `src/core/mechanics/OneAwayDefinition.ts`
- Create: `test/contract/oneAway.contract.test.ts`

**Interfaces:**
- Produces: `OneAwayDefinition` implementing `IMechanicDefinition<OneAwayReveal>`.
- 1 product. Masks 1 digit in price. Generates decoy digit $\pm 1$.
- Choice IDs: clean digit values `'A'` vs `'B'`.
- Strictly complies with zero leakage.

- [ ] **Step 1: Write contract test in `test/contract/oneAway.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { OneAwayDefinition } from '../../src/core/mechanics/OneAwayDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('ONE_AWAY Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p401', name: 'Giày chạy bộ Ultraboost', price: 3800000, image: 'shoes.jpg', category: 'fashion' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(OneAwayDefinition, sampleEntities, 333);
  });

  it('masks one digit and provides delta 1 decoy', () => {
    const rng = new ForkableRng(12);
    const state = OneAwayDefinition.createState({ entities: sampleEntities, rng });
    expect(state.choices).toHaveLength(2);
    expect(state.answer.revealPayload.fullPrice).toBe(3800000);
    expect([7, 9]).toContain(Number(state.choices.find((c) => c.id !== state.answer.winningChoiceId)?.label));

    const question = OneAwayDefinition.compileQuestion(state, 'tv_game_show');
    expect(question.questionHeadline).toContain('Chữ số bị che');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/oneAway.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/OneAwayDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { OneAwayReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

function maskPrice(price: number, hiddenIndex: number): string {
  const formatted = price.toLocaleString('vi-VN');
  let digitIdx = 0;
  let result = '';
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i]!;
    if (/\d/.test(ch)) {
      if (digitIdx === hiddenIndex) {
        result += '?';
      } else {
        result += ch;
      }
      digitIdx++;
    } else {
      result += ch;
    }
  }
  return `${result}₫`;
}

export const OneAwayDefinition: IMechanicDefinition<OneAwayReveal> = {
  id: 'ONE_AWAY',
  name: 'One Away Digit Guess',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<OneAwayReveal> {
    if (input.entities.length !== 1) {
      throw new Error(`ONE_AWAY requires exactly 1 product, received ${input.entities.length}`);
    }

    const product = input.entities[0]!;
    const priceStr = String(product.price);
    const hiddenDigitIndex = 1; // Default to 2nd significant digit
    const correctDigit = Number(priceStr[hiddenDigitIndex]);

    const decoyDigit = correctDigit === 9 ? 8 : correctDigit + 1;
    const rng = input.rng.fork('decoy_order');
    const swap = rng.boolean();

    const options = swap ? [decoyDigit, correctDigit] : [correctDigit, decoyDigit];
    const winningChoiceId = options[0] === correctDigit ? 'A' : 'B';

    const choices = [
      { id: 'A', label: String(options[0]) },
      { id: 'B', label: String(options[1]) },
    ];

    return {
      gameId: `one_away_${Date.now()}`,
      mechanicId: 'ONE_AWAY',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [product],
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'ONE_AWAY',
          fullPrice: product.price,
          revealedDigit: correctDigit,
          hiddenDigitIndex,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.9,
          familiarity: 0.8,
          visualDeception: 0.3,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<OneAwayReveal>): void {
    if (state.entities.length !== 1) throw new Error('ONE_AWAY must have 1 entity');
    if (!['A', 'B'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<OneAwayReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const product = state.entities[0]!;
    const masked = maskPrice(product.price, state.answer.revealPayload.hiddenDigitIndex);

    return {
      mechanicId: 'ONE_AWAY',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `Chữ số bị che trong giá ${masked} là số mấy?`,
      entities: [
        {
          productId: product.productId,
          name: product.name,
          image: product.image,
          brand: product.brand,
          price: { kind: 'hidden', label: '???' },
          badgeTag: `GIÁ CHE: ${masked}`,
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<OneAwayReveal>): RevealRenderModel<OneAwayReveal> {
    const product = state.entities[0]!;
    const { revealedDigit, fullPrice } = state.answer.revealPayload;

    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 CHỮ SỐ CHÍNH XÁC LÀ: ${revealedDigit}!`,
      subDetailBanner: `${product.name}: ${fullPrice.toLocaleString('vi-VN')}₫`,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<OneAwayReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<OneAwayReveal>): MechanicScriptContext {
    return {
      productNames: [state.entities[0]!.name],
      benchmarkPriceLabel: `${state.answer.revealPayload.fullPrice.toLocaleString('vi-VN')}₫`,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/oneAway.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/OneAwayDefinition.ts test/contract/oneAway.contract.test.ts
git commit -m "feat(core): implement OneAwayDefinition with digit masking and contract tests"
```

---

### Task 6: DEAL_OR_SCAM Mechanic (`DealOrScamDefinition`)

**Files:**
- Create: `src/core/mechanics/DealOrScamDefinition.ts`
- Create: `test/contract/dealOrScam.contract.test.ts`

**Interfaces:**
- Produces: `DealOrScamDefinition` implementing `IMechanicDefinition<DealOrScamReveal>`.
- 1 product. Resolves original price and compares with sale price.
- Choice IDs: `'deal'` ("DEAL HỜI MÚC NGAY") and `'scam'` ("BẪY SALE ẢO / SCAM").
- Reveal provides explanation of why it is legitimate deal or suspicious discount.

- [ ] **Step 1: Write contract test in `test/contract/dealOrScam.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { DealOrScamDefinition } from '../../src/core/mechanics/DealOrScamDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('DEAL_OR_SCAM Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p501', name: 'iPhone 15 Pro Max 256GB', price: 49000, image: 'iphone.jpg', category: 'tech' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(DealOrScamDefinition, sampleEntities, 555);
  });

  it('classifies luxury tech sold at 49k as scam', () => {
    const rng = new ForkableRng(1);
    const state = DealOrScamDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('scam');
    expect(state.answer.revealPayload.verdict).toBe('scam');

    const reveal = DealOrScamDefinition.compileReveal(state);
    expect(reveal.headlineBanner).toContain('CÚ LỪA');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/dealOrScam.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/DealOrScamDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { DealOrScamReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export const DealOrScamDefinition: IMechanicDefinition<DealOrScamReveal> = {
  id: 'DEAL_OR_SCAM',
  name: 'Deal Or Scam Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<DealOrScamReveal> {
    if (input.entities.length !== 1) {
      throw new Error(`DEAL_OR_SCAM requires exactly 1 product, received ${input.entities.length}`);
    }

    const product = input.entities[0]!;
    const salePrice = product.price;

    let originalPrice = product.originalPrice ?? Math.round(salePrice * 3.5);
    if (originalPrice <= salePrice) {
      originalPrice = Math.round(salePrice * 2);
    }

    const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

    const isScam =
      discountPercent >= 80 && (['tech', 'electronics', 'luxury'].includes(product.category) || salePrice < 50000);

    const verdict: 'deal' | 'scam' = isScam ? 'scam' : 'deal';
    const explanation = isScam
      ? 'Giảm giá phi lý trên 80% cho đồ công nghệ cao cấp — dấu hiệu bẫy hàng nhái!'
      : 'Chương trình khuyến mãi chính hãng xả kho trợ giá, an tâm chốt đơn!';

    return {
      gameId: `dos_${Date.now()}`,
      mechanicId: 'DEAL_OR_SCAM',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: [product],
      choices: [
        { id: 'deal', label: 'DEAL HỜI MÚC NGAY' },
        { id: 'scam', label: 'BẪY SALE ẢO / SCAM' },
      ],
      answer: {
        winningChoiceId: verdict,
        revealPayload: {
          kind: 'DEAL_OR_SCAM',
          originalPrice,
          salePrice,
          discountPercent,
          verdict,
          explanation,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.7,
          familiarity: 0.9,
          visualDeception: isScam ? 0.9 : 0.4,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<DealOrScamReveal>): void {
    if (state.entities.length !== 1) throw new Error('DEAL_OR_SCAM must have 1 entity');
    if (!['deal', 'scam'].includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<DealOrScamReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    const product = state.entities[0]!;
    const { discountPercent, originalPrice, salePrice } = state.answer.revealPayload;

    return {
      mechanicId: 'DEAL_OR_SCAM',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: `${product.name} sale -${discountPercent}%: KÈO THƠM hay CÚ LỪA?`,
      entities: [
        {
          productId: product.productId,
          name: product.name,
          image: product.image,
          brand: product.brand,
          price: {
            kind: 'reference',
            value: salePrice,
            label: `${salePrice.toLocaleString('vi-VN')}₫ (Gốc: ${originalPrice.toLocaleString('vi-VN')}₫)`,
            role: 'original_price',
          },
          badgeTag: `SALE -${discountPercent}%`,
        },
      ],
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<DealOrScamReveal>): RevealRenderModel<DealOrScamReveal> {
    const { verdict, explanation } = state.answer.revealPayload;
    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: verdict === 'deal' ? '🎉 KÈO THƠM CHÍNH HÃNG!' : '⚠️ CÚ LỪA! BẪY SALE ẢO',
      subDetailBanner: explanation,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<DealOrScamReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<DealOrScamReveal>): MechanicScriptContext {
    return {
      productNames: [state.entities[0]!.name],
      discountRateLabel: `${state.answer.revealPayload.discountPercent}%`,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/dealOrScam.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/DealOrScamDefinition.ts test/contract/dealOrScam.contract.test.ts
git commit -m "feat(core): implement DealOrScamDefinition with classification engine and contract tests"
```

---

### Task 7: ODD_ONE_OUT Mechanic (`OddOneOutDefinition`)

**Files:**
- Create: `src/core/mechanics/OddOneOutDefinition.ts`
- Create: `test/contract/oddOneOut.contract.test.ts`

**Interfaces:**
- Produces: `OddOneOutDefinition` implementing `IMechanicDefinition<OddOneOutReveal>`.
- 4 products in 2x2 grid. Identifies outlier by category -> brand -> price outlier.
- Standardizes choices to `'A'`, `'B'`, `'C'`, `'D'`.
- Reveal includes clear reason and explanation.
- Hides prices in question phase.

- [ ] **Step 1: Write contract test in `test/contract/oddOneOut.contract.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import { OddOneOutDefinition } from '../../src/core/mechanics/OddOneOutDefinition';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';

describe('ODD_ONE_OUT Contract Verification', () => {
  const sampleEntities: RawEntity[] = [
    { productId: 'p601', name: 'Nồi cơm điện Cuckoo', price: 1800000, image: 'cuckoo.jpg', category: 'kitchen' },
    { productId: 'p602', name: 'Chảo chống dính Tefal', price: 650000, image: 'pan.jpg', category: 'kitchen' },
    { productId: 'p603', name: 'Nồi áp suất Philips', price: 2100000, image: 'cooker.jpg', category: 'kitchen' },
    { productId: 'p604', name: 'Bàn phím cơ không dây', price: 1200000, image: 'keyboard.jpg', category: 'gaming' },
  ];

  it('fulfills mechanic contract without leakage', () => {
    verifyMechanicContract(OddOneOutDefinition, sampleEntities, 888);
  });

  it('identifies gaming item as outlier by category', () => {
    const rng = new ForkableRng(1);
    const state = OddOneOutDefinition.createState({ entities: sampleEntities, rng });
    expect(state.answer.winningChoiceId).toBe('D');
    expect(state.answer.revealPayload.reason).toBe('category');

    const reveal = OddOneOutDefinition.compileReveal(state);
    expect(reveal.headlineBanner).toContain('Bàn phím cơ');
    expect(reveal.subDetailBanner).toContain('gaming');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/contract/oddOneOut.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/OddOneOutDefinition.ts`**

```typescript
import type { IMechanicDefinition, CreateStateInput } from '../registry/MechanicRegistry';
import type { GameState, DifficultyProfile, RawEntity } from '../state/types';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { OddOneOutReveal } from '../presentation/reveals';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

const LABELS = ['A', 'B', 'C', 'D'];

export const OddOneOutDefinition: IMechanicDefinition<OddOneOutReveal> = {
  id: 'ODD_ONE_OUT',
  name: 'Odd One Out Challenge',
  defaultTotalRounds: 1,

  createState(input: CreateStateInput): GameState<OddOneOutReveal> {
    if (input.entities.length !== 4) {
      throw new Error(`ODD_ONE_OUT requires exactly 4 products, received ${input.entities.length}`);
    }

    // 1. Group by category
    const catMap = new Map<string, RawEntity[]>();
    input.entities.forEach((e) => {
      const list = catMap.get(e.category) ?? [];
      list.push(e);
      catMap.set(e.category, list);
    });

    let outlier: RawEntity | undefined;
    let reason: 'category' | 'brand' | 'price_outlier' = 'category';
    let explanation = '';

    for (const [, list] of catMap.entries()) {
      if (list.length === 1 && catMap.size === 2) {
        outlier = list[0]!;
        reason = 'category';
        explanation = `3 món còn lại cùng ngành hàng, riêng ${outlier.name} thuộc ngành hàng khác (${outlier.category})!`;
        break;
      }
    }

    // 2. Fallback: Price outlier
    if (!outlier) {
      const sorted = [...input.entities].sort((a, b) => a.price - b.price);
      const deltaLow = sorted[1]!.price - sorted[0]!.price;
      const deltaHigh = sorted[3]!.price - sorted[2]!.price;
      outlier = deltaHigh > deltaLow ? sorted[3]! : sorted[0]!;
      reason = 'price_outlier';
      explanation = `${outlier.name} có mức giá lệch hẳn so với 3 món còn lại!`;
    }

    const winningIndex = input.entities.findIndex((e) => e.productId === outlier!.productId);
    const winningChoiceId = LABELS[winningIndex]!;

    const choices = input.entities.map((e, idx) => ({
      id: LABELS[idx]!,
      label: `${LABELS[idx]}. ${e.name}`,
    }));

    return {
      gameId: `ooo_${Date.now()}`,
      mechanicId: 'ODD_ONE_OUT',
      seed: 0,
      roundIndex: input.roundIndex ?? 1,
      totalRounds: input.totalRounds ?? 1,
      entities: input.entities,
      choices,
      answer: {
        winningChoiceId,
        revealPayload: {
          kind: 'ODD_ONE_OUT',
          oddProductId: outlier.productId,
          reason,
          explanation,
        },
      },
      difficulty: {
        global: {
          priceProximity: 0.6,
          familiarity: 0.8,
          visualDeception: 0.6,
        },
      },
      metadata: { createdAt: Date.now() },
    };
  },

  validateState(state: GameState<OddOneOutReveal>): void {
    if (state.entities.length !== 4) throw new Error('ODD_ONE_OUT must have 4 entities');
    if (!LABELS.includes(state.answer.winningChoiceId)) {
      throw new Error(`Invalid winning choice: ${state.answer.winningChoiceId}`);
    }
  },

  compileQuestion(state: GameState<OddOneOutReveal>, _themeId: VisualThemeId): QuestionRenderModel {
    return {
      mechanicId: 'ODD_ONE_OUT',
      roundIndex: state.roundIndex,
      totalRounds: state.totalRounds,
      questionHeadline: 'Món nào là "KẺ LẠ" trong 4 món này?',
      entities: state.entities.map((item, idx) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        brand: item.brand,
        price: { kind: 'hidden', label: '???' },
        badgeTag: `MÓN ${LABELS[idx]}`,
      })),
      choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
    };
  },

  compileReveal(state: GameState<OddOneOutReveal>): RevealRenderModel<OddOneOutReveal> {
    const winnerEntity = state.entities.find((e) => e.productId === state.answer.revealPayload.oddProductId)!;
    return {
      winningChoiceId: state.answer.winningChoiceId,
      headlineBanner: `🎉 KẺ LẠ LÀ ${state.answer.winningChoiceId}: ${winnerEntity.name}!`,
      subDetailBanner: state.answer.revealPayload.explanation,
      payload: state.answer.revealPayload,
    };
  },

  getDifficultyModel(state: GameState<OddOneOutReveal>): DifficultyProfile {
    return state.difficulty;
  },

  getScriptContext(state: GameState<OddOneOutReveal>): MechanicScriptContext {
    return {
      productNames: state.entities.map((e) => e.name),
      bracketLabels: state.choices.map((c) => c.label),
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/contract/oddOneOut.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/mechanics/OddOneOutDefinition.ts test/contract/oddOneOut.contract.test.ts
git commit -m "feat(core): implement OddOneOutDefinition with outlier reasoning and contract tests"
```

---

### Task 8: Mechanics Barrel & Auto-Registration (`src/core/mechanics/index.ts`)

**Files:**
- Create: `src/core/mechanics/index.ts`
- Test: `test/core/mechanics/registration.test.ts`

**Interfaces:**
- Produces: `registerAllMechanics()`, exports all 7 definitions.

- [ ] **Step 1: Write registration tests in `test/core/mechanics/registration.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/mechanics/registration.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/mechanics/index.ts`**

```typescript
import { MechanicRegistry } from '../registry/MechanicRegistry';
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
  const definitions = [
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/mechanics/registration.test.ts`
Expected: PASS

- [ ] **Step 5: Run full TypeScript check and all contract tests**

Run: `npx tsc --noEmit && npx vitest run test/contract/`
Expected: All contract tests pass and 0 TypeScript compiler errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/mechanics/index.ts test/core/mechanics/registration.test.ts
git commit -m "feat(core): export registerAllMechanics registering all 7 core game mechanics"
```

---

## Plan Self-Review
- **Spec Coverage:** Implements items 9 through 15 (Phase C) from `docs/superpowers/specs/2026-09-16-gameplay-contract-v2-design.md`.
- **No Placeholders:** Every method, type signature, error message, test case, and commit command is explicit.
- **Leakage Prevention:** Verified via `GameplayValidator.validate()` in every contract test.
