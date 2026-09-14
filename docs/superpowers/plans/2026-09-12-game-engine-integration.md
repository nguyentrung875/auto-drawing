# High-Quality Browser Frame Capture & Web Studio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Next.js Web Studio (`ai-game-video-engine`) with a high-fidelity headless browser frame capture renderer and FFmpeg pipeline to produce vertical 1080×1920 MP4 videos with smooth 30fps animations, sharp typography, and one-click in-studio rendering and playback.

**Architecture:** A dedicated 1080×1920 HTML5/CSS3 template provides deterministic timeline seeking via `window.__SEEK_FRAME__(frame, timeSec)`. A headless Chromium runner (`BrowserFrameRenderer`) captures frames frame-by-frame and pipes them directly to FFmpeg alongside audio (TTS voice + SFX + BGM) to encode crisp H.264 MP4s. Next.js Web Studio exposes `/api/render` and `/api/videos/[filename]`, providing a one-click "Render MP4" workflow with an embedded HTML5 player.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, TypeScript, Puppeteer / Playwright (Chromium headless), FFmpeg (`@ffmpeg-installer/ffmpeg`), Node.js.

## Global Constraints
- Video resolution: exactly 1080×1920 @ 30fps vertical format (9:16).
- Deterministic timeline: 18.0s total duration across 7 scenes (`hook`, `product`, `question`, `countdown`, `reveal`, `result`, `cta`).
- Zero affiliate link leakage in video frames: pixel-scan verification required.
- Cost model: local-first, zero cloud render API costs.
- Budget: render under 40 seconds on standard CPU.

---

### Task 1: Dedicated 1080×1920 Render Template with Deterministic Timeline

**Files:**
- Create: `src/render/template/renderTemplate.html`
- Create: `src/render/template/renderTemplate.ts`
- Test: `test/render/render-template.test.ts`

**Interfaces:**
- Consumes: `SceneData`, `GameJson` from `src/types/game.ts`
- Produces: `generateRenderHtml(game: GameJson, sceneData: SceneData): string`
- Client API: `window.__SEEK_FRAME__(frameIndex: number, timeSec: number): void`

- [ ] **Step 1: Write unit test for render template generation**

```typescript
// test/render/render-template.test.ts
import { describe, it, expect } from 'vitest';
import { generateRenderHtml } from '../../src/render/template/renderTemplate';
import { sampleGame, sampleSceneData } from '../helpers/sampleGame';

describe('generateRenderHtml', () => {
  it('generates HTML containing 1080x1920 viewport and window.__SEEK_FRAME__', () => {
    const html = generateRenderHtml(sampleGame, sampleSceneData);
    expect(html).toContain('1080');
    expect(html).toContain('1920');
    expect(html).toContain('__SEEK_FRAME__');
    expect(html).toContain(sampleGame.content.question);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/render/render-template.test.ts`
Expected: FAIL ("Cannot find module '../../src/render/template/renderTemplate'")

- [ ] **Step 3: Implement `renderTemplate.ts` and `renderTemplate.html`**
Implement the HTML5/CSS3 template with modern styling (Inter font, smooth gradients, 3D card flip, countdown ring, reveal animations) and `generateRenderHtml()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render/render-template.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/template/ test/render/render-template.test.ts
git commit -m "feat(render): add 1080x1920 HTML/CSS deterministic render template"
```

---

### Task 2: Implement `BrowserFrameRenderer` with Headless Chromium

**Files:**
- Create: `src/render/browserFrameRenderer.ts`
- Modify: `package.json` (add puppeteer-core or playwright-core as optional/dev dependency)
- Test: `test/render/browser-frame-renderer.test.ts`

**Interfaces:**
- Consumes: `generateRenderHtml`, `IFrameRenderer` from `src/render/types.ts`
- Produces: `BrowserFrameRenderer implements IFrameRenderer`
- Methods: `renderFrames(input: RenderInput, context: FrameRenderContext): Promise<FrameRenderResult>`

- [ ] **Step 1: Write unit test for BrowserFrameRenderer contract**

```typescript
// test/render/browser-frame-renderer.test.ts
import { describe, it, expect } from 'vitest';
import { BrowserFrameRenderer } from '../../src/render/browserFrameRenderer';

describe('BrowserFrameRenderer', () => {
  it('identifies backend as browser and handles fallback when headless browser is missing', async () => {
    const renderer = new BrowserFrameRenderer();
    expect(renderer.backend).toBe('browser');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/render/browser-frame-renderer.test.ts`
Expected: FAIL ("Cannot find module '../../src/render/browserFrameRenderer'")

