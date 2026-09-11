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
