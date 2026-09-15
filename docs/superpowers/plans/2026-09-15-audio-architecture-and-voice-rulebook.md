# Audio Architecture & Voice Rulebook Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a decoupled, dual-stage audio architecture with declarative voice rulebooks, multi-attribute anti-repetition tracking, deterministic runtime selection, and micro-silence gap timing across all 7 MVP mechanics.

**Architecture:** 
- **Upstream / Declarative (`src/audio/voiceRulebook.ts`):** Defines intent distributions, word economy rules, timing budgets, visual dependency, static anti-spoiler guards, and an offline pool of 35+ verified candidates across the 7 MVP mechanics.
- **Runtime Selector & Memory (`src/audio/voiceSelector.ts`, `src/audio/voiceHistoryStore.ts`):** Deterministic PRNG selects candidates using seed and weighted distribution, filters spoilers, calculates multi-dimensional `ScriptQualityScore`, and applies anti-repetition penalties over a rolling history buffer.
- **Execution Engine (`src/audio/AudioEngine.ts`):** Replaces zero-sum math with physical timing: `voiceEndAt = revealAt - targetGapSec`, `voiceStartAt = voiceEndAt - actualDuration`, verifies `minVoiceStartAt >= countdownAt`, and outputs `AudioRuntimeScore` measuring `actualRevealGap` and `gapError`.
- **Mechanics (`src/game/mechanics/*`):** Replaces verbose 20-word string templates with punchy, decision-driving voice metadata.

**Tech Stack:** TypeScript 5.7, Vitest, Node.js 22+, `msedge-tts`, `@resvg/resvg-js`.

