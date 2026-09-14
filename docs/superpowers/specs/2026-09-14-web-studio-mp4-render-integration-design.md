# Design Specification: Web Studio MP4 Render Integration

**Date:** 2026-09-14  
**Status:** Approved by User  
**Target:** Web Studio (`studio/`) & Core Engine CLI (`bin/game.js`)  
**Scope:** On-Demand MP4 Rendering with Real-time Progress Streaming & In-Browser Video Playback  

---

## 1. Executive Summary & Goals

Hiện tại, Web Studio (`/studio`) chỉ hỗ trợ tạo `GameJson` và hiển thị mô phỏng giao diện tương tác qua HTML/CSS phone mockup. Toàn bộ tính năng xuất file video `.mp4` chuẩn 1080×1920 (chụp từng khung hình Canvas, tổng hợp âm thanh TTS tiếng Việt và mux FFmpeg) đang được đóng gói trong CLI Core Engine (`bin/game.js render`).

Mục tiêu của thiết kế này là:
1. **Tích hợp tính năng Render MP4 trực tiếp vào Web Studio UI** thông qua một nút bấm nổi bật `"🎬 Render MP4 Thật"`.
2. **Cung cấp tiến trình thời gian thực (Real-time Live Progress)** thông qua Server-Sent Events (SSE) để hiển thị chính xác % hoàn thành và stage hiện tại (TTS Voice -> Frame Render -> FFmpeg Mux).
3. **Cung cấp Video Player chuẩn 9:16 ngay trên trình duyệt** với endpoint streaming hỗ trợ HTTP Range Requests (`206 Partial Content`), cho phép phát video tức thì, tua mượt mà và tải về máy.
4. **Đảm bảo tính ổn định và cô lập (Process Isolation)** bằng cách chạy CLI qua child process độc lập, không làm nghẽn hoặc xung đột bundling Turbopack/Next.js.

---

## 2. Architecture & Data Flow

```text
+-------------------------------------------------------------------------------+
|                            Web Browser (Studio UI)                            |
|                                                                               |
|  [Game Config & Preview] ---> Click "🎬 Render MP4"                           |
|         ^                               |                                     |
|         | (SSE Events: audio,           v POST /api/render (gameJson/params)  |
|         |  progress %, done)   +---------------------------------------+      |
|         +----------------------|  Next.js Server API Route             |      |
|                                |  (studio/src/app/api/render/route.ts) |      |
|                                +---------------------------------------+      |
|                                                 |                             |
|                                                 | child_process.spawn         |
|                                                 v                             |
|                                +---------------------------------------+      |
|                                |  CLI Core Engine Launcher             |      |
|                                |  (bin/game.js render --game ...)      |      |
|                                +---------------------------------------+      |
|                                                 |                             |
|                                                 v                             |
|                                [ Pipeline: Audio -> Canvas -> FFmpeg ]        |
|                                                 |                             |
|                                                 v                             |
|  [Tab "🎥 Video MP4"] <======= GET /api/videos/<gameId>_<seed>.mp4            |
|  <video controls src="...">    (HTTP 206 Partial Content Range Streaming)     |
|                                (export/<gameId>_<seed>.mp4)                   |
+-------------------------------------------------------------------------------+
```

---

## 3. Backend API Specifications

### 3.1. `POST /api/render` (Streaming SSE)
- **File:** `studio/src/app/api/render/route.ts`
- **Request Body:**
  ```json
  {
    "gameId": "game_abc123",
    "gameJson": { ... },
    "mechanic": "HI_LO",
    "productIds": ["605899", "605900"],
    "seed": 123456,
    "resultVariant": "in_video"
  }
  ```
- **Response:** `Content-Type: text/event-stream; charset=utf-8`
- **SSE Event Protocol:**
  - `event: progress`
    ```json
    { "stage": "audio", "message": "Đang tổng hợp giọng lồng tiếng TTS...", "percent": 15 }
    ```
    ```json
    { "stage": "render", "message": "Đang vẽ khung hình video (180/450)...", "percent": 60 }
    ```
    ```json
    { "stage": "mux", "message": "Đang nén và ghép âm thanh bằng FFmpeg...", "percent": 90 }
    ```
  - `event: done`
    ```json
    {
      "ok": true,
      "gameId": "hi_lo_123456",
      "seed": 123456,
      "videoUrl": "/api/videos/hi_lo_123456_123456.mp4",
      "videoFilename": "hi_lo_123456_123456.mp4",
      "caption": "...",
      "hashtags": ["#doangia", "#affiliate"],
      "affiliateLink": "...",
      "renderMs": 14200
    }
    ```
  - `event: error`
    ```json
    { "ok": false, "error": "Render failed", "stderr": "..." }
    ```
- **Lifecycle & Cancellation:**
  - Lắng nghe `req.signal.on('abort', ...)`: Nếu client đóng tab hoặc bấm "Hủy", server ngay lập tức gọi `child.kill('SIGTERM')` để giải phóng tài nguyên.
  - Tự động xóa file cấu hình tạm trong `temp/` khi tiến trình kết thúc.