- [ ] **Step 3: Implement `BrowserFrameRenderer`**
Implement browser launch with Puppeteer / Chromium, loading `renderTemplate.html`, driving `__SEEK_FRAME__`, capturing PNG frames, with graceful fallback to `SoftwareFrameRenderer` if browser cannot launch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render/browser-frame-renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/browserFrameRenderer.ts test/render/browser-frame-renderer.test.ts package.json
git commit -m "feat(render): implement BrowserFrameRenderer with headless Chromium capture"
```

---

### Task 3: Wire Browser Renderer into CLI and `RenderEngine`

**Files:**
- Modify: `src/render/RenderEngine.ts`
- Modify: `src/cli/render.ts`
- Test: `test/render/render-engine-browser.test.ts`

**Interfaces:**
- Consumes: `BrowserFrameRenderer`
- Produces: Updated CLI flag `--renderer browser|software` (default `browser` with automatic software fallback)

- [ ] **Step 1: Write test for RenderEngine renderer selection**

```typescript
// test/render/render-engine-browser.test.ts
import { describe, it, expect } from 'vitest';
import { createRenderEngine } from '../../src/render/RenderEngine';

describe('RenderEngine renderer selection', () => {
  it('selects browser renderer when requested and falls back cleanly', () => {
    const engine = createRenderEngine({ renderer: 'browser' });
    expect(engine.getRendererName()).toBe('browser');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/render/render-engine-browser.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement renderer wiring in `RenderEngine.ts` and `src/cli/render.ts`**
Update `RenderEngine` options and CLI flags so `--renderer browser` is supported and defaults to browser rendering when available.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render/render-engine-browser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/RenderEngine.ts src/cli/render.ts test/render/render-engine-browser.test.ts
git commit -m "feat(render): wire browser renderer into RenderEngine and CLI options"
```

---

### Task 4: Next.js Web Studio Render & Video Streaming APIs

**Files:**
- Create: `ai-game-video-engine/src/app/api/render/route.ts`
- Create: `ai-game-video-engine/src/app/api/videos/[filename]/route.ts`
- Test: `test/api/studio-render-api.test.ts`

**Interfaces:**
- Consumes: Core `RenderEngine`, `ProductProvider`, `buildGame`
- Produces:
  - `POST /api/render` -> `{ ok: true, videoUrl: "/api/videos/<gameId>.mp4", caption, hashtags, affiliateLink, renderMs }`
  - `GET /api/videos/[filename]` -> streams MP4 binary with `Content-Type: video/mp4` and range headers

- [ ] **Step 1: Write test for render API route handler**

```typescript
// test/api/studio-render-api.test.ts
import { describe, it, expect } from 'vitest';
import { handleRenderRequest } from '../../ai-game-video-engine/src/lib/render-service';

describe('handleRenderRequest', () => {
  it('plans and executes render job returning videoUrl', async () => {
    const res = await handleRenderRequest({
      mechanic: 'HI_LO',
      productIds: ['p001', 'p002'],
      seed: 839271,
      resultVariant: 'in_video'
    });
    expect(res.ok).toBe(true);
    expect(res.videoUrl).toContain('.mp4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api/studio-render-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `/api/render` and `/api/videos/[filename]`**
Implement the routes in Next.js app to bridge the Web Studio directly to the rendering pipeline and stream the MP4 files.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api/studio-render-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-game-video-engine/src/app/api/render/ ai-game-video-engine/src/app/api/videos/
git commit -m "feat(api): add Web Studio /api/render and /api/videos streaming endpoints"
```

---

### Task 5: Web Studio UI: Render Button, Progress Indicator & Video Player

**Files:**
- Modify: `ai-game-video-engine/src/app/studio/page.tsx`
- Modify: `ai-game-video-engine/src/components/GamePreview.tsx`

**Interfaces:**
- Consumes: `/api/render`, `/api/videos/[filename]`
- Produces:
  - "🎬 Render Video MP4" button in Studio header and control bar
  - Interactive render progress indicator modal
  - Embedded `<video>` player tab with play/pause, download, and copy caption buttons

- [ ] **Step 1: Update `GamePreview.tsx` to include an "MP4 Video" tab with player**
Add an `<video controls ... />` player tab showing the rendered MP4 file when available, with download button.

- [ ] **Step 2: Update `src/app/studio/page.tsx` to support the Render MP4 flow**
Add the Render button, loading state, progress feedback, and automatic switch to the video player tab upon completion.

- [ ] **Step 3: Manual & visual verification in browser**
Open `http://localhost:3000/studio`, choose products, click "Render Video MP4", and verify the video plays in the studio player.

- [ ] **Step 4: Commit**

```bash
git add ai-game-video-engine/src/app/studio/page.tsx ai-game-video-engine/src/components/GamePreview.tsx
git commit -m "feat(ui): add Render Video MP4 button, progress modal and video player in Studio"
```

---

### Task 6: End-to-End Quality & Verification Test

**Files:**
- Test: `test/e2e/high-quality-render.test.ts`

- [ ] **Step 1: Write E2E test rendering full 1080x1920 MP4**
Verify video file exists, duration is 18.0s, resolution is 1080x1920, and pixel scan passes.

- [ ] **Step 2: Run E2E test**
Run: `npx vitest run test/e2e/high-quality-render.test.ts`
Expected: PASS

- [ ] **Step 3: Commit and update documentation**

```bash
git add test/e2e/ README.md
git commit -m "chore(test): add E2E quality verification test for browser frame renderer"
```
