# Design Specification: Merge Web Studio & Core Game Video Engine

**Date:** 2026-09-14  
**Status:** Approved by User  
**Scope:** Phase 1 (P0 Mechanics: G1 Most Expensive, G2 Higher or Lower, G3 Odd One Out)  
**Target Architecture:** Modular Monolith with Unified Isomorphic Canvas Renderer & Local-First File Storage  

---

## 1. Executive Summary & Goals

Dự án nhằm hợp nhất hai phần mã nguồn:
1. **Core Headless Engine (`src/` ở thư mục gốc):** Nhà máy sản xuất video tự động chuẩn PRD với CLI, File Queue, Worker Pool, Audio Engine (viPiper/Formant), Software Canvas Renderer và FFmpeg muxer ra MP4 1080×1920 (9:16).
2. **Web Studio UI (`ai-game-video-engine_claude4.6`):** Bàn điều khiển trực quan với Studio tạo game, chọn sản phẩm (Product Selector lọc danh mục, cảnh báo delta giá), dashboard batch và phone preview.

### Mục tiêu then chốt (Non-negotiables):
- **Unified Isomorphic Canvas Renderer:** Preview trên Web Studio và video MP4 xuất ra từ Node.js sử dụng **CÙNG MỘT HÀM PAINTER CANVAS**. Triệt tiêu 100% hiện tượng lệch giao diện (Visual Mismatch / "What You See Is What You Get").
- **Local-First Zero-Setup:** Loại bỏ hoàn toàn PostgreSQL và Drizzle ORM. Lưu trữ state 100% bằng file JSON (`queue/*.json`, `export/`, `logs/*.json`). Cắm là chạy, không cần cài server database bên ngoài.
- **Semantic Design System:** LLM chỉ quyết định nội dung ("Nội dung gì?"). Engine quyết định toàn bộ bố cục, tỉ lệ, font chữ, animation ("Hiển thị đẹp như thế nào?"). Tuyệt đối không để AI can thiệp vào tọa độ pixel thô.
- **Hỗ trợ trọn vẹn nhóm P0:** G1 (Most Expensive), G2 (Higher or Lower) và bổ sung G3 (Odd One Out).

---

## 2. System Architecture

```text
                               +----------------------------------+
                               |     User (Web Browser GUI)       |
                               |               OR                 |
                               |    Hermes Agent (Headless CLI)   |
                               +-----------------+----------------+
                                                 |
                         +-----------------------+-----------------------+
                         |                                               |
             [Web Studio: Next.js]                                [CLI: bin/game.js]
             - /studio (Config & Preview)                         - game render
             - /batch (Dashboard)                                 - game batch
             - /products (Selector)                               - game products list
                         |                                               |
                         +-----------------------+-----------------------+
                                                 |
                                                 v
                               +----------------------------------+
                               |      Local File Queue System     |
                               |      (queue/<jobId>.json)        |
                               +-----------------+----------------+
                                                 |
                                                 v
                               +----------------------------------+
                               |       GameEngine & Validator     |
                               | - 2-Layer Validation             |
                               | - Deterministic gameplay (seed)  |
                               | - Timeline & Audio Cues builder  |
                               +-----------------+----------------+
                                                 |
                                                 v
                               +----------------------------------+
                               |     Isomorphic Scene Painter     |
                               |    (Canvas 2D Rendering Logic)   |
                               +--------+----------------+--------+
                                        |                |
             +--------------------------+                +--------------------------+
             | (Browser context)                                  | (Node.js headless context)
             v                                                    v
  +----------------------+                             +----------------------+
  | HTML5 <canvas> Stage |                             | Software Canvas Buf  |
  | (1080x1920 scaled)   |                             | (1080x1920 @ 30fps)  |
  +----------+-----------+                             +----------+-----------+
             |                                                    |
             v                                                    v
  [ Interactive 60fps ]                                [ PNG Frame Sequence ]
  [ Realtime Preview  ]                                           |
                                                       +----------+-----------+
                                                       |   FFmpeg Audio Mux   |
                                                       | (voice.wav + sfx +bgm|
                                                       +----------+-----------+
                                                                  |
                                                                  v
                                                       [ export/<gameId>.mp4 ]
```

