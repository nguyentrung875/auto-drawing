# Hướng dẫn Khởi động Nhanh (Getting Started)

Tài liệu này cung cấp quy trình từng bước từ thiết lập môi trường trắng đến khi render thành công video đầu tiên với **auto-drawing (Universal AI Game Video Engine)**.

---

## 1. Yêu cầu Hệ thống & Môi trường

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị Production | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10/11, Ubuntu 22.04 LTS, macOS 13+ | Ubuntu 22.04 / 24.04 LTS hoặc Windows 11 64-bit | Local-first, không yêu cầu GPU rời |
| **Node.js** | `>= 22.12.0` | Node.js LTS v22.x | Bắt buộc hỗ trợ các tính năng native buffer & ES modules |
| **npm** | `>= 10.0.0` | npm đi kèm Node.js v22 | |
| **FFmpeg** | `>= 5.0` (libx264, aac) | FFmpeg 6.x / 7.x với static build | Bắt buộc có trong system `PATH` hoặc qua biến `FFMPEG_PATH` |
| **Trình duyệt** | Không yêu cầu | Không yêu cầu | 100% Zero Browser Dependencies (không cần Chrome/Puppeteer) |
| **RAM** | 8 GB | 16 GB - 32 GB | Khi render batch song song nhiều workers |
| **Ổ đĩa trống** | 5 GB SSD | 50 GB+ SSD NVMe | Chứa frame PNG tạm thời (`temp/`) và video xuất (`export/`) |
| **Internet** | Kết nối ổn định | Băng thông >= 20 Mbps | Dùng khi sinh giọng đọc trực tuyến Microsoft Edge Neural TTS |

### Kiểm tra phiên bản môi trường:
```bash
node -v      # Phải >= v22.12.0
npm -v       # Phải >= 10.0.0
ffmpeg -version
```

Nếu máy chưa cài đặt FFmpeg:
- **Windows**: `winget install Gyan.FFmpeg` hoặc tải từ [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) rồi thêm thư mục `bin` vào `PATH`.
- **Ubuntu/Debian**: `sudo apt update && sudo apt install -y ffmpeg`
- **macOS**: `brew install ffmpeg`

---

## 2. Cài đặt Dự án

### Bước 1: Clone kho mã nguồn
```bash
git clone https://github.com/nguyentrung875/auto-drawing.git
cd auto-drawing
```

### Bước 2: Cài đặt Dependencies cho Core Engine
```bash
npm install
```

### Bước 3: Cài đặt Dependencies cho Web Studio
```bash
npm --prefix studio install
```

---

## 3. Khởi tạo Tài nguyên Mẫu (Bắt buộc)

Dự án sử dụng cơ chế sinh asset offline tất định (deterministic) để đảm bảo không phụ thuộc vào CDN bên ngoài:

```bash
# Sinh 50 ảnh mẫu PNG 512×512 chuẩn cho 50 SKU (products/p001.json -> p050.json)
# Tự động tạo assets/images/, assets/audio/sfx/, assets/audio/music/
npm run assets:generate
```

Sau khi chạy xong, hãy kiểm tra:
- Thư mục `assets/images/` có chứa các file `p001.png` ... `p050.png`.
- Thư mục `assets/fonts/` có chứa `DejaVuSans.ttf` (hoặc font fallback).
- Thư mục `assets/audio/` có chứa các SFX (`tick.wav`, `countdown.wav`, `reveal.wav`).

---

## 4. Chạy Kiểm thử Toàn diện (Health Verification)

Trước khi thực hiện render video đầu tiên, hãy đảm bảo toàn bộ mã nguồn pass 100% kiểm tra static types, linter và unit tests:

```bash
npm run verify
```

Lệnh trên sẽ thực thi chuỗi:
1. `tsc --noEmit`: Kiểm tra 0 lỗi TypeScript strict mode.
2. `eslint src`: Đảm bảo quy tắc kiến trúc Clean Architecture / Bounded Contexts.
3. `vitest run`: Chạy toàn bộ 80+ test suites (380+ tests) cho catalog, validator, audio, scene, và renderers.

