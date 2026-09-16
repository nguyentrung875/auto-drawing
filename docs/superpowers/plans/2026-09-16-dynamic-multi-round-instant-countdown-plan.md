# Dynamic Multi-Round Engine & Instant Countdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the game engine into a dynamic multi-round system supporting arbitrary round counts ($N$ rounds), instant countdown timer ($\ge 5.0$s per round) with zero dead air, and multi-round audio/TTS synthesis.

**Architecture:** Decouple round count from fixed DSL arrays via dynamic curation in `ChallengeCurator`, eliminate timeline lag in `AllInOneScene`, ensure instant countdown bar animation in `scenePainter`, synthesize multi-round voice narration and escalating countdown SFX via `MultiRoundAudioComposer`, and expose clean CLI flags (`--rounds`, `--timer`).

**Tech Stack:** TypeScript 5.7, Node.js 22+, Vitest, Canvas/Skia, FFmpeg, MsEdgeTTS.

**Spec:** [`docs/superpowers/specs/2026-09-16-dynamic-multi-round-instant-countdown-spec.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-16-dynamic-multi-round-instant-countdown-spec.md)

## Global Constraints

- Backwards compatibility: Existing single-round test suites must continue to pass.
- Minimum countdown duration: `timerSeconds` must always be $\ge 5.0$ seconds.
- Instant countdown: No visual freeze at round start; countdown bar must decrement immediately from frame 0 of the round play phase.
- Windows Edge-TTS compatibility: Must resolve FFmpeg path via `resolveBinary('ffmpeg')` rather than assuming system PATH.

---

### Task 1: Fix EdgeTtsEngine Windows FFmpeg Resolution

**Files:**
- Modify: `src/audio/EdgeTtsEngine.ts:120-145`
- Test: `test/audio/edge-tts-resolution.test.ts`

**Interfaces:**
- Consumes: `resolveBinary('ffmpeg')` from `src/render/process.ts`
- Produces: Reliable PCM WAV synthesis without `spawn ffmpeg ENOENT`

- [ ] **Step 1: Write the failing/verification test**

```typescript
// test/audio/edge-tts-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { EdgeTtsEngine } from '../../src/audio/EdgeTtsEngine';
import { resolveBinary } from '../../src/render/process';

describe('EdgeTtsEngine FFmpeg Resolution', () => {
  it('resolves ffmpeg binary path from installer or environment', () => {
    const ffmpegPath = resolveBinary('ffmpeg');
    expect(ffmpegPath).toBeTruthy();
    expect(typeof ffmpegPath).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify**

Run: `npx vitest run test/audio/edge-tts-resolution.test.ts`
Expected: PASS or identifies resolution requirement.

- [ ] **Step 3: Update EdgeTtsEngine.ts**

Import `resolveBinary` from `../render/process` and pass the resolved path to `spawn(ffmpegBinary, ...)`.

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run test/audio/`
Expected: PASS

---

### Task 2: Dynamic N-Rounds & Configurable Timer in ChallengeCurator

**Files:**
- Modify: `src/challenge/types.ts`
- Modify: `src/challenge/ChallengeCurator.ts`
- Test: `test/challenge/ChallengeCurator.test.ts`

**Interfaces:**
- Consumes: `CurateOptions { totalRounds?: number; timerSeconds?: number }`
- Produces: `MultiRoundChallenge` with exact number of rounds and minimum 5.0s timer per round

- [ ] **Step 1: Write the failing test**

```typescript
// test/challenge/dynamic-rounds.test.ts
import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { ProductProvider } from '../../src/product/ProductProvider';

describe('Dynamic N-Rounds in ChallengeCurator', () => {
  const provider = new ProductProvider('products', { watch: false });
  const products = provider.getAll();
  const curator = new ChallengeCurator();

  it('supports 2 rounds with custom 6s timer', () => {
    const challenge = curator.curate(g9Definition, products, 42, {
      totalRounds: 2,
      timerSeconds: 6.0,
    });
    expect(challenge.rounds.length).toBe(2);
    expect(challenge.rounds[0]?.timerSeconds).toBe(6.0);
    expect(challenge.rounds[1]?.timerSeconds).toBe(6.0);
  });

  it('enforces minimum 5s timer constraint', () => {
    const challenge = curator.curate(g9Definition, products, 42, {
      totalRounds: 4,
      timerSeconds: 3.0, // should clamp to 5.0
    });
    expect(challenge.rounds.length).toBe(4);
    expect(challenge.rounds[0]?.timerSeconds).toBe(5.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/challenge/dynamic-rounds.test.ts`
Expected: FAIL (curate does not accept 4th argument or ignores dynamic rounds).

- [ ] **Step 3: Implement dynamic round count and timer override in ChallengeCurator**

Update `CurateOptions` interface and dynamically synthesize or slice round specs in `ChallengeCurator.curate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/challenge/dynamic-rounds.test.ts`
Expected: PASS

---

### Task 3: Instant Countdown Timeline in AllInOneScene

**Files:**
- Modify: `src/scene/AllInOneScene.ts`
- Test: `test/scene/AllInOneScene.test.ts`

**Interfaces:**
- Consumes: `MultiRoundChallenge` with $N$ rounds
- Produces: Instant timeline with `playDuration = round.timerSeconds` (no 2.5s delay)

- [ ] **Step 1: Write failing/updated test**

```typescript
// in test/scene/AllInOneScene.test.ts
it('generates an instant countdown timeline without 2.5s idle lag', () => {
  const scene = new AllInOneScene(mockChallenge); // timerSeconds = 5.0
  const timeline = scene.getTimeline();
  const round1Play = timeline.slots.find((s) => s.type === 'round_1_play');
  expect(round1Play).toBeDefined();
  expect(round1Play?.duration).toBe(5.0); // Exactly timerSeconds, no +2.5s
  expect(round1Play?.start).toBe(1.0); // Starts right after 1.0s intro hook
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/scene/AllInOneScene.test.ts`
Expected: FAIL (currently duration is timerSeconds + 2.5 = 7.5).

- [ ] **Step 3: Update AllInOneScene.ts**

Set `hook` duration to 1.0s, `playDuration = Math.max(5.0, round.timerSeconds)`, `revealDuration = 2.0s`, `microHookDuration = 0.5s`, `scorecard = 1.5s`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/scene/AllInOneScene.test.ts`
Expected: PASS

---

### Task 4: Instant Countdown Bar Animation in scenePainter

**Files:**
- Modify: `src/render/scenePainter.ts:1470-1485`
- Test: `test/render/multi-round-painter.test.ts`

**Interfaces:**
- Consumes: Canvas, `slot`, `timeSeconds`
- Produces: Smoothly decreasing countdown bar from $1.0 \to 0.0$ over `slot.duration` with zero freeze

- [ ] **Step 1: Write test for instant countdown progress**

```typescript
// in test/render/multi-round-painter.test.ts
it('decrements countdown immediately from the first frame of play phase', () => {
  const canvas = new Canvas(1080, 1920);
  // At timeSeconds = slot.start, remaining seconds must equal full slot duration
  // At timeSeconds = slot.start + 2.5, remaining seconds must equal slot.duration - 2.5
});
```

- [ ] **Step 2: Run test and inspect current behavior**

- [ ] **Step 3: Update paintMultiRoundFrame in scenePainter.ts**

Ensure `secondsRemaining = Math.max(0, slot.end - timeSeconds)` without any clamping against `round.timerSeconds`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render/multi-round-painter.test.ts`
Expected: PASS

---

### Task 5: Multi-Round Audio Synthesis (Voice + SFX + BGM)

**Files:**
- Create: `src/audio/MultiRoundAudioComposer.ts`
- Test: `test/audio/MultiRoundAudioComposer.test.ts`

**Interfaces:**
- Consumes: `MultiRoundChallenge`, `Timeline`, `rootDir`
- Produces: Mixed `audio.wav` with Voice TTS for each round, countdown ticking SFX, reveal impact, and ducked BGM

- [ ] **Step 1: Write unit test for MultiRoundAudioComposer**

```typescript
// test/audio/MultiRoundAudioComposer.test.ts
import { describe, it, expect } from 'vitest';
import { MultiRoundAudioComposer } from '../../src/audio/MultiRoundAudioComposer';

describe('MultiRoundAudioComposer', () => {
  it('schedules voice and sfx cues across all rounds', async () => {
    const composer = new MultiRoundAudioComposer();
    const cues = composer.planAudioCues(mockChallenge, mockTimeline);
    expect(cues.voiceSegments.length).toBe(mockChallenge.rounds.length);
    expect(cues.sfxCues.some(c => c.type === 'tick')).toBe(true);
    expect(cues.sfxCues.some(c => c.type === 'reveal')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/audio/MultiRoundAudioComposer.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement MultiRoundAudioComposer**

Implement audio synthesis orchestrator that:
1. Synthesizes Edge-TTS voice for each round's question (starting at `round_play.start + 0.1s`).
2. Adds accelerating countdown tick cues starting at `round_play.start` until `round_play.end`.
3. Adds reveal SFX at `round_reveal.start`.
4. Mixes into final audio WAV with BGM and auto-ducking.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/audio/MultiRoundAudioComposer.test.ts`
Expected: PASS

---

### Task 6: CLI Integration & End-to-End Pipeline

**Files:**
- Modify: `src/cli/render.ts`
- Test: `test/cli/multi-round-cli.test.ts`

**Interfaces:**
- Consumes: `--rounds <N>`, `--timer <seconds>`
- Produces: Multi-round video render with instant countdown and complete audio track

- [ ] **Step 1: Write CLI test for --rounds and --timer args**

```typescript
// test/cli/multi-round-cli.test.ts
import { describe, it, expect } from 'vitest';
import { parseRenderArgs } from '../../src/cli/render';

describe('Multi-Round CLI args parsing', () => {
  it('parses --rounds and --timer flags', () => {
    const args = parseRenderArgs(['node', 'cli', '--rounds', '4', '--timer', '6']);
    expect(args.rounds).toBe(4);
    expect(args.timer).toBe(6);
  });
});
```

- [ ] **Step 2: Update parseRenderArgs and runRenderCommand in render.ts**

Wire multi-round pipeline to trigger when `--rounds` is passed or `--mode multi` is set, connecting `MultiRoundAudioComposer`.

- [ ] **Step 3: Run full CLI tests**

Run: `npx vitest run test/cli/`
Expected: PASS

---

### Task 7: End-to-End Render & Verification

- [ ] **Step 1: Run all unit test suites**

Run: `npm test`
Expected: All tests pass 100%.

- [ ] **Step 2: Render sample 3-round video with 5s instant countdown**

Run: `npx tsx src/cli/index.ts render --mechanic guess_the_price --rounds 3 --timer 5 --seed 839271`
Expected: Exit code 0, generates MP4 video in `export/`.

- [ ] **Step 3: Verify video duration, audio sync, and instant countdown timing**

Check output MP4 duration and audio bed to confirm zero dead air.
