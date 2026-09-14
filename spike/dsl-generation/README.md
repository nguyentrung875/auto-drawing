# Spike: Concept Plan → Drawing DSL

Kiểm chứng **Open Question #5** trong PRD:

> Concept Plan (FR-3b) chỉ mô tả **ngữ nghĩa** — `"long ear on the left"`.
> Liệu từng ấy thông tin có đủ để LLM (FR-2) sinh ra hình học **đúng tỷ lệ** không?

Nếu **không đủ** → phải bổ sung gợi ý vị trí thô vào Concept Plan schema → **sửa PRD lần nữa**.

## Chạy

```powershell
cd spike\dsl-generation

# 0. Self-test validator (KHÔNG tốn quota) — luôn chạy trước
..\vision-ingestion\.venv\Scripts\python test_geometry_check.py

# 1. Xem mốc so sánh: hình vẽ tay đúng tỷ lệ (KHÔNG tốn quota)
..\vision-ingestion\.venv\Scripts\python run_spike.py --baseline-only

# 2. Xem prompt sẽ gửi đi (KHÔNG tốn quota)
..\vision-ingestion\.venv\Scripts\python run_spike.py --dry-run

# 3. Gọi API thật — chỉ 2 lượt gọi
$env:GEMINI_API_KEY = "AQ.Ab8..."
..\vision-ingestion\.venv\Scripts\python run_spike.py
```

Mở `results/report.html` để xem hình vẽ ra trông thế nào.

## Cách chấm điểm

`geometry_check.py` biến câu hỏi chủ quan *"hình có đẹp không"* thành phép đo khách quan:

| Tiêu chí | Điểm | Bắt lỗi gì |
|---|---:|---|
| Shape hợp lệ | 30 | thiếu tham số, `r=0`, polyline 1 điểm |
| Nằm trong canvas | 20 | tràn ra ngoài khung |
| Độ lấp đầy khung | 15 | hình tí xíu hoặc tràn khung |
| **Tính liền mạch** | 30 | **bộ phận lơ lửng không chạm hình nào** |
| **Quan hệ không gian** | 35 | **tai nằm dưới đầu, mắt nằm ngoài đầu** |

Hai tiêu chí cuối là cốt lõi — chúng bắt đúng loại lỗi mà mô tả ngữ nghĩa dễ gây ra.

Validator suy ra ràng buộc từ hai nguồn: (1) từ khóa trong `description`
(`"on top of"`, `"inside"`), và (2) **tri thức giải phẫu** (`ANATOMY_INSIDE` —
mắt/mũi/râu hiển nhiên phải nằm trong đầu, kể cả khi mô tả không nói).

## Mốc so sánh (baseline)

`baseline/*.json` là hình tôi vẽ tay đúng tỷ lệ, đạt **96.5%**. Đây là trần điểm
thực tế — nếu LLM đạt gần mức này thì mô tả ngữ nghĩa là đủ.

| Kết quả LLM | Kết luận |
|---|---|
| ≥ 70% | Đủ. Giữ nguyên FR-3b, đóng Open Question #5 |
| 45–69% | Chưa ổn định. Bổ sung `anchor` vào Concept Plan → sửa FR-3b |
| < 45% | Không đủ. Xem lại kiến trúc FR-2/FR-3b |

## Giới hạn đã biết

Validator kiểm tra **tính đúng cấu trúc**, không kiểm tra **tính thẩm mỹ**.
Một hình có thể đạt 100% mà vẫn xấu (tỷ lệ cân đối nhưng thô kệch). Baseline con
hươu là ví dụ: cấu trúc đúng hoàn toàn nhưng cổ quá mảnh, thân quá dẹt.

→ Điểm cao là **điều kiện cần, không phải điều kiện đủ**. Vẫn phải xem
`results/report.html` bằng mắt.

## File

| File | Nội dung |
|---|---|
| `concept_plans/*.json` | 2 Concept Plan thật, trích từ spike vision-ingestion (đều đạt 100%) |
| `dsl_prompt.py` | System prompt + DSL schema |
| `geometry_check.py` | Validator hình học — trái tim của spike |
| `test_geometry_check.py` | 7 self-test, chạy trước khi tin kết quả |
| `render_svg.py` | Vẽ DSL ra SVG + trang báo cáo |
| `baseline/*.json` | Hình vẽ tay đúng tỷ lệ làm mốc |
| `run_spike.py` | Runner chính |
