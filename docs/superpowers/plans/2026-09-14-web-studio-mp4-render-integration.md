# Web Studio MP4 Render Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate real-time on-demand MP4 rendering directly into Web Studio, with live progress streaming (SSE), resilient child-process execution, HTTP 206 Range video streaming, and an in-browser 9:16 video player.

**Architecture:** A lightweight Next.js API route (`POST /api/render`) spawns the Core Engine CLI (`bin/game.js render`) in an isolated child process, translating terminal output into Server-Sent Events (SSE) representing progress percentages and pipeline stages. The frontend (`GamePreview.tsx`) listens to the SSE stream, renders an animated progress indicator, and once complete, displays the video via a dedicated HTTP Range-supporting video endpoint (`GET /api/videos/[filename]`).

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript, Node.js `child_process`, Server-Sent Events (SSE), Vitest, HTML5 Video API.

## Global Constraints

- **Process Isolation:** The rendering pipeline (Puppeteer, Canvas, FFmpeg) MUST be executed via `child_process.spawn(process.execPath, [launcher, 'render', ...])` to avoid Turbopack bundler conflicts with native binaries.
- **Local-First & Zero Postgres:** State is stored in local JSON files and videos are written directly to `export/`.
- **Safe File Access:** Video streaming must strictly sanitize filenames using `/^[a-zA-Z0-9_\-]+\.mp4$/` to prevent path traversal.
- **Graceful Cancellation:** If the client disconnects or aborts, any spawned rendering process must be terminated immediately with `SIGTERM`.

---

### Task 1: Video Streaming Endpoint `GET /api/videos/[filename]`

**Files:**
- Create: `studio/src/app/api/videos/[filename]/route.ts`
- Test: `studio/test/api/videos.test.ts`

**Interfaces:**
- Consumes: `export/<filename>.mp4` on local filesystem
- Produces: HTTP response with status `200` (full) or `206` (partial range), headers `Content-Range`, `Accept-Ranges: bytes`, `Content-Length`, `Content-Type: video/mp4`.

- [ ] **Step 1: Write unit tests for video streaming endpoint**

Create `studio/test/api/videos.test.ts` testing:
1. Malicious filename rejection (`../secret.mp4`, `test.exe` -> 400 Bad Request)
2. Non-existent file (`missing_123.mp4` -> 404 Not Found)
3. Successful 200 response when no Range header is sent
4. Successful 206 response with correct `Content-Range` and `Content-Length` when `Range: bytes=0-99` is sent

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run studio/test/api/videos.test.ts`  
Expected: FAIL (file not found or route not implemented)

- [ ] **Step 3: Implement `studio/src/app/api/videos/[filename]/route.ts`**

Implement:
- Extract `filename` from params (await `params`).
- Validate with `/^[a-zA-Z0-9_\-]+\.mp4$/`. Return 400 if invalid.
- Resolve path in `rootDir/export/<filename>`.
- Check existence with `fs.existsSync`. Return 404 if missing.
- Parse `Range` header if present; create stream with `{ start, end }`, set 206 status, `Content-Range`, `Accept-Ranges`, `Content-Length`.
- If no Range header, stream full file with status 200.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run studio/test/api/videos.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add studio/src/app/api/videos/[filename]/route.ts studio/test/api/videos.test.ts
git commit -m "feat(studio): add HTTP 206 Range video streaming route"
```

---

### Task 2: SSE Render Endpoint `POST /api/render`

**Files:**
- Create: `studio/src/app/api/render/route.ts`
- Test: `studio/test/api/render.test.ts`

**Interfaces:**
- Consumes: `{ gameId, gameJson?, mechanic?, productIds?, seed?, resultVariant? }`
- Produces: `text/event-stream` with events `progress`, `done`, `error`.

- [ ] **Step 1: Write tests for `/api/render` request parsing and validation**

