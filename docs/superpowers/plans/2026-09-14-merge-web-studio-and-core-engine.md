# Merge Web Studio & Core Game Video Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Next.js Web Studio from `ai-game-video-engine_claude4.6` with the Core Engine in `src/`, replacing PostgreSQL with Local-first file queues, establishing a Unified Isomorphic Canvas Renderer, and completing the P0 game triad (G1 Most Expensive, G2 Higher or Lower, G3 Odd One Out).

**Architecture:** Monorepo with Core Engine at root (`src/`, `bin/game.js`) and Web Studio in `studio/`. A unified Canvas 2D Painter is shared between browser preview (`<canvas>`) and Node.js video frame generation (PNG sequence -> FFmpeg -> MP4). All persistence is local-first file-based (`queue/`, `export/`, `logs/`).

**Tech Stack:** Node.js (>=22.12), TypeScript, Next.js 16, React 19, Tailwind CSS, Canvas 2D / Software Rasterizer, FFmpeg, Vitest, Zod, Seedrandom.

**Spec:** [`docs/superpowers/specs/2026-09-14-merge-web-studio-and-core-engine-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-14-merge-web-studio-and-core-engine-design.md)

## Global Constraints
- Zero PostgreSQL: Remove `pg`, `drizzle-orm`, `drizzle-kit` completely.
- Local-first 100%: File-based queues in `queue/`, videos in `export/`, logs in `logs/`.
- Single Source of Truth for Visuals: Browser Preview and MP4 Renderer must use the exact same Canvas layout and painting logic.
- Semantic Control: LLM only generates content; Engine controls layout, typography, and geometry.
- Preserve 100% existing Core Engine tests (all 38 test suites in `test/` must pass).

---

### Task 1: Scaffold `studio/` & Remove PostgreSQL Dependencies

**Files:**
- Create: `studio/` (migrated from `ai-game-video-engine_claude4.6`)
- Modify: `studio/package.json`
- Delete: `studio/src/db/`
- Modify: Root `package.json`

**Interfaces:**
- Consumes: `ai-game-video-engine_claude4.6/` source code
- Produces: Cleaned `studio/` directory with root scripts `npm run studio:dev`, `npm run studio:build`

- [ ] **Step 1: Copy `ai-game-video-engine_claude4.6` to `studio/` (excluding node_modules & .next)**
- [ ] **Step 2: Clean `studio/package.json` to remove `pg`, `drizzle-orm`, `drizzle-kit`, `dotenv`**
- [ ] **Step 3: Delete `studio/src/db` and `studio/drizzle.config.json`**
- [ ] **Step 4: Add convenience scripts to root `package.json` (`studio:dev`, `studio:build`)**
- [ ] **Step 5: Run `npm install` in `studio/` and verify it installs cleanly**

---

### Task 2: Implement G3 (Odd One Out Mechanic) in Core Engine

**Files:**
- Create: `src/game/mechanics/OddOneOutMechanic.ts`
- Modify: `src/game/mechanics/index.ts`
- Modify: `src/types/game.ts`
- Test: `test/engine/mechanics.test.ts`

**Interfaces:**
- Consumes: `IMechanic`, `MechanicInput`, `ProductCard`, `layoutCards`
- Produces: `MechanicRegistry.get('ODD_ONE_OUT')` producing valid 4-card gameplay

- [ ] **Step 1: Add failing test for `OddOneOutMechanic` in `test/engine/mechanics.test.ts`**
- [ ] **Step 2: Add `'ODD_ONE_OUT'` to `Mechanic` enum in `src/types/game.ts`**
- [ ] **Step 3: Implement `OddOneOutMechanic` with 3-in-cluster + 1-outlier logic**
- [ ] **Step 4: Register `OddOneOutMechanic` in `src/game/mechanics/index.ts`**
- [ ] **Step 5: Run tests (`npm test`) and confirm all tests pass**

---

### Task 3: Unified Isomorphic Canvas Painter & Layout Contract

**Files:**
- Modify: `src/render/scenePainter.ts`
- Create: `src/render/isomorphicPainter.ts` (exportable functions for both Node Canvas and Browser Canvas)
- Test: `test/render/scenePainter.test.ts`

**Interfaces:**
- Consumes: `CanvasRenderingContext2D | Canvas`, `RenderFrame`, `PaintContext`
- Produces: `drawSceneFrame(ctx, frameData)` working identically in browser and Node

- [ ] **Step 1: Write test verifying `scenePainter` can render all 7 scenes for G1, G2, G3**
- [ ] **Step 2: Refactor `scenePainter.ts` to expose unified draw routines compatible with standard Canvas 2D**
- [ ] **Step 3: Add auto-fit typography scaling for variable question lengths**
- [ ] **Step 4: Verify frame rendering pipeline still passes `test/render/RenderEngine.test.ts`**

---

### Task 4: Replace DOM Mockup with `<CanvasPreview />` in Web Studio

**Files:**
- Create: `studio/src/components/CanvasPreview.tsx`
- Modify: `studio/src/components/GamePreview.tsx`
- Modify: `studio/src/app/studio/page.tsx`

**Interfaces:**
- Consumes: `GameJson`, `Timeline`, `drawSceneFrame`
- Produces: Realtime 60fps HTML5 Canvas preview + Video Player switch for MP4

- [ ] **Step 1: Implement `CanvasPreview.tsx` mounting a 1080x1920 `<canvas>` scaled via CSS to phone frame**
- [ ] **Step 2: Add animation loop (`requestAnimationFrame`) with Play, Pause, Scrub timeline controls**
- [ ] **Step 3: Integrate `drawSceneFrame` so canvas draws identical frames to the backend**
- [ ] **Step 4: Add HTML5 `<video>` player tab to play the exported MP4 once generated**

---

### Task 5: Refactor Studio API Routes to Local-First File Storage

**Files:**
- Modify: `studio/src/app/api/products/route.ts`
- Modify: `studio/src/app/api/games/route.ts`
- Modify: `studio/src/app/api/batch/route.ts`
- Modify: `studio/src/app/page.tsx` (Dashboard stats reading from `logs/` and `export/`)
- Modify: `studio/src/app/batch/page.tsx`

**Interfaces:**
- Consumes: Local files in `queue/`, `export/`, `logs/`, and `src/product/ProductProvider`
- Produces: Zero-database REST endpoints for Studio

- [ ] **Step 1: Rewrite `/api/products` to read 50 SKU mock directly without database**
- [ ] **Step 2: Rewrite `/api/games` to trigger `GameEngine.build(...)` and `RenderEngine.render(...)`**
- [ ] **Step 3: Rewrite `/api/batch` to create file jobs in `queue/*.json` and report stats**
- [ ] **Step 4: Update Dashboard and Batch pages to remove any SQL/Drizzle queries**
- [ ] **Step 5: Verify all pages in `studio/` load without database errors**

---

### Task 6: End-to-End System Verification

**Files:**
- Modify: `README.md`
- Test: All vitest suites + CLI + Web Studio

- [ ] **Step 1: Run full Core Engine test suite: `npm test`**
- [ ] **Step 2: Test CLI Single Render: `node bin/game.js render --mechanic hi_lo --seed 1001`**
- [ ] **Step 3: Test CLI Batch Render: `node bin/game.js batch --count 3 --mechanics hi_lo,most_expensive,odd_one_out`**
- [ ] **Step 4: Launch Web Studio (`npm run studio:dev`) and test full UI flow**
- [ ] **Step 5: Update documentation in `README.md` with system overview and running instructions**
