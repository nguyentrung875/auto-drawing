# Kiến trúc Hệ thống (System Architecture)

Tài liệu kỹ thuật chuyên sâu mô tả kiến trúc, nguyên lý thiết kế, các bounded contexts, hợp đồng dữ liệu (data contracts) và pipeline xử lý của **auto-drawing (Universal AI Game Video Engine)**.

---

## 1. Triết lý Thiết kế (Design Principles)

Hệ thống được xây dựng theo mô hình **Modular Monolith** kết hợp nguyên lý **Clean Architecture** và **Domain-Driven Design (DDD)** với các tiêu chuẩn:

1. **Local-First & Zero External SaaS Cost**:
   - Vận hành 100% trên phần cứng máy trạm hoặc VPS thông thường.
   - Không phụ thuộc vào các API render video đám mây trả phí đắt đỏ (Replicate, Shotstack, Creatomate...). Chi phí kết xuất ~0 VNĐ/video.
2. **Determinism (Tính Tất định)**:
   - Cùng một bộ `(seed, dsl, catalog, options)` sẽ luôn luôn sinh ra video có nội dung, câu hỏi, giọng đọc và hình ảnh chính xác từng frame và từng mẫu âm thanh (bit-for-bit/frame-perfect).
3. **Strict Data Integrity ("Zero Data Invention")**:
   - Renderer và Presentation layer hoạt động theo nguyên tắc pure projection (chiếu dữ liệu).
   - Tuyệt đối không tự suy diễn giá tiền, không tự đoán đáp án, không dùng giá fallback ngẫu nhiên trong renderer. Mọi logic xác định thắng/thua và giá sản phẩm thuộc về `ChallengeCurator` và `Validator`.
4. **Platform Safe Zone Compliance (TikTok/Reels/Shorts)**:
   - Mọi phần tử UI, thẻ sản phẩm, câu hỏi và nút tương tác bắt buộc phải nằm trọn trong vùng an toàn `y: 360px – 1580px` của khung hình dọc 1080×1920.

---

## 2. Bounded Contexts & Quy tắc Ràng buộc Phụ thuộc

Dự án áp dụng quy tắc phụ thuộc 1 chiều nghiêm ngặt (được kiểm tra tự động bởi ESLint rule `import/no-restricted-paths`):

```
┌───────────────────────────────────────────────────────────┐
│                      CLI & Studio                         │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                   Queue & Orchestrator                    │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│             Validator & Product Catalog                   │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│            Challenge Engine & Game Definitions            │
└──────────────────────┬──────────────┬─────────────────────┘
                       │              │
        ┌──────────────▼─────┐  ┌─────▼──────────────┐
        │   Scene & Timeline │  │    Audio Engine    │
        └──────────────┬─────┘  └─────┬──────────────┘
                       │              │
                       └───────┬──────┘
                               │
                ┌──────────────▼─────────────┐
                │       Render Engine        │
                │ (ScenePainter, AssetCache) │
                └──────────────┬─────────────┘
                               │
                ┌──────────────▼─────────────┐
                │   FFmpeg Muxer & Output    │
                └────────────────────────────┘
```

### Các Bounded Contexts chính:

| Bounded Context | Trách nhiệm cốt lõi | Các Modules tiêu biểu |
| :--- | :--- | :--- |
| **`product`** | Quản lý kho SKU, nạp metadata JSON, cache in-memory, schema validation. | `ProductProvider`, `schema.ts` |
| **`validator`** | Kiểm định toàn vẹn kịch bản 2 tầng (Schema Zod + Invariant Logic rules). | `Validator.ts`, `errors.ts` |
| **`challenge`** | Dynamic Multi-Round Engine: phân bổ độ khó, tính toán câu hỏi, sinh đáp án, chấm điểm viral vector. | `ChallengeCurator.ts`, `DecisionEngine.ts`, `KnapsackEngine.ts`, `NumericEngine.ts`, `ViralScorer.ts` |
| **`definitions`** | Khai báo Game DSL (7 mechanics: g1, g2, g3, g5, g7, g9, g41) quy định layout, thời gian, số SKU. | `g1_hi_lo.ts`, `g41_deal_or_scam.ts`... |
| **`scene`** | Xây dựng trục thời gian (Timeline slots: Hook, Play, Reveal, MicroHook, Scorecard). | `AllInOneScene.ts`, `Timeline.ts` |
| **`audio`** | Tổng hợp âm thanh đa tầng: Edge TTS tiếng Việt, SFX đếm ngược/reveal, auto-ducking nhạc nền. | `EdgeTtsEngine.ts`, `MultiRoundAudioComposer.ts` |
| **`render`** | Kết xuất đồ hoạ 1080×1920: Satori SVG/Resvg native với keyframe caching (mặc định), Software Canvas fallback, cache ảnh in-memory, muxing MP4 H.264. | `satoriFrameRenderer.ts`, `softwareFrameRenderer.ts`, `scenePainter.ts`, `RenderAssetCache.ts`, `ffmpeg.ts` |
| **`queue`** | Quản lý hàng đợi job file-based không cần Redis/RabbitMQ. | `QueueStore.ts`, `QueueJob.ts` |
| **`observability`** | Logging chuẩn JSON Lines, đo lường thời gian từng stage, xuất báo cáo batch. | `BatchReporter.ts`, `timing.ts` |
| **`studio`** | Giao diện Next.js 15 Web Studio trực quan, xem trước HTML, live stream SSE render. | `studio/src/app/api/*` |

---

## 3. Sơ đồ Tuần tự Pipeline (Sequence Diagram)