Create `studio/test/api/render.test.ts` testing:
1. Rejects request with missing gameId / productIds / gameJson with status 400.
2. Formats SSE message correctly (`data: { ... }\n\n`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run studio/test/api/render.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `studio/src/app/api/render/route.ts`**

Implement:
- Receive request JSON: `{ gameId, gameJson, mechanic, productIds, seed, resultVariant }`.
- Validate required fields.
- Create `TransformStream` / `ReadableStream` for SSE response with headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
- If `gameJson` is provided: write to `temp/render_<gameId>.json`. Arguments: `['render', '--game', tempFile]`.
- Else: Arguments: `['render', '--mechanic', mechanic.toLowerCase(), '--products', productIds.join(','), '--seed', String(seed), '--result-variant', resultVariant]`.
- Spawn `child_process.spawn(process.execPath, [launcherPath, ...args], { cwd: rootDir })`.
- Parse lines from `stdout` & `stderr`:
  - If output contains audio keywords -> send `{ stage: 'audio', message: 'Đang tổng hợp audio TTS...', percent: 20 }`.
  - If output contains frame regex (e.g. `frame (\d+)/(\d+)` or scene info) -> calculate percent (20% + 60% * (frame / total)) -> send `{ stage: 'render', message: `Đang render khung hình...`, percent }`.
  - If output contains ffmpeg / muxing -> send `{ stage: 'mux', message: 'Đang đóng gói MP4 qua FFmpeg...', percent: 90 }`.
- On process close:
  - If code === 0: locate generated `.mp4` and `.caption.json` in `export/`, send `event: done` with `{ ok: true, videoUrl: '/api/videos/<filename>', renderMs }`.
  - If code !== 0: send `event: error` with `{ ok: false, error: 'Render process failed', stderr }`.
- On `req.signal.on('abort')`: kill child process (`child.kill('SIGTERM')`).
- In `finally`: delete `tempFile` if created.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run studio/test/api/render.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add studio/src/app/api/render/route.ts studio/test/api/render.test.ts
git commit -m "feat(studio): add SSE on-demand MP4 render API"
```

---

### Task 3: Studio UI Live Progress & 9:16 Video Player

**Files:**
- Modify: `studio/src/components/GamePreview.tsx`
- Test: `studio/test/preview/studio-multi-round.test.ts` (or add component test)

**Interfaces:**
- Consumes: `GameJson`, `fetch('/api/render')`
- Produces: Interactive "🎬 Render MP4 Thật" action button, Live Progress Bar (0-100%), and Tab "🎥 Video MP4" with HTML5 video player and download link.

- [ ] **Step 1: Add state and handlers in `GamePreview.tsx`**

Add states:
- `isRendering: boolean`
- `renderProgress: { stage: string; message: string; percent: number } | null`
- `renderedVideo: { url: string; filename: string; renderMs: number } | null`
- `renderError: string | null`
- `abortControllerRef: React.MutableRefObject<AbortController | null>`

Implement `handleStartRender()`:
- Create `new AbortController()`.
- Send `fetch('/api/render', { method: 'POST', body: JSON.stringify({ gameId, gameJson: game, mechanic, productIds, seed, resultVariant }), signal })`.
- Read response body using `res.body.getReader()`.
- Decode UTF-8 chunks, parse SSE event blocks (`data: ...`), update `renderProgress`.
- On `done`: set `renderedVideo`, set `activeTab = 'video'`, clear `isRendering`.
- On `error`: set `renderError`, clear `isRendering`.

Implement `handleCancelRender()`:
- Abort controller, reset rendering state.

- [ ] **Step 2: Add "🎬 Render MP4 Thật" button to Header**

In `GamePreview.tsx` header:
- Next to `Copy JSON` button:
  - If `isRendering`: Button with spinning icon and `Đang render (${renderProgress?.percent || 0}%)`, disabled.
  - If not rendering: Button with `🎬 Render MP4 Thật` styled with indigo-to-pink gradient.

- [ ] **Step 3: Add Live Progress Modal / Banner**

When `isRendering === true`:
- Show progress bar (animated width `percent%`), current stage label, and a "Hủy" button.

- [ ] **Step 4: Add Tab "🎥 Video MP4" and Video Player View**

Update tabs list: `const tabs = ['preview', 'video', 'json', 'timeline', 'audio']`.
When `activeTab === 'video'`:
- If `renderedVideo`:
  - 9:16 aspect ratio smartphone container.
  - `<video src={renderedVideo.url} controls autoPlay loop playsInline className="w-full h-full object-contain rounded-2xl bg-black" />`.
  - Actions below:
    - `<a href={renderedVideo.url} download className="...">⬇ Tải về MP4</a>`.
    - Button to copy video URL.
    - Metadata badge: Rendered in `${(renderedVideo.renderMs / 1000).toFixed(1)}s`.
- If no `renderedVideo` yet:
  - Empty state with CTA button to click "Render MP4 Thật".

- [ ] **Step 5: Run typecheck & build**

Run: `npm run studio:build`  
Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add studio/src/components/GamePreview.tsx
git commit -m "feat(studio): add Render MP4 button, live progress and 9:16 video player"
```

---

### Task 4: End-to-End Verification & Sanity Test

**Files:**
- Test: Local verification via browser & CLI

- [ ] **Step 1: Verify test suites pass**

Run: `npm test`  
Expected: All existing core engine tests pass.

- [ ] **Step 2: Test rendering a video through the Studio API**

Send test request to running server:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/videos/test.mp4" -Method GET
```
Verify path sanitization and error handling.

- [ ] **Step 3: Perform live render test and verify exported MP4**

Trigger a test render for `HI_LO` via Studio or API, confirm file exists in `export/*.mp4`, and verify browser playback.

- [ ] **Step 4: Final commit and cleanup**

```bash
git status
git commit -m "chore: complete Web Studio MP4 render integration"
```
