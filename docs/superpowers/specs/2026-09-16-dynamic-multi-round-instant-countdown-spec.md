# Master Design Spec: Dynamic Multi-Round Engine & Instant Countdown Architecture

- **Date**: 2026-09-16
- **Topic**: Dynamic N-Rounds, Instant Countdown Timer (>= 5s), Zero Dead Air, Multi-Round Audio Synthesis
- **Target Formats**: TikTok, YouTube Shorts, Facebook Reels (1080x1920 9:16 Vertical Video)
- **Status**: Approved by User, Ready for Implementation

---

## 1. Problem & Strategic Objectives

### 1.1 Root Problem
1. **Single-round legacy default**: Prior `game render` CLI defaulted to the 18s single-round pipeline, causing ~8 seconds of dead lead-in before the countdown timer started.
2. **Multi-round had fixed constraints**: The prototype `AllInOneScene` and `g9_guess_the_price` DSL hardcoded `rounds.length = 3` and added an unnecessary 2.5s delay to `playDuration = timerSeconds + 2.5s`, causing the pill countdown bar to remain frozen for 2.5 seconds.
3. **Mute multi-round audio**: In multi-round rendering mode, only background music was synthesized—no Edge-TTS question narration or countdown SFX cues were generated.

### 1.2 Target Experience (Flow A - Instant High-Retention Short-Form)
- **0.0s – 1.0s (Quick Intro/Hook)**: Series HUD + High-contrast Hook Headline ("ĐOÁN GIÁ N VÒNG!").
- **Each Round ($i = 1 \dots N$)**:
  - `round_i_play` (**Instant Countdown $\ge 5.0$s**, default 5.0s):
    - Frame 0 of play phase begins the countdown immediately (`secondsRemaining` begins decreasing from `timerSeconds` to `0.0`).
    - Voice Narration starts immediately at second 0.0–0.2 of the round, reading the question/product price concisely.
    - Accelerating SFX ticks (`[0.3, 0.35, 0.42, 0.50, 0.62, 0.75, 0.90]`) fire every 0.5s–1.0s toward 0.
  - `round_i_reveal` (**1.5s – 2.0s**):
    - Winning choice highlighted with green stroke + confetti/impact SFX.
    - Accurate benchmark price revealed.
  - `micro_hook_i` (**0.5s**, between rounds $1 \dots N-1$):
    - Snappy transition badge: *"VÒNG TIẾP THEO!"*.
- **Outro (1.5s – 2.0s)**:
  - Series Scorecard + Interactive CTA: *"Bạn đoán đúng mấy câu? Comment ngay!"*.

---

## 2. Core Architecture Changes

### 2.1 Dynamic Game Definitions & Curation (`ChallengeCurator.ts`, `types.ts`)
- `MultiRoundChallengeConfig`:
  ```typescript
  export interface MultiRoundOptions {
    totalRounds?: number;      // N rounds (default: 3, configurable: 2, 3, 4, 5...)
    timerSeconds?: number;     // Countdown duration per round (min: 5.0, default: 5.0)
    seed?: number;
    mechanic?: string;
  }
  ```
- `ChallengeCurator.curate(dsl, products, seed, options)`:
  - If `options.totalRounds` is specified, slice/scale the rounds dynamically from the DSL or dynamically generate cognitive rounds:
    - Round 1: `confidence_builder` (easy/instant)
    - Round $2 \dots N-1$: `tension_creator` (moderate/deliberation)
    - Round $N$: `wtf_reveal` (high perception conflict / shock value)
  - `timerSeconds` override: if provided, each round's `timerSeconds` is set to `Math.max(5.0, options.timerSeconds)`.

### 2.2 Instant Countdown Timeline (`AllInOneScene.ts`)
- Eliminate the `+ 2.5s` delay in `playDuration`:
  ```typescript
  // Before: const playDuration = round.timerSeconds + 2.5; (caused 2.5s frozen bar)
  // After: Instant countdown
  const playDuration = Math.max(5.0, round.timerSeconds);
  ```
- Timeline structure for $N$ rounds:
  - `hook`: 1.0s
  - For each round $i$:
    - `round_${i}_play`: `playDuration` (e.g. 5.0s)
    - `round_${i}_reveal`: 2.0s
    - `micro_hook_${i}`: 0.5s (if $i < N$)
  - `scorecard`: 1.5s
  - Total duration = $1.0 + N \times (5.0 + 2.0) + (N - 1) \times 0.5 + 1.5 = 1.0 + 7N + 0.5(N - 1) + 1.5 = 7.5N + 2.0$ seconds (e.g., 3 rounds = 24.5s; 2 rounds = 17s).

### 2.3 Canvas Rendering Adjustments (`scenePainter.ts`)
- In `paintMultiRoundFrame`:
  - `drawPillCountdown`: Starts at `round.timerSeconds` at slot start and decrements linearly to `0.0` at slot end:
    ```typescript
    const elapsedInPlay = timeSeconds - slot.start;
    const secondsRemaining = Math.max(0, slot.duration - elapsedInPlay);
    drawPillCountdown(canvas, secondsRemaining, slot.duration, countdownY);
    ```
  - Series HUD: Displays dynamic dot count and active index based on `scene.challenge.rounds.length`.

### 2.4 Multi-Round Audio Engine (`MultiRoundAudioComposer.ts`)
- **Voice TTS per Round**:
  - Synthesizes speech for each round's question using `EdgeTtsEngine` (with `resolveBinary('ffmpeg')` fix to prevent `ENOENT` on Windows).
  - Positions `voice_round_i` at `slot.start + 0.1s` (starts speaking immediately as cards appear).
- **SFX Scheduling**:
  - Countdown ticks: Fired at each integer and half-second before reveal.
  - Reveal sound: Fired at `round_i_reveal.start`.
  - Micro-hook transition: Fired at `micro_hook_i.start`.
- **Music Bed & Ducking**:
  - Looped BGM across the entire video duration.
  - Dynamic ducking whenever voice is active in each round.

### 2.5 CLI Integration (`src/cli/render.ts`)
- Support flags:
  - `--rounds <N>` (e.g. `--rounds 3`, `--rounds 5`)
  - `--timer <seconds>` (e.g. `--timer 5`, min: 5)
  - Default execution mode leverages multi-round when `--rounds` is passed or by default for flagship mechanics.

---

## 3. Verification & Quality Gates

1. **Unit Tests**:
   - `ChallengeCurator.test.ts`: Verify dynamic round count (2, 3, 5 rounds) and custom `timerSeconds >= 5.0`.
   - `AllInOneScene.test.ts`: Verify timeline slots calculation, zero idle gap at start of play, correct total duration.
   - `scenePainter.test.ts`: Verify `drawPillCountdown` at $t=0$ matches `timerSeconds` and decreases smoothly.
   - `MultiRoundAudioComposer.test.ts`: Verify voice and SFX placement per round.
2. **Video Render Verification**:
   - Render a sample 3-round video with 5s countdown: `game render --rounds 3 --timer 5`.
   - Verify that countdown begins at $t=1.0$s and runs for 5.0s with no dead air.
