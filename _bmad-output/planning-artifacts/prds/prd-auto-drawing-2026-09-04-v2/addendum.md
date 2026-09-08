# Technical Addendum — Drawing Transformation Video Factory

Tài liệu này lưu trữ các chi tiết kỹ thuật sâu, so sánh kiến trúc và phân tích thư viện từ `tools.md` và các phiên bản trao đổi trước đó để giữ cho tài liệu PRD chính gọn gàng, tập trung vào yêu cầu và hành vi.

---

## 1. Stack Evaluation Matrix (từ tools.md)

| Khối chức năng | Thư viện đề cử | License | Đánh giá & Quyết định |
|---|---|---|---|
| **Drawing / Hand-drawn Animation** | **Sketchling** (`AnayGarodia/sketchling`) | MIT | Có bộ từ vựng drawing vocabulary thân thiện với LLM, pipeline validate qua headless browser. Thích hợp để tham khảo thiết kế DSL. |
| | **HandDraw-Skill** (`ToBeWin/HandDraw-Skill`) | MIT | Pipeline JSON DSL → SVG → Remotion → FFmpeg. Tư duy deterministic rất tốt. |
| | **svg-draw-motion** (`vorojar/svg-draw-motion`) | MIT | Thuật toán bút bám theo đường vẽ (pen follow stroke) chạy trên browser, export video. Khuyến nghị tái sử dụng thuật toán tính vector tiếp tuyến và tọa độ đầu bút. |
| | **chalkboard** (`Atharva-Kanherkar/chalkboard`) | MIT | Pipeline hoàn chỉnh từ prompt/scene → SceneScript JSON → render MP4. Khuyến nghị nghiên cứu cấu trúc SceneScript. |
| | **Motion Canvas** (`motion-canvas/motion-canvas`) | MIT | Framework diễn hoạt lập trình trên nền web/canvas. Ưu tiên số 1 để thay thế Remotion nhằm giữ stack 100% MIT. |
| | **Remotion** (`remotion-dev/remotion`) | Commercial/Company License | Rất mạnh, nhưng có giới hạn về doanh thu/quy mô công ty nếu dùng bản quyền miễn phí. Đưa vào phương án dự phòng. |
| **TTS (Text-To-Speech)** | **viPiper** (`kiendt/viPiper`) / **Piper** | MIT | Chạy hoàn toàn offline, tốc độ cực nhanh, mô hình nhẹ, phát âm tiếng Việt chuẩn. Đạt mục tiêu chi phí API = 0. |
| | **Edge TTS / ElevenLabs** | API / Free tier | Chất lượng giọng rất tự nhiên nhưng phụ thuộc mạng và có rủi ro rate limit/chi phí khi mở rộng batch 100+ video. Dự phòng cho tương lai. |
| **Video Muxing & Encoding** | **FFmpeg** | LGPL/GPL | Chuẩn công nghiệp để ghép video, audio, SFX và xuất MP4 H.264/AAC. |

---

