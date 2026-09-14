# Deferred Work Ledger

## Deferred from: code review of Epic 1 (Foundation) (2026-09-11)

- **[DF1] Cross-check `metadata.mechanic` vs `gameplay.mechanic`** — `src/game/schema.ts`
  Zod schema hiện chấp nhận `metadata.mechanic='HI_LO'` + `gameplay.mechanic='MOST_EXPENSIVE'`
  cùng lúc (không cross-check). Thuộc game-logic layer → xử lý ở Epic 2 (Story 2.1 Two-Layer
  Validator), không thuộc phạm vi Epic 1.

- **[DF2] Error vocabulary cho "invalid value"** — `src/game/GameLoader.ts` (`toSchemaError`)
  Mọi zod issue (enum sai, type sai, số không nguyên) hiện đều map về `E_SCHEMA_MISSING_FIELD`
  (hint vẫn chính xác). Bảng lỗi PRD/addendum §4 chưa định nghĩa code riêng cho "invalid value"
  → cân nhắc khi chuẩn hóa vocabulary với Hermes.

## Deferred from: code review of Epic 2 (Game Engine) (2026-09-11)

- **[DF3] RESOLVED in Epic 3** — `Validator.validateSchema` now rejects a non-canonical
  scene order with `E_SCHEMA_SCENE_INVALID`, and `SceneSystem` validates the same sequence
  before creating frames. The renderer cannot silently play a reordered scene list.

- **[DF4] RESOLVED in Epic 3** — the dependency-rule test now checks virtual `lintText`
  paths through the same `import/no-restricted-paths` rule id, so queue → render violations
  are reported in both editor/CI lint and the test harness.

## Deferred from: Epic 4 self-review (2026-09-12)

- **[DF5] Motion Canvas headless backend not installed** — `src/render/RenderEngine.ts`
  resolves the frame stage through the AD-8 contract and currently always lands on the
  built-in software rasteriser; when `config.frameRenderer = 'motion-canvas'` the render
  still succeeds and records `W_RENDERER_FALLBACK` in the job warnings. Swapping in the
  real `@motion-canvas/2d` headless backend is a drop-in `IFrameRenderer` implementation
  (no queue/CLI change) and should be re-measured against the 45s budget when adopted.

- **[DF6] RESOLVED** — `metadata.mechanic` vs `gameplay.mechanic` (carried from DF1).
  `Validator.validateSchema` rejects the mismatch with `E_SCHEMA_MISSING_FIELD` at
  `gameplay.mechanic`, and additionally cross-checks `gameplay.interaction` against the
  mechanic. Confirmed 2026-09-12 by mutating a computed HI_LO game to
  `gameplay.mechanic = 'MOST_EXPENSIVE'` and observing the rejection. Only DF2 (a
  dedicated "invalid value" code) is still open from that thread.

- **[DF7] Batch retry policy** — FR-11 mentions "retry 3×" for the batch. Epic 4 implements
  the LLM-stub retry (3 attempts on malformed JSON, per the 4.3 AC) and records
  `attempts`/`retries` per job; a render-stage retry (e.g. re-run once after
  `E_ENCODE_FAILED`) is deliberately not automatic — a failed job is logged and the batch
  fails forward. Consider a bounded retry when real overnight failure data exists.

## Raised by the party-mode review of all four epics (2026-09-12)

Four defects were found by inspecting rendered frames and audio rather than scene data;
all four are fixed in this change. The residual, genuinely-deferred work is below.

- **[DF8] PARTIALLY RESOLVED — narration is audible, but not neural** —
  `src/audio/AudioEngine.ts`, `src/audio/FormantViEngine.ts`.
  The adapter now degrades in three ordered steps instead of jumping to silence:
  **Piper** (`PIPER_PATH` → `piper` on PATH, model from `PIPER_VOICE` →
  `assets/voices/vi_VN.onnx`) → **`FormantViEngine`**, a built-in deterministic Vietnamese
  formant synthesiser that really speaks the script, reporting
  `W_VOICE_FORMANT_FALLBACK` → **silent WAV** (`W_VOICE_SILENT_STUB`) only if the formant
  voice itself throws. Measured after the change: the voice clip carries 36,764 non-zero
  PCM frames at 82% peak, where it was 100% zeros before.
  The formant voice is a source-filter model (3 formants + the six Vietnamese tone
  contours + onset bursts/nasal codas). It is intelligible-ish and robotic — **good enough
  that a render is never mute, not good enough to publish**. Piper remains the intended
  production voice and is still preferred automatically when installed.
  *Why not just install Piper:* this sandbox can only reach `registry.npmjs.org` and
  `api.github.com`; GitHub release assets (`objects.githubusercontent.com`), Hugging Face
  and `raw.githubusercontent.com` all fail TLS, there is no root for `apt-get`, and npm
  publishes only browser/WASM Piper builds. Installing Piper + a `vi_VN` model on a
  networked machine upgrades the voice with **no code change**.

- **[DF9] RESOLVED (2026-09-12)** — `scripts/generate-assets.mjs`, `npm run assets:generate`.
  A deterministic offline generator now produces the full asset pack: 50 product PNGs
  (512×512, hue per category, motif + vignette, seeded by FNV-1a over the product id — no
  `Math.random()`, so AR-10 holds and reruns are byte-identical), 6 SFX WAVs and 3 loopable
  music beds (partials rounded to whole cycles so the loop seam does not click). 5.4 MB total.
  SKU `image` fields were migrated `.webp` → `.png` because `isRenderableImage()` only
  decodes PNG — that mismatch, not a missing directory, was the real cause of
  `W_ASSET_PLACEHOLDER` firing on 100% of jobs.
  Effect on a `hi_lo p001,p042 --seed 839271` render: job warnings dropped from 4
  (`W_ASSETS_DIR_MISSING`, `W_VOICE_SILENT_STUB`, `W_MUSIC_MISSING`, `W_ASSET_PLACEHOLDER`)
  to 1 (`W_VOICE_FORMANT_FALLBACK`), and the mix went from `mean_volume -37.9 dB` (music
  synth only) to **mean −28.9 dB / max −5.1 dB**.
  `assets/` stays git-ignored; the generator is the reproduction mechanism. These are
  *synthetic* placeholder images — real product photography is a content task, not a code one.

## Raised by the Epics 1–4 retrospective (2026-09-12)

- **[DF10] RESOLVED (2026-09-12)** — `src/observability/BatchReporter.ts`.
  `formatSummary` printed only `avg_render_ms` (~6.4–7.9s), omitting encode
  (~9.5s), so the figure everyone quoted as "cost per video" understated it by
  more than half. The summary now also prints `avg_job <n>s wall-clock`
  (duration / job count). Measured truth: ~17–19s per video, 15m42s for 50.

- **[DF11] No end-to-end viewer review step** — process, not code.
  The frozen-countdown defect (ring animating while the digit sat on "3" for the
  whole scene) was found by tiling a whole video into a contact sheet and looking
  at it, not by any test. `layoutScan` now covers static layout, but pacing,
  animation continuity and "is this watchable" remain unverified by automation.
  Recommend a contact-sheet spot-check of at least one video per mechanic before
  publishing a batch:
  `ffmpeg -i <mp4> -vf "fps=12/18,scale=270:-1,tile=4x3" -frames:v 1 sheet.png`