**Spec:** [`docs/superpowers/specs/2026-09-15-audio-architecture-and-voice-rulebook-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-15-audio-architecture-and-voice-rulebook-design.md)

## Global Constraints

- **Zero LLM in Engine:** `VoiceSelector` is 100% offline and deterministic; Hermes supplies candidates upstream via `GameJson` or the Engine falls back to `offlinePool`.
- **Physical Gap Metric:** `gapError = Math.abs(actualRevealGap - targetGapSec) <= 0.015s` (15ms tolerance).
- **Countdown Invariant:** `voiceStartAt >= countdownAt` (voice never encroaches into Question scene).
- **Backwards Compatibility:** `game.content.voice_script` remains a string, while `game.content.voice` holds structured `VoiceMetadata`.
- **Test Integrity:** All existing test suites must pass.

---

### Task 1: Voice Types & Declarative Voice Rulebook

**Files:**
- Modify: `src/audio/types.ts`
- Create: `src/audio/voiceRulebook.ts`
- Test: `test/audio/voice-rulebook.test.ts`

**Interfaces:**
- Produces: `VoiceIntent`, `VoiceCandidate`, `VoiceMetadata`, `VoiceTimingConfig`, `ScriptQualityScore`, `AudioRuntimeScore`, `MechanicVoiceRule`, `VOICE_RULEBOOK`

- [ ] **Step 1: Write unit test in `test/audio/voice-rulebook.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { VOICE_RULEBOOK } from '../../src/audio/voiceRulebook';
import { MECHANICS } from '../../src/game/schema';

describe('VoiceRulebook', () => {
  it('defines valid voice rules for all 7 MVP mechanics', () => {
    for (const mechanic of MECHANICS) {
      const rule = VOICE_RULEBOOK[mechanic];
      expect(rule).toBeDefined();
      expect(rule.mechanic).toBe(mechanic);
      expect(rule.allowedIntents.length).toBeGreaterThan(0);
      
      // Distributions must sum to ~1.0
      const totalWeight = Object.values(rule.intentDistribution).reduce((a, b) => a + b, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);

      // Timing bounds
      expect(rule.timing.defaultGapMs).toBeGreaterThanOrEqual(rule.timing.minGapMs);
      expect(rule.timing.defaultGapMs).toBeLessThanOrEqual(rule.timing.maxGapMs);
      expect(rule.timing.maxDurationSec).toBeGreaterThanOrEqual(1.5);

      // Offline pool non-empty and compliant
      expect(rule.offlinePool.length).toBeGreaterThanOrEqual(4);
      for (const cand of rule.offlinePool) {
        expect(cand.id).toBeDefined();
        expect(rule.allowedIntents).toContain(cand.intent);
        expect(cand.script.length).toBeGreaterThan(0);
        // None of the pool candidates should trip their own static forbidden patterns
        for (const pattern of rule.staticForbiddenPatterns) {
          expect(pattern.test(cand.script)).toBe(false);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify failure**
```bash
npx vitest run test/audio/voice-rulebook.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Update `src/audio/types.ts` with enhanced voice types**
Add `VoiceMode`, `VoiceIntent`, `VisualDependency`, `VoiceCandidate`, `VoiceMetadata`, `VoiceTimingConfig`, `ScriptQualityScore`, and `AudioRuntimeScore`.

- [ ] **Step 4: Implement `src/audio/voiceRulebook.ts`**
Define `VOICE_RULEBOOK` containing the full specification for `MOST_EXPENSIVE`, `HI_LO`, `ONE_AWAY`, `ODD_ONE_OUT`, `GUESS_THE_PRICE`, `GROCERY_BASKET`, `DEAL_OR_SCAM` with timing, static forbidden regexes, and offline candidate pools.

- [ ] **Step 5: Run test to verify it passes**
```bash
npx vitest run test/audio/voice-rulebook.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit Task 1**
```bash
git add src/audio/types.ts src/audio/voiceRulebook.ts test/audio/voice-rulebook.test.ts
git commit -m "feat(audio): implement declarative VoiceRulebook for 7 MVP mechanics"
```

---

### Task 2: Multi-Attribute Voice History Store (Anti-Repetition)

**Files:**
- Create: `src/audio/voiceHistoryStore.ts`
- Test: `test/audio/voice-history-store.test.ts`

**Interfaces:**
- Consumes: `VoiceIntent`, `VoiceMetadata` from `src/audio/types.ts`
- Produces: `VoiceHistoryRecord`, `VoiceHistoryStore`

- [ ] **Step 1: Write unit test in `test/audio/voice-history-store.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { VoiceHistoryStore } from '../../src/audio/voiceHistoryStore';

describe('VoiceHistoryStore', () => {
  it('tracks history and calculates repetition penalties accurately', () => {
    const store = new VoiceHistoryStore({ maxCapacity: 10 });
    
    // Initial penalty for fresh candidate is 0
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_01', 'Cao hay thấp?', 'CHALLENGE')).toBe(0);

    // Record usage
    store.record({
      mechanic: 'HI_LO',
      templateId: 'HL_CHALLENGE_01',
      script: 'Cao hay thấp?',
      intent: 'CHALLENGE',
      timestamp: Date.now(),
    });

    // Immediate repeat of exact script -> penalty 100
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_01', 'Cao hay thấp?', 'CHALLENGE')).toBe(100);

    // Same templateId -> penalty 50
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_01', 'Khác text', 'CHALLENGE')).toBeGreaterThanOrEqual(50);

    // Different template, same intent -> smaller penalty
    expect(store.calculatePenalty('HI_LO', 'HL_CHALLENGE_02', 'Khác', 'CHALLENGE')).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify failure**
```bash
npx vitest run test/audio/voice-history-store.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/audio/voiceHistoryStore.ts`**
Implement circular memory buffer tracking the last $N$ records, with method `calculatePenalty(mechanic, templateId, script, intent): number` and `record(record: VoiceHistoryRecord): void`.

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run test/audio/voice-history-store.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit Task 2**
```bash
git add src/audio/voiceHistoryStore.ts test/audio/voice-history-store.test.ts
git commit -m "feat(audio): implement VoiceHistoryStore with multi-attribute penalty scoring"
```

---

### Task 3: Deterministic Voice Selector & Script Quality Scorer

**Files:**
- Create: `src/audio/voiceSelector.ts`
- Modify: `src/audio/index.ts`
- Test: `test/audio/voice-selector.test.ts`

**Interfaces:**
- Consumes: `VOICE_RULEBOOK`, `VoiceHistoryStore`
- Produces: `selectVoiceScript(options)`, `calculateScriptQualityScore(candidate, rule, history)`

- [ ] **Step 1: Write unit test in `test/audio/voice-selector.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { selectVoiceScript } from '../../src/audio/voiceSelector';
import { VoiceHistoryStore } from '../../src/audio/voiceHistoryStore';

describe('VoiceSelector', () => {
  it('deterministically selects candidates for the same seed', () => {
    const history = new VoiceHistoryStore();
    const result1 = selectVoiceScript({ mechanic: 'MOST_EXPENSIVE', seed: 12345, history });
    const result2 = selectVoiceScript({ mechanic: 'MOST_EXPENSIVE', seed: 12345, history });
    expect(result1.script).toBe(result2.script);
    expect(result1.intent).toBe(result2.intent);
    expect(result1.templateId).toBe(result2.templateId);
  });

  it('rejects candidates tripping static anti-spoiler filters', () => {
    const history = new VoiceHistoryStore();
    const custom = [
      { id: 'bad_01', intent: 'CHALLENGE' as const, script: 'Kết quả là món bên trái đắt nhất' },
      { id: 'good_01', intent: 'CHALLENGE' as const, script: 'Món nào đắt nhất?' },
    ];
    const res = selectVoiceScript({
      mechanic: 'MOST_EXPENSIVE',
      seed: 999,
      history,
      customCandidates: custom,
    });
    expect(res.templateId).toBe('good_01');
  });
});
```

- [ ] **Step 2: Run test to verify failure**
```bash
npx vitest run test/audio/voice-selector.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/audio/voiceSelector.ts`**
- Seeded pseudo-random PRNG (Mulberry32 or SplitMix32) using `seed`.
- Intent selection based on cumulative weights in `rule.intentDistribution`.
- Candidate filtering using `rule.staticForbiddenPatterns`.
- Multi-dimensional `calculateScriptQualityScore`.
- History penalty integration and selection of top candidate.
- Export in `src/audio/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run test/audio/voice-selector.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit Task 3**
```bash
git add src/audio/voiceSelector.ts src/audio/index.ts test/audio/voice-selector.test.ts
git commit -m "feat(audio): implement deterministic VoiceSelector with ScriptQualityScore"
```

---

### Task 4: Dynamic Timeline Engine & Physical Gap Validation in AudioEngine

**Files:**
- Modify: `src/audio/AudioEngine.ts`
- Modify: `test/audio/AudioEngine.test.ts`
- Create: `test/audio/audio-engine-timing.test.ts`

**Interfaces:**
- Consumes: `VOICE_RULEBOOK`, `AudioRuntimeScore`
- Produces: `AudioSegment.runtimeScore`, `actualRevealGap`, `gapError`

- [ ] **Step 1: Write timing tests in `test/audio/audio-engine-timing.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { MechanicRegistry } from '../../src/game';
import { product } from '../helpers/products';

describe('AudioEngine Physical Gap Timing', () => {
  it('enforces revealGapMs micro-silence pause before reveal', async () => {
    const game = MechanicRegistry.get('HI_LO').create({
      products: [product('p1', 100000), product('p2', 200000)],
      seed: 839271,
    }).game;

    const result = await new AudioEngine().synthesize(game);
    const actualRevealGap = Number((result.revealAt - (result.voiceStartAt + result.voiceDuration)).toFixed(3));
    
    // Default target gap for HI_LO is 0.09s (90ms)
    expect(actualRevealGap).toBeCloseTo(0.09, 2);
    expect(result.voiceStartAt).toBeGreaterThanOrEqual(8.0); // Never before countdown
    expect(result.runtimeScore).toBeDefined();
    expect(result.runtimeScore?.gapErrorMs).toBeLessThanOrEqual(15);
    expect(result.runtimeScore?.pass).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**
```bash
npx vitest run test/audio/audio-engine-timing.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Update `src/audio/AudioEngine.ts`**
- Resolve `revealGapMs` from `game.audio?.voice?.revealGapMs` or `VOICE_RULEBOOK[mechanic]?.timing.defaultGapMs ?? 100`.
- Calculate `targetGapSec = revealGapMs / 1000`.
- `voiceEndAt = Number((revealAt - targetGapSec).toFixed(3))`.
- `voiceStartAt = Number((voiceEndAt - duration).toFixed(3))`.
- Enforce `voiceStartAt >= countdownAt`; throw `E_AUDIO_DURATION_INVALID` if voice exceeds budget.
- Compute physical metrics: `actualRevealGap = Number((revealAt - (voiceStartAt + duration)).toFixed(3))` and `gapErrorMs = Math.round(Math.abs(actualRevealGap - targetGapSec) * 1000)`.
- Populate `runtimeScore: AudioRuntimeScore`.

- [ ] **Step 4: Update `test/audio/AudioEngine.test.ts`**
Ensure existing tests expect the new timing calculations.

- [ ] **Step 5: Run audio tests**
```bash
npx vitest run test/audio/
```
Expected: All audio test suites pass.

- [ ] **Step 6: Commit Task 4**
```bash
git add src/audio/AudioEngine.ts test/audio/AudioEngine.test.ts test/audio/audio-engine-timing.test.ts
git commit -m "feat(audio): add dynamic reveal gap timing and AudioRuntimeScore to AudioEngine"
```

---

### Task 5: Refactor 7 Mechanics to Use VoiceSelector & Punchy Scripts

**Files:**
- Modify: `src/game/mechanics/HiLoMechanic.ts`
- Modify: `src/game/mechanics/MostExpensiveMechanic.ts`
- Modify: `src/game/mechanics/OneAwayMechanic.ts`
- Modify: `src/game/mechanics/OddOneOutMechanic.ts`
- Modify: `src/game/mechanics/GuessThePriceMechanic.ts`
- Modify: `src/game/mechanics/GroceryBasketMechanic.ts`
- Modify: `src/game/mechanics/DealOrScamMechanic.ts`
- Modify: `test/engine/mechanics.test.ts`

**Interfaces:**
- Consumes: `selectVoiceScript` from `src/audio/voiceSelector`
- Produces: Clean, punchy `voice_script` (<8 words) and structured `game.audio.voice`

- [ ] **Step 1: Write test expectations in `test/engine/mechanics.test.ts`**
Assert that across all 7 mechanics, `game.content.voice_script.split(/\s+/).length` is $\le 8$ words and `game.audio.voice.script` matches `game.content.voice_script`.

- [ ] **Step 2: Update all 7 mechanics**
In each mechanic's `create()` method:
Call `selectVoiceScript({ mechanic: this.id, seed })` and pass the returned script to `buildBaseGame`.

- [ ] **Step 3: Run mechanics test suite**
```bash
npx vitest run test/engine/
```
Expected: PASS.

- [ ] **Step 4: Run full project test suite**
```bash
npx vitest run
```
Expected: All 45 test files pass.

- [ ] **Step 5: Commit Task 5**
```bash
git add src/game/mechanics/ test/engine/
git commit -m "refactor(game): wire VoiceSelector into all 7 mechanics with concise scripts"
```

---

### Task 6: Full System Verification & MP4 Render Test

**Files:**
- Test: `test/render/satori-frame-renderer.test.ts`
- Output: `export/hi_lo_new_audio.mp4`

- [ ] **Step 1: Run TypeScript compiler check**
```bash
npm run build
```
Expected: PASS with 0 errors.

- [ ] **Step 2: Render sample MP4 with Satori renderer**
```bash
node dist/cli/index.js render --renderer satori
```
Expected: Produces high-quality video with clean audio timing, 80-120ms anticipation gap before reveal, and no warning logs.

- [ ] **Step 3: Commit Task 6**
```bash
git add .
git commit -m "chore: complete audio architecture upgrade and verify E2E video render"
```