---

## 3. Directory Layout & Module Structure

```text
auto-drawing/
├── bin/
│   └── game.js                      # Headless CLI entrypoint cho Hermes & Terminal
├── src/                             # Core Engine (Node.js ESM)
│   ├── audio/                       # ViPiper, Formant, AudioEngine
│   ├── cli/                         # CLI command handlers (render, batch, inspect)
│   ├── game/                        # GameEngine, GameLoader, schema
│   │   └── mechanics/               # HiLo, MostExpensive, OneAway, OddOneOut (G3)
│   ├── observability/               # JobLogger, BatchReporter (file-based)
│   ├── product/                     # ProductProvider (đọc products.json 50 SKU)
│   ├── queue/                       # QueueStore, WorkerPool, JobRunner (file-based)
│   ├── render/                      # Canvas, ScenePainter, SoftwareFrameRenderer, FFmpeg
│   │   ├── canvas.ts                # Software Canvas buffer implementation
│   │   ├── scenePainter.ts          # Isomorphic canvas painting primitives
│   │   └── ffmpeg.ts                # FFmpeg muxer wrapper
│   ├── scene/                       # SceneSystem (7 MVP scenes)
│   └── validator/                   # 2-Layer Validator (Schema + Game Logic)
├── studio/                          # Web Studio (Next.js 16 + Tailwind CSS)
│   ├── package.json                 # Phụ thuộc web: Next, React, Tailwind (KHÔNG có pg/drizzle)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                 # Local Next.js API Routes (gọi vào src/ hoặc queue/)
│   │   │   │   ├── games/           # POST (tạo game, render)
│   │   │   │   ├── batch/           # POST (tạo batch job vào queue)
│   │   │   │   └── products/        # GET (đọc danh sách sản phẩm)
│   │   │   ├── studio/page.tsx      # Visual Game Studio
│   │   │   ├── batch/page.tsx       # Batch Management Dashboard
│   │   │   └── products/page.tsx    # 50 SKU Product Gallery
│   │   └── components/
│   │       ├── CanvasPreview.tsx    # HTML5 Canvas Preview dùng chung scenePainter!
│   │       └── ProductSelector.tsx  # Product selector with search & delta warnings
├── queue/                           # Job files (local-first)
├── export/                          # Output MP4 & caption.json
├── logs/                            # Job & Batch logs
└── package.json                     # Root scripts (test, build, cli, studio)
```

---

## 4. Key Subsystem Designs

### 4.1. Unified Isomorphic Canvas Renderer (`src/render/scenePainter.ts`)
- **Core Interface:** Tạo hàm vẽ nhận canvas context tương thích cả `HTMLCanvasElement` (trên browser) và `Canvas` buffer (trên Node.js).
- **Semantic Components:**
  - `paintBackground(ctx, theme)`: Tô gradient và tilt góc nghiêng.
  - `paintBadge(ctx, label, accent)`: Vẽ nhãn scene bo tròn trên cùng.
  - `paintQuestion(ctx, text)`: Tự động đo kích thước chữ (auto-scale) để text luôn nằm trong vùng an toàn (Safe-zone 1080×1920).
  - `paintCards(ctx, cards, layoutType)`:
    - 2 thẻ: Dàn dọc cân đối (cho HI_LO).
    - 3–4 thẻ: Dàn lưới 2×2 không chồng lấn (cho MOST_EXPENSIVE, ODD_ONE_OUT).
  - `paintCountdown(ctx, remainingSeconds, pulse)`: Vòng tròn countdown 3.0s với hiệu ứng giật nhẹ theo tick 0.5s.
  - `paintReveal(ctx, answerData)`: Highlight đáp án, vẽ badge chính xác.
  - `paintResult(ctx, variant, answer)`: Xử lý biến thể `in_video` vs `comment`.
  - `paintCTA(ctx, ctaText)`: Nút kêu gọi hành động bo tròn nổi bật.

