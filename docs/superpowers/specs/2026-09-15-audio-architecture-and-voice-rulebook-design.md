# Technical Design Specification: Audio Architecture & Voice Rulebook Upgrade (v2 - Refined)

- **Author**: Antigravity & Trung
- **Date**: 2026-09-15
- **Status**: Ready for Implementation
- **Target Components**: `src/audio/voiceRulebook.ts`, `src/audio/voiceSelector.ts`, `src/audio/voiceHistoryStore.ts`, `src/audio/AudioEngine.ts`, `src/audio/types.ts`, `src/game/mechanics/*Mechanic.ts`

---

## 1. Problem Statement & Motivation

1. **Information Overlap & Over-budget Scripts:**
   - In existing mechanics (`*Mechanic.ts`), `voice_script` duplicated visual stage content (reading long product names, baseline prices, multiple choices).
   - In mechanics like `DealOrScamMechanic` (25 words), speech duration overran budgets, triggering warnings or robotic fallbacks.

2. **No Anticipation Gap Before Reveal:**
   - The old formula `voiceStartAt = revealAt - duration` forced speech to end right at `revealAt = 11.00s`, causing speech tails to collide with `reveal_chime.wav` and eliminating the vital 80–120ms micro-silence pause.

3. **Pattern Fatigue & Lack of Performance Tracking:**
   - Every video used identical phrasing. There was no anti-repetition tracking and no metadata (`templateId`, `intent`) to track which voice patterns drove higher retention or comments.

4. **Architectural Blur between Hermes (Creative/LLM) and GameEngine (Deterministic Runtime):**
   - The engine must NEVER call an LLM at runtime. Hermes generates creative candidates upstream; the Engine's `VoiceSelector` is a fast, offline, deterministic selector with history penalties.

---

## 2. Core Principles & Separation of Concerns

```text
               ┌────────────────────────────────────────────────────────┐
               │                  HERMES (Creative/LLM)                 │
               │  - Analyzes products, trend, and audience psychology    │
               │  - Generates 3-5 punchy VoiceCandidate[]                │
               │  - Ensures semantic anti-spoiler compliance            │
               └──────────────────────────┬─────────────────────────────┘
                                          │  passes candidates in GameJson
                                          ▼  (or fallback to Rulebook Pool)
               ┌────────────────────────────────────────────────────────┐
               │             GAME CONTENT JSON / RULEBOOK               │
               │  - Allowed intents, weights, timing config, pool       │
               │  - Visual dependency rating: HIGH | MEDIUM | LOW       │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │         VoiceSelector (Engine Runtime Selection)       │
               │  - Deterministic PRNG using job seed                   │
               │  - Samples intent via seeded weighted distribution     │
               │  - Filters out candidates via Static Anti-Spoiler      │
               │  - Evaluates ScriptQualityScore (Brevity, Fit, Novelty)│
               │  - Checks VoiceHistoryStore (penalizes recent repeats) │
               │  - Output: { script, intent, templateId, visualDep }   │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │             AudioEngine (Execution Phase)              │
               │  - Synthesizes speech via TTSProvider (EdgeTTS/Piper)  │
               │  - Computes dynamic placement with targetGap           │
               │  - Verifies minVoiceStartAt >= countdownAt             │
               │  - Evaluates Runtime AQS (actualRevealGap, gapError)   │
               │  - Assembles audio_bed.wav with SFX + BGM              │
               └────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1. Voice Schema & Metadata (`src/audio/types.ts`)

```typescript
export type VoiceMode = 'SPOKEN' | 'SILENT';

export type VoiceIntent =
  | 'CHALLENGE'   // e.g. "Cao hơn hay thấp hơn?" (boosts comments)
  | 'CURIOSITY'   // e.g. "Nhìn kỹ kẻo nhầm nhé!" (boosts retention)
  | 'URGENCY'     // e.g. "Chốt đáp án nhanh!" (boosts tension)
  | 'DECISION';   // e.g. "Bạn chọn bên nào?"

export type VisualDependency = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VoiceCandidate {
  id: string;
  intent: VoiceIntent;
  script: string;
}

export interface VoiceMetadata {
  script: string;
  intent: VoiceIntent;
  templateId: string;
  visualDependency: VisualDependency;
}

