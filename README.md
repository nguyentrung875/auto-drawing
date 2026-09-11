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

## Epic 2: Game Engine ✅

- [x] Story 2.1 — Two-Layer Validator (`src/validator/Validator.ts`): Schema + Game Logic,
      `code/field/hint`, <200ms, warning `W_AFFILIATE_MISSING` không block (AD-4)
- [x] Story 2.2 — Deterministic Answer & Timeline (`src/game/GameEngine.ts` + `src/game/rng.ts`),
      timeline 18.0s (countdown 3.0s / reveal 2.0s), `E_TIMELINE_DRIFT`, seedrandom bắt buộc
- [x] Story 2.3 — HI_LO (BOOLEAN) → `answer: higher|lower`, `E_HILO_EQUAL_PRICE` khi delta <5%
- [x] Story 2.4 — MOST_EXPENSIVE (MULTIPLE_CHOICE) 3–4 cards, `E_MOST_EXPENSIVE_TIE` khi top2 <2%
- [x] Story 2.5 — ONE_AWAY (DIGIT) `189,?00`, options delta 1 seeded, `DigitReveal`

## Epic 3: Scene & Audio ✅

- [x] Story 3.1 — `src/scene/`: seven renderer-neutral scenes, deterministic frame model,
      `PriceReveal`/`DigitReveal`, ProductCard layout and Result `in_video`/`comment` variants
- [x] Story 3.2 — `src/audio/`: `IAudioEngine`, offline `ViPiperEngine` WAV stub,
      six countdown cues at 0.5s, reveal sync and `E_AUDIO_MISSING_SFX`
- [x] Story 3.3 — `src/preview/`: autoplay HTML preview at 1080×1920, CLI `game render --preview`,
      and CommonJS compatibility for the original spike runner

```bash
game render --mechanic hi_lo --products p001,p042 --seed 839271 --preview
node spike/universal-game-demo/src/run_spike.js
```

```bash
game plan --mechanic hi_lo --products p001,p002 --seed 839271
game plan --mechanic most_expensive --products p001,p015,p028 --seed 839272
game plan --mechanic one_away --products p001 --seed 839273 --hidden-index 3
```

`game plan` chạy hết pipeline Epic 2 (Provider → Mechanic → Validator 2 tầng → Engine)
và in JSON `{answer, timeline, revealType, diversification, game, sceneData}`;
lỗi → exit 1 + `{"code","field","hint"}`.

## Cấu trúc (modular monolith)

```
src/
├── game/        # Game JSON schema (zod v1) + GameLoader + GameEngine + mechanics/ + rng
├── product/     # ProductProvider — 50 SKU files, cache, atomic write, FS watch
├── validator/   # Two-layer validation (Validator.ts) — Epic 2
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
