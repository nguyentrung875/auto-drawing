# Vision Ingestion Spike

Spike kiểm chứng feasibility của **Path D — Image-to-DSL Ingestion**: dùng Vision LLM để extract Drawing Steps từ ảnh how-to-draw (Pinterest, sách, tutorial).

## Setup nhanh

```bash
# 1. Cài dependencies
pip install openai google-generativeai pillow

# 2. Set API keys (chỉ cần 1 trong 2)
set OPENAI_API_KEY=sk-...
set GEMINI_API_KEY=AIza...
```

## Chuẩn bị ảnh test

Đặt **10 ảnh how-to-draw** vào thư mục `images/`. Đa dạng hóa:

| Loại | Mô tả | Mục đích |
|---|---|---|
| Easy (3–4 ảnh) | Nền trắng, nét đen đậm, có đánh số bước | Baseline accuracy |
| Medium (3–4 ảnh) | Có màu, nhiều chi tiết, nền phức tạp | Stress test |
| Hard (2–3 ảnh) | Chất lượng thấp, chụp màn hình mờ | Tìm giới hạn |

**Gợi ý tìm kiếm trên Pinterest:**
- `how to draw rabbit step by step easy`
- `draw from number 3 bunny tutorial`
- `easy animal drawing steps for kids`

## Chạy spike

### Bước 1 — Parse 1 ảnh (test nhanh)
```bash
python parse_image.py images/rabbit.jpg --model both
# Output: images/rabbit.result.json
```

### Bước 2 — Xem visual render
1. Mở `render.html` trong browser (double-click)
2. Click "Load Result JSON" → chọn file `rabbit.result.json`
3. Chọn model (openai hoặc gemini)
4. Click ▶ Play để xem animation từng bước

### Bước 3 — Chạy toàn bộ batch eval
```bash
python eval.py --model both --images-dir images/
# Output: eval_report.html (mở để xem bảng kết quả)
```

## Đọc kết quả

```
eval_results/         ← JSON kết quả từng ảnh
eval_report.json      ← Tổng hợp machine-readable
eval_report.html      ← Bảng đẹp để review  ← MỞ CÁI NÀY
```

### Scoring (tự động)

| Điểm | Status | Ý nghĩa |
|---|---|---|
| ≥ 70% | ✅ Pass | Vision approach khả thi |
| 50–69% | ⚠️ Partial | Cần refine prompt thêm |
| < 50% | ❌ Fail | Abandon Path D, dùng SVG-only |

### Ground truth (tùy chọn)

Để đo accuracy chính xác hơn, tạo file `images/<name>.truth.json` cạnh mỗi ảnh:
```json
{
  "step_count": 6,
  "subject_name": "rabbit",
  "hook_shape": "number 3"
}
```

## Decision tree sau spike

```
avg_score ≥ 70% với GPT-4o    → IVisionParser default = OpenAI  → GO
avg_score ≥ 70% với Gemini     → IVisionParser default = Gemini  → GO (rẻ hơn)
50% ≤ avg_score < 70%          → Refine prompt 1 ngày thêm, re-eval
avg_score < 50%                → NO-GO: dùng SVG Ingestion là primary
```

## Ước tính cost

| | |
|---|---|
| 1 ảnh / 1 model | ~$0.002–0.005 |
| 10 ảnh / 2 models | ~$0.04–0.10 |
| 200 subjects (one-time) | ~$0.40–1.00 |
| Per-video runtime cost | **$0.00** (ingestion là one-time) |

## Files

| File | Mục đích |
|---|---|
| `parse_image.py` | Parse 1 ảnh với GPT-4o / Gemini Vision |
| `eval.py` | Batch eval + scoring + HTML report |
| `render.html` | Visual renderer xem Drawing Steps trên canvas |
| `images/` | Đặt ảnh test vào đây |
| `eval_results/` | JSON kết quả từng ảnh (auto-created) |