## 2. Drawing DSL Detailed Schema (Đặc tả kỹ thuật)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DrawingDSLComponent",
  "type": "object",
  "required": ["component_id", "subject", "part", "steps"],
  "properties": {
    "component_id": { "type": "string" },
    "subject": { "type": "string" },
    "part": { "type": "string" },
    "anchor_point": {
      "type": "object",
      "properties": {
        "relative_to": { "type": "string" },
        "offset_x": { "type": "number" },
        "offset_y": { "type": "number" }
      }
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["primitive", "params"],
        "properties": {
          "primitive": {
            "type": "string",
            "enum": ["arc", "circle", "line", "bezier_2", "bezier_3", "polyline", "rect"]
          },
          "params": { "type": "object" },
          "stroke_style": {
            "type": "object",
            "properties": {
              "width": { "type": "number" },
              "color": { "type": "string" },
              "dash_array": { "type": "string" }
            }
          },
          "voice_cue": { "type": "string" }
        }
      }
    }
  }
}
```

---

## 3. Rejected Alternatives & Architecture Trade-offs

1. **Sinh SVG thô trực tiếp từ LLM (Prompt → SVG):**
   - *Lý do loại bỏ:* LLM thường xuyên bị ảo giác tọa độ (hallucination), tạo ra các đường vẽ bị gấp khúc, tự cắt nhau, hoặc thứ tự nét đảo lộn không giống người vẽ tay.
   - *Giải pháp thay thế:* Buộc LLM sinh Drawing DSL qua vocabulary primitives đã chuẩn hóa, sau đó DSL Compiler dịch ra tọa độ tuyệt đối.
2. **Sử dụng AI Video Generator (Runway, Kling, Sora):**
   - *Lý do loại bỏ:* Chi phí cực cao (~0.20$ - 0.50$/video), không kiểm soát được chuyển động nét vẽ chính xác (pen tip tracking), không đảm bảo tính nhất quán giữa nét vẽ và kết quả cuối cùng.
3. **Phụ thuộc 100% vào Cloud API (Cloud TTS + Cloud Render):**
   - *Lý do loại bỏ:* Phá vỡ mục tiêu chi phí của solo operator. Với mô hình affiliate content quy mô 100 video/ngày, chi phí API tích lũy sẽ ăn mòn lợi nhuận. Chuyển sang Local-first đưa chi phí sinh video tiệm cận 0 USD.

---

## 4. Hand Engine & Compositing Architecture (từ gpt_review_clip.md)

### 4.1. Phân rã 4 Engines chuyên biệt
Theo tài liệu phân tích clip mẫu, 90% độ khó nằm ở việc điều phối bàn tay và đầu phấn bám nét thay vì việc sinh hình. Hệ thống được module hóa thành 4 engine:
1. **Engine 1 — Drawing Engine ✏️:** Quản lý SVG paths, bóc tách thứ tự nét (stroke order), phân bổ timeline và co giãn tốc độ vẽ. Không phụ thuộc vào bàn tay.
2. **Engine 2 — Hand Engine ✋:** Tính toán vị trí bàn tay ($p = \text{path.point\_at}(t)$), góc xoay theo tiếp tuyến ($\theta = \arctan2(dy, dx)$), và điều khiển cử động nhấc tay (lift).
3. **Engine 3 — Style Engine 🖍️:** Tạo chất liệu bảng xanh/giấy vẽ, texture phấn nhám, độ rung mờ (blur/noise) và bụi phấn (chalk dust).
4. **Engine 4 — Video Engine 🎬:** Kết hợp các lớp (Canvas + SVG + Hand + Text + Audio/SFX) qua FFmpeg hoặc WebCodecs để xuất MP4 1080×1920.

### 4.2. So sánh 3 chiến lược Bàn tay (Hand Approaches)
- **Hướng A: AI Video (Sora/Kling/Veo):** Điểm 4/10. Dễ làm thử nghiệm prompt nhưng không có tính tất định, ngón tay dễ bị dị tật và không bám nét vẽ $\rightarrow$ **Loại bỏ**.
- **Hướng B: 2D Hand Asset + Transform (Lựa chọn cho MVP):** Điểm 7/10. Dùng ảnh PNG tách nền chất lượng cao, gán điểm neo Pivot tại chóp đầu phấn, code transform position + tangent rotation + lift motion. Rất rẻ, tất định 100%, render trong vài giây, dễ batch 100 video/ngày $\rightarrow$ **Áp dụng cho MVP**.
- **Hướng C: 3D Hand Model + IK Rig (Lựa chọn dài hạn):** Điểm 9/10. Dựng mô hình 3D bàn tay trong Blender, gắn xương Inverse Kinematics, điều khiển ngón tay bóp theo nét vẽ. Đạt độ chân thực photorealistic tuyệt đối $\rightarrow$ **Quy hoạch cho Phase 6**.

### 4.3. Nguyên lý Hand Library (Tái sử dụng Asset)
Không sinh bàn tay mới cho từng video. Hệ thống duy trì một thư viện **Hand Library** gồm:
- Grip A: Cầm phấn góc nghiêng chuẩn $45^\circ$ (cho bảng xanh).
- Grip B: Cầm bút chì/bút lông góc trên nhìn xuống (cho phong cách giấy).
- Grip C: Cầm phấn ngón tay hơi co (cho nét vẽ chi tiết nhỏ).
Tất cả các hình vẽ (Bear, Bunny, Flower...) đều dùng chung Hand Library này qua bộ điều hợp tọa độ (Path Adapter).


---

## 5. ADR-04: Tách Image-to-Concept khỏi Image-to-Geometry {#adr-04-tach-image-to-concept-khoi-image-to-geometry}

**Ngày:** 2026-09-08 · **Trạng thái:** Accepted · **Liên quan:** FR-3b, FR-3c, A-H13, A-H14, A-H15

### Bối cảnh

Path D ban đầu (FR-3b phiên bản gốc) đặt mục tiêu: nạp ảnh how-to-draw từ Pinterest → Vision LLM → Drawing Steps **kèm tọa độ** → Registry. Giả định A-H13 đặt ngưỡng ≥ 70% accuracy, đánh dấu rủi ro **Cao**.

Spike `spike/vision-ingestion/` chạy 2026-09-08 với `gemini-3.6-flash` trên bộ 11 ảnh (6 tutorial thật + 5 negative case), so sánh song song hai chế độ:

- **`concept`** — chỉ trích xuất ngữ nghĩa (subject, hook, thứ tự bước, voice_cue), ngưỡng 90%
- **`geometry`** — trích xuất thêm tọa độ tương đối từng nét, ngưỡng 70%

### Phát hiện quyết định: Panel Leak

Ảnh how-to-draw là **lưới nhiều panel**. Vision LLM trả về tọa độ theo vị trí trong *lưới panel*, không phải trong *canvas vẽ*. Tọa độ vẫn nằm trong `[0,1]` — nên chỉ số `coord_validity` báo 100% và **gây hiểu nhầm nghiêm trọng** — nhưng mỗi bước thuộc một hệ quy chiếu khác nhau.

| Ảnh | Bằng chứng | panel_leak_score |
|---|---|---:|
| `rabbit_7steps` | Đầu `x=0.15`, tai `x=0.85` — cách 70% bề ngang | 77.4% |
| `rabbit_8steps` | Khớp **chính xác** lưới 3×3: `x: 0.13→0.42→0.77 \| 0.10→0.47→0.80` | 89.7% |
| `bird_number78` | Mắt `(0.24,0.41)` nằm ngoài đầu `(0.83,0.15)` | 96.7% |

Quan sát ở **3/3 ảnh, không ngoại lệ** → hạn chế hệ thống, không phải nhiễu thống kê.

### So sánh định lượng

| | Concept | Geometry |
|---|---|---|
| Ảnh đúng (tutorial thật) | **6/6** | **0/3** (sau khi tính panel leak) |
| Output token / ảnh | 602 | 1255 (**2.08×**) |
| Thời gian TB | 14.0s | 19.8s (max 84s) |
| JSON hỏng | 0 | 1 (bị cắt ở 979 tokens) |
| Lỗi API 503 | 2/11 | 4/11 |

*Lưu ý phương pháp:* báo cáo tự động ban đầu so sánh 9 ảnh (concept) với 7 ảnh (geometry) khác nhau do lỗi API ngẫu nhiên → sai lệch. Tính lại trên 5 ảnh cả hai đều chạy được: 80.0% vs 78.9% — ngang nhau. Chênh lệch thật chỉ lộ ra sau khi áp dụng `panel_leak_score`.

### Quyết định

**Tách FR-3b thành hai yêu cầu độc lập:**

1. **FR-3b — Image-to-Concept Ingestion → vào MVP.** Vision LLM chỉ đọc ngữ nghĩa. Schema output cấm mọi trường tọa độ. Kế hoạch vẽ chuyển sang FR-2 để LLM sinh Drawing DSL.
2. **FR-3c — Image-to-Geometry Ingestion → hoãn v2.** Cần bổ sung bước panel segmentation (cắt panel + căn chỉnh hệ tọa độ) trước khi tái xem xét.

**Bắt buộc Operator Confirmation Gate.** 2/5 negative case bị nhận nhầm với confidence 0.95–0.98 → không thể lọc tự động bằng ngưỡng.

### Hệ quả

- ✅ Giữ nguyên tính tất định (NFR-2): mọi tọa độ vẫn đi qua DSL Compiler, không phụ thuộc ước lượng của Vision LLM.
- ✅ Chi phí ingestion giảm ~2× so với thiết kế gốc.
- ✅ Giảm rủi ro bản quyền: tham chiếu ý tưởng thay vì sao chép hình học (A-H15).
- ⚠️ Vẫn cần người duyệt 100% Concept Plan — không đạt được tự động hóa hoàn toàn như kỳ vọng ban đầu.
- ⚠️ Chất lượng hình học cuối cùng phụ thuộc hoàn toàn vào FR-2 (Path A), không được "hỗ trợ" bởi tham chiếu ảnh như thiết kế gốc.

### Phương án đã cân nhắc và loại bỏ

1. **Giữ nguyên FR-3b gốc (geometry đầy đủ):** loại — panel leak khiến kết quả không dùng được, tốn 2× chi phí.
2. **Panel segmentation ngay trong MVP:** loại — khối lượng công việc chưa ước lượng, làm chậm mục tiêu MVP 1–2 tuần.
3. **Bỏ hoàn toàn Path D, chỉ dùng Path A + B:** loại — concept mode đạt 100% và giải quyết đúng nút thắt "AI tự sinh ý tưởng nghèo nàn" của solo operator.
