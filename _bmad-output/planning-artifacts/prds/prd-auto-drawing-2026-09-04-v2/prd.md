---
title: Drawing Transformation Video Factory
created: 2026-09-04
updated: 2026-09-05
status: draft
---

# PRD: Drawing Transformation Video Factory

## 0. Document Purpose

Tài liệu này xác định các yêu cầu sản phẩm cho **Drawing Transformation Video Factory** — hệ thống nội bộ sản xuất video short-form tự động dựa trên quy trình biến đổi hình vẽ từng nét (Drawing Transformation). Tài liệu đóng vai trò là kim chỉ nam kỹ thuật và tiêu chuẩn nghiệm thu duy nhất cho các giai đoạn thiết kế kiến trúc (`bmad-architecture`), thiết kế trải nghiệm người dùng (`bmad-ux`), và phân rã công việc lập trình (`bmad-create-epics-and-stories`). 

Mọi thuật ngữ trong tài liệu đều được neo chặt tại [Mục 3. Glossary](#3-glossary). Các giả định kỹ thuật lớn được đánh dấu bằng nhãn `[ASSUMPTION]` và tổng hợp tại [Mục 10. Assumptions Index](#10-assumptions-index). Các chi tiết triển khai kỹ thuật sâu hoặc nghiên cứu thư viện mã nguồn mở được lưu trữ tại [`addendum.md`](file:///d:/My%20Folder/source_code/auto-drawing/_bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/addendum.md).

---

## 1. Vision

> **Turn simple shapes into surprising drawings — automatically, repeatedly, and at zero marginal cost.**

Drawing Transformation Video Factory không phải là một ứng dụng chỉnh sửa video thông thường, cũng không sử dụng AI tạo video đen (black-box generative AI) để giả mạo quá trình vẽ. Đây là một **nhà máy nội dung (Content Factory)** tự động hóa 100% quy trình:
$$\text{Hook đơn giản (số/chữ/ký hiệu)} \xrightarrow{\text{Tò mò}} \text{Quy trình vẽ từng nét} \xrightarrow{\text{Bất ngờ}} \text{Reveal tranh hoàn thiện} \xrightarrow{\text{Hành động}} \text{CTA}$$

Hệ thống giải quyết bài toán nút thắt nhân lực của nhà sáng tạo nội dung đơn lẻ (solo creator / affiliate operator): thay vì mất 2–4 giờ vẽ tay, ghi âm, cắt ghép và dựng animation cho một video 20 giây, hệ thống cho phép sinh hàng loạt 50–100 video độc bản mỗi ngày với chi phí tiệm cận 0đ nhờ kiến trúc Local-first (chạy offline hoàn toàn trên máy trạm cá nhân, sử dụng thư viện nguồn mở MIT/Apache 2.0).

---

## 2. Target User

### 2.1 Jobs To Be Done (JTBD)
- **Functional Job:** Tự động chuyển đổi các ý tưởng biến hình (ví dụ: "Số 8 thành Con Gấu") thành video ngắn hoàn chỉnh (1080×1920 MP4, 30fps) có âm thanh thuyết minh tiếng Việt và nhạc nền đồng bộ mà không cần can thiệp dựng thủ công.
- **Economic Job:** Sản xuất quy mô lớn (batch 50–100 video/ngày) phục vụ tiếp thị liên kết (affiliate) hoặc xây kênh short-form với chi phí tính toán và vận hành thấp nhất có thể.
- **Quality Job:** Đảm bảo 100% video xuất xưởng có chuyển động ngòi bút bám sát nét vẽ thực tế, không có hiện tượng "teleport" hay nét vẽ tự hiện ra như các công cụ AI thông thường.

### 2.2 Non-Users (v1)
- **Họa sĩ diễn hoạt chuyên nghiệp:** Sản phẩm không phục vụ những người cần công cụ vẽ tay tự do (như Procreate hay Adobe Animate).
- **Khách hàng đại chúng (B2C Public Users):** Hệ thống được thiết kế như một công cụ vận hành nội bộ (Internal Factory Tool) cho operator, không phải nền tảng SaaS đại trà có quản lý người dùng phức tạp.

### 2.3 Key User Journeys

#### UJ-1: Huy sản xuất một video đơn lẻ để kiểm chứng concept mới
- **Protagonist:** Huy — solo creator kiêm affiliate operator trong ngành văn phòng phẩm và dụng cụ mỹ thuật.
- **Entry state:** Huy mở giao diện dòng lệnh hoặc dashboard cục bộ trên laptop của mình.
- **Path:**
  1. Huy nhập lệnh tạo video với input: `"8 -> Bear"`, phong cách `"cute_simple"`, ngôn ngữ `"vi"`.
  2. Hệ thống kiểm tra Registry, tìm thấy Hook `"8"` và Subject `"Bear"` hợp lệ; tự động lập kế hoạch vẽ (Drawing Plan) gồm 6 bước: số 8, tai trái, tai phải, mắt, mũi, miệng.
  3. Hệ thống tạo giọng đọc tiếng Việt qua viPiper, tự động căn chỉnh thời gian từng nét vẽ khớp hoàn hảo với nhịp điệu giọng nói, chèn SFX sột soạt của bút chì.
  4. Hệ thống thực hiện Color Fill Reveal (đổ màu phẳng cho gấu) trong 1.5 giây và hiển thị CTA "Link bút vẽ ở bio nhé!".
  5. Trình phát preview bật lên ngay trên máy để Huy xem thử.
- **Climax:** Video chạy mượt mà từ đầu đến cuối: đầu bút đi tới đâu nét hiện tới đó, giọng đọc nói "Thêm hai cái tai" đúng khoảnh khắc tai gấu được vẽ xong.
- **Resolution:** Huy bấm xác nhận xuất bản, nhận file `export/8_bear_v1.mp4` sẵn sàng đăng TikTok.
- **Edge case:** Nếu một nét tai bị lệch ra ngoài khung hình canvas (Canvas Bounds), bộ validator chặn lại ngay tại Bước 2, báo lỗi chi tiết và đề xuất tọa độ căn chỉnh thay vì để video bị render lỗi.

#### UJ-2: Huy chạy mẻ sản xuất hàng loạt 50 video cho tuần mới
- **Protagonist:** Huy, chuẩn bị content cho cả tuần.
- **Entry state:** Huy chuẩn bị một danh sách 50 cặp biến hình dạng CSV hoặc prompt: `"50 biến hình từ chữ số 0-9 thành con vật dễ thương"`.
- **Path:**
  1. Huy khởi chạy tiến trình batch factory.
  2. Hệ thống chạy bộ lọc Transformation Scoring: 46 concept đạt điểm ≥ 18/25 được đưa vào queue xử lý; 4 concept điểm thấp được đánh dấu để review sau.
  3. Video Diversification Engine tự động phối màu nền giấy (5 mẫu), màu mực, độ nghiêng canvas (±2°) và nhạc nền ngẫu nhiên cho từng video để tránh bị thuật toán quét trùng lặp nội dung.
  4. Hệ thống chạy render song song trên máy cục bộ; tự động retry nếu có bước gặp sự cố tạm thời.
- **Climax:** Sau 35 phút, toàn bộ 46 video đã render xong với báo cáo validation 100% pass.
- **Resolution:** Huy mở thư mục xuất, kiểm tra ngẫu nhiên 3 video đạt chuẩn và lên lịch đăng tải.

#### UJ-3: Huy nạp thêm Component mới vào Registry mà không cần vẽ tay
- **Protagonist:** Huy muốn bổ sung con vật mới ("Thỏ tai dài") vào thư viện.
- **Entry state:** Huy không biết dùng phần mềm đồ họa vector chuyên nghiệp.
- **Path — 3 lựa chọn song song (operator chọn cách phù hợp nhất):**
  - **Path A (LLM DSL):** Huy nhập mô tả `"Thỏ tai dài biến hình từ số 3"`. LLM sinh Drawing DSL, hệ thống biên dịch và hiển thị Preview trong 10 giây. Retry tối đa 3 lần nếu DSL vi phạm schema.
  - **Path B (SVG Ingestion):** Huy kéo thả một file SVG con thỏ tải trên mạng. Tool tự bóc tách các `<path>` theo thứ tự xuất hiện trong file.
  - **Path D (Image Ingestion — gated by spike):** Huy lưu ảnh hướng dẫn vẽ từ Pinterest xuống local, chạy lệnh `draw ingest-image ./rabbit-tutorial.jpg`. Vision LLM phân tích ảnh step-by-step (~3 giây), hiện Preview animate 6 bước trên canvas. Huy xác nhận tỷ lệ ổn và tùy chọn assign hook: `--hook 3`.
- **Climax (mọi path):** Huy bấm "Duyệt", component được lưu vào Registry với metadata `ingestion_path`, `hook_ref`, và ảnh gốc (nếu Path D) để tham chiếu sau.
- **Resolution:** Component có thể tái sử dụng ngay lập tức cho các video tiếp theo. Subject chưa có hook được đặt vào bucket "available subjects" chờ operator assign.

---

## 3. Glossary

Mọi tài liệu, mã nguồn và giao diện người dùng downstream bắt buộc phải sử dụng chính xác các danh từ sau:

- **Hook:** Ký hiệu hoặc hình vẽ đơn giản xuất hiện ở đầu video để kích thích sự tò mò của người xem (ví dụ: số "8", chữ "C", hình tròn).
- **Subject:** Đối tượng hoàn chỉnh cuối cùng mà Hook được biến đổi thành (ví dụ: Bear, Cat, Flower).
- **Transformation:** Cặp nguyên tử (Hook → Subject) đi kèm toàn bộ Drawing Sequence hoàn chỉnh.
- **Drawing Sequence:** Danh sách có thứ tự các Drawing Step cấu thành một Transformation.
- **Drawing Step:** Một bước vẽ đơn lẻ, bao gồm: ID định danh, geometry (tọa độ path), thứ tự vẽ (drawing order), quy tắc thời lượng (duration rule) và lời thoại tương ứng (voice line).
- **Component:** Phần tử đồ họa tái sử dụng được lưu trong Registry (ví dụ: `bear_left_ear`, `bear_eyes`).
- **Primitive:** Phần tử hình học cơ bản nhất không thể phân tách nhỏ hơn: `arc`, `circle`, `line`, `bezier_2`, `bezier_3`, `polyline`, `rect`. LLM bắt buộc phải sử dụng các primitive này khi sinh DSL.
- **Drawing DSL:** Ngôn ngữ mô tả nét vẽ dạng JSON schema nghiêm ngặt. LLM chỉ được phép sinh DSL, tuyệt đối không được sinh mã SVG thô.
- **DSL Compiler:** Thành phần biên dịch Drawing DSL thành tọa độ SVG path tuyệt đối trên canvas. Đảm bảo tính tất định (Deterministic).
- **DSL Validator:** Thành phần kiểm tra tính hợp lệ của DSL trước khi biên dịch (kiểm tra schema, giới hạn tọa độ, tính liên tục).
- **Registry:** Kho lưu trữ tập trung các Component đã qua kiểm định chất lượng.
- **Asset:** Tài nguyên media phi hình học: file âm thanh giọng đọc (TTS), hiệu ứng âm thanh (SFX), nhạc nền (BGM), texture nền giấy.
- **Canvas Bounds:** Khung không gian vẽ hợp lệ (chuẩn xuất 1080×1920 pixels).
- **Pen Tip / Chalk Pivot:** Tọa độ điểm neo cố định tại chóp đầu viên phấn/ngòi bút trên ảnh bàn tay 2D — bắt buộc phải bám sát tuyệt đối đầu mút của nét vẽ đang xuất hiện trên từng frame.
- **Hand Engine:** Module tính toán động học bàn tay: xác định tọa độ dịch chuyển ($p = \text{path.point\_at}(t)$), góc xoay theo tiếp tuyến vector nét vẽ ($\theta = \text{tangent.angle}$) và điều phối cử động nhấc/hạ tay.
- **2D Hand Asset:** Tài nguyên đồ họa hình bàn tay người thật (ảnh PNG tách nền trong suốt) đang ở tư thế cầm bút hoặc cầm phấn, được gán sẵn điểm neo Pivot để render đè lên canvas.
- **Hand Tangent Rotation:** Thuật toán tính góc nghiêng của bàn tay theo hướng tiếp tuyến của nét cong Bézier tại từng frame, có áp dụng bộ lọc làm mịn (smoothing) và giới hạn góc quay (clamping) để tạo cử động tự nhiên.
- **Hand Occlusion:** Cơ chế xếp lớp hiển thị (compositing order) bảo đảm mu bàn tay và ngón tay luôn che khuất nét vẽ nằm phía dưới chúng, ngăn chặn triệt để lỗi "nét vẽ nổi đè lên trên bàn tay".
- **Pen-up Lift Motion:** Cử động nhấc bàn tay và dịch chuyển nhẹ (kèm hiệu ứng scale nhỏ 1.03x hoặc mờ bóng) trong 0.2s–0.4s khi chuyển giữa các nét vẽ không liên tục.
- **Dead Air:** Khoảng thời gian hoàn toàn im lặng trong video (không có voice, không có SFX vẽ, không có BGM). Ngưỡng tối đa cho phép là ≤ 0.5s.
- **Pacing Orchestration:** Động cơ điều phối nhịp độ tự động, co giãn tốc độ vẽ hoặc chèn âm thanh nền để xóa bỏ Dead Air.
- **Color Fill Reveal:** Kỹ thuật đổ màu phẳng (flat color) lên các vùng kín của hình vẽ hoàn chỉnh trong ~1.5 giây trước khi chuyển sang CTA.
- **Batch:** Tập hợp nhiều concept được lập lịch và sản xuất tự động trong một phiên chạy.
- **Production-ready:** Trạng thái của video đã vượt qua 100% các cổng kiểm tra chất lượng (Quality Gates).
- **Seed:** Giá trị ngẫu nhiên khởi tạo dùng để tái hiện 100% chính xác logic của một video đã tạo.

---

## 4. Features

### 4.1 Transformation Registry & Ingestion Pipeline
**Mô tả:** Quản lý kho dữ liệu các linh kiện đồ họa và giải quyết triệt để nút thắt nhập liệu bằng quy trình nạp bán tự động (thực hiện UJ-3). Ngăn chặn tình trạng solo operator phải vẽ tay từng nét bằng công cụ đồ họa phức tạp.

#### FR-1: Registry Store
Hệ thống SHALL duy trì một kho lưu trữ cục bộ có cấu trúc lưu các Component đã kiểm định.
- **Consequences (testable):**
  - Hệ thống đọc và nạp danh mục Component trong thời gian ≤ 500ms khi khởi động.
  - Mỗi Component có mã ID duy nhất, bounding box, danh sách stroke có thứ tự và metadata phong cách.
- **Out of Scope:** Lưu trữ trên đám mây đa người dùng trong giai đoạn MVP.

#### FR-2: Drawing DSL Generation
Hệ thống SHALL cho phép LLM sinh Component mới thông qua Drawing DSL có schema JSON nghiêm ngặt (chỉ sử dụng các Primitive đã khai báo).
- **Consequences (testable):**
  - DSL Validator từ chối ngay lập tức bất kỳ cấu trúc JSON nào chứa mã SVG thô hoặc tọa độ nằm ngoài Canvas Bounds.
  - LLM được retry tối đa 3 lần nếu vi phạm schema trước khi đánh dấu lỗi cho operator.
  - DSL Compiler dịch mã DSL hợp lệ thành tọa độ SVG path tuyệt đối trong thời gian ≤ 100ms.

#### FR-3: Semi-Auto SVG Ingestion (Path B)
Hệ thống SHALL cung cấp công cụ nạp file SVG có sẵn, tự động phân rã các `<path>` thành các Drawing Step theo thứ tự xuất hiện trong file.
- **Consequences (testable):**
  - Tự động chuẩn hóa tỷ lệ (normalize scale) về kích thước chuẩn của canvas.
  - Hiển thị cửa sổ xem trước (Preview) diễn hoạt nét vẽ cho operator duyệt trong vòng ≤ 10 giây.

#### FR-3b: Image-to-DSL Ingestion (Path D) `[SPIKE-GATED]`
Hệ thống SHALL cung cấp công cụ nạp ảnh hướng dẫn vẽ (how-to-draw tutorial image) từ file local, sử dụng Vision LLM để extract Drawing Steps tự động.
- **Activation condition:** Chỉ đưa vào MVP nếu spike `spike/vision-ingestion/` đạt accuracy ≥ 70% trên bộ 10 ảnh test. Nếu thấp hơn: duy trì Path A + Path B + Path C là đủ.
- **Consequences (testable):**
  - Lệnh `draw ingest-image <file>` nhận ảnh JPG/PNG/WebP local, gọi `IVisionParser`, trả về JSON Drawing Steps trong ≤ 10 giây.
  - Nếu `confidence < 0.7` hoặc `is_step_tutorial: false`: từ chối với thông báo rõ ràng, không tự động commit vào Registry.
  - Hiển thị Preview animate từng bước trên canvas để operator xác nhận trước khi lưu (giống FR-3).
  - Hỗ trợ flag `--hook <value>` để operator assign hook cho Subject-only import (hook_ref: null → bucket "available subjects").
  - Component được lưu kèm metadata: `ingestion_path: "vision-image"`, `source_image: <filename>`, `llm_confidence: <float>`.
  - Chi phí Vision LLM call: **one-time per Subject** (≤$0.005), không phát sinh lại khi render video.
- **Out of Scope:** Crawl ảnh trực tiếp từ URL Pinterest — operator phải download về local trước.

---

### 4.2 Content Planning & Transformation Definition
**Mô tả:** Tiếp nhận ý tưởng từ người dùng hoặc sinh tự động các cặp biến hình, đánh giá tính khả thi và lập kịch bản sản xuất chi tiết (thực hiện UJ-1, UJ-2).

#### FR-4: Concept Creation
Hệ thống SHALL hỗ trợ tạo concept biến hình gồm: `hook`, `subject`, `language`, `style`.
- **Consequences (testable):**
  - Đầu vào hợp lệ sinh ra một đối tượng Concept có ID duy nhất và trạng thái ban đầu là `draft`.

#### FR-5: Transformation Definition & Scoring
Hệ thống SHALL tự động chấm điểm concept theo thang 5 tiêu chí (tổng 25 điểm): Tò mò (Curiosity), Đơn giản (Simplicity), Khả thi hình học (Drawing Feasibility), Tính biến đổi (Visual Transformation), và Tiềm năng giữ chân (Retention Potential).
- **Consequences (testable):**
  - Chỉ các concept đạt tổng điểm ≥ 18/25 mới được tự động đưa vào hàng đợi sản xuất video.
  - Concept dưới 18 điểm được gắn trạng thái `low_score` để operator xem xét thủ công.

#### FR-6: Deterministic Seed & Asset Reuse
Hệ thống SHALL cho phép tái hiện chính xác một kết quả logic khi cung cấp cùng input và Seed.
- **Consequences (testable):**
  - Hai lần chạy với cùng concept và cùng Seed tạo ra cấu trúc Drawing Step, độ dài timeline và tham số biến thiên giống nhau 100%.

---

### 4.3 Drawing Generation & Validation Engine
**Mô tả:** Động cơ cốt lõi bảo đảm tính toán học và tính hợp lý của hình vẽ (thực hiện nguyên lý Deterministic Drawing).

#### FR-7: Drawing Sequence Geometry
Mỗi Drawing Step trong sequence bắt buộc phải gắn với một đối tượng hình học xác định, thứ tự nét vẽ rõ ràng và quy tắc thời lượng.
- **Consequences (testable):**
  - Không tồn tại bước vẽ nào mà thiếu thông tin tọa độ path hoặc thời gian thực hiện.

#### FR-8: Drawing & Geometry Validation
Hệ thống SHALL kiểm tra và từ chối kế hoạch vẽ nếu phát hiện lỗi hình học.
- **Consequences (testable):**
  - Từ chối kế hoạch nếu: nét vẽ vượt quá Canvas Bounds, nét vẽ tự cắt nhau bất thường, hoặc tham chiếu đến Component không tồn tại trong Registry.
  - Trong chế độ Batch: hệ thống ghi nhận lỗi vào metadata (`status: failed_validation`) và tự động chuyển sang concept tiếp theo mà không gây sập (crash) toàn bộ tiến trình.

#### FR-9: Drawing-to-Reveal Consistency
Hình ảnh cuối cùng của bức vẽ trước khi reveal bắt buộc phải được kết xuất từ chính tập hợp geometry đã được vẽ qua các bước trước đó.
- **Consequences (testable):**
  - Tuyệt đối không được thay thế bằng một file ảnh bitmap hoặc vector độc lập không trải qua quá trình vẽ.

---

### 4.4 Audio & Pacing Orchestration
**Mô tả:** Điều phối âm thanh và thời gian để đảm bảo video luôn cuốn hút, không bao giờ rơi vào khoảng lặng (thực hiện UJ-1).

#### FR-10: Vietnamese Voiceover
Hệ thống SHALL tạo giọng đọc tiếng Việt khớp với từng Drawing Step bằng engine viPiper cục bộ.
- **Consequences (testable):**
  - File audio thuyết minh được xuất dưới định dạng WAV/AAC chất lượng cao mà không tốn chi phí gọi API đám mây.

#### FR-11: Audio-Visual Timing Master & Pacing Engine
Video timeline SHALL lấy thời lượng giọng đọc (TTS audio duration) làm mốc tham chiếu chính (Audio-driven timeline).
- **Consequences (testable):**
  - Tốc độ vẽ của nét tương ứng được co giãn tự động để kết thúc đồng thời với câu thoại (cho phép tăng tốc tối đa 2x hoặc chèn khoảng dừng tự nhiên).
  - Dead Air (im lặng hoàn toàn) SHALL không vượt quá 0.5 giây tại bất kỳ thời điểm nào. Nếu có khoảng trống giữa các câu thoại, hệ thống tự động lấp đầy bằng tiếng bút vẽ sột soạt (SFX) hoặc nhạc nền nhẹ (BGM).

#### FR-12: SFX & Background Music
Hệ thống SHALL tự động gắn hiệu ứng âm thanh tiếng bút vẽ khi ngòi bút di chuyển và âm thanh chuông/tinh tinh (chime) tại khoảnh khắc Reveal.
- **Consequences (testable):**
  - Âm lượng SFX và BGM được tự động cân bằng (ducking) để không lấn át giọng đọc chính.

---

### 4.5 Video Composition & Hand-Drawn Rendering Engine
**Mô tả:** Kết xuất đồ họa chuyển động thành video MP4 hoàn chỉnh với hiệu ứng vẽ tay chân thực (thực hiện UJ-1).

#### FR-13: Drawing Animation & 2D Hand Controller
Hệ thống SHALL tích hợp bộ điều khiển bàn tay 2D (2D Hand Controller) điều khiển ảnh bàn tay cầm phấn/bút bám sát tuyệt đối tiến trình xuất hiện của đường nét vẽ.
- **Consequences (testable):**
  - **Tọa độ điểm neo (Chalk Pivot Tracking):** Độ lệch giữa điểm neo đầu viên phấn/ngòi bút trên ảnh 2D Hand và tọa độ nét vẽ hiện hành $\le 5$ pixels trên từng frame.
  - **Góc xoay tiếp tuyến (Tangent Rotation):** Góc xoay của bàn tay được tính toán theo vector tiếp tuyến của path ($\theta = \arctan2(dy, dx)$), được làm mịn qua bộ lọc giảm giật (damping/smoothing) và giới hạn trong dải góc tự nhiên (clamping $\pm 35^\circ$ so với góc nghiêng cơ sở), ngăn chặn hoàn toàn việc bàn tay bị quay vòng $360^\circ$ phi thực tế.
  - **Cử động chuyển nét (Pen-up Lift Motion):** Khi di chuyển giữa hai nét vẽ không liên tục, bàn tay thực hiện cử động nâng nhẹ (scale +3% hoặc dịch chuyển $+10\text{px}$ theo phương thẳng đứng và giảm độ đậm bóng đổ) trong $0.2\text{s} - 0.4\text{s}$; tuyệt đối không có hiện tượng dịch chuyển tức thời (teleport > 10px giữa 2 frame liên tiếp).

#### FR-13b: Hand Occlusion & Compositing Layering
Hệ thống SHALL bảo đảm cấu trúc xếp lớp đồ họa (visual layering) tuân thủ chặt chẽ nguyên lý che khuất vật lý:
- **Consequences (testable):**
  - Thứ tự lớp hiển thị bắt buộc: $\text{Background Texture} < \text{Nét đã vẽ xong} < \text{Nét đang vẽ} < \text{2D Hand Asset}$.
  - Nét vẽ xuất hiện từ vị trí đầu viên phấn và lập tức bị mu bàn tay/ngón tay che khuất nếu nét đó đi vào vùng không gian bên dưới ảnh bàn tay. Tuyệt đối không để nét vẽ hiển thị đè lên trên bàn tay.

#### FR-13c: Visual Medium & Texture Styling
Hệ thống SHALL hỗ trợ tối thiểu 2 phong cách chất liệu thị giác có thể cấu hình:
- **Consequences (testable):**
  - **Phong cách Bảng đen/Bảng xanh (Chalkboard Style):** Nền bảng có vân nhám, nét vẽ mô phỏng phấn trắng (rough stroke edge với độ mờ/noise nhẹ), bụi phấn mờ (chalk dust) rơi tại các điểm đổi hướng nét vẽ, kèm âm thanh phấn cọ vào bảng.
  - **Phong cách Giấy vẽ (Paper Sketch Style):** Nền giấy mỹ thuật có hạt sần (grain), nét bút chì/bút dạ mượt mà, kèm âm thanh ngòi bút sột soạt.

#### FR-14: Color Fill Reveal
Hệ thống SHALL hỗ trợ tính năng tùy chọn: sau khi nét vẽ hoàn tất, thực hiện đổ màu phẳng (flat SVG fill) lên các mảng kín của hình vẽ trong 1.0s – 2.0s trước khi hiển thị CTA.
- **Consequences (testable):**
  - Tăng độ thẩm mỹ và tỷ lệ chuyển đổi cho sản phẩm affiliate mà không làm phức tạp hóa engine vẽ.

#### FR-15: Configurable CTA & Video Composition
Khung hình kết thúc (CTA) có thể cấu hình linh hoạt (ví dụ: text, icon giỏ hàng, lời kêu gọi) và không được hard-code vào renderer.
- **Consequences (testable):**
  - Thay đổi nội dung CTA chỉ qua file cấu hình JSON mà không cần biên dịch lại mã nguồn.

#### FR-16: Video Export
Hệ thống SHALL xuất video định dạng MP4 (H.264 / AAC), kích thước chuẩn 1080×1920 (tỷ lệ 9:16), tốc độ 30 FPS.
- **Consequences (testable):**
  - Tổng thời lượng video nằm trong khoảng mục tiêu: 15 đến 30 giây.
  - Nếu thời lượng vẽ vượt quá 25s, hệ thống tự động áp dụng hệ số tăng tốc (1.2x–1.8x) cho các nét phụ để tổng thời lượng không vượt quá 30 giây.

---

### 4.6 Batch Factory & Diversification Engine
**Mô tả:** Tự động hóa sản xuất quy mô lớn và chống thuật toán quét trùng lặp nội dung của nền tảng (thực hiện UJ-2).

#### FR-17: Batch Generation Pipeline
Hệ thống SHALL có khả năng nhận một danh sách hàng chục/hàng trăm concept và tự động xử lý qua toàn bộ pipeline từ planning, validation, synthesis đến rendering.
- **Consequences (testable):**
  - Hỗ trợ xử lý song song dựa trên số nhân CPU của máy cục bộ, quản lý hàng đợi không gây tràn bộ nhớ RAM.

#### FR-18: Video Diversification Engine
Hệ thống SHALL tự động áp dụng các biến thiên ngẫu nhiên có kiểm soát cho từng video trong batch.
- **Consequences (testable):**
  - Mỗi video trong batch bắt buộc phải mang ít nhất 2 yếu tố khác biệt: chất liệu/màu nền giấy (từ thư viện ≥ 5 mẫu), màu mực vẽ, độ nghiêng khung vẽ ngẫu nhiên (±2°), hoặc bản nhạc nền ngẫu nhiên.
  - Toàn bộ tham số biến thiên được lưu trong metadata cùng Seed để đảm bảo tính tái lập (Reproducibility).

#### FR-19: Quality Gate & Error Recovery
Hệ thống SHALL tự động phân loại video thành công vào thư mục `production-ready`, các video gặp lỗi hoặc nghi ngờ chất lượng vào thư mục `needs-review`.
- **Consequences (testable):**
  - Không có video hỏng nào bị gắn nhãn thành công giả (False Positive).

#### FR-20: Generation Metadata & Cost Tracking
Mỗi video xuất xưởng SHALL đi kèm một file metadata JSON chứa: ID, Seed, thời gian render, tài nguyên sử dụng, chi phí tính toán (0 USD nếu chạy local).
- **Consequences (testable):**
  - Phục vụ việc đối soát hiệu quả chuyển đổi affiliate downstream.

---

## 5. Non-Goals (Explicit)

Để bảo đảm thời gian hoàn thành MVP trong 1–2 tuần, hệ thống dứt khoát **KHÔNG** làm các phần việc sau:
- ❌ **Không làm 3D Animation hoặc Diễn hoạt nhân vật phức tạp:** Chỉ tập trung vào diễn hoạt vẽ tay 2D dạng nét phác thảo (line-art sketch).
- ❌ **Không dùng Generative AI Video (Sora, Runway, Kling):** Không sử dụng các mô hình video AI tạo chuyển động ngẫu nhiên, không thể kiểm soát ngòi bút.
- ❌ **Không làm bàn tay người 3D siêu thực (3D Mesh / IK Rig) trong MVP:** Tránh làm phức tạp hóa pipeline bằng việc dựng mô hình 3D trong Blender/Three.js ở giai đoạn đầu. MVP sử dụng kiến trúc **2D Hand Asset (ảnh PNG tách nền + biến đổi tọa độ/tiếp tuyến)** để đạt độ chân thực 7/10 mà vẫn giữ tốc độ render tức thì và chi phí 0đ. Mô hình 3D Hand được quy hoạch vào Phase 6 (Future Roadmap khi cần chất lượng photorealistic tuyệt đối).
- ❌ **Không xây dựng trình biên tập video đầy đủ (Full Video Editor GUI):** Không xây giao diện dạng Premiere hay CapCut. Mọi tùy biến thực hiện qua kịch bản dữ liệu và file cấu hình.
- ❌ **Không tự động đăng tải đa nền tảng qua API không chính thức:** Tránh rủi ro bị khóa tài khoản mạng xã hội. MVP dừng lại ở việc xuất video hoàn chỉnh vào thư mục để người vận hành kiểm tra và đăng tải.
- ❌ **Không xây dựng hệ thống quản lý người dùng / Multi-tenant Cloud SaaS:** Chỉ phục vụ chạy cục bộ trên máy của operator.

---

## 6. MVP Scope

### 6.1 In Scope
- Kho lưu trữ Registry khởi tạo tối thiểu: 10 Hook chữ số (0–9) và 20 Subject con vật hoàn chỉnh với đầy đủ các bước bóc tách chi tiết.
- Bộ biên dịch và kiểm định Drawing DSL (DSL Compiler + Validator).
- Công cụ Semi-auto Ingestion bóc tách nét từ file SVG có sẵn.
- Tích hợp TTS tiếng Việt chạy offline hoàn toàn (viPiper / Piper).
- **Bộ điều khiển 2D Hand Controller:** Điều khiển ảnh bàn tay cầm phấn/bút bám sát tọa độ nét vẽ (độ lệch $\le 5\text{px}$), xoay theo góc tiếp tuyến có giới hạn góc (clamping), nhấc tay tự nhiên khi đổi nét (không teleport).
- **Cơ chế xếp lớp Hand Occlusion:** Đảm bảo bàn tay che nét vẽ bên dưới, không bị lỗi đè lớp ngược.
- **Thư viện 2D Hand Asset khởi tạo:** Tối thiểu 2 mẫu bàn tay cầm phấn/bút chuẩn (góc nhìn từ trên xuống cho người thuận tay phải).
- Động cơ điều phối nhịp điệu (Pacing Engine) chống Dead Air (> 0.5s).
- Tính năng Color Fill Reveal phẳng trước khi kết thúc video.
- Engine biến thiên video trong batch (nền bảng xanh/giấy vẽ, màu nét, độ nghiêng, BGM).
- Xuất video chuẩn MP4 1080×1920 30fps bằng FFmpeg / WebCodecs.
- Chạy batch 50 video hoàn toàn tự động trên máy cục bộ.
- **Exploration Mode — Export Comparison Set:** Single-video mode hỗ trợ lệnh `--variants N` để xuất N biến thể (mặc định 3) của cùng một concept với các tham số ngẫu nhiên khác nhau (màu, góc, BGM, script template). Phục vụ A/B test thủ công trước khi chạy batch toàn phần. *(Xác thực A-H11 — Content Hypothesis trước khi đầu tư batch)*
- **Image Ingestion (Path D) `[SPIKE-GATED]`:** Công cụ `draw ingest-image <file>` nạp ảnh how-to-draw local qua Vision LLM → Drawing Steps → Registry. Chỉ đưa vào MVP nếu spike đạt ≥ 70% accuracy. *(Xác thực FR-3b)*

### 6.2 Out of Scope for MVP
- Bàn tay 3D đa khớp (3D Hand Model với Inverse Kinematics) — quy hoạch cho Phase 6.
- Giọng đọc đa ngôn ngữ (tiếng Anh, tiếng Tây Ban Nha) — dời sang v2.
- Giao diện kéo thả Component trực quan nâng cao — dời sang v1.5.
- Tự động lấy dữ liệu phân tích view/click từ TikTok/YouTube qua webhook — dời sang v2.
- Tự động A/B test nội dung câu kêu gọi hành động (CTA) gắn với link affiliate — dời sang v2.

---

## 7. Success Metrics

Mỗi chỉ số thành công đo lường trực tiếp năng lực vận hành và chất lượng sản phẩm:

### 7.1 Primary Metrics
- **SM-0 [P0] (Short-form Content Effectiveness):** Video đăng tải đạt tỷ lệ giữ chân 3 giây đầu **≥ 60%** và tỷ lệ xem hết (completion rate) **≥ 25%** trên kênh thử nghiệm. *Đây là thước đo kinh doanh duy nhất — mọi SM kỹ thuật bên dưới chỉ có giá trị nếu SM-0 đạt ngưỡng. Đo bằng Exploration Mode trước khi chạy batch toàn phần.*
- **SM-1 (Render Success Rate):** Tỷ lệ render video thành công không lỗi đạt **≥ 95%** trên mọi batch chạy từ 50 video trở lên. *(Xác thực FR-17, FR-19)*
- **SM-2 (Hand & Chalk Pivot Alignment):** 100% video xuất xưởng có điểm neo đầu phấn của 2D Hand bám sát nét vẽ với độ lệch **≤ 5px**, góc xoay mượt mà không có frame giật lật đột ngột (> 45°/frame), và không có frame teleport. *(Xác thực FR-13, FR-13b)*
- **SM-3 (Dead Air Elimination):** 100% video không có khoảng lặng hoàn toàn vượt quá **0.5 giây**. *(Xác thực FR-11)*
- **SM-4 (Production Speed):** Thời gian sản xuất trung bình cho 1 video (từ concept đến MP4) **≤ 45 giây** trên máy trạm cá nhân thông thường. *(Xác thực FR-16)*
- **SM-5 (Cost per Video Ceiling):** Chi phí biên mỗi video **≤ $0.01 USD** (chế độ local-first mặc định: $0.00; cho phép tối đa $0.01 nếu dùng TTS fallback chất lượng cao). *(Xác thực FR-10, NFR-3)*

### 7.2 Secondary Metrics
- **SM-6 (Registry Ingestion Time):** Operator có thể nạp và duyệt một Component mới từ SVG vào Registry trong thời gian **≤ 30 giây**. *(Xác thực FR-3)*
- **SM-7 (Batch Review Throughput):** Operator có thể rà soát và phê duyệt mẻ 50 video trong thời gian **≤ 15 phút**. *(Xác thực UJ-2)*

### 7.3 Counter-metrics (Chỉ số kiềm chế)
- **SM-C1 (Spam Rejection Rate):** Tỷ lệ tài khoản bị nền tảng TikTok/Shorts cảnh báo hoặc bóp tương tác (shadowban) do trùng lặp nội dung phải bằng **0%**. *(Kiềm chế FR-17 — không được spam số lượng mà bỏ qua biến thiên Diversification)*
- **SM-C2 (Operator Reject Rate):** Tỷ lệ video bị operator từ chối xuất bản ở khâu preview do hình vẽ xấu hoặc giọng đọc gượng gạo phải **≤ 10%**. *(Kiềm chế việc hạ thấp tiêu chuẩn validation)*

---

## 8. Cross-Cutting Non-Functional Requirements

### NFR-1: Reliability
- Hệ thống không bao giờ được tạo ra "thành công giả" (silent failure): nếu thiếu asset âm thanh, nét vẽ lỗi tọa độ hoặc render đứt đoạn, video phải lập tức bị đánh dấu thất bại kèm mã lỗi chi tiết trong file log.
- **SLO:** Tỷ lệ sập hệ thống (crash) khi xử lý batch 100 video là **0%**.

### NFR-2: Reproducibility
- Đảm bảo tính tất định 100%: Cùng một bộ tham số concept + cùng một giá trị Seed bắt buộc phải tạo ra video có cấu trúc thời gian, geometry và nội dung giống hệt nhau.

### NFR-3: Cost & Performance
- **Chi phí biên mỗi video ≤ $0.01 USD:** Chế độ mặc định là Local-first ($0.00 — viPiper + Motion Canvas + FFmpeg offline). Nếu viPiper không đạt chất lượng giọng đọc, cho phép swap sang TTS online (Edge TTS miễn phí hoặc ElevenLabs ≤$0.003/video) mà không vi phạm NFR này. *(Thay thế ràng buộc cứng "Zero Cloud API Dependency" — xem ADR-03 và A-01)*
- Thời gian render không vượt quá **45 giây / video** 1080×1920 30fps trên CPU 8 nhân thông thường. Worker pool mặc định `WORKER_POOL_MAX = min(CPU-1, 3)` để đảm bảo NFR RAM.
- Chiếm dụng bộ nhớ RAM tối đa không quá **4GB** trong suốt quá trình chạy batch. *(Phải benchmark tại R0 — nếu Motion Canvas headless vượt ngưỡng, fallback sang node-canvas per ADR-01)*

### NFR-4: Observability
- Mỗi lần render đều tự động ghi vết (logging) chi tiết: thời gian thực thi từng công đoạn (Planning, TTS, Drawing, Compose, Encode), dung lượng file, danh sách Component tham chiếu và giá trị Seed tương ứng.

### NFR-5: Extensibility & Open-source Stack
- Hệ thống được cấu trúc dạng module hóa cao:
  - Cho phép thay thế TTS engine (từ viPiper sang ElevenLabs/Edge TTS) bằng cách cấu hình interface mà không phải sửa logic vẽ.
  - Ưu tiên tối đa các thư viện có giấy phép bản quyền **MIT hoặc Apache 2.0** (như Motion Canvas, chalkboard, Sketchling, viPiper) để không bị ràng buộc bản quyền thương mại khi quy mô dự án mở rộng.

---

## 9. Open Questions

1. **Chất lượng giọng viPiper trên thiết bị di động:** Giọng đọc offline của viPiper đã đủ truyền cảm để người xem TikTok nghe tự nhiên như giọng người thật chưa, hay cần bổ sung thêm bộ lọc ngữ điệu/EQ âm thanh?
2. **Ngưỡng nhạy cảm trùng lặp của TikTok:** Liệu 4 yếu tố biến thiên hiện tại (màu giấy/bảng, góc nghiêng, màu nét, nhạc nền) đã đủ để thuật toán kiểm duyệt của TikTok coi 50 video cùng hook là nội dung độc bản hoàn toàn chưa?
3. **Độ phức tạp tối đa của nét vẽ:** Một bức vẽ có tối đa bao nhiêu nét (stroke count) thì bắt đầu làm người xem mất kiên nhẫn trong khung thời gian 25–30 giây?
4. **Thuật toán làm mịn góc xoay tiếp tuyến (Tangent Smoothing):** Cần hệ số suy giảm (damping factor) bao nhiêu để bàn tay vừa nghiêng theo đường cong mềm mại của nét vẽ, vừa không bị lắc giật (jitter) khi gặp các góc gấp khúc sắc nhọn hoặc khi vẽ các chi tiết nhỏ như mắt, mũi?

---

## 10. Assumptions Index

| Mã ID | Giả định `[ASSUMPTION]` | Mức độ rủi ro | Kế hoạch kiểm chứng |
|---|---|:---:|---|
| **A-01** | `[ASSUMPTION]` Engine viPiper (chạy local offline, license MIT) có phát âm tiếng Việt đủ tự nhiên và rõ chữ cho video ngắn mà không cần đến API trả phí. | Trung bình | Thử nghiệm render 5 mẫu giọng với các câu thoại phức tạp ở tuần đầu tiên (Release R0). |
| **A-02** | `[ASSUMPTION]` Quy tắc trích xuất thứ tự path trong file SVG từ Illustrator/Inkscape phản ánh đúng thứ tự vẽ tự nhiên của người vẽ tay. | Cao | Thử nghiệm công cụ Semi-auto Ingestion với 20 file SVG mẫu; nếu không tự nhiên, bổ sung giao diện cho phép operator kéo thả đổi thứ tự nét trong 5 giây. |
| **A-03** | `[ASSUMPTION]` Framework Motion Canvas / headless canvas có thể render mượt mà 30fps MP4 ở độ phân giải 1080×1920 trong thời gian ≤ 45s trên máy tính cá nhân. | Trung bình | Benchmark hiệu năng render tại Release R0. |
| **A-04** | `[ASSUMPTION]` Kỹ thuật Color Fill Reveal đổ màu phẳng (flat color) trong 1.5s làm tăng tỷ lệ xem hết và tương tác mà không khiến người xem cảm thấy video bị cắt cụt. | Thấp | So sánh số liệu giữ chân giữa 10 video có màu và 10 video chỉ vẽ nét trắng đen. |
| **A-05** | `[ASSUMPTION]` Solo operator có thể dễ dàng quản lý việc đăng 20–30 video/ngày bằng công cụ lên lịch thủ công mà chưa cần đến auto-upload API. | Thấp | Kiểm chứng thực tế sau khi hoàn thành mẻ sản xuất đầu tiên. |
| **A-06** | `[ASSUMPTION]` 2D Hand Asset (ảnh PNG tách nền điều khiển theo góc tiếp tuyến) mang lại cảm giác vẽ tay chân thực vượt trội so với ngòi bút đơn lẻ (đạt ~7/10 điểm chân thực) và hoàn toàn đủ sức giữ chân người xem TikTok mà không cần tốn chi phí dựng mô hình 3D trong giai đoạn MVP. | Thấp | Render thử nghiệm 2 video A/B test (1 video chỉ có ngòi bút, 1 video có bàn tay 2D) để so sánh chỉ số hoàn thành video. |
| **A-H13** | `[ASSUMPTION]` Vision LLM (GPT-4o hoặc Gemini Vision) có thể extract Drawing Steps từ ảnh how-to-draw step-by-step với accuracy ≥ 70% (đúng thứ tự, đúng shape type) trên ảnh tutorial điển hình tìm được trên Pinterest. | **Cao** | Chạy spike `spike/vision-ingestion/` với 10 ảnh test, 2 models song song. Nếu < 70%: abandon Path D, duy trì Path A+B+C. Nếu ≥ 70%: integrate IVisionParser vào registry ingestion. |

---

## 11. Entity Model

Cấu trúc quan hệ dữ liệu giữa các thực thể trong hệ thống:

```text
Concept (ID, Hook, Subject, Language, Style, Score, Status)
 │
 └── 1..N ──► Transformation (Input, Output, Seed)
               │
               └── 1..N ──► DrawingStep (ID, DrawingOrder, DurationRule, VoiceCue)
                             │
                             └── N..1 ──► Component (Lưu trong Registry)
                                           ├── ID: string
                                           ├── Type: enum (glyph | animal_part | primitive)
                                           ├── Geometry: SVGPath / PrimitiveParams
                                           ├── BoundingBox: Rect(x, y, w, h)
                                           └── StrokeOrderMetadata: Array<StrokeID>

VideoAsset (ProjectID, ConceptRef, Seed, Version, GenerationTime)
 ├── AudioTrack: VoiceoverAudio + SFXClips + BackgroundMusic
 ├── HandControllerConfig:
 │    ├── HandAssetRef: FilePath (hand_chalk_right.png)
 │    ├── ChalkPivot: Point(x, y)
 │    ├── MaxAngleClamp: Float (±35.0 deg)
 │    └── LiftElevateOffset: Float (10.0 px)
 ├── StyleConfig:
 │    ├── MediumType: enum (chalkboard | paper_sketch)
 │    ├── BoardTexture: FilePath
 │    ├── StrokeNoiseProfile: GaussianBlur / DashJitter
 │    └── DustEffectEnabled: Boolean
 ├── DiversificationConfig: CanvasTilt + InkColor + BGMSong
 ├── ValidationReport: Boolean (All Gates Passed)
 └── OutputFile: FilePath (.mp4)
```
