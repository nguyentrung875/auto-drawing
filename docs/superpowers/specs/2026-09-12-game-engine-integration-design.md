# Design Spec: High-Quality Browser Frame Capture & Web Studio Integration

## 1. Overview & Context

- **System Context**: `auto-drawing` is a Universal AI Game Video Engine designed to generate vertical 1080×1920 video games for TikTok/Shopee affiliate marketing.
- **Current Problem**: The current video rendering engine (`SoftwareFrameRenderer`) relies on a CPU-based rasterizer in pure Node.js Buffer (`raster.ts`, `truetype.ts`). Each scene samples only 4 static keyframes (`[0, 0.25, 0.5, 0.75]`), leading to choppy, slide-like output without smooth 30fps transitions, anti-aliased typography, or modern styling.
- **Solution**: Integrate the modern React/Tailwind/HTML5 frontend from `ai-game-video-engine` as a dedicated 1080×1920 render template. A headless Chromium instance (Puppeteer / Playwright) steps through the 18-second timeline frame-by-frame (540 frames @ 30fps) with deterministic seeking. The crisp, GPU-rendered frames are piped directly to FFmpeg for audio muxing (TTS voice + SFX + BGM) into an H.264 MP4. The Web Studio UI provides a one-click "Render MP4" button with an in-browser HTML5 video player for immediate preview and download.

---

## 2. Architecture & System Flow

```mermaid
graph TD
    subgraph WebStudio ["Next.js Web Studio (ai-game-video-engine)"]
        StudioUI["Studio UI (/studio)"] -->|POST /api/render| RenderAPI["Render API Endpoint"]
        VideoPlayer["Video Player & Download"]
    end

    subgraph HeadlessRenderPipeline ["Rendering Engine (auto-drawing core)"]
        RenderAPI --> Orchestrator["Headless Render Orchestrator"]
        Orchestrator --> Browser["Headless Chromium"]
        Browser --> Template["Render Template (1080x1920 HTML/CSS/Tailwind)"]
        Template -->|window.__SEEK_FRAME__(frame, time)| CanvasCapture["Frame Buffer (PNG / Raw RGBA)"]
        CanvasCapture -->|Pipe stdin| FFmpeg["FFmpeg Encoder (libx264 -crf 18)"]
        AudioEngine["AudioEngine (TTS + SFX + BGM)"] -->|Mux Audio| FFmpeg
    end

    subgraph Artifacts ["Generated Outputs"]
        FFmpeg --> MP4["export/<gameId>.mp4"]
        FFmpeg --> Caption["export/<gameId>.caption.json"]
        MP4 -.->|Stream via /api/videos| VideoPlayer
    end
```

---

## 3. Detailed Component Specifications

### 3.1 Dedicated Render Template (`/render` or standalone HTML/CSS)
- **Viewport**: Fixed at `1080px × 1920px` (Aspect ratio 9:16).
- **Styling**: Tailwind CSS v4, Inter font, custom gradients, smooth drop-shadows, and modern card styling.
- **Deterministic Stepping Interface**:
  - Exposes `window.__SEEK_FRAME__(frameIndex: number, timeSec: number)` on global window object.
  - Automatically updates component state (card positions, countdown progress, flip rotation, masked digits) without running asynchronous timers (`requestAnimationFrame` or `setInterval` are driven deterministically).
- **Scene Animations**:
  - `hook` (0–2s): Title entrance, theme badge pop-in.
  - `product` (2–5s): Smooth slide-in of product cards, price badge reveal with subtle float.
  - `question` (5–8s): Question banner pulse, action highlight.
  - `countdown` (8–11s): Continuous 360-degree countdown ring reduction with pulse on integer boundaries (3, 2, 1).
  - `reveal` (11–13s): 3D card flip / masked digit glow reveal.
  - `result` (13–15s): Green/Red result badge, answer confirmation.
  - `cta` (15–18s): Call to action banner with comment prompt.

### 3.2 Headless Browser Frame Capture (`BrowserFrameRenderer`)
- **Engine**: Puppeteer / Playwright using Chromium headless.
- **Launch Arguments**: `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --force-device-scale-factor=1 --window-size=1080,1920`.
- **Capture Loop**:
  ```ts
  for (let frame = 0; frame < totalFrames; frame++) {
    const timeSec = frame / fps;
    await page.evaluate((f, t) => window.__SEEK_FRAME__(f, t), frame, timeSec);
    const frameBuffer = await page.screenshot({ type: 'png', omitBackground: false });
    ffmpegProcess.stdin.write(frameBuffer);
  }
  ffmpegProcess.stdin.end();
  ```
- **Fallback**: If Chromium is not available on the host environment, gracefully fallback to `SoftwareFrameRenderer` and issue a clear warning `W_RENDER_BROWSER_FALLBACK`.

### 3.3 Audio Integration & FFmpeg Muxing
- **Audio Inputs**:
  - Voice narration track (synthesized by `ViPiperEngine` / `FormantViEngine`).
  - SFX cues: 6 countdown ticks at 0.5s intervals, 1 reveal chime, 1 correct/wrong sound.
  - Background music bed: Loopable ambient track ducked to volume 0.18.
- **FFmpeg Encoding Command**:
  ```bash
  ffmpeg -y -f image2pipe -vcodec png -r 30 -i - -i audio_mix.wav \
    -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 \
    -c:a aac -b:a 192k -shortest export/<gameId>.mp4
  ```

### 3.4 Web Studio Integration (`src/app/studio/page.tsx`)
- **Action Buttons**:
  - "🎮 Xem Preview nhanh": Instant browser preview using simulated React components.
  - "🎬 Render Video MP4": Triggers full headless browser render pipeline.
- **Progress Modal**:
  - Visual status for Planning (Validation) -> Browser Capture (Frames 0/540) -> Audio Muxing -> Done.
- **Video Delivery (`/api/videos/[filename]`)**:
  - Stream the exported `.mp4` file directly to the client with `Accept-Ranges: bytes` support.
  - Web UI embeds an HTML5 `<video controls src="/api/videos/..." />` player.
  - Include "⬇️ Tải file MP4" and "📋 Sao chép Caption & Link Affiliate" buttons.

---

## 4. Verification & Quality Gates

1. **Visual Quality Gate**:
   - Inspect rendered MP4: Zero jagged fonts, smooth 30fps animation during countdown and reveal scenes, authentic drop shadows and gradients.
2. **Affiliate Compliance Gate (Pixel-scan)**:
   - Run pixel scanner on rendered video frames to verify affiliate links are never burned directly into video pixels (only in caption JSON).
3. **Budget & Performance**:
   - Total render time for an 18-second video must be within 35 seconds on a standard 4-core machine.
   - Temporary frame buffers and browser tabs must be cleanly closed and garbage-collected.