### 3.2. `GET /api/videos/[filename]` (Range Video Streaming)
- **File:** `studio/src/app/api/videos/[filename]/route.ts`
- **Security Validation:**
  - Chỉ cho phép filename khớp pattern: `/^[a-zA-Z0-9_\-]+\.mp4$/`
  - Chặn hoàn toàn traversal attacks (`..`, dấu phân cách thư mục `/` hoặc `\`).
- **HTTP Range Handling:**
  - Kiểm tra `fs.statSync(filePath)` để lấy `fileSize`.
  - Nếu có header `Range: bytes=start-end`:
    - Tính toán `start`, `end`, `chunkSize = end - start + 1`.
    - Trả về status `206 Partial Content` kèm headers:
      - `Content-Range: bytes ${start}-${end}/${fileSize}`
      - `Accept-Ranges: bytes`
      - `Content-Length: chunkSize`
      - `Content-Type: video/mp4`
  - Nếu không có `Range`: Trả về status `200 OK` kèm toàn bộ file stream.

---

## 4. Frontend UI/UX Specifications

### 4.1. Trigger Button trong `GamePreview.tsx`
- Vị trí: Trên Header của `GamePreview`, ngay cạnh nút "Copy JSON".
- Hiển thị:
  - Trạng thái thường: Nút màu Gradient Indigo/Rose `🎬 Render MP4 Thật`.
  - Trạng thái rendering: `⏳ Đang render... (45%)` (disabled, có hiệu ứng xung nhịp pulse).

### 4.2. Live Progress Modal / Bar
- Khi người dùng bấm Render:
  - Khởi tạo `AbortController` để hỗ trợ nút "Hủy".
  - Mở kết nối `fetch('/api/render')` và đọc stream qua `ReadableStreamDefaultReader`.
  - Hiển thị thanh tiến trình 0% -> 100% với animation mượt mà.
  - Hiển thị log mô tả bước hiện tại (Audio TTS -> Vẽ Canvas Frames -> FFmpeg Mux).
  - Nút "Hủy render": Gọi `abortController.abort()` và đóng panel.

### 4.3. Tab "🎥 Video MP4"
- Bổ sung tab thứ 5 vào thanh tabs của `GamePreview`: `['preview', 'video', 'json', 'timeline', 'audio']`.
- Khi render xong: Tự động active tab `video`.
- Nội dung tab `video`:
  - Khung điện thoại dọc 9:16 (`aspect-ratio: 9/16; max-width: 320px;`) chứa:
    ```tsx
    <video
      src={videoUrl}
      controls
      autoPlay
      loop
      playsInline
      className="w-full h-full object-contain rounded-2xl bg-black"
    />
    ```
  - Cụm Action Buttons:
    - `⬇ Tải về MP4` (thẻ `<a>` với thuộc tính `download`).
    - `📋 Sao chép link video`.
    - `🔄 Render lại` (cho phép render lại với seed khác hoặc cùng config).
  - Box thông số: Thời gian render (ví dụ: `15.4s`), đường dẫn file tại máy local.

---

## 5. Error Handling & Edge Cases

| Kịch bản lỗi | Cách xử lý |
|---|---|
| Người dùng đóng tab / bấm Hủy khi đang render | `req.signal.on('abort')` gửi `SIGTERM` tắt tiến trình CLI, dọn dẹp file `temp/`. |
| Truy cập file video ngoài thư mục `export/` | Regex chặn tên file, trả về `400 Bad Request` hoặc `404 Not Found`. |
| File MP4 chưa hoàn tất hoặc bị hỏng | Trả về event `error` kèm thông báo chi tiết từ `stderr`. |
| FFmpeg hoặc Node CLI không tìm thấy | Kiểm tra tồn tại của `bin/game.js` trước khi spawn, fallback báo lỗi rõ ràng. |
| Yêu cầu Range header không hợp lệ | Trả về `416 Range Not Satisfiable` kèm header `Content-Range: bytes */fileSize`. |

---

## 6. Verification Plan

1. **Automated Unit / API Tests:**
   - Tạo test suite `studio/test/api/videos.test.ts`:
     - Test chặn path traversal (`../`, `test.exe`).
     - Test trả về header 206 Partial Content và `Content-Range`.
   - Tạo test suite `studio/test/api/render.test.ts`:
     - Test validation body đầu vào.
2. **Manual & Browser Verification:**
   - Truy cập `http://localhost:3000/studio`.
   - Chọn mechanic `HI_LO`, chọn 2 sản phẩm bất kỳ, bấm **Tạo Video**.
   - Bấm **"🎬 Render MP4 Thật"**.
   - Quan sát thanh tiến trình cập nhật đều qua 3 giai đoạn: Audio -> Frames -> Mux.
   - Khi hoàn thành, xác nhận tab **"🎥 Video MP4"** tự mở, video tự phát, có âm thanh giọng đọc và hình ảnh chuẩn nét 1080×1920.
   - Kiểm tra file video tồn tại vật lý trong thư mục `export/`.
