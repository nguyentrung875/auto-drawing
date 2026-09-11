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

- **[DF3] Scene-order not validated** — `src/validator/Validator.ts` (`validateSchema`)
  Validator kiểm tra scenes ⊆ 7 MVP + có countdown/reveal, nhưng không kiểm tra thứ tự
  chuẩn (`hook→product→question→countdown→reveal→result→cta`). Game JSON do LLM viết có
  scenes bị đảo thứ tự vẫn pass validation (tổng vẫn 18s) → video phát sai trình tự.
  Mechanics luôn sinh đúng thứ tự, chưa có path LLM-authored trong Epic 2 → để Epic 3
  (Scene System sở hữu scene sequencing) xử lý.

- **[DF4] `test/lint/dependency-rule.test.ts` failing (pre-existing)** — test "flags queue
  importing render" đang fail (`errorCount 0`) — đã xác minh fail y hệt tại parent commit
  `c4d463c` (Epic 1), không do Epic 2 gây ra. `import/no-restricted-paths` không trigger
  khi dùng `ESLint.lintText` với file không tồn tại trên disk. Cần sửa ở Epic 1 backlog.
