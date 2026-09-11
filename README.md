# auto-drawing — Universal AI Game Video Engine

Modular monolith (TypeScript, Node.js ≥22) sinh video game ngắn 1080×1920 cho
TikTok/Shopee affiliate: khai báo **Universal Game JSON** → Validator 2 tầng →
Game Engine (answer/timeline deterministic) → 7 scenes → Audio → Render MP4.
100% local-first, MIT/Apache stack, cost ~0đ/video.

> **Pivot:** PRD `prd-universal-game-engine-2026-09-11` supersede PRD
> `prd-auto-drawing-2026-09-04-v2` (Drawing Transformation). Repo này chỉ build
> Game Video Engine.

## Trạng thái hiện tại — Epic 1: Foundation ✅

- [x] Story 1.1 — Project Scaffolding & Modular Monolith Structure
- [x] Story 1.2 — Universal Game JSON Schema & Versioning (`src/game/schema.ts` + `GameLoader`)
- [x] Story 1.3 — ProductProvider 50 files (`products/pXXX.json`, atomic write, FS watch) + CLI `game products list`

## Cấu trúc (modular monolith)

```
src/
├── game/        # Game JSON schema (zod v1) + GameLoader
├── product/     # ProductProvider — 50 SKU files, cache, atomic write, FS watch
├── validator/   # (Epic 2) two-layer validation
├── scene/       # (Epic 3) 7 reusable scenes
├── audio/       # (Epic 3) viPiper + SFX
├── render/      # (Epic 4) Motion Canvas → FFmpeg
├── queue/       # (Epic 4) file-based job queue
├── observability/ # (Epic 4) logs + batch_report
├── types/       # shared types (GameJson, …)
├── utils/       # format helpers
└── cli/         # `game` CLI entry
products/        # 50 mock SKU files p001.json … p050.json
games/           # sample Game JSON (hi_lo.json)
```

**Dependency rule (enforced by `eslint import/no-restricted-paths`):**

```
queue → validator → game → {audio, scene} → render → observability
```

## Commands

```bash
npm install
npm run build          # tsc --noEmit (strict)
npm test               # vitest
npm run lint           # eslint (dependency rule)
npm run products:list  # = game products list
node bin/game.js products list
```

## Planning artifacts

Kế hoạch đầy đủ trong `_bmad-output/planning-artifacts/` (PRD, Architecture,
Epics). Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`.
