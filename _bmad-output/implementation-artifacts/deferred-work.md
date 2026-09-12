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

- **[DF8] No real Vietnamese voice in this environment** — `src/audio/AudioEngine.ts`.
  `ViPiperEngine` now actually invokes Piper (`PIPER_PATH` → `piper` on PATH, model from
  `PIPER_VOICE` → `assets/voices/vi_VN.onnx`) and only falls back to a silent placeholder
  WAV when the binary or the model is absent — reporting `W_VOICE_SILENT_STUB` on the job
  log when it does. Piper is *not* installed here, so local renders are still mute; that
  is now visible instead of silent. Installing Piper + a `vi_VN` model turns narration on
  with no code change. Previously this gap was undocumented, which is why FR-9 looked
  satisfied while every MP4 had no voice (measured `mean_volume -37.9 dB`, music bed only).

- **[DF9] Product images are still absent** — there is no `assets/` directory and no seed
  script, so every ProductCard renders the deterministic `P0xx` placeholder and
  `W_ASSET_PLACEHOLDER` fires on 100% of jobs. The asset *check* no longer disables itself
  silently (see below), but real imagery is still outstanding. `W_ASSET_PLACEHOLDER` and
  `W_MUSIC_MISSING` remain always-on until assets land; treat them as environment state,
  not per-job signal, when reading `batch_report.json`.