---

## 5. Render Video Đầu Tiên

Hệ thống cung cấp file thực thi CLI thông qua `bin/game.js` (tự động chạy trực tiếp bằng `tsx`).

### 5.1. Render 1 Video Multi-Round (Khuyến nghị cho TikTok / Reels)
Chạy thử game **Hi-Lo (Cao Hơn hay Thấp Hơn)** với 3 vòng thi, mỗi vòng 5 giây:

```bash
# Mặc định sử dụng Satori Frame Renderer (siêu nhẹ & keyframe caching nhanh gấp 3.5x)
node bin/game.js render --mode multi --mechanic hi_lo --rounds 3 --timer 5.0 --seed 839271

# Hoặc chỉ định rõ renderer nếu muốn:
# --renderer satori   (mặc định)
# --renderer software (phương án fallback thuần CPU pixel)
```

**Quá trình thực thi sẽ hiển thị tiến độ:**
1. `[challenge]` Curating 3 rounds using DSL `g1_hi_lo` (seed 839271).
2. `[scene]` Building timeline slots: Series Hook (1.0s) -> Round 1 (5.0s play + 2.0s reveal) -> MicroHook -> Round 2 -> Round 3 -> Scorecard (1.5s).
3. `[audio]` Synthesizing Edge TTS voiceovers, mixing tick SFX, and ducking tension BGM.
4. `[render]` Painting ~735 frames (30 FPS) with `scenePainter` & `RenderAssetCache`.
5. `[mux]` FFmpeg combining PNG sequence + WAV audio bed into `export/g1_hi_lo_839271.mp4`.
6. `[caption]` Generating `export/g1_hi_lo_839271.caption.json`.

Video thành phẩm sẽ nằm tại:
- **Video MP4**: `export/g1_hi_lo_839271.mp4`
- **Metadata/Caption**: `export/g1_hi_lo_839271.caption.json`

### 5.2. Render các Game Mechanics khác
```bash
# Game 2: Tìm sản phẩm đắt nhất (4 sản phẩm mỗi vòng)
node bin/game.js render --mode multi --mechanic most_expensive --rounds 3 --seed 123456

# Game 41: Deal Hời hay Bẫy Scam (Phân tích giá sale sốc)
node bin/game.js render --mode multi --mechanic deal_or_scam --rounds 3 --seed 777888

# Game 7: Giỏ hàng siêu thị (Bài toán Knapsack đủ tiền hay cháy túi)
node bin/game.js render --mode multi --mechanic grocery_basket --rounds 2 --seed 999111

# Game 9: Đoán khoảng giá
node bin/game.js render --mode multi --mechanic guess_the_price --rounds 3 --seed 456789
```

### 5.3. Xem trước (Preview) không cần render video
Nếu bạn chỉ muốn xem layout giao diện và kịch bản dưới dạng file HTML tương tác nhanh mà không tốn tài nguyên encode video:

```bash
node bin/game.js render --mode multi --mechanic hi_lo --rounds 3 --seed 839271 --preview
```
File HTML preview sẽ được sinh ra tại `export/preview_g1_hi_lo_839271.html`. Mở trực tiếp bằng trình duyệt để xem.

---

## 6. Khởi chạy Web Studio Trực quan

Web Studio là giao diện quản trị đồ hoạ xây dựng trên **Next.js 15 (App Router)** và **Tailwind CSS**, cho phép người dùng biên tập viên sáng tạo nội dung trực quan:

```bash
npm run studio:dev
```

Mở trình duyệt truy cập: **`http://localhost:3000`** (hoặc `http://localhost:3000/studio`)

### Các phân hệ chính trong Studio:
1. **Game Creator**:
   - Chọn Game Mechanic từ danh sách 7 game.
   - Chọn thủ công danh sách SKU hoặc để hệ thống tự động bốc ngẫu nhiên tương thích.
   - Tùy chỉnh seed ngẫu nhiên, biến thể hiển thị đáp án (`in_video` hoặc `comment`).
