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

### Windows — cách nhanh nhất: chạy 1 file

```bat
run_windows.bat AQ.Ab8...
```

Script tự làm hết: tìm `py` hoặc `python`, tạo venv, cài thư viện, self-test rubric,
kiểm tra key, chạy so sánh, rồi mở báo cáo. Dừng ngay nếu có bước nào lỗi.

Nếu muốn tự gõ từng lệnh thì xem bên dưới.

---

Chạy **từng dòng một**, theo đúng thứ tự (không gộp thành 1 dòng).

### Windows — PowerShell

```powershell
py -m venv .venv
.venv\Scripts\pip install google-genai pillow
$env:GEMINI_API_KEY = "AQ.Ab8..."
.venv\Scripts\python compare.py --model gemini
```

### Windows — Command Prompt (cmd.exe)

```bat
py -m venv .venv
.venv\Scripts\pip install google-genai pillow
set GEMINI_API_KEY=AQ.Ab8...
.venv\Scripts\python compare.py --model gemini
```

> Trong cmd.exe **đừng** đặt dấu nháy quanh key — `set K="abc"` sẽ lưu cả dấu nháy vào giá trị.

### macOS / Linux

```bash
python3 -m venv .venv
.venv/bin/pip install google-genai pillow
export GEMINI_API_KEY="AQ.Ab8..."
.venv/bin/python compare.py --model gemini
```

### Ghi chú

- **`py` chỉ dùng cho lệnh đầu tiên** (`py -m venv .venv`). Sau khi venv đã tạo,
  gọi thẳng `.venv\Scripts\python` — bên trong venv nó luôn tên là `python.exe`,
  không có `py.exe`. Nếu máy bạn không có `python` trên PATH thì cũng không sao.
- Nếu cả `py` lẫn `python` đều báo "not found": cài Python từ python.org và nhớ
  tick **"Add Python to PATH"**, hoặc chạy `py --version` để kiểm tra.
- Biến môi trường chỉ sống trong **cửa sổ terminal hiện tại**. Đóng đi mở lại là phải `set`/`export` lần nữa.
- Gọi thẳng `.venv\Scripts\python` (hoặc `.venv/bin/python`) thì **không cần** `activate`.
- Nếu muốn dùng OpenAI: `pip install openai` và đặt thêm `OPENAI_API_KEY=sk-...`
- Đổi model qua `GEMINI_VISION_MODEL` (mặc định `gemini-3.6-flash`) hoặc `OPENAI_VISION_MODEL` (mặc định `gpt-4o`).

> **Về định dạng key Gemini `AQ.`**
>
> Google đã chuyển từ Standard key (`AIza...`) sang Auth key (`AQ.Ab...`).
> AI Studio hiện **chỉ cấp key dạng `AQ.`** — nếu bạn nhận được key bắt đầu bằng
> `AQ.` thì đó là **đúng**, không phải lỗi. Key `AIza` cũ sẽ ngừng hoạt động.
>
> Cạm bẫy hay gặp: key `AQ.` bị từ chối trên **OpenAI-compatible endpoint**
> (`/v1beta/openai` với `Authorization: Bearer`), nhưng chạy bình thường trên
> **native endpoint**. Spike này dùng SDK `google-genai` đi đường native nên
> không dính vấn đề đó.
>
> Lưu ý: SDK cũ `google-generativeai` đã EOL — đừng cài, dùng `google-genai`.

## Ảnh test — đã có sẵn trong repo

**Không cần chuẩn bị gì.** Bộ 11 ảnh + ground truth đã được commit trong `images/`,
nên clone về là chạy được ngay và mọi người so sánh trên cùng một bộ dữ liệu.

| Nhóm | Số lượng | Nội dung |
|---|:---:|---|
| Easy | 3 | Lưới panel rõ ràng, hook là số/chữ (số 20 → mèo, số 1 → hươu, chữ G → hươu) |
| Medium | 4 | Nhiều bước, layout lộn xộn, có ảnh bị cắt giữa chừng |
| Hard | 2 | Panel lẻ, ảnh có background |
| **Negative** | **2** | **Bẫy: hình hoàn thiện & sơ đồ giải phẫu — model phải TỪ CHỐI** |

Tổng cộng **6 ảnh là tutorial thật** và **5 ảnh model phải từ chối**
(`is_step_tutorial: false`). Chủ ý chọn vậy: nếu chỉ toàn ảnh đẹp thì cả hai chế độ
đều pass và thí nghiệm chẳng nói lên điều gì.

Chi tiết nguồn gốc, lý do từng ảnh, và lưu ý bản quyền: xem [`images/SOURCES.md`](images/SOURCES.md).

**Muốn dùng ảnh của bạn?** Thả vào `images/` kèm file `<tên>.truth.json`:
```json
{
  "step_count": 6, "subject_name": "rabbit", "hook_shape": "number 3",
  "is_step_tutorial": true, "difficulty": "easy", "note": "mô tả ngắn"
}
```
Trường `is_step_tutorial` **bắt buộc** — rubric dựa vào nó để phân biệt
`true_negative` (từ chối đúng, 100đ) với `false_negative` (từ chối nhầm, 0đ).

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

### 1b. Kiểm tra API key — **1 lượt gọi, ~$0.001**
```bash
python compare.py --check-key
```
Xác nhận key hoạt động trước khi chạy 22 lượt gọi. Nếu hỏng, nó nói rõ hỏng chỗ nào
(key sai / thiếu quyền / hết quota / sai tên model / lỗi mạng) thay vì để bạn đoán.

### 1c. Xem model nào dùng được
```bash
python compare.py --list-models
```
Tên model Gemini thay đổi khá nhanh và model cũ bị gỡ khỏi tài khoản mới. Nếu
`--check-key` báo **404**, chạy lệnh này để lấy danh sách thật rồi đặt lại:

```powershell
$env:GEMINI_VISION_MODEL = "gemini-3.6-flash"    # PowerShell
```
```bat
set GEMINI_VISION_MODEL=gemini-3.6-flash          REM cmd.exe
```

### 2. Test nhanh 1 ảnh
```bash
python parse_image.py images/rabbit.jpg --mode both-modes --model gemini
```

### 3. Chạy so sánh đầy đủ ← **cái chính**
```bash
python compare.py --model gemini            # 11 ảnh × 2 mode = 22 calls (~$0.09)  ← khuyến nghị
python compare.py --model both              # thêm GPT-4o: 44 calls (~$0.18)
python compare.py --limit 3                 # thử 3 ảnh trước cho chắc
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
| `run_windows.bat` | Runner 1-click cho Windows (tự setup + chạy + mở báo cáo) |
| `render.html` | Xem animation từng bước (geometry mode) |
| `eval.py` | *Deprecated* — chuyển hướng sang `compare.py` |

---

## Lưu ý bản quyền

Ảnh tutorial trên Pinterest có bản quyền của tác giả. Dùng làm **tham chiếu ý tưởng** (concept mode) là rủi ro thấp; sao chép **geometry 1:1** rồi xuất bản thương mại ở quy mô 50–100 video/ngày là rủi ro thật. Đây là một lý do độc lập với accuracy để ưu tiên concept mode.
