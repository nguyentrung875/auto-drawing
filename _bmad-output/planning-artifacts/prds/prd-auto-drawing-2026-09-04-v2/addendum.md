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