2. **Interactive Preview**:
   - Khung hình 9:16 tỉ lệ chuẩn di động.
   - Thanh trượt timeline kéo đến từng mốc thời gian để kiểm tra hiển thị.
3. **Live Server-Sent Events (SSE) Render**:
   - Bấm nút **"Render Video MP4"** để backend kích hoạt tiến trình render ngầm.
   - Thanh tiến trình hiển thị realtime tiến độ từng frame và thời gian ước tính.
   - Trình phát video MP4 tích hợp hỗ trợ **HTTP Range Requests** (tua tiến/lùi mượt mà).

---

## 7. Sản xuất Video Hàng Loạt (Batch Production)

Để vận hành kênh affiliate tự động xuất 50–100 video mỗi ngày:

```bash
node bin/game.js batch --count 50 --mechanics hi_lo,deal_or_scam,most_expensive,grocery_basket
```

### Đặc tính Batch Runner:
- **Fail-Forward**: Nếu 1 video gặp sự cố (ví dụ SKU bị thiếu ảnh), tiến trình ghi nhận lỗi vào log và tiếp tục render video tiếp theo mà không làm crash cả batch.
- **Deduplication / Fingerprint**: Tự động hash kết hợp sản phẩm để tránh trùng lặp nội dung giữa các video liên tiếp.
- **Batch Report**: Báo cáo tổng kết hiệu năng, tỷ lệ thành công/thất bại, thời gian trung bình mỗi video được ghi tại `export/batch-<timestamp>/batch_report.json`.

---

## 8. Cấu trúc Thư mục Runtime

Khi hệ thống vận hành, các thư mục sau sẽ được tự động quản lý:

```
auto-drawing/
├── products/          # Chứa 50+ file JSON metadata sản phẩm (p001.json...)
├── assets/            # Chứa ảnh PNG, font chữ DejaVuSans, âm thanh WAV
├── queue/             # Hàng đợi job (chế độ single-round / worker queue)
│   ├── pending/       # Các job đang chờ xử lý
│   └── completed/     # Các job đã hoàn tất
├── temp/              # Thư mục tạm thời chứa frames PNG khi render (tự dọn dẹp)
│   └── <jobId>/       # frames/frame_00000.png ... audio.wav
├── export/            # Thư mục xuất thành phẩm cuối cùng
│   ├── *.mp4          # Video thành phẩm chuẩn 1080×1920 H.264
│   └── *.caption.json # Script caption, hashtags và affiliate link
└── logs/              # Nhật ký chi tiết của từng lượt render (JSON Lines)
```

---

## 9. Xử lý các Sự cố Môi trường Ban đầu

### Lỗi: `Error: Cannot find module '@ffmpeg-installer/ffmpeg'` hoặc FFmpeg missing
**Xử lý:** Cài đặt FFmpeg trên máy và đảm bảo gõ lệnh `ffmpeg` trong terminal nhận diện được. Nếu dùng đường dẫn tuỳ chỉnh, đặt biến môi trường:
```bash
# Windows PowerShell
$env:FFMPEG_PATH="C:\ffmpeg\bin\ffmpeg.exe"

# Linux / macOS
export FFMPEG_PATH="/usr/bin/ffmpeg"
```

### Lỗi: Giọng đọc Edge-TTS bị timeout hoặc lỗi mạng
**Xử lý:**
- Mặc định `EdgeTtsEngine` có cơ chế fallback offline: nếu không kết nối được dịch vụ Microsoft Edge TTS, hệ thống sẽ tự động fallback sang `FormantViEngine` hoặc tạo audio placeholder an toàn để không làm hỏng tiến trình render video.
- Kiểm tra kết nối internet hoặc proxy nếu bạn muốn sử dụng giọng đọc Neural chất lượng cao.

### Lỗi: Ký tự tiếng Việt bị hiển thị ô vuông / dấu hỏi
**Xử lý:**
Đảm bảo file font `DejaVuSans.ttf` tồn tại trong thư mục `assets/fonts/DejaVuSans.ttf`. Pure Software Canvas của hệ thống phụ thuộc vào font TrueType này để render text tiếng Việt có dấu.
