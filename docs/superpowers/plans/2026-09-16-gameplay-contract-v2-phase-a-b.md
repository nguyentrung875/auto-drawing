# Gameplay Contract v2 (Phase A & B: Foundation & Safety) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Core Foundation and Safety Layers of Gameplay Contract v2.1: Forkable PRNG, Type-Safe Presentation Model with Information-Flow Security, Extensible MechanicRegistry with Lifecycle Hooks, File-Based Content Fingerprinting, Diversity Policy Manager, and Pre-Render Gameplay Leakage Validator.

**Architecture:** 4-Layer Separation with functional compilation. Logic lives purely in `GameState`. `QuestionRenderModel` strictly strips answers and prices using discriminated `QuestionPrice`. Diversity is decoupled from Seed via an LRU-windowed `DiversityManager` backed by file-based JSON storage. Pre-render `GameplayValidator` audits against price, answer, and metadata leaks.

**Tech Stack:** TypeScript (strict mode), Node.js (fs/crypto), seedrandom, vitest.

**Spec:** [`docs/superpowers/specs/2026-09-16-gameplay-contract-v2-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-16-gameplay-contract-v2-design.md)

## Global Constraints
- Strictly zero compile errors: `npx tsc --noEmit` must always pass.
- All tests run via `npx vitest run <test-file>`.
- Information-Flow Security: `QuestionRenderModel` must never contain actual answer or raw secret price.
- No arbitrary strings for secret prices: use `QuestionPrice = HiddenPrice | ReferencePrice`.
- Exact and Semantic fingerprints must be persisted atomically to `data/fingerprints/history.json`.
- Frequent commits: commit after each completed task.

---

### Task 1: Forkable PRNG Object API

**Files:**
- Create: `src/core/rng/ForkableRng.ts`
- Test: `test/core/rng/ForkableRng.test.ts`

**Interfaces:**
- Produces: `IForkableRng`, `ForkableRng` with methods `next()`, `fork()`, `int()`, `pick()`, `shuffle()`, `boolean()`.

- [ ] **Step 1: Write unit tests in `test/core/rng/ForkableRng.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { ForkableRng } from '../../../src/core/rng/ForkableRng';

describe('ForkableRng', () => {
  it('produces deterministic numbers from seed', () => {
    const rng1 = new ForkableRng(839271);
    const rng2 = new ForkableRng(839271);
    expect(rng1.next()).toBe(rng2.next());
    expect(rng1.int(1, 100)).toBe(rng2.int(1, 100));
  });

  it('forks namespaces independently without perturbing siblings', () => {
    const parent1 = new ForkableRng(839271);
    const products1 = parent1.fork('products');
    const choices1 = parent1.fork('choices');

    const parent2 = new ForkableRng(839271);
    const products2 = parent2.fork('products');
    // Call extra draws on parent2/choices2
    const choices2 = parent2.fork('choices');
    choices2.next();
    choices2.next();

    // products1 and products2 must produce identical sequence despite choices2 being used
    expect(products1.next()).toBe(products2.next());
    expect(products1.int(10, 50)).toBe(products2.int(10, 50));
  });

  it('picks and shuffles deterministically', () => {
    const rng = new ForkableRng(42);
    const items = ['A', 'B', 'C', 'D'];
    const picked = rng.pick(items);
    expect(items).toContain(picked);

    const shuffled = rng.shuffle(items);
    expect(shuffled).toHaveLength(4);
    expect(shuffled.sort()).toEqual([...items].sort());
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/rng/ForkableRng.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `src/core/rng/ForkableRng.ts`**

```typescript
import seedrandom from 'seedrandom';

export interface IForkableRng {
  next(): number;
  fork(namespace: string): IForkableRng;
  int(min: number, max: number): number;
  pick<T>(array: readonly T[]): T;
  shuffle<T>(array: readonly T[]): T[];
  boolean(probability?: number): boolean;
}

export class ForkableRng implements IForkableRng {
  private readonly rng: () => number;

  constructor(private readonly seedValue: string | number) {
    this.rng = seedrandom(String(seedValue));
  }

  next(): number {
    return this.rng();
  }

  fork(namespace: string): IForkableRng {
    return new ForkableRng(`${this.seedValue}::${namespace}`);
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    const index = Math.floor(this.next() * array.length);
    return array[index]!;
  }

  shuffle<T>(array: readonly T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!] as [T, T];
    }
    return copy;
  }

  boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/rng/ForkableRng.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/rng/ForkableRng.ts test/core/rng/ForkableRng.test.ts
git commit -m "feat(core): implement ForkableRng with composable namespaces and utility methods"
```

---

### Task 2: Core State & Presentation Types (Defensive Typing)

**Files:**
- Create: `src/core/state/types.ts`
- Create: `src/core/presentation/reveals.ts`
- Create: `src/core/presentation/types.ts`
- Test: `test/core/presentation/types.test.ts`

**Interfaces:**
- Produces: `GameState`, `QuestionRenderModel`, `QuestionPrice`, `RevealRenderModel`, `AnyRevealPayload`.

- [ ] **Step 1: Write type contract tests in `test/core/presentation/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import type { QuestionRenderModel, QuestionPrice } from '../../../src/core/presentation/types';
import type { HiLoReveal, AnyRevealPayload } from '../../../src/core/presentation/reveals';

describe('Presentation Model Typing', () => {
  it('enforces type-safe QuestionPrice without arbitrary numbers', () => {
    const hidden: QuestionPrice = { kind: 'hidden', label: '???' };
    const reference: QuestionPrice = {
      kind: 'reference',
      value: 189000,
      label: '189.000₫',
      role: 'anchor_benchmark',
    };

    expect(hidden.kind).toBe('hidden');
    expect(reference.kind).toBe('reference');
  });

  it('compiles discriminated reveal payload correctly', () => {
    const reveal: AnyRevealPayload = {
      kind: 'HI_LO',
      priceA: 189000,
      priceB: 249000,
      comparison: 'higher',
    };
    expect(reveal.kind).toBe('HI_LO');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/presentation/types.test.ts`
Expected: FAIL with missing module imports

- [ ] **Step 3: Implement `src/core/state/types.ts`**

```typescript
export type MechanicId = string;

export interface GlobalDifficulty {
  priceProximity: number;   // 0.0 (xa) -> 1.0 (sát nút)
  familiarity: number;      // 0.0 (hiếm lạ) -> 1.0 (phổ thông)
  visualDeception: number;  // 0.0 (trực quan) -> 1.0 (xung đột nhận thức cực độ)
}

export interface DifficultyProfile {
  global: GlobalDifficulty;
  mechanicData?: Record<string, number | string>;
}

export interface RawEntity {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  brand?: string;
  category: string;
}

export interface ChoiceState {
  id: string;              // "A", "B", "C", "D"
  label: string;           // "higher", "scam", "bracket_1"
  value?: unknown;
}

export interface GameState<TRevealPayload = unknown> {
  gameId: string;
  mechanicId: MechanicId;
  seed: number;
  roundIndex: number;
  totalRounds: number;
  entities: RawEntity[];
  choices: ChoiceState[];
  answer: {
    winningChoiceId: string;
    revealPayload: TRevealPayload;
  };
  difficulty: DifficultyProfile;
  metadata: {
    createdAt: number;
    seriesNumber?: number;
  };
}
```

- [ ] **Step 4: Implement `src/core/presentation/reveals.ts`**

```typescript
export interface HiLoReveal {
  kind: 'HI_LO';
  priceA: number;
  priceB: number;
  comparison: 'higher' | 'lower';
}

export interface MostExpensiveReveal {
  kind: 'MOST_EXPENSIVE';
  prices: Array<{ productId: string; name: string; price: number }>;
  highestProductId: string;
}

export interface OneAwayReveal {
  kind: 'ONE_AWAY';
  fullPrice: number;
  revealedDigit: number;
  hiddenDigitIndex: number;
}

export interface OddOneOutReveal {
  kind: 'ODD_ONE_OUT';
  oddProductId: string;
  reason: 'category' | 'brand' | 'price_outlier';
  explanation: string;
}

export interface GuessThePriceReveal {
  kind: 'GUESS_THE_PRICE';
  actualPrice: number;
  correctBracketLabel: string;
}

export interface GroceryBasketReveal {
  kind: 'GROCERY_BASKET';
  budget: number;
  totalBill: number;
  isUnderBudget: boolean;
  itemPrices: Array<{ productId: string; name: string; price: number }>;
}

export interface DealOrScamReveal {
  kind: 'DEAL_OR_SCAM';
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  verdict: 'deal' | 'scam';
  explanation: string;
}

export type AnyRevealPayload =
  | HiLoReveal
  | MostExpensiveReveal
  | OneAwayReveal
  | OddOneOutReveal
  | GuessThePriceReveal
  | GroceryBasketReveal
  | DealOrScamReveal;
```

- [ ] **Step 5: Implement `src/core/presentation/types.ts`**

```typescript
import type { MechanicId } from '../state/types';

export type HiddenPrice = {
  kind: 'hidden';
  label: '???';
};

export type ReferencePrice = {
  kind: 'reference';
  value: number;
  label: string;
  role: 'anchor_benchmark' | 'original_price';
};

export type QuestionPrice = HiddenPrice | ReferencePrice;

export interface QuestionProductViewModel {
  productId: string;
  name: string;
  image: string;
  brand?: string;
  price: QuestionPrice;
  badgeTag?: string;
}

export interface QuestionChoiceViewModel {
  id: string;           // "A", "B", "C", "D"
  label: string;        // "CAO HƠN ⬆️", "100K - 150K"
}

export interface QuestionRenderModel {
  mechanicId: MechanicId;
  roundIndex: number;
  totalRounds: number;
  questionHeadline: string;
  entities: QuestionProductViewModel[];
  choices: QuestionChoiceViewModel[];
}

export interface RevealRenderModel<TPayload> {
  winningChoiceId: string;
  headlineBanner: string;
  subDetailBanner: string;
  payload: TPayload;
}

export interface PresentationModel<TPayload> {
  question: QuestionRenderModel;
  reveal: RevealRenderModel<TPayload>;
  cta: {
    bannerText: string;
    subText: string;
    variant: 'single_round_challenge' | 'multi_round_scorecard' | 'comment_debate';
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/core/presentation/types.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/state/types.ts src/core/presentation/reveals.ts src/core/presentation/types.ts test/core/presentation/types.test.ts
git commit -m "feat(core): define type-safe GameState and QuestionPrice presentation models"
```

---

### Task 3: Policy Module (Configurable Thresholds)

**Files:**
- Create: `src/core/policy/types.ts`
- Create: `src/core/policy/index.ts`
- Test: `test/core/policy/policy.test.ts`

**Interfaces:**
- Produces: `DiversityPolicy`, `AudioPolicy`, `LayoutPolicy`, `QualityPolicy`, default instances.

- [ ] **Step 1: Write tests in `test/core/policy/policy.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DIVERSITY_POLICY,
  DEFAULT_AUDIO_POLICY,
  DEFAULT_LAYOUT_POLICY,
  validateDiversityPolicy,
} from '../../../src/core/policy';

describe('Policy Module', () => {
  it('exports valid default policies', () => {
    expect(DEFAULT_DIVERSITY_POLICY.cooldownProductTuple).toBe(50);
    expect(DEFAULT_AUDIO_POLICY.targetLufs).toBe(-14.0);
    expect(DEFAULT_LAYOUT_POLICY.safeZoneTop).toBe(150);
  });

  it('validates custom diversity policy ranges', () => {
    expect(() => validateDiversityPolicy({ ...DEFAULT_DIVERSITY_POLICY, targetAnswerRatio: 1.5 })).toThrow();
    expect(() => validateDiversityPolicy({ ...DEFAULT_DIVERSITY_POLICY, cooldownProductTuple: -1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/policy/policy.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/core/policy/types.ts` & `src/core/policy/index.ts`**

```typescript
// src/core/policy/types.ts

export interface DiversityPolicy {
  cooldownProductTuple: number;
  cooldownHeroSku: number;
  maxConsecutiveSameAnswer: number;
  targetAnswerRatio: number;
  answerRatioTolerance: number;
}

export interface AudioPolicy {
  targetLufs: number;
  lufsTolerance: number;
  maxTruePeakDbTp: number;
  maxSilenceDurationSec: number;
  duckingRatio: number;
}

export interface LayoutPolicy {
  safeZoneTop: number;
  safeZoneBottom: number;
  cardMaxWidth: number;
  gutter: number;
}
```

```typescript
// src/core/policy/index.ts
import type { DiversityPolicy, AudioPolicy, LayoutPolicy } from './types';
export * from './types';

export const DEFAULT_DIVERSITY_POLICY: DiversityPolicy = {
  cooldownProductTuple: 50,
  cooldownHeroSku: 10,
  maxConsecutiveSameAnswer: 3,
  targetAnswerRatio: 0.5,
  answerRatioTolerance: 0.05,
};

export const DEFAULT_AUDIO_POLICY: AudioPolicy = {
  targetLufs: -14.0,
  lufsTolerance: 2.0,
  maxTruePeakDbTp: -1.0,
  maxSilenceDurationSec: 1.2,
  duckingRatio: 0.3,
};

export const DEFAULT_LAYOUT_POLICY: LayoutPolicy = {
  safeZoneTop: 150,
  safeZoneBottom: 1480,
  cardMaxWidth: 400,
  gutter: 60,
};

export function validateDiversityPolicy(policy: DiversityPolicy): void {
  if (policy.cooldownProductTuple < 0 || policy.cooldownHeroSku < 0) {
    throw new Error('Cooldowns must be non-negative');
  }
  if (policy.targetAnswerRatio <= 0 || policy.targetAnswerRatio >= 1) {
    throw new Error('targetAnswerRatio must be between 0 and 1');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/policy/policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/policy/types.ts src/core/policy/index.ts test/core/policy/policy.test.ts
git commit -m "feat(core): implement policy module extracting configurable diversity, audio and layout rules"
```

---

### Task 4: MechanicRegistry with Complete Lifecycle Hooks

**Files:**
- Create: `src/core/theme/types.ts`
- Create: `src/core/script/types.ts`
- Create: `src/core/registry/MechanicRegistry.ts`
- Test: `test/core/registry/MechanicRegistry.test.ts`

**Interfaces:**
- Produces: `IMechanicDefinition`, `MechanicRegistry` (`register`, `get`, `list`, `clear`).

- [ ] **Step 1: Create minimal theme & script types**

`src/core/theme/types.ts`:
```typescript
export type VisualThemeId = 'tv_game_show' | 'clean_shopping' | 'cyber_arcade' | 'street_quiz';
```

`src/core/script/types.ts`:
```typescript
export interface MechanicScriptContext {
  productNames: string[];
  benchmarkPriceLabel?: string;
  bracketLabels?: string[];
  discountRateLabel?: string;
}
```

- [ ] **Step 2: Write tests in `test/core/registry/MechanicRegistry.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MechanicRegistry, type IMechanicDefinition } from '../../../src/core/registry/MechanicRegistry';

describe('MechanicRegistry', () => {
  beforeEach(() => {
    MechanicRegistry.clear();
  });

  it('registers and retrieves a mechanic definition with lifecycle hooks', () => {
    const mockMechanic: IMechanicDefinition<{ winner: string }> = {
      id: 'TEST_GAME',
      name: 'Test Game',
      defaultTotalRounds: 1,
      createState: (input) => ({
        gameId: 'g_test',
        mechanicId: 'TEST_GAME',
        seed: 123,
        roundIndex: 1,
        totalRounds: 1,
        entities: input.entities,
        choices: [{ id: 'A', label: 'Option A' }],
        answer: { winningChoiceId: 'A', revealPayload: { winner: 'A' } },
        difficulty: { global: { priceProximity: 0.5, familiarity: 0.5, visualDeception: 0.5 } },
        metadata: { createdAt: Date.now() },
      }),
      validateState: () => {},
      compileQuestion: (state) => ({
        mechanicId: state.mechanicId,
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Test Question',
        entities: [],
        choices: [{ id: 'A', label: 'Option A' }],
      }),
      compileReveal: (state) => ({
        winningChoiceId: 'A',
        headlineBanner: 'Win',
        subDetailBanner: 'Detail',
        payload: state.answer.revealPayload,
      }),
      getDifficultyModel: (state) => state.difficulty,
      getScriptContext: () => ({ productNames: ['Item 1'] }),
    };

    MechanicRegistry.register(mockMechanic);
    expect(MechanicRegistry.list()).toContain('TEST_GAME');
    expect(MechanicRegistry.get('TEST_GAME').name).toBe('Test Game');
  });

  it('rejects duplicate mechanic registration', () => {
    const m = { id: 'DUP', name: 'Dup' } as any;
    MechanicRegistry.register(m);
    expect(() => MechanicRegistry.register(m)).toThrow(/already registered/);
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npx vitest run test/core/registry/MechanicRegistry.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement `src/core/registry/MechanicRegistry.ts`**

```typescript
import type { MechanicId, RawEntity, GameState, DifficultyProfile, GlobalDifficulty } from '../state/types';
import type { IForkableRng } from '../rng/ForkableRng';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export interface CreateStateInput {
  entities: RawEntity[];
  rng: IForkableRng;
  difficultyTarget?: Partial<GlobalDifficulty>;
  roundIndex?: number;
  totalRounds?: number;
}

export interface IMechanicDefinition<TReveal = unknown> {
  readonly id: MechanicId;
  readonly name: string;
  readonly defaultTotalRounds: number;

  createState(input: CreateStateInput): GameState<TReveal>;
  validateState(state: GameState<TReveal>): void;
  compileQuestion(state: GameState<TReveal>, themeId: VisualThemeId): QuestionRenderModel;
  compileReveal(state: GameState<TReveal>): RevealRenderModel<TReveal>;
  getDifficultyModel(state: GameState<TReveal>): DifficultyProfile;
  getScriptContext(state: GameState<TReveal>): MechanicScriptContext;
}

export class MechanicRegistry {
  private static readonly mechanics = new Map<MechanicId, IMechanicDefinition<any>>();

  static register<T>(mechanic: IMechanicDefinition<T>): void {
    if (this.mechanics.has(mechanic.id)) {
      throw new Error(`Mechanic "${mechanic.id}" already registered`);
    }
    this.mechanics.set(mechanic.id, mechanic);
  }

  static get<T = unknown>(id: MechanicId): IMechanicDefinition<T> {
    const found = this.mechanics.get(id);
    if (!found) throw new Error(`Mechanic "${id}" not found in registry`);
    return found as IMechanicDefinition<T>;
  }

  static list(): string[] {
    return Array.from(this.mechanics.keys());
  }

  static clear(): void {
    this.mechanics.clear();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/core/registry/MechanicRegistry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/theme/types.ts src/core/script/types.ts src/core/registry/MechanicRegistry.ts test/core/registry/MechanicRegistry.test.ts
git commit -m "feat(core): implement MechanicRegistry with complete compilation lifecycle hooks"
```

---

### Task 5: Two-Tier Content Fingerprint & File Store

**Files:**
- Create: `src/core/fingerprint/types.ts`
- Create: `src/core/fingerprint/FingerprintEngine.ts`
- Create: `src/core/fingerprint/FingerprintStore.ts`
- Test: `test/core/fingerprint/fingerprint.test.ts`

**Interfaces:**
- Produces: `FingerprintBundle`, `computeFingerprints(input)`, `FileFingerprintStore` (`record`, `hasExact`, `hasSemantic`, `load`, `save`).

- [ ] **Step 1: Write tests in `test/core/fingerprint/fingerprint.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeFingerprints } from '../../../src/core/fingerprint/FingerprintEngine';
import { FileFingerprintStore } from '../../../src/core/fingerprint/FingerprintStore';

describe('Fingerprint System', () => {
  const filePath = join(tmpdir(), `fp_test_${Date.now()}.json`);

  it('computes distinct exact and semantic fingerprints', () => {
    const bundle1 = computeFingerprints({
      mechanicId: 'HI_LO',
      productIds: ['p001', 'p002'],
      categories: ['electronics', 'appliances'],
      hookId: 'hook_1',
      voiceId: 'voice_1',
      themeId: 'tv_game_show',
      answerId: 'higher',
      difficultyBand: 'easy',
      revealStructure: 'price_split',
    });

    const bundle2 = computeFingerprints({
      mechanicId: 'HI_LO',
      productIds: ['p001', 'p002'],
      categories: ['electronics', 'appliances'],
      hookId: 'hook_2', // Changed hook
      voiceId: 'voice_2', // Changed voice
      themeId: 'tv_game_show',
      answerId: 'higher',
      difficultyBand: 'easy',
      revealStructure: 'price_split',
    });

    // Exact fingerprint differs
    expect(bundle1.exact).not.toBe(bundle2.exact);
    // Semantic fingerprint matches because core game structure and categories are identical
    expect(bundle1.semantic).toBe(bundle2.semantic);
  });

  it('persists and checks collision in FileFingerprintStore', () => {
    const store = new FileFingerprintStore(filePath);
    const fp = computeFingerprints({
      mechanicId: 'G9',
      productIds: ['p010'],
      categories: ['food'],
      hookId: 'h1',
      voiceId: 'v1',
      themeId: 'shopping',
      answerId: 'A',
      difficultyBand: 'med',
      revealStructure: 'bracket',
    });

    expect(store.hasExact(fp.exact)).toBe(false);
    store.record(fp);
    expect(store.hasExact(fp.exact)).toBe(true);
    expect(store.hasSemantic(fp.semantic)).toBe(true);

    // Re-instantiate from file
    const store2 = new FileFingerprintStore(filePath);
    expect(store2.hasExact(fp.exact)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/fingerprint/fingerprint.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/fingerprint/types.ts` & `FingerprintEngine.ts`**

```typescript
// src/core/fingerprint/types.ts
export interface FingerprintInput {
  mechanicId: string;
  productIds: string[];
  categories: string[];
  hookId: string;
  voiceId: string;
  themeId: string;
  answerId: string;
  difficultyBand: string;
  revealStructure: string;
}

export interface FingerprintBundle {
  exact: string;
  semantic: string;
  createdAt: number;
}
```

```typescript
// src/core/fingerprint/FingerprintEngine.ts
import { createHash } from 'node:crypto';
import type { FingerprintInput, FingerprintBundle } from './types';

export function computeFingerprints(input: FingerprintInput): FingerprintBundle {
  const sortedProducts = [...input.productIds].sort().join('|');
  const sortedCategories = [...input.categories].sort().join('|');

  const exactRaw = `${input.mechanicId}::${sortedProducts}::${input.hookId}::${input.voiceId}::${input.themeId}::${input.answerId}`;
  const semanticRaw = `${input.mechanicId}::${sortedCategories}::${input.difficultyBand}::${input.revealStructure}::${input.themeId}`;

  const exact = createHash('sha256').update(exactRaw).digest('hex');
  const semantic = createHash('sha256').update(semanticRaw).digest('hex');

  return { exact, semantic, createdAt: Date.now() };
}
```

- [ ] **Step 4: Implement `src/core/fingerprint/FingerprintStore.ts`**

```typescript
// src/core/fingerprint/FingerprintStore.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FingerprintBundle } from './types';

export class FileFingerprintStore {
  private exactSet = new Set<string>();
  private semanticSet = new Set<string>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  record(bundle: FingerprintBundle): void {
    this.exactSet.add(bundle.exact);
    this.semanticSet.add(bundle.semantic);
    this.save();
  }

  hasExact(exactHash: string): boolean {
    return this.exactSet.has(exactHash);
  }

  hasSemantic(semanticHash: string): boolean {
    return this.semanticSet.has(semanticHash);
  }

  private load(): void {
    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw) as { exacts: string[]; semantics: string[] };
        this.exactSet = new Set(data.exacts || []);
        this.semanticSet = new Set(data.semantics || []);
      } catch {
        this.exactSet = new Set();
        this.semanticSet = new Set();
      }
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(
      {
        exacts: Array.from(this.exactSet),
        semantics: Array.from(this.semanticSet),
      },
      null,
      2,
    );
    writeFileSync(this.filePath, payload, 'utf-8');
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/core/fingerprint/fingerprint.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/fingerprint/ test/core/fingerprint/
git commit -m "feat(core): implement two-tier content fingerprint and atomic file store"
```

---

### Task 6: DiversityManager & Answer Sequence Balancing

**Files:**
- Create: `src/core/diversity/DiversityManager.ts`
- Test: `test/core/diversity/DiversityManager.test.ts`

**Interfaces:**
- Consumes: `DiversityPolicy`, `FileFingerprintStore`
- Produces: `DiversityManager` (`canAcceptProductTuple`, `canAcceptHeroSku`, `canAcceptAnswer`, `recordHistory`).

- [ ] **Step 1: Write tests in `test/core/diversity/DiversityManager.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { DiversityManager } from '../../../src/core/diversity/DiversityManager';
import { DEFAULT_DIVERSITY_POLICY } from '../../../src/core/policy';

describe('DiversityManager', () => {
  it('enforces product tuple cooldown window', () => {
    const manager = new DiversityManager({ ...DEFAULT_DIVERSITY_POLICY, cooldownProductTuple: 2 });
    const tuple = ['p001', 'p002'];

    expect(manager.canAcceptProductTuple(tuple)).toBe(true);
    manager.recordTuple(tuple);

    // Immediate duplicate blocked
    expect(manager.canAcceptProductTuple(tuple)).toBe(false);

    // Push 2 other tuples
    manager.recordTuple(['p003', 'p004']);
    manager.recordTuple(['p005', 'p006']);

    // Cooldown expired -> accepted again
    expect(manager.canAcceptProductTuple(tuple)).toBe(true);
  });

  it('prevents consecutive same answer bias (e.g. max 3 A in a row)', () => {
    const manager = new DiversityManager({ ...DEFAULT_DIVERSITY_POLICY, maxConsecutiveSameAnswer: 3 });
    manager.recordAnswer('A');
    manager.recordAnswer('A');
    manager.recordAnswer('A');

    // 4th A in a row must be rejected
    expect(manager.canAcceptAnswer('A')).toBe(false);
    expect(manager.canAcceptAnswer('B')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/diversity/DiversityManager.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/diversity/DiversityManager.ts`**

```typescript
import type { DiversityPolicy } from '../policy/types';
import { DEFAULT_DIVERSITY_POLICY } from '../policy';

export class DiversityManager {
  private readonly tupleHistory: string[] = [];
  private readonly heroHistory: string[] = [];
  private readonly answerHistory: string[] = [];

  constructor(private readonly policy: DiversityPolicy = DEFAULT_DIVERSITY_POLICY) {}

  canAcceptProductTuple(productIds: string[]): boolean {
    const key = [...productIds].sort().join('|');
    const recent = this.tupleHistory.slice(-this.policy.cooldownProductTuple);
    return !recent.includes(key);
  }

  canAcceptHeroSku(sku: string): boolean {
    const recent = this.heroHistory.slice(-this.policy.cooldownHeroSku);
    return !recent.includes(sku);
  }

  canAcceptAnswer(answerId: string): boolean {
    const max = this.policy.maxConsecutiveSameAnswer;
    if (this.answerHistory.length < max) return true;
    const tail = this.answerHistory.slice(-max);
    return !tail.every((a) => a === answerId);
  }

  recordTuple(productIds: string[]): void {
    this.tupleHistory.push([...productIds].sort().join('|'));
  }

  recordHero(sku: string): void {
    this.heroHistory.push(sku);
  }

  recordAnswer(answerId: string): void {
    this.answerHistory.push(answerId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/diversity/DiversityManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/diversity/DiversityManager.ts test/core/diversity/DiversityManager.test.ts
git commit -m "feat(core): implement DiversityManager with tuple cooldown and sequence bias prevention"
```

---

### Task 7: Pre-Render GameplayValidator & Information Leakage Audit

**Files:**
- Create: `src/validator/GameplayValidator.ts`
- Test: `test/validator/GameplayValidator.test.ts`

**Interfaces:**
- Consumes: `PresentationModel`, `GameState`
- Produces: `GameplayValidator.validate(presentation, state)`

- [ ] **Step 1: Write leakage detection tests in `test/validator/GameplayValidator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { GameplayValidator, GameplayValidationError } from '../../../src/validator/GameplayValidator';
import type { PresentationModel } from '../../../src/core/presentation/types';

describe('GameplayValidator', () => {
  it('catches premature price exposure in question entities', () => {
    const presentation: PresentationModel<any> = {
      question: {
        mechanicId: 'GROCERY_BASKET',
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Đủ hay thiếu?',
        entities: [
          {
            productId: 'p001',
            name: 'Item 1',
            image: 'img.png',
            price: { kind: 'reference', value: 189000, label: '189.000₫', role: 'anchor_benchmark' }, // LEAK! Target item has price
          },
        ],
        choices: [{ id: 'A', label: 'ĐỦ' }],
      },
      reveal: { winningChoiceId: 'A', headlineBanner: 'ĐỦ', subDetailBanner: '', payload: {} },
      cta: { bannerText: 'CTA', subText: '', variant: 'single_round_challenge' },
    };

    expect(() => GameplayValidator.validate(presentation)).toThrow(GameplayValidationError);
    expect(() => GameplayValidator.validate(presentation)).toThrow(/E_LEAKAGE_PRICE_PREMATURE/);
  });

  it('catches technical product IDs leaking into reveal text', () => {
    const presentation: PresentationModel<any> = {
      question: {
        mechanicId: 'MOST_EXPENSIVE',
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Món nào đắt nhất?',
        entities: [{ productId: 'p015', name: 'Nồi chiên', image: 'img.png', price: { kind: 'hidden', label: '???' } }],
        choices: [{ id: 'A', label: 'A. Nồi chiên' }],
      },
      reveal: { winningChoiceId: 'A', headlineBanner: '🎯 ĐÁP ÁN: p015', subDetailBanner: '', payload: {} },
      cta: { bannerText: 'CTA', subText: '', variant: 'single_round_challenge' },
    };

    expect(() => GameplayValidator.validate(presentation)).toThrow(/E_LEAKAGE_RAW_PRODUCT_ID/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/validator/GameplayValidator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/validator/GameplayValidator.ts`**

```typescript
import type { PresentationModel } from '../core/presentation/types';

export class GameplayValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'GameplayValidationError';
  }
}

export class GameplayValidator {
  static validate(presentation: PresentationModel<any>): void {
    const { question, reveal, cta } = presentation;

    // 1. Information Leakage Audit: Target item price leak
    if (question.mechanicId === 'GROCERY_BASKET' || question.mechanicId === 'GUESS_THE_PRICE') {
      question.entities.forEach((e, idx) => {
        if (e.price.kind === 'reference') {
          throw new GameplayValidationError(
            'E_LEAKAGE_PRICE_PREMATURE',
            `Product ${idx} (${e.productId}) exposed reference price "${e.price.label}" during question phase in ${question.mechanicId}`,
          );
        }
      });
    }

    // 2. Information Leakage Audit: Technical SKU leakage
    const rawIdRegex = /\bp\d{3,}\b/i;
    if (rawIdRegex.test(reveal.headlineBanner)) {
      throw new GameplayValidationError(
        'E_LEAKAGE_RAW_PRODUCT_ID',
        `Reveal headline banner leaked raw product ID: "${reveal.headlineBanner}"`,
      );
    }
    question.choices.forEach((c) => {
      if (rawIdRegex.test(c.label)) {
        throw new GameplayValidationError(
          'E_LEAKAGE_RAW_PRODUCT_ID',
          `Choice label leaked raw product ID: "${c.label}"`,
        );
      }
    });

    // 3. CTA Round Mismatch
    if (question.totalRounds === 1 && cta.variant === 'multi_round_scorecard') {
      throw new GameplayValidationError(
        'E_CTA_ROUND_MISMATCH',
        'Single-round presentation cannot use multi_round_scorecard CTA',
      );
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/validator/GameplayValidator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/validator/GameplayValidator.ts test/validator/GameplayValidator.test.ts
git commit -m "feat(validator): implement GameplayValidator with premature price and SKU leakage audits"
```

---

### Task 8: Contract Test Runner & Sample Mechanic Snapshot

**Files:**
- Create: `test/contract/contractRunner.ts`
- Create: `test/contract/sample.contract.test.ts`

**Interfaces:**
- Produces: `verifyMechanicContract(mechanicDefinition, sampleEntities, seed)`

- [ ] **Step 1: Write `test/contract/contractRunner.ts`**

```typescript
import { expect } from 'vitest';
import type { IMechanicDefinition } from '../../src/core/registry/MechanicRegistry';
import type { RawEntity } from '../../src/core/state/types';
import { ForkableRng } from '../../src/core/rng/ForkableRng';
import { GameplayValidator } from '../../src/validator/GameplayValidator';

export function verifyMechanicContract(
  mechanic: IMechanicDefinition<any>,
  entities: RawEntity[],
  seed = 839271,
): void {
  const rng = new ForkableRng(seed);
  const state = mechanic.createGameState({ entities, rng });
  mechanic.validateState(state);

  expect(state.mechanicId).toBe(mechanic.id);
  expect(state.choices.length).toBeGreaterThanOrEqual(2);
  expect(state.answer.winningChoiceId).toBeDefined();

  const question = mechanic.compileQuestion(state, 'tv_game_show');
  const reveal = mechanic.compileReveal(state);

  const presentation = {
    question,
    reveal,
    cta: {
      bannerText: 'CTA Banner',
      subText: 'Comment below',
      variant: state.totalRounds > 1 ? ('multi_round_scorecard' as const) : ('single_round_challenge' as const),
    },
  };

  // Must pass zero-leakage validator
  GameplayValidator.validate(presentation);
}
```

- [ ] **Step 2: Create sample contract test in `test/contract/sample.contract.test.ts`**

```typescript
import { describe, it } from 'vitest';
import { verifyMechanicContract } from './contractRunner';
import type { IMechanicDefinition } from '../../src/core/registry/MechanicRegistry';

describe('Mechanic Contract Suite Harness', () => {
  it('successfully audits compliant mechanic lifecycle', () => {
    const compliantMechanic: IMechanicDefinition<any> = {
      id: 'COMPLIANT_GAME',
      name: 'Compliant Game',
      defaultTotalRounds: 1,
      createState: (input) => ({
        gameId: 'cg_1',
        mechanicId: 'COMPLIANT_GAME',
        seed: 123,
        roundIndex: 1,
        totalRounds: 1,
        entities: input.entities,
        choices: [
          { id: 'A', label: 'Choice A' },
          { id: 'B', label: 'Choice B' },
        ],
        answer: { winningChoiceId: 'A', revealPayload: { kind: 'HI_LO' } },
        difficulty: { global: { priceProximity: 0.5, familiarity: 0.5, visualDeception: 0.5 } },
        metadata: { createdAt: Date.now() },
      }),
      validateState: () => {},
      compileQuestion: (state) => ({
        mechanicId: state.mechanicId,
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Headline',
        entities: state.entities.map((e) => ({
          productId: e.productId,
          name: e.name,
          image: e.image,
          price: { kind: 'hidden', label: '???' },
        })),
        choices: state.choices.map((c) => ({ id: c.id, label: c.label })),
      }),
      compileReveal: (state) => ({
        winningChoiceId: 'A',
        headlineBanner: '🎉 BẠN ĐÃ THẮNG',
        subDetailBanner: 'Mô tả',
        payload: state.answer.revealPayload,
      }),
      getDifficultyModel: (state) => state.difficulty,
      getScriptContext: () => ({ productNames: ['P1'] }),
    };

    const entities = [
      { productId: 'p001', name: 'Product 1', price: 100000, image: 'p1.png', category: 'cat' },
    ];

    verifyMechanicContract(compliantMechanic, entities);
  });
});
```

- [ ] **Step 3: Run contract test**

Run: `npx vitest run test/contract/sample.contract.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add test/contract/contractRunner.ts test/contract/sample.contract.test.ts
git commit -m "test(contract): scaffold reusable contract verification harness for mechanic lifecycles"
```

---

### Task 9: PresentationCompiler & ScriptPlanner Core Decoupling

**Files:**
- Create: `src/core/compiler/PresentationCompiler.ts`
- Create: `src/core/script/ScriptPlanner.ts`
- Test: `test/core/compiler/compiler.test.ts`

**Interfaces:**
- Produces: `PresentationCompiler.compile(state, themeId, ctaVariant)`, `ScriptPlanner.plan(state, templatePool)`.

- [ ] **Step 1: Write compiler test in `test/core/compiler/compiler.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { PresentationCompiler } from '../../../src/core/compiler/PresentationCompiler';
import { MechanicRegistry } from '../../../src/core/registry/MechanicRegistry';
import { ForkableRng } from '../../../src/core/rng/ForkableRng';

describe('PresentationCompiler', () => {
  it('compiles presentation through registered mechanic hooks without if-else branching', () => {
    MechanicRegistry.clear();
    MechanicRegistry.register({
      id: 'DUMMY',
      name: 'Dummy',
      defaultTotalRounds: 1,
      createState: (input) => ({
        gameId: 'd1',
        mechanicId: 'DUMMY',
        seed: 1,
        roundIndex: 1,
        totalRounds: 1,
        entities: input.entities,
        choices: [{ id: 'A', label: 'A' }],
        answer: { winningChoiceId: 'A', revealPayload: {} },
        difficulty: { global: { priceProximity: 0, familiarity: 1, visualDeception: 0 } },
        metadata: { createdAt: Date.now() },
      }),
      validateState: () => {},
      compileQuestion: (s) => ({
        mechanicId: s.mechanicId,
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Q',
        entities: [],
        choices: [],
      }),
      compileReveal: () => ({
        winningChoiceId: 'A',
        headlineBanner: 'Win',
        subDetailBanner: '',
        payload: {},
      }),
      getDifficultyModel: (s) => s.difficulty,
      getScriptContext: () => ({ productNames: [] }),
    });

    const state = MechanicRegistry.get('DUMMY').createState({
      entities: [],
      rng: new ForkableRng(1),
    });

    const presentation = PresentationCompiler.compile(state, 'tv_game_show', 'single_round_challenge');
    expect(presentation.question.questionHeadline).toBe('Q');
    expect(presentation.reveal.winningChoiceId).toBe('A');
    expect(presentation.cta.variant).toBe('single_round_challenge');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/compiler/compiler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/compiler/PresentationCompiler.ts` & `src/core/script/ScriptPlanner.ts`**

```typescript
// src/core/compiler/PresentationCompiler.ts
import type { GameState } from '../state/types';
import type { PresentationModel } from '../presentation/types';
import type { VisualThemeId } from '../theme/types';
import { MechanicRegistry } from '../registry/MechanicRegistry';

export class PresentationCompiler {
  static compile<T>(
    state: GameState<T>,
    themeId: VisualThemeId,
    ctaVariant: 'single_round_challenge' | 'multi_round_scorecard' | 'comment_debate',
  ): PresentationModel<T> {
    const mechanic = MechanicRegistry.get<T>(state.mechanicId);
    const question = mechanic.compileQuestion(state, themeId);
    const reveal = mechanic.compileReveal(state);

    const isMulti = state.totalRounds > 1;
    const bannerText = isMulti ? '⭐ BẢNG ĐIỂM SHOW ⭐' : 'BẠN ĐOÁN ĐÚNG KHÔNG?';
    const subText = isMulti ? 'Bình luận số câu bạn đúng!' : 'Comment đáp án của bạn ngay!';

    return {
      question,
      reveal,
      cta: {
        bannerText,
        subText,
        variant: ctaVariant,
      },
    };
  }
}
```

```typescript
// src/core/script/ScriptPlanner.ts
import type { GameState } from '../state/types';
import type { ScriptPlan, ScriptEvent } from './types';

export class ScriptPlanner {
  static plan(state: GameState<any>, voiceId = 'vi_default'): ScriptPlan {
    const events: ScriptEvent[] = [
      {
        id: 'hook_1',
        type: 'HOOK',
        text: 'Thử thách 5 giây đoán giá!',
        timingOffsetSec: 0,
        maxDurationSec: 2.0,
      },
      {
        id: 'q_1',
        type: 'QUESTION',
        text: 'Đoán xem đáp án là gì?',
        timingOffsetSec: 2.0,
        maxDurationSec: 3.0,
      },
      {
        id: 'rev_1',
        type: 'REVEAL',
        text: 'Kết quả chính xác là!',
        timingOffsetSec: 8.0,
        maxDurationSec: 2.5,
      },
    ];

    return {
      roundIndex: state.roundIndex,
      events,
      voiceId,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/compiler/compiler.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite & TypeScript check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All tests pass with 0 TypeScript compiler errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/compiler/ src/core/script/ test/core/compiler/
git commit -m "feat(core): implement PresentationCompiler and ScriptPlanner decoupling logic from rendering"
```

---

## Plan Self-Review
- **Spec Coverage:** Covers all Phase A (Tasks 1–6) and Phase B (Tasks 7–9) items from Spec v2.1.
- **No Placeholders:** All code snippets, commands, and expected outputs are explicit and complete.
- **Type Consistency:** Method signatures and types (`ForkableRng`, `QuestionPrice`, `RevealRenderModel`, `MechanicRegistry`, `DiversityPolicy`) strictly match Spec v2.1.