Quy trình sản xuất 1 video Multi-Round hoàn chỉnh từ lệnh CLI/Studio:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Batch Runner
    participant CLI as CLI Engine (render.ts)
    participant Catalog as ProductProvider
    participant Curator as ChallengeCurator
    participant Scene as AllInOneScene
    participant Audio as MultiRoundAudioComposer
    participant Painter as ScenePainter & AssetCache
    participant Muxer as FFmpegMuxer
    
    User->>CLI: runRenderCommand({ mechanic: 'hi_lo', rounds: 3, timer: 5.0, seed: 839271 })
    CLI->>Catalog: resolveProducts() (nạp SKU từ products/*.json)
    Catalog-->>CLI: Product[] catalog
    
    CLI->>Curator: curate(dsl, catalog, seed, { totalRounds: 3, timerSeconds: 5.0 })
    Note over Curator: 1. Lọc sản phẩm qua EligibilityFilter<br/>2. Phân loại round (Confidence -> Tension -> WTF)<br/>3. Tính đáp án đúng bằng NumericEngine<br/>4. Chấm điểm tâm lý ViralScorer
    Curator-->>CLI: MultiRoundChallenge
    
    CLI->>Scene: new AllInOneScene(challenge)
    Scene-->>CLI: timeline (Total duration: 24.5s, 735 frames @ 30 FPS)
    
    par Xử lý Âm thanh & Khung hình song song
        CLI->>Audio: composeAudio(challenge, timeline, options)
        Note over Audio: Edge-TTS synthesis -> Mix SFX cues -> Loop BGM -> Auto-ducking (-75%) -> Soft limiter
        Audio-->>CLI: master_audio.wav
    and Render Khung hình Canvas
        loop Từng frame từ 0 đến 735 (tại timeSeconds)
            CLI->>Painter: paintMultiRoundFrame(canvas, scene, timeSeconds, { assetCache })
            Note over Painter: drawSeriesHUD -> drawCyberpunkQuestionBox -> drawMultiRoundProducts (via AssetCache) -> drawChoiceDeck -> drawPillCountdown
            Painter-->>CLI: PNG Buffer -> Ghi temp/<jobId>/frames/frame_%05d.png
        end
    end
    
    CLI->>Muxer: mux({ framesPattern, audioPath, outputPath, fps: 30, crf: 18 })
    Note over Muxer: FFmpeg ghép chuỗi PNG + master WAV -> H.264 MP4
    Muxer-->>CLI: export/g1_hi_lo_839271.mp4
    
    CLI->>CLI: Ghi caption.json (Metadata, hashtags, affiliate link an toàn)
    CLI->>CLI: Dọn dẹp temp/<jobId>/
    CLI-->>User: RenderCommandResult (exitCode: 0, videoPath, captionPath)
```

---

## 4. Các Hợp đồng Dữ liệu Cốt lõi (Data Contracts)

### 4.1. `MultiRoundChallenge` & `ChallengeRound` (`src/challenge/types.ts`)
Đây là output chuẩn từ Bounded Context `challenge`, được Scene và Audio consume:

```typescript
export interface MultiRoundChallenge {
  gameId: string;            // Ví dụ: "g1_hi_lo", "g9_guess_the_price"
  seed: number;              // Seed tất định
  title: string;             // Tiêu đề game
  seriesNumber: number;      // Số tập trong chuỗi nội dung
  rounds: ChallengeRound[];  // Danh sách các vòng chơi
  finalCta: string;          // Lời kêu gọi hành động cuối video
}

export interface ChallengeRound {
  roundIndex: number;                         // 1, 2, 3...
  type: 'confidence_builder' | 'tension_creator' | 'wtf_reveal';
  mechanic?: string;                          // "hi_lo", "deal_or_scam"...
  question: string;                           // "Món B CAO HƠN hay THẤP HƠN món A?"
  hookText?: string;
  microHook?: string;
  products: Product[];                        // 1..4 sản phẩm xuất hiện trong vòng
  choices: ChallengeChoice[];                 // Các phương án lựa chọn
  correctAnswer: string | number;             // Mã hoặc giá trị đáp án chính xác
  timerSeconds: number;                       // Thời gian đếm ngược (>= 5.0s)
  scoreVector: ChallengeScoreVector;          // Vector tâm lý viral 10 chiều
  revealText: string;                         // Chuỗi công bố khi lật mở đáp án
}

export interface ChallengeChoice {
  id: string;                                 // "A", "B", "higher", "lower", "deal"...
  label: string;                              // "CAO HƠN", "THẤP HƠN", "189K"...
  isCorrect: boolean;                         // Đánh dấu lựa chọn đúng
  value?: number | string;                    // Giá trị thực tế gắn kèm
}
```

### 4.2. `Product` Schema (`src/product/schema.ts`)
```typescript
export interface Product {
  productId: string;        // Regex: /^p\d+$/ (ví dụ: "p001")
  name: string;             // Tên hiển thị sản phẩm
  image: string;            // Đường dẫn tương đối (assets/images/p001.png)
  price: number;            // Giá bán niêm yết chính thức (số nguyên dương)
  currency: string;         // Mặc định: "VND"
  source: string;           // Nguồn dữ liệu ("mock", "shopee", "tiktok_shop")
  updatedAt: string;        // ISO 8601
  category: string;         // Ngành hàng: "gia dụng", "công nghệ"...
  brand: string;            // Thương hiệu: "OMO", "Sony"...
  affiliate_link: string;   // Link tiếp thị liên kết (Bảo vệ bởi PixelScan)
  
  // Các trường tuỳ chọn hỗ trợ thuật toán viral
  sizeCategory?: 'tiny' | 'small' | 'medium' | 'large' | 'bulky';
  perceivedValue?: 'dirt_cheap' | 'budget' | 'mid_range' | 'premium' | 'luxury';
  originalPrice?: number;
  discountPercent?: number;
}
```

### 4.3. `RenderAssetCache` (`src/render/assetCache.ts`)
Bộ đệm in-memory giải quyết nghẽn cổ chai disk I/O khi decode ảnh PNG qua hàng trăm frame:

```typescript
export class RenderAssetCache {
  private cache = new Map<string, Image>();

  // Nạp hoặc lấy ảnh từ RAM, tự động resolve đường dẫn tuyệt đối
  getImage(imagePath: string, rootDir?: string): Image | null;
  
  // Kiểm tra ảnh đã được cache hay chưa
  has(imagePath: string, rootDir?: string): boolean;
  
  // Xóa cache sau khi render xong job
  clear(): void;
  
  // Số lượng ảnh hiện tại trong cache
  get size(): number;
}
```

---

## 5. Timeline & Scene System (`src/scene/AllInOneScene.ts`)

Mỗi video Multi-Round được chia thành một chuỗi các `TimelineSlot` liên tục không có khoảng chết (Zero Dead Air):

```
┌──────────┬──────────────────────┬──────────────────────┬─────────────┬───────────┐
│ Hook     │ Round 1              │ Round 2              │ Round N     │ Scorecard │
│ (1.0s)   │ Play: 5.0s | Rev: 2s │ Play: 5.0s | Rev: 2s │ ...         │ & CTA 1.5s│
└──────────┴──────────────────────┴──────────────────────┴─────────────┴───────────┘
```

1. **Series Hook (0.0s – 1.0s)**: Xuất hiện huy hiệu series, logo kênh và nhạc giật gân thu hút sự chú ý trong 1 giây đầu tiên của feed lướt.
2. **Các Round Chơi (Rounds 1..N)**:
   - **Play Phase (`round.timerSeconds`, tối thiểu 5.0s)**:
     - Câu hỏi xuất hiện ngay lập tức tại `t = 0.0s`.
     - Giọng đọc AI cất lên tại `t = 0.1s`.
     - Thanh đếm ngược Pill Countdown co lại dần và đổi màu (Xanh -> Vàng -> Đỏ).
     - Âm thanh SFX tick đếm ngược tăng dần âm lượng và tần số.
   - **Reveal Phase (2.0s)**:
     - Thanh đếm ngược biến mất.
     - Lựa chọn đúng phát sáng neon xanh lá cây.
     - Banner Reveal chúc mừng bung ra ở giữa màn hình.
     - Hiệu ứng âm thanh Reveal SFX kích hoạt.
   - **Micro-Hook (0.5s)**:
     - Xuất hiện giữa các round (trừ round cuối) để tạo đà kích thích người xem chuẩn bị sang round tiếp theo.
3. **Scorecard & CTA (1.5s)**:
   - Tổng kết số câu trả lời và câu kêu gọi hành động: *"Bạn đúng được bao nhiêu câu? Comment ngay bên dưới để nhận mã giảm giá!"*

---

## 6. Kiến trúc Âm thanh Đa tầng (`MultiRoundAudioComposer.ts`)

Video viral đòi hỏi trải nghiệm âm thanh sống động và phân tầng rõ ràng:

1. **Voice Track (Edge Neural TTS)**:
   - Kịch bản câu hỏi được gửi tới Microsoft Azure Edge TTS WebSocket API.
   - Giải mã luồng MP3 trả về thành WAV PCM Mono 24kHz.
   - Tự động áp dụng bộ lọc `atempo` để co giãn tốc độ đọc vừa khớp với thời gian đếm ngược của round.
2. **SFX Track (Sound Effects)**:
   - Cues âm thanh đếm ngược kích hoạt với chuỗi âm lượng leo thang:
     `COUNTDOWN_GAINS = [0.30, 0.35, 0.42, 0.50, 0.62, 0.75, 0.90]`
   - Tạo áp lực tâm lý thôi thúc người xem bình luận trước khi hết giờ.
3. **Music Track & Auto-Ducking**:
   - Nhạc nền căng thẳng (Tension BGM) được phát lặp liên tục.
   - Khi có giọng đọc AI cất lên, hệ thống tự động giảm âm lượng nhạc nền xuống **25%** (`floor = 0.25`) với tốc độ dốc vào `attackSec = 0.08s` và nhả ra `releaseSec = 0.20s`.
4. **Soft Limiter & Normalization**:
   - Bộ giới hạn mềm quét toàn bộ biên độ master buffer để triệt tiêu hiện tượng clipping (vỡ tiếng) khi giọng đọc, SFX và nhạc nền va chạm tại các điểm cao trào.

---

## 7. Động cơ Đồ hoạ & Bố cục 9:16 (`src/render/`)

Hệ thống cung cấp cơ chế kết xuất khung hình pluggable (`IFrameRenderer`) tối ưu hoá cho hiệu năng và độ ổn định cao:

### 7.1. Kiến trúc Bộ Kết xuất Khung hình (Frame Renderers)

1. **Satori Frame Renderer (`satoriFrameRenderer.ts` — Mặc định / Primary)**:
   - **Cơ chế**: Sinh Virtual DOM kịch bản `1080×1920` $\rightarrow$ Satori biên dịch sang SVG $\rightarrow$ Rust native engine (`@resvg/resvg-js`) rasterize sang buffer PNG.
   - **Smart Keyframe Caching**: Trong video 18s (540 frames), hầu hết các phân cảnh (Hook, Question, Reveal, Scorecard) đều là đồ hoạ tĩnh. Hệ thống tự động nhận diện trạng thái và lưu bộ đệm frame PNG đã render. Chỉ khi đến phân cảnh đếm ngược (Countdown tick/ring animation), Satori mới tính toán lại SVG.
   - **Hiệu quả**: Giảm số lần sinh SVG từ 540 lần xuống còn ~35 lần, giúp tốc độ render video 18s chỉ mất **dưới 20 giây** với mức tiêu thụ RAM cực thấp (~17MB heap).
2. **Software Frame Renderer (`softwareFrameRenderer.ts` — Fallback)**:
   - **Cơ chế**: Bộ rasterizer 2D Canvas thuần TypeScript/JavaScript (không cần font hệ thống hay native binary).
   - Sử dụng cơ chế mẫu keyframe phân đoạn để đảm bảo tính tất định (deterministic) 100% trên mọi nền tảng.
3. **Zero Browser Overhead**:
   - Dự án **loại bỏ hoàn toàn Puppeteer / Headless Chromium** ra khỏi kiến trúc render video.
   - Tiết kiệm hơn 500MB RAM, loại bỏ hoàn toàn độ trễ giao tiếp CDP qua WebSocket, không lo lỗi crash trình duyệt ngầm khi chạy batch hàng loạt.

### 7.2. Tiêu chuẩn Safe Zone 9:16
Khung hình di động TikTok/Shorts có độ phân giải **1080 × 1920**. Các vùng nguy hiểm bị che bởi UI của nền tảng:
- `y < 360px`: Thanh tìm kiếm, nút chuyển tab (Following/For You), tên camera filter.
- `y > 1580px`: Caption văn bản, hashtags, audio marquee quay tròn, nút Home/Shop.
- `x > 920px`: Cột nút tương tác (Avatar chủ kênh, Tim, Bình luận, Bookmark, Share).

**Quy chuẩn bố cục của Auto-Drawing:**
- **HUD Series**: `y = 120px` (nằm gọn phía trên cùng).
- **Question Box**: `y = 220px` (bắt đầu vùng an toàn).
- **Product Showcase Area**: `y = 480px – 1180px` (vùng trung tâm thị giác mạnh nhất).
- **Choice Deck Buttons**: `startY = 1200px`, kết thúc tại `bottomY <= 1520px`.
- **Countdown Pill / Reveal Banner**: Đặt tại `bottomY + 25px` (luôn <= 1560px).

### 7.3. Hỗ trợ Layout Sản phẩm Đa dạng
- **1 Sản phẩm** (`deal_or_scam`, `one_away`, `guess_the_price`): Thẻ sản phẩm lớn chính giữa `580×580`, hiệu ứng glow neon.
- **2 Sản phẩm** (`hi_lo`): 2 thẻ đối xứng đặt dọc hoặc đặt ngang với nhãn "MÓN A" (Mốc so sánh) và "MÓN B" (Cần đoán).
- **3 Sản phẩm** (`grocery_basket`): Layout giỏ hàng 3 tầng hiển thị kèm giá tiền và thanh ngân sách.
- **4 Sản phẩm** (`most_expensive`, `odd_one_out`): Lưới 2×2 trực quan (A, B, C, D) với nhãn phân định rõ ràng.

---

## 8. Cơ chế Bảo mật Dữ liệu & Tiếp thị Liên kết (Affiliate Safety)

Hệ thống được thiết kế để tuân thủ 100% chính sách cộng đồng của TikTok Shop, Shopee và Meta:

1. **Không in Link Affiliate lên Khung hình Video (Zero Burned-in Links)**:
   - Các nền tảng video ngắn sẽ bóp tương tác hoặc cấm đăng nếu phát hiện video có chứa URL thô hoặc mã QR chuyển hướng ngoài sàn.
   - Mô-đun `pixelScan.ts` sẽ phân tích buffer trước khi xuất video để đảm bảo không có chuỗi URL nào xuất hiện trong khung hình.
2. **Xuất Kèm File Caption Tiêu Chuẩn (`*.caption.json`)**:
   - Mọi thông tin tiếp thị, link affiliate ngắn gọn, mã voucher, và hashtags đều được xuất vào file JSON kèm theo để tự động đưa vào mục bình luận (Comment ghim) hoặc phần mô tả video.