export interface VoiceTimingConfig {
  defaultGapMs: number;
  minGapMs: number;
  maxGapMs: number;
  maxDurationSec: number;
}
```

### 3.2. Declarative Rulebook with Candidate Pools (`src/audio/voiceRulebook.ts`)

The rulebook holds the **rules** and a rich **offline fallback pool** (100+ candidates total across 7 mechanics), so the Engine runs 100% offline without needing Hermes.

```typescript
export interface MechanicVoiceRule {
  mechanic: string;
  allowedIntents: VoiceIntent[];
  intentDistribution: Record<VoiceIntent, number>;
  timing: VoiceTimingConfig;
  visualDependency: VisualDependency;
  staticForbiddenPatterns: RegExp[];
  offlinePool: VoiceCandidate[];
}
```

#### Settings for 7 MVP Mechanics:
1. **`MOST_EXPENSIVE`**:
   - Distribution: Challenge 70%, Curiosity 20%, Urgency 10%.
   - Timing: `defaultGapMs: 100, minGapMs: 80, maxGapMs: 140, maxDurationSec: 2.2`.
   - VisualDependency: `MEDIUM`.
   - Forbidden: `/(đắt nhất là|kết quả là|giá tiền|triệu|nghìn đồng)/i`.
   - Pool:
     - `ME_CHALLENGE_01`: `"Món nào đắt nhất?"`
     - `ME_CHALLENGE_02`: `"Đoán xem món nào đắt nhất?"`
     - `ME_CHALLENGE_03`: `"Bạn chọn món nào đắt nhất?"`
     - `ME_CURIOSITY_01`: `"Nhìn kỹ kẻo nhầm nhé!"`
     - `ME_URGENCY_01`: `"Chốt đáp án nhanh!"`
2. **`HI_LO`**:
   - Distribution: Challenge 70%, Decision 20%, Urgency 10%.
   - Timing: `defaultGapMs: 90, minGapMs: 70, maxGapMs: 120, maxDurationSec: 1.8`.
   - VisualDependency: `HIGH` (voice must remain extremely concise).
   - Forbidden: `/(kết quả là|chắc chắn cao|chắc chắn thấp|\d{3})/i`.
   - Pool:
     - `HL_CHALLENGE_01`: `"Cao hơn hay thấp hơn?"`
     - `HL_CHALLENGE_02`: `"Cao hay thấp?"`
     - `HL_DECISION_01`: `"Bạn đoán cao hay thấp?"`
     - `HL_DECISION_02`: `"Chọn cao hay thấp nào?"`
     - `HL_URGENCY_01`: `"Cao hay thấp, chọn nhanh!"`
3. **`ONE_AWAY`**:
   - Distribution: Challenge 70%, Curiosity 20%, Urgency 10%.
   - Timing: `defaultGapMs: 100, minGapMs: 80, maxGapMs: 130, maxDurationSec: 2.0`.
   - VisualDependency: `HIGH`.
   - Forbidden: `/(số \d là đúng|đáp án là)/i`.
   - Pool:
     - `OA_CHALLENGE_01`: `"Số nào bị che?"`
     - `OA_CHALLENGE_02`: `"Chữ số bị che là mấy?"`
     - `OA_CHALLENGE_03`: `"Đoán xem là số mấy?"`
     - `OA_CURIOSITY_01`: `"Có một số rất dễ nhầm!"`
     - `OA_URGENCY_01`: `"Chốt số mấy nào!"`
4. **`ODD_ONE_OUT`**:
   - Distribution: Challenge 60%, Curiosity 30%, Urgency 10%.
   - Timing: `defaultGapMs: 110, minGapMs: 90, maxGapMs: 150, maxDurationSec: 2.0`.
   - VisualDependency: `HIGH`.
   - Forbidden: `/(món khác là|đáp án|loại bỏ)/i`.
   - Pool:
     - `OO_CHALLENGE_01`: `"Món nào khác biệt?"`
     - `OO_CHALLENGE_02`: `"Đâu là món lạc loài?"`
     - `OO_CURIOSITY_01`: `"Tìm ra món khác loài chưa?"`
     - `OO_URGENCY_01`: `"Nhanh, món nào khác biệt?"`
5. **`GUESS_THE_PRICE`**:
   - Distribution: Challenge 70%, Decision 20%, Urgency 10%.
   - Timing: `defaultGapMs: 100, minGapMs: 80, maxGapMs: 130, maxDurationSec: 2.0`.
   - VisualDependency: `HIGH`.
   - Forbidden: `/(trên mức|dưới mức|chính xác là)/i`.
   - Pool:
     - `GP_CHALLENGE_01`: `"Trên hay dưới mức giá này?"`
     - `GP_DECISION_01`: `"Bạn chọn khoảng giá nào?"`
     - `GP_URGENCY_01`: `"Trên hay dưới, chốt nhanh!"`
6. **`GROCERY_BASKET`**:
   - Distribution: Challenge 70%, Decision 20%, Urgency 10%.
   - Timing: `defaultGapMs: 100, minGapMs: 80, maxGapMs: 130, maxDurationSec: 2.0`.
   - VisualDependency: `HIGH`.
   - Forbidden: `/(tổng cộng là|cháy túi rồi|thừa tiền)/i`.
   - Pool:
     - `GB_CHALLENGE_01`: `"Ngân sách này đủ mua không?"`
     - `GB_CHALLENGE_02`: `"Liệu có đủ tiền mua?"`
     - `GB_DECISION_01`: `"Đủ tiền hay cháy túi?"`
     - `GB_URGENCY_01`: `"Đủ hay thiếu, chốt đi!"`
7. **`DEAL_OR_SCAM`**:
   - Distribution: Challenge 65%, Decision 20%, Curiosity 15%.
   - Timing: `defaultGapMs: 120, minGapMs: 90, maxGapMs: 160, maxDurationSec: 2.2`.
   - VisualDependency: `MEDIUM`.
   - Forbidden: `/(chắc chắn là scam|deal hời múc đi|lừa đảo đấy)/i`.
   - Pool:
     - `DS_CHALLENGE_01`: `"Kèo thơm hay cú lừa?"`
     - `DS_CHALLENGE_02`: `"Deal hời hay bẫy giá ảo?"`
     - `DS_CURIOSITY_01`: `"Coi chừng bị lừa đấy!"`
     - `DS_URGENCY_01`: `"Múc ngay hay né gấp?"`

---

### 3.3. Multi-Dimension Script Quality Score (`ScriptQualityScore`)

Instead of hard-limiting words, `ScriptQualityScore` balances multiple signals:

```typescript
export interface ScriptQualityScore {
  mechanicFit: number;        // 0-25 (matches allowed intents)
  naturalness: number;        // 0-20 (Vietnamese cadence, punctuation)
  brevity: number;            // 0-15 (word/char economy without sacrificing clarity)
  challengeStrength: number;  // 0-15 (urgency / engagement prompt)
  novelty: number;            // 0-15 (distance from recent history)
  commentPotential: number;   // 0-10 (binary choice / polar prompt)
  total: number;              // 0-100
  antiSpoilerPassed: boolean; // hard gate (must be true)
}
```

---

### 3.4. Multi-Attribute Anti-Repetition Store (`src/audio/voiceHistoryStore.ts`)

Stores enriched records of recent video renders:
```typescript
export interface VoiceHistoryRecord {
  mechanic: string;
  intent: VoiceIntent;
  templateId: string;
  script: string;
  timestamp: number;
}
```
**Penalty Calculations:**
- Same exact script in last 10 videos: `-100 pts` (disqualified if alternatives exist).
- Same templateId in last 3 videos: `-50 pts`.
- Same intent in last 2 videos: `-15 pts`.
- Same intent 3 times in a row: `-30 pts`.

---

### 3.5. Dynamic AudioEngine Timing & Physical Gap Metrics (`src/audio/AudioEngine.ts`)

1. **Target Gap & Voice Placement:**
   - `targetGapSec = (rule.timing.defaultGapMs) / 1000`.
   - `voiceEndAt = revealAt - targetGapSec`.
   - `voiceStartAt = voiceEndAt - actualDuration`.

2. **Tension Window Invariant (No Overrun):**
   - Enforce `voiceStartAt >= countdownAt` (voice must never invade the Question scene before Countdown).
   - If `actualDuration > rule.timing.maxDurationSec`, throw or warn `W_VOICE_OVER_BUDGET`.

3. **Physical Metric Verification (`AudioRuntimeScore`):**
   - `actualRevealGap = Number((revealAt - (voiceStartAt + actualDuration)).toFixed(3))`.
   - `gapError = Number(Math.abs(actualRevealGap - targetGapSec).toFixed(3))`.
   - Verification: `gapError <= 0.015` (15ms maximum physical timing tolerance).
   - Collision check: `actualRevealGap >= (rule.timing.minGapMs / 1000)`.

```typescript
export interface AudioRuntimeScore {
  score: number; // 0..100
  actualDuration: number;
  actualRevealGapMs: number;
  gapErrorMs: number;
  collisionDetected: boolean;
  pass: boolean;
}
```

---

## 4. Mechanic Refactoring (`src/game/mechanics/`)

Each mechanic's `create()` method invokes:
```typescript
const voiceMeta = selectVoiceScript({
  mechanic: this.id,
  seed,
  history: voiceHistoryStore,
  customCandidates: input.voiceCandidates, // Optional Hermes-provided candidates
});
```
And populates both `game.content.voice_script` (string for backwards compatibility) and `game.content.voice` (structured `VoiceMetadata` for analytics).

---

## 5. Verification Plan

1. **Unit Tests (`test/audio/voice-rulebook.test.ts`):**
   - Validate distributions sum to 1.0 for all 7 mechanics.
   - Validate every candidate passes static anti-spoiler regex.
2. **Unit Tests (`test/audio/voice-selector.test.ts`):**
   - Deterministic PRNG reproducibility by seed.
   - History penalty prevents consecutive template reuse.
   - ScriptQualityScore computation.
3. **Unit Tests (`test/audio/audio-engine-timing.test.ts`):**
   - Physical `actualRevealGap` verification within 15ms.
   - `minVoiceStartAt >= countdownAt` invariant.
4. **Integration (`npm test`):**
   - Ensure all 45 test suites pass.
