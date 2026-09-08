# Vision Ingestion Spike — Concept vs Geometry

Spike kiểm chứng **Path D** (nạp ảnh how-to-draw từ Pinterest/sách/tutorial) bằng Vision LLM.

Khác với bản trước, spike này chạy **2 chế độ song song** để trả lời một câu hỏi cụ thể:

> Vision LLM giỏi tới đâu ở việc đọc **Ý TƯỞNG** so với việc đọc **HÌNH HỌC**?

| Chế độ | LLM phải trả về | Ngưỡng pass | Ứng với PRD |
|---|---|:---:|---|
| **`concept`** — Image-to-Concept | subject, hook, số bước, tên bộ phận từng bước, `voice_cue` tiếng Việt. **KHÔNG toạ độ.** | **≥ 90%** | FR-3b (đề xuất mới) |
| **`geometry`** — Image-to-DSL | tất cả những thứ trên **+ toạ độ tương đối** từng nét (`relative_cx/cy/rx/ry/points`) | **≥ 70%** | FR-3b hiện tại / A-H13 |

**Giả thuyết cần kiểm chứng:** concept mode sẽ đạt điểm cao hơn hẳn, vì model thị giác đọc *ngữ nghĩa* tốt nhưng ước lượng *toạ độ chính xác* thì kém. Nếu đúng → tách FR-3b làm hai, đưa concept vào MVP và đẩy geometry sang v2.

---

## Setup

```bash
pip install openai google-generativeai pillow

# Chỉ cần 1 trong 2 key
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=AIza...

# Tuỳ chọn: đổi model
export OPENAI_VISION_MODEL=gpt-4o
export GEMINI_VISION_MODEL=gemini-1.5-pro
```

## Chuẩn bị ảnh test

Đặt **10 ảnh how-to-draw** vào `images/`:

| Loại | Số lượng | Mô tả | Mục đích |
|---|:---:|---|---|
| Easy | 3–4 | Nền trắng, nét đen đậm, có đánh số bước | Baseline |
| Medium | 3–4 | Có màu, nhiều chi tiết, nền phức tạp | Stress test |
| Hard | 2–3 | Chất lượng thấp, screenshot mờ | Tìm giới hạn |

Gợi ý tìm trên Pinterest: `how to draw rabbit step by step easy` · `draw from number 3 bunny tutorial` · `easy animal drawing steps for kids`

**Ground truth (khuyến khích)** — tạo `images/<name>.truth.json` cạnh mỗi ảnh:
```json
{ "step_count": 6, "subject_name": "rabbit", "hook_shape": "number 3" }
```

---

## Chạy

### 0. Self-test rubric — **miễn phí, chạy trước tiên**
```bash
python test_scoring.py --demo
```
Chạy 16 assertion offline chứng minh rubric phân biệt đúng kết quả tốt/xấu, đồng thời sinh `compare_report.demo.html` để bạn xem trước format báo cáo mà không tốn API.

### 1. Kiểm tra setup, không gọi API
```bash
python compare.py --dry-run
```

### 2. Test nhanh 1 ảnh
```bash
python parse_image.py images/rabbit.jpg --mode both-modes --model gemini
```

### 3. Chạy so sánh đầy đủ ← **cái chính**
```bash
python compare.py --model both              # 10 ảnh × 2 model × 2 mode = 40 calls (~$0.16)
python compare.py --model gemini            # rẻ hơn: 20 calls
python compare.py --limit 3                 # thử 3 ảnh trước
python compare.py --modes concept           # chỉ chạy concept
```

### 4. Xem kết quả
```
compare_report.html   ← MỞ CÁI NÀY: bảng side-by-side + verdict + hành động PRD
compare_report.md     ← dán thẳng vào PRD / validation-report
compare_report.json   ← machine-readable
compare_results/      ← JSON thô từng ảnh
render.html           ← xem animation (chỉ dùng được với geometry mode)
```

---

## Cách chấm điểm

Mỗi chế độ có **rubric riêng** — không chấm concept mode theo tiêu chí toạ độ vì nó cố tình không sinh toạ độ.

**Concept (100đ):** subject naming 15 · hook 10 · step_count hợp lý 10 · steps nhất quán 20 · part_name unique+snake_case 15 · voice_cue tiếng Việt ≤10 từ 15 · primitive_hint hợp lệ 10 · complexity 5

**Geometry (100đ):** subject 10 · step_count 10 · steps nhất quán 20 · mọi step có strokes 20 · primitive hợp lệ 20 · voice_cue 10 · confidence 10

Riêng geometry mode còn đo 2 chỉ số bộc lộ điểm yếu thật:
- **`coord_validity`** — % toạ độ nằm trong `[0,1]`
- **`coord_degenerate`** — % nét có bán kính/kích thước ≈ 0 (hình suy biến)

Ngoài ra `voice_cue` được kiểm tra bằng ký tự có dấu + stopword tiếng Việt, nên `"Now we draw the ears"` sẽ bị đánh trượt dù JSON hợp lệ.

---

## Decision tree

`compare.py` tự suy ra 1 trong 4 verdict và in kèm danh sách hành động cụ thể cho PRD:

| Verdict | Điều kiện | Hành động |
|---|---|---|
| **`SPLIT`** | concept ≥90%, geometry <70% | Tách FR-3b (concept, vào MVP) và FR-3c (geometry, v2). Hạ A-H13 xuống Trung bình. ← *kịch bản dự đoán* |
| **`BOTH-GO`** | cả hai đạt ngưỡng | Giữ FR-3b nhưng chia 2 tầng output; geometry chỉ auto-commit khi `coord_validity` = 100% |
| **`BOTH-WEAK`** | cả hai dưới ngưỡng | Refine prompt 1 ngày, chạy lại. Vẫn fail → bỏ Path D, thêm FR "Curated Concept Seed List" thủ công |
| **`UNEXPECTED`** | geometry đạt nhưng concept không | Chưa sửa PRD — review lại rubric và bộ ảnh test |

---

## Chi phí

| | |
|---|---|
| 1 ảnh / 1 model / 1 mode | ~$0.002–0.005 |
| 10 ảnh × 2 models × 2 modes | ~$0.08–0.20 |
| 200 subjects (one-time, concept mode) | ~$0.40–1.00 |
| **Runtime cost mỗi video** | **$0.00** — ingestion là one-time |

---

## Files

| File | Mục đích |
|---|---|
| `prompts.py` | Định nghĩa 2 prompt + ngưỡng pass từng chế độ |
| `parse_image.py` | Parse 1 ảnh, hỗ trợ `--mode concept\|geometry\|both-modes` |
| `scoring.py` | Rubric riêng cho từng chế độ + đo sức khoẻ toạ độ |
| `compare.py` | **Runner chính** — chạy A/B, tổng hợp, sinh 3 báo cáo, suy ra verdict |
| `test_scoring.py` | Self-test offline + sinh báo cáo demo |
| `render.html` | Xem animation từng bước (geometry mode) |
| `eval.py` | *Deprecated* — chuyển hướng sang `compare.py` |

---

## Lưu ý bản quyền

Ảnh tutorial trên Pinterest có bản quyền của tác giả. Dùng làm **tham chiếu ý tưởng** (concept mode) là rủi ro thấp; sao chép **geometry 1:1** rồi xuất bản thương mại ở quy mô 50–100 video/ngày là rủi ro thật. Đây là một lý do độc lập với accuracy để ưu tiên concept mode.
