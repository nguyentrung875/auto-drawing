# Design Specification: Web Studio Preview & Video Renderer Synchronization (WYSIWYG)

**Date:** 2026-09-14  
**Status:** Approved by User  
**Target:** Web Studio (`studio/`) & Core Engine Renderer (`src/render/`)  
**Scope:** 100% Bit-for-Bit Visual Synchronization between Web Studio Preview & Core Engine Rendered MP4  

---

## 1. Executive Summary & Goals

Trước đây, Web Studio sử dụng một component React DOM riêng biệt ([`studio/src/components/GamePreview.tsx`](file:///d:/source_code/auto-drawing/studio/src/components/GamePreview.tsx)) với mã HTML/CSS và Tailwind mockup độc lập. Trong khi đó, video MP4 được sinh ra bởi Core Engine lại sử dụng template render chuẩn 1080×1920 ([`src/render/template/renderTemplate.ts`](file:///d:/source_code/auto-drawing/src/render/template/renderTemplate.ts)). Sự phân tách này dẫn đến hiện tượng **Visual Mismatch (lệch hoàn toàn về bố cục, màu sắc, font chữ và hiệu ứng animation)** giữa bản xem trước và video thật.

Mục tiêu của thiết kế này là:
1. **Thiết lập Single Source of Truth duy nhất cho giao diện:** Bản Preview trên Web Studio và Video MP4 xuất ra từ Puppeteer sử dụng chung chính xác mã HTML/CSS template từ `generateRenderHtml()`.
2. **Triệt tiêu 100% sai lệch giao diện (WYSIWYG):** Mọi chi tiết đồ họa (quầng sáng ambient glowing orbs, bố cục thẻ sản phẩm, bo góc, bóng đổ 3D, vòng đếm countdown SVG, hiệu ứng mở đáp án) hiển thị đồng nhất tuyệt đối.
3. **Interactive Timeline Scrubbing mượt mà tại 60fps:** Kéo thanh trượt hoặc bấm Play trên Studio sẽ điều khiển trực tiếp hàm `window.__SEEK_FRAME__(frame, timeSec)` trong template.
4. **Hỗ trợ chế độ Fullscreen Modal (1080×1920):** Cung cấp nút phóng to để người dùng soi chi tiết từng pixel ở kích thước thực.

---

## 2. Architecture & Data Flow

```text
+-------------------------------------------------------------------------------+
|                            Web Studio (Browser UI)                            |
|                                                                               |
|  [Game JSON Created] ---> fetch('POST /api/preview/html', { game })           |
|                                     |                                         |
|                                     v                                         |
|                 +---------------------------------------+                     |
|                 | studio/src/app/api/preview/html/route |                     |
|                 +---------------------------------------+                     |
|                                     |                                         |
|                                     v calls                                   |
|                 +---------------------------------------+                     |
|                 | src/render/template/renderTemplate.ts | (Single Source      |
|                 | generateRenderHtml(renderInput)       |  of Truth)          |
|                 +---------------------------------------+                     |
|                                     |                                         |
|                                     v returns HTML string                     |
|                                                                               |
|  <iframe srcDoc={html} style="transform: scale(0.259)" />                     |
|  (Scaled into 280x498 smartphone frame or Fullscreen Modal)                   |
|                                                                               |
|  [Scrubber 0s -> 18s] ---> iframe.contentWindow.__SEEK_FRAME__(timeSec)       |
|                                                                               |
|  [Click "Render MP4"] ---> bin/game.js render (uses SAME template!)           |
+-------------------------------------------------------------------------------+
```

---

## 3. Detailed Specifications

### 3.1. Backend API: `POST /api/preview/html`
- **File:** `studio/src/app/api/preview/html/route.ts`
- **Request Body:**
  ```json
  {
    "game": { ... } // GameJson object
  }
  ```
- **Execution:**
  1. Đọc danh sách sản phẩm từ `products/` (thông qua `ProductProvider` hoặc mock catalog).
  2. Tạo đối tượng `RenderInput`:
     ```ts
     const renderInput: RenderInput = {
       game,
       timeline: game.timeline,
       sceneData: { cards: layoutCards(game) },
       products: productDetails,
       diversification: { bgColor: '#0f172a', tilt: 0, bgm: 'default' },
       rootDir,
     };
     ```
  3. Gọi `generateRenderHtml(renderInput)` từ `src/render/template/renderTemplate.ts`.
  4. Trả về `Content-Type: text/html; charset=utf-8` chứa chuỗi HTML 1080×1920 hoàn chỉnh với ảnh Base64 nhúng trực tiếp.
- **Latency:** < 10ms (thuần túy xử lý chuỗi trong memory).

### 3.2. Frontend Viewport Component: `UnifiedViewport.tsx`
- **File:** `studio/src/components/UnifiedViewport.tsx` (hoặc nhúng trực tiếp trong `GamePreview.tsx`)
- **Props:**
  - `game`: `GameJson`
  - `currentTime`: `number` (thời gian hiện tại từ scrubber)
  - `isPlaying`: `boolean`
  - `totalDuration`: `number`
- **Rendering:**
  - Khung điện thoại dọc (tỉ lệ 9:16, chiều rộng 280px, chiều cao 498px).
  - Tỉ lệ scale: `280 / 1080 = 0.259259`.
  - Thẻ `<iframe>`:
    ```tsx
    <iframe
      ref={iframeRef}
      srcDoc={htmlContent}
      sandbox="allow-scripts"
      className="border-0 pointer-events-none select-none"
      style={{
        width: 1080,
        height: 1920,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    />
    ```
- **Timeline Scrubbing:**
  - Lắng nghe sự thay đổi của `currentTime`:
    ```ts
    if (iframeRef.current?.contentWindow?.__SEEK_FRAME__) {
      iframeRef.current.contentWindow.__SEEK_FRAME__(0, currentTime);
    }
    ```
- **Fullscreen Modal:**
  - Nút `⛶ Soi chi tiết` mở Modal overlay hiển thị khung iframe với tỉ lệ lớn hơn (scale 0.45 hoặc vừa chiều cao màn hình desktop), giúp người dùng kiểm tra rõ nét từng chi tiết trước khi render.

---

## 4. Error Handling & Edge Cases

1. **Iframe Load Timing:**
   - Đảm bảo không gọi `__SEEK_FRAME__` khi iframe chưa `onLoad`.
   - Có cờ `iframeLoaded: boolean` để đồng bộ ngay khi load xong.
2. **Missing Product Images:**
   - `resolveImageBase64` trong `renderTemplate.ts` có fallback hiển thị placeholder icon nếu file ảnh không tìm thấy, đảm bảo không bị vỡ giao diện.
3. **Multi-round Games:**
   - Template hỗ trợ đầy đủ các timeline slots khác nhau (18s cho single-round, 38s cho multi-round).

---

## 5. Verification Plan

1. **Automated Unit Tests:**
   - Tạo `studio/test/api/preview-html.test.ts`:
     - Test `POST /api/preview/html` trả về mã 200 và chuỗi HTML chứa `id="stage"`, `__SEEK_FRAME__`, và tên sản phẩm.
2. **Manual & Visual Comparison:**
   - Mở Web Studio tại [http://localhost:3000/studio](http://localhost:3000/studio).
   - Tạo game `HI_LO`.
   - So sánh trực tiếp:
     - Tab **"🎮 Mô phỏng"**: Bây giờ hiển thị đúng quầng sáng tím-xanh, font Inter, thẻ card 1080×1920 scale nhỏ, vòng xoay countdown SVG.
     - Tua thanh scrubber: Quan sát các chuyển cảnh mượt mà.
     - Bấm **"🎬 Render MP4 Thật"** ➔ Chuyển sang tab **"🎥 Video Thật"**: Xác nhận video MP4 và tab mô phỏng trùng khớp nhau 100%.
