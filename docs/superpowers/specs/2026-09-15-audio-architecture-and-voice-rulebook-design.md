# Technical Design Specification: Audio Architecture & Voice Rulebook Upgrade

- **Author**: Antigravity & Trung
- **Date**: 2026-09-15
- **Status**: Draft (Review Gate)
- **Target Components**: `src/audio/voiceRulebook.ts`, `src/audio/voiceSelector.ts`, `src/audio/voiceHistoryStore.ts`, `src/audio/AudioEngine.ts`, `src/audio/types.ts`, `src/game/mechanics/*Mechanic.ts`

---

## 1. Problem Statement & Motivation

1. **Information Overlap & Over-budget Scripts:**
   - In the existing mechanic generators (`*Mechanic.ts`), `voice_script` was duplicating information already visually prominent on the 1080×1920 stage (e.g. reading full product names, reference prices, and multiple choices).
   - In mechanics like `DealOrScamMechanic` (25 words) and `HiLoMechanic` (15+ words with long product names), speech duration frequently exceeded the 1.9s budget, triggering `W_VOICE_OVER_BUDGET` or robotic fallback.

2. **No Anticipation Gap Before Reveal (Collision with Sound Effects):**
   - The formula `voiceStartAt = revealAt - duration` forced speech to terminate exactly at `revealAt = 11.00s`.
   - This caused the last syllable of speech to collide directly with the `reveal_chime.wav` SFX and the visual price reveal, eliminating the vital 80–120ms micro-silence pause that builds viewer tension.

3. **Pattern Fatigue in Mass Production:**
   - Scripts lacked intent diversification (every video used the exact same sentence pattern).
   - There was no anti-repetition tracking to prevent identical templates across consecutive videos.

4. **Monolithic Pass/Fail instead of Dual-Stage Quality Scoring:**
   - Quality was only assessed as a binary check (duration < 2.0s).
   - Word count, mechanic fit, clarity, comment bait potential, and runtime execution metrics were conflated.

---

## 2. Core Principles & Architecture

### 2.1. Separation of Responsibilities
* **Visual Layer (Eye):** Displays products, badges, reference prices, and option buttons.
* **Voice Layer (Ear):** Prompts the viewer to make a decision or take action (short, punchy 4–8 words).
* **SFX Layer (Ear):** Countdown ticks (8.0s–10.5s) build pressure; Reveal chime (11.0s) awards the result.
* **Micro-Silence Gap:** 80–120ms silence between voice end and reveal chime creates anticipation.

### 2.2. Dual-Stage Architecture Flow

```text
               ┌────────────────────────────────────────────────────────┐
               │              Game Mechanic (1 of 7 MVP)                │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │           Voice Rulebook (Declarative Config)           │
               │  - Intent Matrix (Challenge, Curiosity, Urgency, ...)  │
               │  - Target Word Range (min: 3, max: 8, pref: [4, 6])    │
               │  - Timing: defaultGapMs, minGapMs, maxGapMs            │
               │  - Forbidden Patterns (anti-spoiler, anti-reading UI)  │
               │  - Template Candidate Pool                             │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │       VoiceSelector (Creative Phase / Hermes)          │
               │  1. Pick Intent via seeded probability distribution    │
               │  2. Sample 3-5 candidates from pool or LLM             │
               │  3. Filter out candidates matching Forbidden Patterns  │
               │  4. Score via Script AQS (Fit, Brevity, Novelty)       │
               │  5. Check against VoiceHistoryStore (N=10 videos)      │
               │  6. Select highest-scoring script                      │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                             game.content.voice_script
                                          │
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │              AudioEngine (Execution Phase)             │
               │  1. Synthesize speech via EdgeTtsEngine / Piper        │
               │  2. Extract actual WAV duration                        │
               │  3. Read revealGapMs from audio config / rulebook      │
               │  4. Compute dynamic placement:                         │
               │     voiceEndAt = revealAt - (revealGapMs / 1000)       │
               │     voiceStartAt = voiceEndAt - actualDuration         │
               │  5. Score via Runtime AQS (collision, gap, duration)   │
               │  6. Assemble audio_bed.wav with SFX + BGM              │
               └────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1. Voice Rulebook (`src/audio/voiceRulebook.ts`)

Declarative schema for all 7 MVP mechanics:

```typescript
export type VoiceIntent = 'CHALLENGE' | 'CURIOSITY' | 'URGENCY' | 'DECISION';

