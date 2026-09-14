# Web Studio Preview & Video Renderer Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize Web Studio preview with the Core Engine video renderer to achieve 100% bit-for-bit WYSIWYG parity, sharing `generateRenderHtml` as the single source of truth for both browser preview and Puppeteer MP4 frame capture.

**Architecture:** A lightweight API endpoint (`POST /api/preview/html`) takes the authored `GameJson` and generates the identical 1080×1920 HTML/CSS document that Puppeteer uses for video rendering. The frontend displays this template inside a sandboxed viewport scaled down (`scale: 0.259`) to fit the phone mockup, directly binding the timeline scrubber to `window.__SEEK_FRAME__(frame, timeSec)`. A fullscreen modal allows previewing in full size.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, HTML5 Iframe Viewport.

## Global Constraints

- **Single Source of Truth:** Giao diện xem trước và Video MP4 PHẢI sử dụng chung mã HTML/CSS từ `generateRenderHtml()`. Tuyệt đối không viết thêm một bộ CSS/DOM song song.
- **Immediate Zero-Latency Rendering:** Toàn bộ ảnh sản phẩm nhúng Base64 để tải tức thì 0ms bên trong iframe.
- **Resilient Scrubbing:** Kéo thanh trượt timeline chỉ gọi `__SEEK_FRAME__` trực tiếp trong RAM, không reload lại iframe hoặc gửi lại HTTP request.

---

### Task 1: Backend Preview HTML Endpoint `POST /api/preview/html`

**Files:**
- Create: `studio/src/app/api/preview/html/route.ts`
- Test: `studio/test/api/preview-html.test.ts`

**Interfaces:**
- Consumes: `{ game: GameJson }`
- Produces: `text/html; charset=utf-8` response with complete 1080×1920 render document.

- [ ] **Step 1: Write failing test in `studio/test/api/preview-html.test.ts`**
  - Verify 400 when `game` is missing in body.
  - Verify 200 and `text/html` response containing `<div id="stage">` and `__SEEK_FRAME__` when valid `game` is provided.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run studio/test/api/preview-html.test.ts`
  - Expected: FAIL (route not found).

- [ ] **Step 3: Implement `studio/src/app/api/preview/html/route.ts`**
  - Extract `game` from body.
  - Load product details (image base64, price, brand) using `ProductProvider` or `MOCK_PRODUCTS`.
  - Build `RenderInput` and call `generateRenderHtml(renderInput)` from `src/render/template/renderTemplate.ts`.
  - Return `new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run studio/test/api/preview-html.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit Task 1**
  ```bash
  git add studio/src/app/api/preview/html/route.ts studio/test/api/preview-html.test.ts
  git commit -m "feat(studio): add POST /api/preview/html for shared video template preview"
  ```

---

### Task 2: Frontend Unified Viewport Component

**Files:**
- Create: `studio/src/components/UnifiedViewport.tsx`
- Modify: `studio/src/components/GamePreview.tsx`

**Interfaces:**
- Consumes: `game: GameJson`, `currentTime: number`, `isPlaying: boolean`, `totalDuration: number`
- Produces: 9:16 responsive smartphone viewport with embedded scaled iframe, zero visual discrepancy with MP4.

- [ ] **Step 1: Create `UnifiedViewport.tsx`**
  - Fetch HTML from `/api/preview/html` whenever `game` changes.
  - Mount scaled iframe (`width: 1080px; height: 1920px; transform: scale(0.259259); transformOrigin: top left`).
  - Sync `currentTime` to `iframeRef.current.contentWindow.__SEEK_FRAME__(0, currentTime)`.

- [ ] **Step 2: Replace `VideoPreview` DOM mock inside `GamePreview.tsx`**
  - Replace the old custom React divs in `VideoPreview` with `UnifiedViewport`.
  - Keep timeline scrubber and play/pause controls.

- [ ] **Step 3: Verify TypeScript compilation**
  - Run: `npm --prefix studio run typecheck`
  - Expected: PASS with 0 errors.

- [ ] **Step 4: Commit Task 2**
  ```bash
  git add studio/src/components/UnifiedViewport.tsx studio/src/components/GamePreview.tsx
  git commit -m "feat(studio): replace DOM mockup with UnifiedViewport for 100% WYSIWYG preview"
  ```

---

### Task 3: Fullscreen Modal & Polish

**Files:**
- Modify: `studio/src/components/UnifiedViewport.tsx`
- Modify: `studio/src/components/GamePreview.tsx`

**Interfaces:**
- Consumes: User click on "⛶ Soi chi tiết"
- Produces: Modal overlay displaying the 1080×1920 template scaled to viewport height for inspecting visual details.

- [ ] **Step 1: Add Fullscreen button and Modal dialog**
  - Add "⛶ Soi chi tiết" button in preview toolbar.
  - Render modal with backdrop blur and enlarged 9:16 preview.

- [ ] **Step 2: Verify production build**
  - Run: `npm run studio:build`
  - Expected: PASS with 0 errors.

- [ ] **Step 3: Commit Task 3**
  ```bash
  git add studio/src/components/UnifiedViewport.tsx studio/src/components/GamePreview.tsx
  git commit -m "feat(studio): add fullscreen detail inspection modal"
  ```

---

### Task 4: End-to-End Verification

**Files:**
- Manual & automated verification

- [ ] **Step 1: Run all test suites**
  - Run: `npx vitest run studio/test/api/`
  - Expected: All pass.

- [ ] **Step 2: Verify side-by-side parity**
  - Open `http://localhost:3000/studio`.
  - Compare "🎮 Mô phỏng" tab vs "🎥 Video Thật" tab.
  - Confirm glowing orbs, product cards, SVG countdown ring, and typography are 100% identical.