### 4.2. Web Studio Component: `CanvasPreview.tsx`
- Thay thế hoàn toàn HTML DOM mockup cũ của Claude 4.6.
- Sử dụng thẻ `<canvas width="1080" height="1920" style="aspect-ratio: 9/16; width: 100%; max-width: 360px;">`.
- Đón nhận sự kiện timeline (Play, Pause, Scrub) và vẽ lại canvas tương ứng từng frame tại 60fps qua `requestAnimationFrame`.
- Cung cấp nút chuyển đổi: **"Chế độ Canvas Preview (Tức thì)"** và **"Chế độ Video MP4 Thật (Sau khi Render)"**.

### 4.3. Loại bỏ PostgreSQL & Chuyển sang File-based API Routes
- **`studio/src/app/api/games/route.ts`:**
  - Nhận request từ Web UI.
  - Gọi trực tiếp `GameEngine.build(...)` và `Validator.validate(...)`.
  - Nếu user chọn "Render MP4", nạp vào `RenderEngine.render(...)` để xuất video vào `export/`.
  - Trả về đường dẫn MP4 và JSON metadata.
- **`studio/src/app/api/batch/route.ts`:**
  - Nhận yêu cầu tạo batch 10–50 video.
  - Tạo các file `queue/job_<uuid>.json` trong thư mục `queue/`.
  - Kích hoạt `BatchOrchestrator` / `WorkerPool` của Core Engine xử lý ngầm.
  - Báo cáo tiến độ bằng cách đọc trực tiếp thư mục `queue/` và `logs/`.
- **`studio/src/app/api/products/route.ts`:**
  - Đọc trực tiếp từ `ProductProvider` (50 SKU mock).

### 4.4. Game Mechanics Scope (P0 Implementation)
1. **G1: Most Expensive (`MostExpensiveMechanic.ts`):** 3–4 sản phẩm, chọn sản phẩm giá cao nhất, delta ≥ 2% giữa top 2.
2. **G2: Higher or Lower (`HiLoMechanic.ts`):** 2 sản phẩm, đoán B cao hơn hay thấp hơn A, delta ≥ 5%.
3. **G3: Odd One Out (`OddOneOutMechanic.ts` - Mới):** 4 sản phẩm (lưới 2×2). 3 sản phẩm cùng nhóm category/brand/price range, 1 sản phẩm khác biệt hoàn toàn. Reveal highlight sản phẩm "lạc đàn" kèm lời giải thích ngắn gọn.

---

## 5. Verification & Testing Plan

1. **Unit & Integration Tests (Vitest):**
   - Chạy toàn bộ 38 test suites hiện có trong `test/` để đảm bảo Core Engine không bị phá vỡ.
   - Thêm unit test cho `OddOneOutMechanic` (kiểm tra phân nhóm, đáp án deterministic).
   - Thêm test cho Isomorphic Painter (đảm bảo output frame không bị crash khi chạy trên Node Canvas).
2. **CLI Verification:**
   - Test lệnh đơn: `node bin/game.js render --mechanic most_expensive --seed 12345` -> xuất MP4 trong `export/`.
   - Test lệnh batch: `node bin/game.js batch --count 5 --mechanics hi_lo,most_expensive,odd_one_out` -> kiểm tra `batch_report.json`.
3. **Web Studio Verification:**
   - Chạy `npm run studio`, truy cập `http://localhost:3000/studio`.
   - Chọn sản phẩm, xem trước trên `<canvas>` preview (kiểm tra mượt 60fps, đúng tỉ lệ).
   - Bấm "Render MP4", xác nhận video xuất ra đúng format 1080×1920 và phát được ngay trên Web Studio.
   - Đảm bảo không còn bất kỳ dòng code nào gọi PostgreSQL.