export interface MechanicVoiceRule {
  mechanic: string;
  allowedIntents: VoiceIntent[];
  intentDistribution: Record<VoiceIntent, number>;
  targetWordCount: { min: number; max: number; preferred: [number, number] };
  timing: { defaultGapMs: number; minGapMs: number; maxGapMs: number };
  visualDependency: 'HIGH' | 'MEDIUM' | 'LOW';
  forbiddenPatterns: RegExp[];
  candidatePool: Array<{
    id: string;
    intent: VoiceIntent;
    template: string;
  }>;
}
```

#### Rulebook Settings for the 7 MVP Mechanics:
1. **`MOST_EXPENSIVE`**:
   - Intents: Challenge (70%), Curiosity (20%), Urgency (10%).
   - Word count: 4–8 words (preferred 4–6).
   - Gap: 100ms (min 80ms, max 140ms).
   - Forbidden: reading all product names, revealing winner, reading exact prices.
   - Candidates: `"Món nào đắt nhất?"`, `"Đoán xem món nào đắt nhất?"`, `"Bạn chọn món nào đắt nhất?"`, `"Nhìn kỹ kẻo nhầm nhé!"`, `"Chốt đáp án nhanh!"`.
2. **`HI_LO`**:
   - Intents: Challenge (70%), Decision (20%), Urgency (10%).
   - Word count: 3–7 words (preferred 3–6).
   - Gap: 90ms (min 70ms, max 120ms).
   - Forbidden: reading reference price, revealing answer.
   - Candidates: `"Cao hơn hay thấp hơn?"`, `"Cao hay thấp?"`, `"Bạn đoán cao hay thấp?"`, `"Chọn cao hay thấp nào?"`, `"Cao hay thấp, chọn nhanh!"`.
3. **`ONE_AWAY`**:
   - Intents: Challenge (70%), Curiosity (20%), Urgency (10%).
   - Word count: 4–7 words (preferred 4–6).
   - Gap: 100ms (min 80ms, max 130ms).
   - Forbidden: revealing hidden digit.
   - Candidates: `"Số nào bị che?"`, `"Chữ số bị che là mấy?"`, `"Đoán xem là số mấy?"`, `"Có một số rất dễ nhầm!"`, `"Chốt số mấy nào!"`.
4. **`ODD_ONE_OUT`**:
   - Intents: Challenge (60%), Curiosity (30%), Urgency (10%).
   - Word count: 4–8 words (preferred 4–6).
   - Gap: 110ms (min 90ms, max 150ms).
   - Forbidden: giving away the odd category before reveal.
   - Candidates: `"Món nào khác biệt?"`, `"Đâu là món lạc loài?"`, `"Tìm ra món khác loài chưa?"`, `"Nhanh, món nào khác biệt?"`.
5. **`GUESS_THE_PRICE`**:
   - Intents: Challenge (70%), Decision (20%), Urgency (10%).
   - Word count: 4–7 words (preferred 4–6).
   - Gap: 100ms (min 80ms, max 130ms).
   - Forbidden: reading the target price or revealing side.
   - Candidates: `"Trên hay dưới mức giá này?"`, `"Bạn chọn khoảng giá nào?"`, `"Trên hay dưới, chốt nhanh!"`.
6. **`GROCERY_BASKET`**:
   - Intents: Challenge (70%), Decision (20%), Urgency (10%).
   - Word count: 4–7 words (preferred 4–6).
   - Gap: 100ms (min 80ms, max 130ms).
   - Forbidden: calculating total price out loud before reveal.
   - Candidates: `"Ngân sách này đủ mua không?"`, `"Liệu có đủ tiền mua?"`, `"Đủ tiền hay cháy túi?"`, `"Đủ hay thiếu, chốt đi!"`.
7. **`DEAL_OR_SCAM`**:
   - Intents: Challenge (65%), Decision (20%), Curiosity (15%).
   - Word count: 4–7 words (preferred 4–6).
   - Gap: 120ms (min 90ms, max 160ms).
   - Forbidden: reading entire discount paragraph or revealing scam verdict.
   - Candidates: `"Kèo thơm hay cú lừa?"`, `"Deal hời hay bẫy giá ảo?"`, `"Coi chừng bị lừa đấy!"`, `"Múc ngay hay né gấp?"`.

---

### 3.2. Anti-Repetition Store (`src/audio/voiceHistoryStore.ts`)

- In-memory circular buffer with optional persistence (`data/voice_history.json`).
- Stores last $N$ records:
  ```typescript
  export interface VoiceHistoryEntry {
    mechanic: string;
    templateId: string;
    scriptText: string;
    timestamp: number;
  }
  ```
- Evaluator checks:
  - Exact script match in last $N$ videos $\rightarrow$ Penalty 100 (disqualify unless no alternatives).
  - Same template ID match in last 3 videos $\rightarrow$ Penalty 50.

---

### 3.3. Script Quality Scoring (`ScriptAQS` in `src/audio/voiceSelector.ts`)

Calculated during script generation:
* **MechanicFit (0–30 pts):** Matches allowed intents for the mechanic.
* **Brevity & Naturalness (0–30 pts):** 
  * 4–6 words: 30 pts.
  * 7–8 words: 24 pts.
  * 3 words or 9–10 words: 15 pts.
  * >10 words: 0 pts.
* **Anti-Spoiler Guard (0 or Reject):** Pass regex check against `forbiddenPatterns`.
* **Novelty vs History (0–40 pts):**
  * Not used in last 10 videos: 40 pts.
  * Used >3 videos ago: 20 pts.
  * Used in last 2 videos: 0 pts.

---

### 3.4. Dynamic Timeline Engine (`src/audio/AudioEngine.ts`)

1. **Configurable Gap Support:**
   - Reads `revealGapMs` from `game.audio.voice.revealGapMs` or `VOICE_RULEBOOK[mechanic].timing.defaultGapMs`. Default: `100ms`.
   - `revealGapSec = revealGapMs / 1000`.
   - `voiceEndAt = revealAt - revealGapSec`.
   - `voiceStartAt = voiceEndAt - actualDuration`.
   - `syncDelta = Math.abs(voiceStartAt + actualDuration - voiceEndAt)` (must be $\le 0.05s$).

2. **Runtime AQS Check (`AudioRuntimeScore`):**
   - Collision guard: `voiceStartAt >= countdownAt` (never speak before countdown starts).
   - Safety pause guard: `revealAt - (voiceStartAt + actualDuration) >= minGapSec`.
   - Hard duration limit: $0.35s \le \text{actualDuration} < 2.0s$.
   - Emits structured report in `AudioSegment`:
     ```typescript
     export interface AudioRuntimeScore {
       score: number; // 0..100
       actualDuration: number;
       revealGapMs: number;
       collisionDetected: boolean;
       pass: boolean;
     }
     ```

---

## 4. Mechanic Refactoring (`src/game/mechanics/`)

All 7 mechanics will replace inline static string templates with:
```typescript
const voiceSelection = selectVoiceScript({
  mechanic: this.id,
  seed,
  history: voiceHistoryStore,
});
```
This guarantees that any game created with a given seed generates a punchy, non-spoiling, non-colliding voiceover script, while remaining completely deterministic.

---

## 5. Verification & Testing Strategy

1. **`test/audio/voice-rulebook.test.ts`**:
   - Verify every mechanic has defined intents, positive distributions summing to 1.0, and non-empty candidate pools.
   - Verify all candidate pool templates stay within 3–8 words and pass their own forbidden patterns.
2. **`test/audio/voice-selector.test.ts`**:
   - Verify seeded selection is deterministic.
   - Verify anti-repetition penalizes recently used candidates.
   - Verify anti-spoiler rejects illegal candidate text.
3. **`test/audio/audio-engine-timing.test.ts`**:
   - Verify `voiceEndAt` ends strictly before `revealAt` by `revealGapMs`.
   - Verify `syncDelta` reflects accuracy of gap placement.
   - Verify `RuntimeAQS` outputs score $\ge 90$ for standard runs.
4. **Integration & Regression:**
   - Run `npm test` across all 45 test files to ensure 100% pass rate.
   - Render sample MP4 videos for `hi_lo` and `most_expensive` using `--renderer satori` to verify audio timing and silence gap in the output video.
