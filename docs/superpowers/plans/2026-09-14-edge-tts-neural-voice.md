# Edge-TTS Vietnamese Neural Voice Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Microsoft Edge Neural TTS (`vi-VN-HoaiMyNeural`) as the primary high-fidelity Vietnamese voiceover engine across Core Engine CLI and Web Studio rendering, replacing the robotic formant fallback with human-like audio.

**Architecture:** Add `msedge-tts` client and wrap it inside `EdgeTtsEngine implements IAudioEngine`. The engine streams lossless PCM audio (`OUTPUT_FORMAT.RIFF_24KHZ_16BIT_MONO_PCM`) directly to disk in `auto-drawing-audio/voice-edge-<hash>.wav`, caches by script hash, calculates accurate RIFF durations, and provides automatic fallback to `FormantViEngine` if offline. `AudioEngine` adopts `EdgeTtsEngine` as its default voice adapter.

**Tech Stack:** Node.js 22+, TypeScript 5.7, `msedge-tts` (v1.4+), Vitest.

## Global Constraints

- Never break existing 43 test files (239 tests) in the repository.
- Audio output format must remain standard RIFF/WAVE PCM mono for seamless FFmpeg audio bed mixing.
- Deterministic caching: repeated scripts must resolve from disk in 0ms with zero network requests.
- Graceful degradation: if network is unavailable or timeout exceeds 10s, fall back to `FormantViEngine` rather than failing.

---

### Task 1: Add `msedge-tts` Dependency & Implement `EdgeTtsEngine`

**Files:**
- Modify: `package.json`
- Create: `src/audio/EdgeTtsEngine.ts`
- Test: `test/audio/EdgeTtsEngine.test.ts`

**Interfaces:**
- Consumes: `IAudioEngine`, `VoiceResult`, `VoiceOptions` from `src/audio/types.ts`
- Produces: `EdgeTtsEngine` class implementing `IAudioEngine`

- [ ] **Step 1: Install `msedge-tts`**
  ```bash
  npm install msedge-tts
  ```

- [ ] **Step 2: Write the unit test in `test/audio/EdgeTtsEngine.test.ts`**
  - Test synthesis of `"Thử thách 5 giây đoán giá"` returns a valid `.wav` file with duration > 0.
  - Test second synthesis with same script hits cache and returns same path without network call.
  - Test fallback to `FormantViEngine` when network error occurs or offline mode is simulated.

- [ ] **Step 3: Run test to verify it fails**
  ```bash
  npx vitest run test/audio/EdgeTtsEngine.test.ts
  ```
  Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/audio/EdgeTtsEngine.ts`**
  - Import `MsEdgeTTS`, `OUTPUT_FORMAT` from `msedge-tts`.
  - Normalize script and calculate SHA-256 cache key: `sha256(voice + ":" + normalizedScript).slice(0, 16)`.
  - Check cache existence: if file exists and `size > 44`, return cached `{ voiceWavPath, duration }`.
  - If cache miss, initialize `new MsEdgeTTS()`, set metadata (`vi-VN-HoaiMyNeural`, `RIFF_24KHZ_16BIT_MONO_PCM`), invoke `toFile()`, and compute duration via RIFF header byteRate.
  - Wrap in try/catch with 10s timeout; on failure invoke `FormantViEngine` as graceful fallback.

- [ ] **Step 5: Run test to verify it passes**
  ```bash
  npx vitest run test/audio/EdgeTtsEngine.test.ts
  ```
  Expected: PASS.

- [ ] **Step 6: Commit Task 1**
  ```bash
  git add package.json package-lock.json src/audio/EdgeTtsEngine.ts test/audio/EdgeTtsEngine.test.ts
  git commit -m "feat(audio): implement EdgeTtsEngine for Vietnamese neural voice synthesis"
  ```

---

### Task 2: Wire `EdgeTtsEngine` into `AudioEngine` & Core Audio Barrel

**Files:**
- Modify: `src/audio/AudioEngine.ts`
- Modify: `src/audio/index.ts`
- Test: `test/audio/AudioEngine.test.ts`

**Interfaces:**
- Consumes: `EdgeTtsEngine` from `src/audio/EdgeTtsEngine.ts`
- Produces: `AudioEngine` using `EdgeTtsEngine` as default adapter

- [ ] **Step 1: Update `src/audio/AudioEngine.ts`**
  - Import `EdgeTtsEngine` from `./EdgeTtsEngine`.
  - Update `AudioEngine` constructor default parameter: `constructor(adapter: IAudioEngine = new EdgeTtsEngine())`.
  - Update `synthesize()` helper default parameter: `adapter: IAudioEngine = new EdgeTtsEngine()`.

- [ ] **Step 2: Update `src/audio/index.ts`**
  - Export `EdgeTtsEngine` and `EdgeTtsOptions`.

- [ ] **Step 3: Run all audio tests**
  ```bash
  npx vitest run test/audio/
  ```
  Expected: All audio test suites pass.

- [ ] **Step 4: Verify TypeScript compilation**
  ```bash
  npm run build
  ```
  Expected: PASS (0 errors).

- [ ] **Step 5: Commit Task 2**
  ```bash
  git add src/audio/AudioEngine.ts src/audio/index.ts
  git commit -m "feat(audio): set EdgeTtsEngine as default voice adapter in AudioEngine"
  ```

---

### Task 3: End-to-End Verification Across CLI & Web Studio

**Files:**
- Verification only

- [ ] **Step 1: Execute CLI render with Edge-TTS voice**
  ```bash
  node bin/game.js render --mechanic hi_lo --products p001,p042 --seed 998877
  ```
  - Verify `export/hi_lo_998877_998877.mp4` is created with audio track.
  - Verify voice narration uses `vi-VN-HoaiMyNeural` with clear natural pronunciation.

- [ ] **Step 2: Run all vitest suites across repository**
  ```bash
  npx vitest run
  ```
  Expected: All test suites pass.

- [ ] **Step 3: Update walkthrough documentation**
  - Document Edge-TTS integration, audio quality comparison, and instructions.
