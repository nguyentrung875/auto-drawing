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

- **[DF6] `metadata.mechanic` vs `gameplay.mechanic` (still DF1)** — no Epic 4 change; the
  CLI derives both from the same `--mechanic` flag, so the mismatch can only be authored
  by hand in a `--game` JSON file. Revisit with the Hermes error vocabulary (DF2).

- **[DF7] Batch retry policy** — FR-11 mentions "retry 3×" for the batch. Epic 4 implements
  the LLM-stub retry (3 attempts on malformed JSON, per the 4.3 AC) and records
  `attempts`/`retries` per job; a render-stage retry (e.g. re-run once after
  `E_ENCODE_FAILED`) is deliberately not automatic — a failed job is logged and the batch
  fails forward. Consider a bounded retry when real overnight failure data exists.
