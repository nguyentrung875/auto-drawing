# Viral All-in-One Multi-Round Engine — Remaining Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining ~15% of the Master Design Spec: extract `DecisionEngine`, generalize `ChallengeCurator` across all Triad of Power games (G9, G7, G41), build the Closed-Loop Analytics Feedback Subsystem (`AnalyticsIngestor` and `WeightCalibrator`), and connect calibrated weights into `ViralScorer`.

**Architecture:**
1. Standalone `DecisionEngine` under `src/challenge/engines/` implementing G41 discount, fake sale, and category risk evaluation.
2. Fully generalized 5-Layer `ChallengeCurator` orchestrating any registered game DSL (`G9`, `G7`, `G41`) with 3-round cognitive escalation and anti-duplicate SKU guarantee.
3. Closed-Loop Analytics Feedback in `src/analytics/`: CSV/JSON analytics ingestion, retention drop-off analysis, and Bayesian weight calibration for `ViralScorer`.

**Tech Stack:** TypeScript 5.7, Node.js 22+, Zod, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-14-viral-all-in-one-multi-round-engine-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-14-viral-all-in-one-multi-round-engine-design.md)

## Global Constraints

- Never break existing 34 test suites (213 tests).
- Backwards compatibility must be preserved for existing mechanics (`HI_LO`, `MOST_EXPENSIVE`, `ONE_AWAY`, `ODD_ONE_OUT`, `GUESS_THE_PRICE`, `GROCERY_BASKET`, `DEAL_OR_SCAM`).
- Every score in `ChallengeScoreVector` must be strictly normalized in $[0.0, 1.0]$.
- Anti-duplicate SKU constraint: no video may contain duplicate product IDs across any round.
- Calibrated weights must always sum to 1.0 and remain strictly positive.

---

### Task 1: Standalone DecisionEngine & Engine Registry

**Files:**
- Create: `src/challenge/engines/DecisionEngine.ts`
- Modify: `src/game/mechanics/DealOrScamMechanic.ts` (re-export or delegate to `DecisionEngine`)
- Test: `test/challenge/engines.test.ts`

**Interfaces:**
- Produces: `DecisionEngine` with methods:
  - `resolveOriginalPrice(product: Product, seed: number): number`
  - `classifyDealOrScam(product: Product, originalPrice: number): 'deal' | 'scam'`
  - `evaluateOffer(product: Product, originalPrice?: number, seed?: number): { originalPrice: number; discountPercent: number; classification: 'deal' | 'scam'; rationale: string }`

- [ ] **Step 1: Write failing test in `test/challenge/engines.test.ts` for `DecisionEngine`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `DecisionEngine.ts`**
- [ ] **Step 4: Update `DealOrScamMechanic.ts` to consume `DecisionEngine`**
- [ ] **Step 5: Run tests to verify pass**

---

### Task 2: Generalized 5-Layer ChallengeCurator (G9, G7, G41)

**Files:**
- Modify: `src/challenge/ChallengeCurator.ts`
- Modify: `src/challenge/types.ts`
- Test: `test/challenge/ChallengeCurator.test.ts`

**Interfaces:**
- Consumes: `GameDefinitionDSL`, `Product[]`, `seed: number`
- Produces: `MultiRoundChallenge` for any of the 3 formats:
  - G9: Numeric brackets with `NumericEngine`
  - G7: 3-item basket budget with `KnapsackEngine`
  - G41: Deal vs scam inspection with `DecisionEngine`
  - All formats enforce cognitive curve: R1 (Confidence) -> R2 (Tension) -> R3 (WTF)

- [ ] **Step 1: Write test cases in `test/challenge/ChallengeCurator.test.ts` for G7 and G41 curation**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Generalize `ChallengeCurator.curate()` for G7 and G41**
- [ ] **Step 4: Verify anti-duplicate SKU and cognitive escalation on all 3 games**
- [ ] **Step 5: Run tests and ensure 100% pass**

---

### Task 3: Closed-Loop Analytics Feedback Subsystem

**Files:**
- Create: `src/analytics/types.ts`
- Create: `src/analytics/AnalyticsIngestor.ts`
- Create: `src/analytics/WeightCalibrator.ts`
- Create: `src/analytics/index.ts`
- Modify: `src/challenge/scorers/ViralScorer.ts` (accept custom/calibrated weights)
- Test: `test/analytics/analytics.test.ts`

**Interfaces:**
- Ingests: Platform CSV or JSON metrics (TikTok, YouTube Shorts, Reels)
  - `VideoAnalyticsRecord`: `{ videoId, platform, holdRate3s, completionRate, dropOffRounds: [r1, r2, r3], commentRate, shareRatio }`
- Calibrates: `ViralScorerWeights` with Bayesian prior update:
  - Increases weights for dimensions correlating with high comment & retention rates
  - Normalizes $\sum w_i = 1.0$
- ViralScorer:
  - `computePredictedViralScore(vector: ChallengeScoreVector, weights?: ViralScorerWeights): number`

- [ ] **Step 1: Write failing test in `test/analytics/analytics.test.ts`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `src/analytics/types.ts`, `AnalyticsIngestor.ts`, `WeightCalibrator.ts`, `index.ts`**
- [ ] **Step 4: Update `ViralScorer.ts` to support calibrated weights & predicted score**
- [ ] **Step 5: Run test suite to verify full completion**

---

### Task 4: Full System Verification

- [ ] **Step 1: Run full test suite (`npm test`)**
- [ ] **Step 2: Run TypeScript check (`npm run build`)**
- [ ] **Step 3: Run linter (`npm run lint`)**
- [ ] **Step 4: Verify git status is clean and ready**
