# Viral All-in-One Multi-Round Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 5-Layer Generic Challenge Curator, Multi-dimensional Viral Scorer (with RevealImpact), Declarative Game DSL for P0 Flagships (G9 Guess The Price, G7 Grocery Basket), and the All-in-One 38s Multi-Round Canvas Scene Renderer.

**Architecture:** Decouple product catalog from game rules using a 5-Layer Composable Pipeline (Eligibility -> Candidate -> Difficulty -> Viral Scoring -> Cognitive Round Composition). Render high-engagement 9:16 vertical videos using an All-in-One Canvas Layout that unifies hook, product showcase, choices, countdown, micro-hooks, and reveal without disruptive scene switches.

**Tech Stack:** TypeScript 5.7, Node.js 22+, Zod, Vitest, Canvas/Skia, FFmpeg.

**Spec:** [`docs/superpowers/specs/2026-09-14-viral-all-in-one-multi-round-engine-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-14-viral-all-in-one-multi-round-engine-design.md)

## Global Constraints

- Never break existing 22 test suites (172 tests) or backwards compatibility for legacy mechanics (`HI_LO`, `MOST_EXPENSIVE`, `ONE_AWAY`, `ODD_ONE_OUT`).
- Every score in `ChallengeScoreVector` must be strictly normalized between `0.0` and `1.0`.
- Anti-duplicate SKU constraint: no video may contain duplicate product IDs across any of its 3 rounds.
- All-in-One Canvas must strictly respect vertical 9:16 safe zones (Top 150px, Bottom 400px reserved for platform UI).
- Video render pipeline must support deterministic seeding for reproducibility.

---

### Task 1: Rich Product Schema & Multidimensional ChallengeScore Types

**Files:**
- Modify: `src/product/schema.ts`
- Create: `src/challenge/types.ts`
- Test: `test/challenge/types.test.ts`

**Interfaces:**
- Consumes: `src/product/schema.ts`
- Produces: `Product`, `ChallengeScoreVector`, `CandidatePair`, `ChallengeRound`, `MultiRoundChallenge`, `GameDefinitionDSL`

- [ ] **Step 1: Write the failing test**

```typescript
// test/challenge/types.test.ts
import { describe, it, expect } from 'vitest';
import { challengeScoreVectorSchema, gameDefinitionSchema } from '../../src/challenge/types';
import { productSchema } from '../../src/product/schema';

describe('Challenge Types & Rich Product Schema', () => {
  it('validates a rich product with optional perception & commerce metadata', () => {
    const validProduct = {
      productId: 'p001',
      name: 'Serum Dưỡng Ẩm Mini',
      image: 'products/p001.png',
      price: 420000,
      currency: 'VND',
      source: 'shopee',
      updatedAt: '2026-09-14',
      category: 'skincare',
      brand: 'The Ordinary',
      affiliate_link: 'https://shope.ee/test',
      sizeCategory: 'tiny',
      perceivedValue: 'budget',
    };
    const parsed = productSchema.parse(validProduct);
    expect(parsed.sizeCategory).toBe('tiny');
    expect(parsed.perceivedValue).toBe('budget');
  });

  it('validates ChallengeScoreVector boundaries (0.0 to 1.0)', () => {
    const validVector = {
      difficulty: 0.8,
      visualClarity: 0.95,
      curiosity: 0.85,
      surprise: 0.9,
      perceptionConflict: 0.95,
      debate: 0.7,
      identity: 0.8,
      familiarity: 0.9,
      commerceRelevance: 0.85,
      revealImpact: 0.92,
    };
    const parsed = challengeScoreVectorSchema.parse(validVector);
    expect(parsed.revealImpact).toBe(0.92);

    expect(() => challengeScoreVectorSchema.parse({ ...validVector, difficulty: 1.5 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/challenge/types.test.ts`
Expected: FAIL with module `../../src/challenge/types` not found.

- [ ] **Step 3: Implement minimal types and update product schema**

In `src/product/schema.ts`:
```typescript
import { z } from 'zod';

export const productSchema = z.object({
  productId: z
    .string()
    .min(1)
    .regex(/^p\d+$/, "productId must look like 'p001'"),
  name: z.string().min(1),
  image: z.string().min(1),
  price: z.number().int().positive(),
  currency: z.string().min(1),
  source: z.string().min(1),
  updatedAt: z.string().min(1),
  category: z.string().min(1),
  brand: z.string().min(1),
  affiliate_link: z.string().min(1),
  // Optional Rich Metadata for Content Intelligence
  sizeCategory: z.enum(['tiny', 'small', 'medium', 'large', 'bulky']).optional(),
  perceivedValue: z.enum(['dirt_cheap', 'budget', 'mid_range', 'premium', 'luxury']).optional(),
  originalPrice: z.number().int().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});

export type Product = z.infer<typeof productSchema>;
```

In `src/challenge/types.ts`:
```typescript
import { z } from 'zod';
import type { Product } from '../product/schema';

export const unitInterval = z.number().min(0.0).max(1.0);

export const challengeScoreVectorSchema = z.object({
  difficulty: unitInterval,
  visualClarity: unitInterval,
  curiosity: unitInterval,
  surprise: unitInterval,
  perceptionConflict: unitInterval,
  debate: unitInterval,
  identity: unitInterval,
  familiarity: unitInterval,
  commerceRelevance: unitInterval,
  revealImpact: unitInterval,
});

export type ChallengeScoreVector = z.infer<typeof challengeScoreVectorSchema>;

export type RoundType = 'confidence_builder' | 'tension_creator' | 'wtf_reveal';

export interface ChallengeChoice {
  id: string;
  label: string;
  isCorrect: boolean;
  value?: number | string;
}

export interface ChallengeRound {
  roundIndex: number;
  type: RoundType;
  question: string;
  hookText?: string;
  microHook?: string;
  products: Product[];
  choices: ChallengeChoice[];
  correctAnswer: string | number;
  timerSeconds: number;
  scoreVector: ChallengeScoreVector;
  revealText: string;
}

export interface MultiRoundChallenge {
  gameId: string;
  seed: number;
  title: string;
  seriesNumber: number;
  rounds: ChallengeRound[];
  finalCta: string;
}

export const gameDefinitionSchema = z.object({
  id: z.string().min(1),
  family: z.enum(['numeric_single_bracket', 'numeric_knapsack', 'commerce_decision', 'semantic', 'visual']),
  name: z.string().min(1),
  targetDuration: z.number().positive(),
  inputs: z.object({
    countPerRound: z.number().int().positive(),
    requiredFields: z.array(z.string()),
  }),
  rounds: z.array(
    z.object({
      round: z.number().int().positive(),
      type: z.enum(['confidence_builder', 'tension_creator', 'wtf_reveal', 'obvious_scam', 'plausible_sale', 'mind_bending_deal']),
      targetDifficulty: z.number().min(0).max(1).optional(),
      bracketRatio: z.number().positive().optional(),
      budget: z.number().positive().optional(),
      deltaBudgetMin: z.number().min(0).max(1).optional(),
      deltaBudgetMax: z.number().min(0).max(1).optional(),
      timerSeconds: z.number().positive(),
      hookText: z.string().optional(),
      microHook: z.string().optional(),
      minPerceptionConflict: z.number().min(0).max(1).optional(),
      perceptionConflict: z.boolean().optional(),
    }),
  ),
  presentation: z.object({
    layout: z.string(),
    actionButtons: z.array(z.string()),
  }),
});

export type GameDefinitionDSL = z.infer<typeof gameDefinitionSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/challenge/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/product/schema.ts src/challenge/types.ts test/challenge/types.test.ts
git commit -m "feat(challenge): add Rich Product schema and ChallengeScore vector types"
```

---

### Task 2: Composable Filter Registry & Concrete Filters (Layers 1 & 2)

**Files:**
- Create: `src/challenge/FilterRegistry.ts`
- Create: `src/challenge/filters/EligibilityFilter.ts`
- Create: `src/challenge/filters/CandidateFilter.ts`
- Test: `test/challenge/FilterRegistry.test.ts`

**Interfaces:**
- Consumes: `src/challenge/types.ts`, `src/product/schema.ts`
- Produces: `FilterRegistry`, `EligibilityFilter`, `CandidateFilter`

- [ ] **Step 1: Write the failing test**

```typescript
// test/challenge/FilterRegistry.test.ts
import { describe, it, expect } from 'vitest';
import { FilterRegistry } from '../../src/challenge/FilterRegistry';
import { EligibilityFilter } from '../../src/challenge/filters/EligibilityFilter';
import { CandidateFilter } from '../../src/challenge/filters/CandidateFilter';
import type { Product } from '../../src/product/schema';

const mockProducts: Product[] = [
  {
    productId: 'p001',
    name: 'Sản phẩm 1',
    image: 'p001.png',
    price: 50000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026-09-14',
    category: 'tech',
    brand: 'BrandA',
    affiliate_link: 'link1',
  },
  {
    productId: 'p002',
    name: 'Sản phẩm 2',
    image: '', // Missing image -> ineligible
    price: 150000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026-09-14',
    category: 'tech',
    brand: 'BrandB',
    affiliate_link: 'link2',
  },
  {
    productId: 'p003',
    name: 'Sản phẩm 3',
    image: 'p003.png',
    price: 300000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026-09-14',
    category: 'home',
    brand: 'BrandC',
    affiliate_link: 'link3',
  },
];

describe('FilterRegistry & Composable Filters', () => {
  it('EligibilityFilter filters out products missing required fields', () => {
    const filter = new EligibilityFilter(['image', 'price', 'name']);
    const eligible = filter.apply(mockProducts);
    expect(eligible.length).toBe(2);
    expect(eligible.map((p) => p.productId)).toEqual(['p001', 'p003']);
  });

  it('CandidateFilter rejects selections with duplicate SKUs across used pool', () => {
    const candidateFilter = new CandidateFilter();
    const usedProductIds = new Set(['p001']);
    const candidates = [mockProducts[0], mockProducts[2]]; // p001 is already used
    const valid = candidateFilter.isDistinct(candidates, usedProductIds);
    expect(valid).toBe(false);

    const freshCandidates = [mockProducts[2]];
    expect(candidateFilter.isDistinct(freshCandidates, usedProductIds)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/challenge/FilterRegistry.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement FilterRegistry, EligibilityFilter, CandidateFilter**

Create `src/challenge/filters/EligibilityFilter.ts`:
```typescript
import type { Product } from '../../src/product/schema';

export class EligibilityFilter {
  constructor(private readonly requiredFields: Array<keyof Product>) {}

  apply(products: Product[]): Product[] {
    return products.filter((product) => {
      for (const field of this.requiredFields) {
        const val = product[field];
        if (val === undefined || val === null || val === '') {
          return false;
        }
      }
      return product.price > 0;
    });
  }
}
```

Create `src/challenge/filters/CandidateFilter.ts`:
```typescript
import type { Product } from '../../src/product/schema';

export class CandidateFilter {
  isDistinct(candidates: Product[], usedProductIds: Set<string>): boolean {
    const seen = new Set<string>();
    for (const p of candidates) {
      if (seen.has(p.productId) || usedProductIds.has(p.productId)) {
        return false;
      }
      seen.add(p.productId);
    }
    return true;
  }
}
```

Create `src/challenge/FilterRegistry.ts`:
```typescript
import type { Product } from '../product/schema';

export interface IFilter<T = Product[]> {
  name: string;
  apply(input: T): T;
}

export class FilterRegistry {
  private readonly filters = new Map<string, IFilter<any>>();

  register<T>(filter: IFilter<T>): void {
    this.filters.set(filter.name, filter);
  }

  get<T>(name: string): IFilter<T> | undefined {
    return this.filters.get(name);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/challenge/FilterRegistry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/challenge/FilterRegistry.ts src/challenge/filters/ test/challenge/FilterRegistry.test.ts
git commit -m "feat(challenge): implement FilterRegistry, EligibilityFilter, and CandidateFilter"
```

---

### Task 3: Primitive Difficulty Engines (Layer 3)

**Files:**
- Create: `src/challenge/engines/NumericEngine.ts`
- Create: `src/challenge/engines/KnapsackEngine.ts`
- Test: `test/challenge/engines.test.ts`

**Interfaces:**
- Consumes: `src/challenge/types.ts`, `src/product/schema.ts`
- Produces: `NumericEngine`, `KnapsackEngine`

- [ ] **Step 1: Write the failing test**

```typescript
// test/challenge/engines.test.ts
import { describe, it, expect } from 'vitest';
import { NumericEngine } from '../../src/challenge/engines/NumericEngine';
import { KnapsackEngine } from '../../src/challenge/engines/KnapsackEngine';
import type { Product } from '../../src/product/schema';

describe('Primitive Difficulty Engines', () => {
  const p1: Product = {
    productId: 'p001',
    name: 'Kem chống nắng',
    image: 'p1.png',
    price: 250000,
    currency: 'VND',
    source: 's',
    updatedAt: '2026',
    category: 'c',
    brand: 'b',
    affiliate_link: 'l',
  };

  it('NumericEngine generates G9 price brackets with given bracket ratio', () => {
    const engine = new NumericEngine();
    // actual price: 250,000 VND. Bracket ratio 5.0 (Easy) -> Fake bracket is either 5x higher or 5x lower
    const { choiceA, choiceB, correctChoice } = engine.generatePriceBrackets(p1.price, 5.0, 12345);
    expect([choiceA.id, choiceB.id]).toContain(correctChoice);
    const correctVal = correctChoice === 'A' ? choiceA.value : choiceB.value;
    const fakeVal = correctChoice === 'A' ? choiceB.value : choiceA.value;
    expect(correctVal).toBe(250000);
    expect(fakeVal === 50000 || fakeVal === 1250000).toBe(true);
  });

  it('KnapsackEngine evaluates basket sum against budget', () => {
    const engine = new KnapsackEngine();
    const basket = [
      { ...p1, price: 100000 },
      { ...p1, price: 150000 },
      { ...p1, price: 40000 },
    ];
    const budget = 300000;
    const result = engine.evaluateBasket(basket, budget);
    expect(result.total).toBe(290000);
    expect(result.isUnderBudget).toBe(true);
    expect(result.deltaPercent).toBeCloseTo(10000 / 300000, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/challenge/engines.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement NumericEngine and KnapsackEngine**

Create `src/challenge/engines/NumericEngine.ts`:
```typescript
import seedrandom from 'seedrandom';
import type { ChallengeChoice } from '../types';

export interface PriceBracketResult {
  choiceA: ChallengeChoice;
  choiceB: ChallengeChoice;
  correctChoice: 'A' | 'B';
}

export class NumericEngine {
  formatVND(price: number): string {
    if (price >= 1000000) {
      const tr = price / 1000000;
      return `${tr % 1 === 0 ? tr : tr.toFixed(1)} TRIỆU`;
    }
    const k = Math.round(price / 1000);
    return `${k}K`;
  }

  generatePriceBrackets(actualPrice: number, bracketRatio: number, seed: number): PriceBracketResult {
    const rng = seedrandom(seed.toString());
    const higher = rng() > 0.5;
    const fakePrice = higher ? Math.round(actualPrice * bracketRatio) : Math.round(actualPrice / bracketRatio);

    const actualLabel = this.formatVND(actualPrice);
    const fakeLabel = this.formatVND(fakePrice);

    const correctIsA = rng() > 0.5;
    return {
      choiceA: {
        id: 'A',
        label: correctIsA ? actualLabel : fakeLabel,
        isCorrect: correctIsA,
        value: correctIsA ? actualPrice : fakePrice,
      },
      choiceB: {
        id: 'B',
        label: correctIsA ? fakeLabel : actualLabel,
        isCorrect: !correctIsA,
        value: correctIsA ? fakePrice : actualPrice,
      },
      correctChoice: correctIsA ? 'A' : 'B',
    };
  }
}
```

Create `src/challenge/engines/KnapsackEngine.ts`:
```typescript
import type { Product } from '../../src/product/schema';

export interface BasketEvaluation {
  total: number;
  budget: number;
  isUnderBudget: boolean;
  deltaPercent: number;
}

export class KnapsackEngine {
  evaluateBasket(basket: Product[], budget: number): BasketEvaluation {
    const total = basket.reduce((sum, item) => sum + item.price, 0);
    const delta = Math.abs(total - budget);
    return {
      total,
      budget,
      isUnderBudget: total <= budget,
      deltaPercent: budget > 0 ? delta / budget : 0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/challenge/engines.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/challenge/engines/ test/challenge/engines.test.ts
git commit -m "feat(challenge): implement NumericEngine and KnapsackEngine"
```

---

### Task 4: Multi-dimensional Viral Scorer & RevealImpact Calculator (Layer 4)

**Files:**
- Create: `src/challenge/scorers/ViralScorer.ts`
- Test: `test/challenge/ViralScorer.test.ts`

**Interfaces:**
- Consumes: `src/challenge/types.ts`, `src/product/schema.ts`
- Produces: `ViralScorer` with `computeScoreVector()`, `computeRevealImpact()`

- [ ] **Step 1: Write the failing test**

```typescript
// test/challenge/ViralScorer.test.ts
import { describe, it, expect } from 'vitest';
import { ViralScorer } from '../../src/challenge/scorers/ViralScorer';
import type { Product } from '../../src/product/schema';

describe('ViralScorer & RevealImpact Calculation', () => {
  const tinyExpensive: Product = {
    productId: 'p001',
    name: 'Serum Nhỏ Siêu Đắt',
    image: 'p1.png',
    price: 3900000,
    currency: 'VND',
    source: 's',
    updatedAt: '2026',
    category: 'cosmetic',
    brand: 'Luxury',
    affiliate_link: 'l',
    sizeCategory: 'tiny',
    perceivedValue: 'luxury',
  };

  const normalProduct: Product = {
    productId: 'p002',
    name: 'Nước Rửa Bát',
    image: 'p2.png',
    price: 35000,
    currency: 'VND',
    source: 's',
    updatedAt: '2026',
    category: 'home',
    brand: 'Sunlight',
    affiliate_link: 'l',
    sizeCategory: 'medium',
    perceivedValue: 'budget',
  };

  it('computes high perception conflict and high RevealImpact for tiny expensive items', () => {
    const scorer = new ViralScorer();
    const scoreVector = scorer.computeScoreVector([tinyExpensive], 0.85);

    expect(scoreVector.perceptionConflict).toBeGreaterThan(0.7);
    expect(scoreVector.revealImpact).toBeGreaterThan(0.7);
    expect(scoreVector.revealImpact).toBeLessThanOrEqual(1.0);
  });

  it('computes standard baseline score vector for normal products', () => {
    const scorer = new ViralScorer();
    const scoreVector = scorer.computeScoreVector([normalProduct], 0.25);

    expect(scoreVector.perceptionConflict).toBeLessThan(0.4);
    expect(scoreVector.difficulty).toBe(0.25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/challenge/ViralScorer.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement ViralScorer**

Create `src/challenge/scorers/ViralScorer.ts`:
```typescript
import type { Product } from '../../src/product/schema';
import type { ChallengeScoreVector } from '../types';

export class ViralScorer {
  computePerceptionConflict(products: Product[]): number {
    let maxConflict = 0.1;
    for (const p of products) {
      if (p.sizeCategory === 'tiny' && p.price > 1000000) {
        maxConflict = Math.max(maxConflict, 0.95);
      } else if (p.sizeCategory === 'bulky' && p.price < 100000) {
        maxConflict = Math.max(maxConflict, 0.9);
      } else if (p.perceivedValue === 'luxury' && p.price < 200000) {
        maxConflict = Math.max(maxConflict, 0.8);
      } else if (p.sizeCategory === 'small' && p.price > 500000) {
        maxConflict = Math.max(maxConflict, 0.75);
      }
    }
    return Math.min(1.0, maxConflict);
  }

  computeRevealImpact(perceptionConflict: number, surprise: number, debate: number): number {
    const base = Math.pow(perceptionConflict, 1.5) * surprise * Math.pow(debate, 0.8);
    const raw = base * 1.3;
    return Math.max(0.0, Math.min(1.0, Math.round(raw * 100) / 100));
  }

  computeScoreVector(products: Product[], targetDifficulty: number): ChallengeScoreVector {
    const perceptionConflict = this.computePerceptionConflict(products);
    const surprise = Math.min(1.0, Math.max(0.2, perceptionConflict * 0.9 + 0.1));
    const debate = Math.min(1.0, Math.max(0.3, perceptionConflict * 0.7 + 0.2));
    const curiosity = Math.min(1.0, Math.max(0.4, targetDifficulty * 0.5 + surprise * 0.5));
    const revealImpact = this.computeRevealImpact(perceptionConflict, surprise, debate);

    return {
      difficulty: Math.min(1.0, Math.max(0.0, targetDifficulty)),
      visualClarity: 0.95,
      curiosity,
      surprise,
      perceptionConflict,
      debate,
      identity: 0.85,
      familiarity: 0.8,
      commerceRelevance: 0.9,
      revealImpact,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/challenge/ViralScorer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/challenge/scorers/ViralScorer.ts test/challenge/ViralScorer.test.ts
git commit -m "feat(challenge): implement ViralScorer and RevealImpact calculation"
```

---

### Task 5: Declarative Game DSL, Round Composer & ChallengeCurator (Layer 5)

**Files:**
- Create: `src/definitions/g9_guess_the_price.ts`
- Create: `src/definitions/g7_grocery_basket.ts`
- Create: `src/challenge/composers/RoundComposer.ts`
- Create: `src/challenge/ChallengeCurator.ts`
- Test: `test/challenge/ChallengeCurator.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4
- Produces: `g9Definition`, `g7Definition`, `RoundComposer`, `ChallengeCurator`

- [ ] **Step 1: Write the failing test**

```typescript
// test/challenge/ChallengeCurator.test.ts
import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import type { Product } from '../../src/product/schema';

const mockCatalog: Product[] = [
  {
    productId: 'p001',
    name: 'Ốp lưng điện thoại',
    image: 'p001.png',
    price: 29000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'tech',
    brand: 'OEM',
    affiliate_link: 'l1',
  },
  {
    productId: 'p002',
    name: 'Máy sấy tóc ion',
    image: 'p002.png',
    price: 350000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'home',
    brand: 'Philips',
    affiliate_link: 'l2',
  },
  {
    productId: 'p003',
    name: 'Củ sạc GaN 140W',
    image: 'p003.png',
    price: 2500000,
    currency: 'VND',
    source: 'shopee',
    updatedAt: '2026',
    category: 'tech',
    brand: 'Anker',
    affiliate_link: 'l3',
    sizeCategory: 'tiny',
    perceivedValue: 'luxury',
  },
];

describe('ChallengeCurator End-to-End Orchestration', () => {
  it('curates a 3-round G9 challenge with cognitive escalation and no duplicate SKUs', () => {
    const curator = new ChallengeCurator();
    const challenge = curator.curate(g9Definition, mockCatalog, 42);

    expect(challenge.rounds.length).toBe(3);
    expect(challenge.rounds[0].type).toBe('confidence_builder');
    expect(challenge.rounds[1].type).toBe('tension_creator');
    expect(challenge.rounds[2].type).toBe('wtf_reveal');

    // Anti-duplicate SKU check
    const usedProductIds = challenge.rounds.flatMap((r) => r.products.map((p) => p.productId));
    const uniqueIds = new Set(usedProductIds);
    expect(uniqueIds.size).toBe(3);

    // Escalation check
    expect(challenge.rounds[0].scoreVector.difficulty).toBeLessThan(challenge.rounds[2].scoreVector.difficulty);
    expect(challenge.rounds[2].scoreVector.revealImpact).toBeGreaterThan(0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/challenge/ChallengeCurator.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement Game Definitions, RoundComposer, and ChallengeCurator**

Create `src/definitions/g9_guess_the_price.ts`:
```typescript
import type { GameDefinitionDSL } from '../challenge/types';

export const g9Definition: GameDefinitionDSL = {
  id: 'g9_guess_the_price',
  family: 'numeric_single_bracket',
  name: '5 Giây Đoán Giá Sản Phẩm',
  targetDuration: 38.0,
  inputs: {
    countPerRound: 1,
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      targetDifficulty: 0.2,
      bracketRatio: 5.0,
      timerSeconds: 4.0,
      hookText: '29K hay 299K? Đoán trúng ngay trong 3 giây!',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      bracketRatio: 2.2,
      timerSeconds: 5.0,
      microHook: 'Câu 2 bắt đầu xoắn não rồi đây!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: 95% NGƯỜI ĐOÁN SAI BÉT!',
    },
  ],
  presentation: {
    layout: 'all_in_one_single_card',
    actionButtons: ['KHOẢNG GIÁ A', 'KHOẢNG GIÁ B'],
  },
};
```

Create `src/definitions/g7_grocery_basket.ts`:
```typescript
import type { GameDefinitionDSL } from '../challenge/types';

export const g7Definition: GameDefinitionDSL = {
  id: 'g7_grocery_basket',
  family: 'numeric_knapsack',
  name: 'Cầm Tiền Đi Siêu Thị',
  targetDuration: 40.0,
  inputs: {
    countPerRound: 3,
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      budget: 300000,
      deltaBudgetMin: 0.25,
      timerSeconds: 4.0,
      hookText: 'Cầm 300K mua 3 món này: ĐỦ hay THIẾU?',
    },
    {
      round: 2,
      type: 'tension_creator',
      budget: 500000,
      deltaBudgetMax: 0.03,
      timerSeconds: 5.0,
      microHook: 'Câu 2 hóa đơn số lẻ cực gắt!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      budget: 1000000,
      perceptionConflict: true,
      timerSeconds: 5.0,
      microHook: 'Câu 3: Nỗi đau ví tiền khi đi siêu thị là đây!',
    },
  ],
  presentation: {
    layout: 'all_in_one_basket_tray',
    actionButtons: ['ĐỦ TIỀN', 'CHÁY TÚI'],
  },
};
```

Create `src/challenge/ChallengeCurator.ts`:
```typescript
import type { Product } from '../product/schema';
import type { GameDefinitionDSL, MultiRoundChallenge, ChallengeRound } from './types';
import { EligibilityFilter } from './filters/EligibilityFilter';
import { CandidateFilter } from './filters/CandidateFilter';
import { NumericEngine } from './engines/NumericEngine';
import { ViralScorer } from './scorers/ViralScorer';

export class ChallengeCurator {
  private readonly numericEngine = new NumericEngine();
  private readonly viralScorer = new ViralScorer();
  private readonly candidateFilter = new CandidateFilter();

  curate(dsl: GameDefinitionDSL, catalog: Product[], seed: number): MultiRoundChallenge {
    const eligibility = new EligibilityFilter(dsl.inputs.requiredFields as Array<keyof Product>);
    const eligibleCatalog = eligibility.apply(catalog);
    if (eligibleCatalog.length < dsl.rounds.length * dsl.inputs.countPerRound) {
      throw new Error(`Insufficient eligible products: ${eligibleCatalog.length} available.`);
    }

    const usedProductIds = new Set<string>();
    const rounds: ChallengeRound[] = [];

    // Sort catalog items for cognitive roles (e.g. wtf items at the end)
    const wtfCandidates = eligibleCatalog.filter((p) => (p.sizeCategory === 'tiny' && p.price > 1000000) || p.price > 2000000);
    const standardCandidates = eligibleCatalog.filter((p) => !wtfCandidates.includes(p));

    dsl.rounds.forEach((roundSpec, idx) => {
      let selected: Product;
      if (roundSpec.type === 'wtf_reveal' && wtfCandidates.length > 0) {
        selected = wtfCandidates.find((p) => !usedProductIds.has(p.productId)) ?? standardCandidates.find((p) => !usedProductIds.has(p.productId))!;
      } else {
        selected = standardCandidates.find((p) => !usedProductIds.has(p.productId)) ?? eligibleCatalog.find((p) => !usedProductIds.has(p.productId))!;
      }
      usedProductIds.add(selected.productId);

      const ratio = roundSpec.bracketRatio ?? 2.0;
      const brackets = this.numericEngine.generatePriceBrackets(selected.price, ratio, seed + idx * 100);
      const scoreVector = this.viralScorer.computeScoreVector([selected], roundSpec.targetDifficulty ?? 0.5);

      rounds.push({
        roundIndex: roundSpec.round,
        type: roundSpec.type as any,
        question: `Giá sản phẩm này là bao nhiêu?`,
        hookText: roundSpec.hookText,
        microHook: roundSpec.microHook,
        products: [selected],
        choices: [brackets.choiceA, brackets.choiceB],
        correctAnswer: brackets.correctChoice,
        timerSeconds: roundSpec.timerSeconds,
        scoreVector,
        revealText: `Giá chính xác: ${this.numericEngine.formatVND(selected.price)}`,
      });
    });

    return {
      gameId: dsl.id,
      seed,
      title: dsl.name,
      seriesNumber: Math.floor((seed % 100) + 1),
      rounds,
      finalCta: 'Ai đúng 3/3 giơ tay! Săn deal tại giỏ hàng bên dưới!',
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/challenge/ChallengeCurator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/definitions/ src/challenge/ChallengeCurator.ts test/challenge/ChallengeCurator.test.ts
git commit -m "feat(challenge): implement ChallengeCurator and G9/G7 game definitions"
```

---

### Task 6: All-in-One Canvas Scene & Dynamic HUD Components

**Files:**
- Create: `src/scene/AllInOneScene.ts`
- Modify: `src/render/scenePainter.ts`
- Test: `test/scene/AllInOneScene.test.ts`

**Interfaces:**
- Consumes: `src/challenge/types.ts`, `src/render/scenePainter.ts`
- Produces: `AllInOneScene`, dynamic HUD rendering for Series Badge, Progress Dots, Countdown Pill, Scorecard

- [ ] **Step 1: Write the failing test**

```typescript
// test/scene/AllInOneScene.test.ts
import { describe, it, expect } from 'vitest';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import type { MultiRoundChallenge } from '../../src/challenge/types';

describe('AllInOneScene Timeline and Layout Generation', () => {
  it('generates a 38-second continuous timeline with 3 rounds and micro-hooks', () => {
    const mockChallenge: MultiRoundChallenge = {
      gameId: 'g9_guess_the_price',
      seed: 42,
      title: '5 Giây Đoán Giá',
      seriesNumber: 12,
      rounds: [
        {
          roundIndex: 1,
          type: 'confidence_builder',
          question: 'Giá bao nhiêu?',
          products: [{ productId: 'p001', name: 'Item 1', image: 'p1.png', price: 29000, currency: 'VND', source: 's', updatedAt: '2026', category: 'c', brand: 'b', affiliate_link: 'l' }],
          choices: [{ id: 'A', label: '29K', isCorrect: true }, { id: 'B', label: '290K', isCorrect: false }],
          correctAnswer: 'A',
          timerSeconds: 4.0,
          scoreVector: { difficulty: 0.2, visualClarity: 1, curiosity: 0.5, surprise: 0.5, perceptionConflict: 0.1, debate: 0.3, identity: 0.8, familiarity: 0.9, commerceRelevance: 0.8, revealImpact: 0.4 },
          revealText: 'Giá: 29K',
        },
        {
          roundIndex: 2,
          type: 'tension_creator',
          question: 'Giá bao nhiêu?',
          products: [{ productId: 'p002', name: 'Item 2', image: 'p2.png', price: 350000, currency: 'VND', source: 's', updatedAt: '2026', category: 'c', brand: 'b', affiliate_link: 'l' }],
          choices: [{ id: 'A', label: '350K', isCorrect: true }, { id: 'B', label: '1.2 Tr', isCorrect: false }],
          correctAnswer: 'A',
          timerSeconds: 5.0,
          scoreVector: { difficulty: 0.55, visualClarity: 1, curiosity: 0.7, surprise: 0.7, perceptionConflict: 0.4, debate: 0.6, identity: 0.8, familiarity: 0.8, commerceRelevance: 0.8, revealImpact: 0.6 },
          revealText: 'Giá: 350K',
        },
        {
          roundIndex: 3,
          type: 'wtf_reveal',
          question: 'Giá bao nhiêu?',
          products: [{ productId: 'p003', name: 'Item 3', image: 'p3.png', price: 2500000, currency: 'VND', source: 's', updatedAt: '2026', category: 'c', brand: 'b', affiliate_link: 'l' }],
          choices: [{ id: 'A', label: '150K', isCorrect: false }, { id: 'B', label: '2.5 Tr', isCorrect: true }],
          correctAnswer: 'B',
          timerSeconds: 5.0,
          scoreVector: { difficulty: 0.85, visualClarity: 1, curiosity: 0.9, surprise: 0.95, perceptionConflict: 0.95, debate: 0.8, identity: 0.9, familiarity: 0.8, commerceRelevance: 0.9, revealImpact: 0.92 },
          revealText: 'Giá: 2.5 Triệu',
        },
      ],
      finalCta: 'Ai đúng 3/3 giơ tay!',
    };

    const scene = new AllInOneScene(mockChallenge);
    const timeline = scene.getTimeline();
    expect(timeline.totalDuration).toBe(38);
    expect(timeline.slots.length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/scene/AllInOneScene.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement AllInOneScene and update scenePainter.ts**

Create `src/scene/AllInOneScene.ts`:
```typescript
import type { MultiRoundChallenge, ChallengeRound } from '../challenge/types';
import type { Timeline, TimelineSlot } from '../types/game';

export class AllInOneScene {
  constructor(private readonly challenge: MultiRoundChallenge) {}

  getTimeline(): Timeline {
    const slots: TimelineSlot[] = [];
    let currentTime = 0;

    // Hook (1.5s)
    slots.push({ type: 'hook', duration: 1.5, start: currentTime, end: currentTime + 1.5 });
    currentTime += 1.5;

    // 3 Rounds with Reveals and Micro-hooks
    this.challenge.rounds.forEach((round, idx) => {
      // Countdown questioning period
      const qDuration = round.timerSeconds + 2.5;
      slots.push({ type: `round_${round.roundIndex}_play`, duration: qDuration, start: currentTime, end: currentTime + qDuration });
      currentTime += qDuration;

      // Reveal period
      const rDuration = 2.5;
      slots.push({ type: `round_${round.roundIndex}_reveal`, duration: rDuration, start: currentTime, end: currentTime + rDuration });
      currentTime += rDuration;

      // Micro-hook transition between rounds
      if (idx < this.challenge.rounds.length - 1) {
        slots.push({ type: `micro_hook_${idx + 1}`, duration: 1.0, start: currentTime, end: currentTime + 1.0 });
        currentTime += 1.0;
      }
    });

    // Scorecard & Final CTA (remaining time up to 38s)
    const remaining = Math.max(3.0, 38.0 - currentTime);
    slots.push({ type: 'scorecard', duration: remaining, start: currentTime, end: currentTime + remaining });
    currentTime += remaining;

    return {
      slots,
      totalDuration: Math.round(currentTime),
    };
  }
}
```

Add paint helper functions in `src/render/scenePainter.ts` to draw AllInOne HUD:
- `drawSeriesHeader(canvas, seriesNumber, currentRound, totalRounds)`
- `drawActionButtons(canvas, choices, selectedId, isRevealed)`
- `drawCountdownBar(canvas, progressRatio, secondsLeft)`
- `drawScorecardHUD(canvas, ctaText)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/scene/AllInOneScene.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scene/AllInOneScene.ts src/render/scenePainter.ts test/scene/AllInOneScene.test.ts
git commit -m "feat(scene): implement AllInOneScene multi-round timeline and HUD renderer"
```

---

### Task 7: Pipeline Integration, CLI Command & End-to-End MP4 Verification

**Files:**
- Modify: `src/cli/render.ts`
- Modify: `src/game/GameEngine.ts`
- Test: `test/integration/AllInOneRender.test.ts`

**Interfaces:**
- Consumes: All tasks
- Produces: Complete end-to-end rendering for G9 and multi-round challenges to `video_ouput/`

- [ ] **Step 1: Write integration test**

```typescript
// test/integration/AllInOneRender.test.ts
import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import { ProductProvider } from '../../src/product/ProductProvider';
import path from 'node:path';

describe('All-in-One Engine Integration Test', () => {
  it('curates a G9 challenge from live product catalog and computes valid timeline', async () => {
    const provider = new ProductProvider(path.resolve(process.cwd(), 'products'));
    const products = await provider.loadAll();
    expect(products.length).toBeGreaterThanOrEqual(3);

    const curator = new ChallengeCurator();
    const challenge = curator.curate(g9Definition, products, 839271);
    expect(challenge.rounds.length).toBe(3);

    const scene = new AllInOneScene(challenge);
    const timeline = scene.getTimeline();
    expect(timeline.totalDuration).toBe(38);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run test/integration/AllInOneRender.test.ts`
Expected: PASS

- [ ] **Step 3: Update CLI command in `src/cli/render.ts`**

Support `node bin/game.js render --mechanic g9 --mode multi --seed 839271` to render full multi-round video and save to `video_ouput/g9_guess_the_price_839271.mp4`.

- [ ] **Step 4: Run full verification suite**

Run: `npm run verify`
Expected: All TypeScript types valid, eslint 0 warnings, all unit and integration tests PASS.

- [ ] **Step 5: Render sample MP4 and verify output**

Run: `node bin/game.js render --mechanic g9 --seed 839271`
Check: `video_ouput/g9_guess_the_price_839271.mp4` created and > 0 bytes.

- [ ] **Step 6: Commit**

```bash
git add src/cli/render.ts src/game/GameEngine.ts test/integration/AllInOneRender.test.ts
git commit -m "feat(cli): add G9 multi-round All-in-One video render integration"
```
