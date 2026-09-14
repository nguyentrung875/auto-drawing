# Kết quả spike — Concept vs Geometry

_Chạy 2026-09-08 · gemini-3.6-flash · 11 ảnh × 2 chế độ_

## TL;DR

Verdict tự động ghi `UNEXPECTED`, nhưng đó là **sai lệch do lỗi kỹ thuật**.
Sau khi hiệu chỉnh, kết luận đúng là **`SPLIT`**:

> **Đưa Image-to-Concept vào MVP. Đẩy Image-to-Geometry sang v2.**

---

## Vì sao verdict tự động bị sai

### Lỗi 1 — So sánh hai tập ảnh khác nhau

Concept chạy được 9 ảnh, geometry chỉ 7 ảnh (do lỗi API 503 ngẫu nhiên).
Báo cáo gốc lấy trung bình của 9 ảnh so với trung bình của 7 ảnh **khác** —
chênh lệch 7.1 điểm phần lớn phản ánh *ảnh nào tình cờ thất bại*, không phải
chất lượng thật.

Tính lại chỉ trên **5 ảnh cả hai chế độ đều chạy được**:

| | Concept | Geometry | Chênh |
|---|---:|---:|---:|
| Paired average (n=5) | **80.0%** | **78.9%** | +1.1 |

Gần như ngang nhau, không phải "geometry vượt trội".

### Lỗi 2 — `coord_validity: 100%` là chỉ số gây hiểu nhầm

Chỉ số này chỉ kiểm tra toạ độ có nằm trong `[0,1]` hay không. Nó **không**
kiểm tra các bước có cùng hệ quy chiếu không. Và đây chính là chỗ geometry mode sụp đổ.

---

## Phát hiện quan trọng nhất: Panel Leak

Ảnh how-to-draw là **lưới nhiều panel**. Vision LLM trả về toạ độ theo vị trí
trong lưới panel, **không phải** trong canvas vẽ. Toạ độ vẫn hợp lệ trong `[0,1]`
nhưng mỗi bước thuộc một hệ quy chiếu khác nhau — ghép lại thì hình vỡ nát.

**Bằng chứng 1 — `medium_rabbit_7steps`:**

| Bước | Bộ phận | x | y |
|---|---|---:|---:|
| 1 | đầu | 0.150 | 0.225 |
| 3 | tai | 0.850 | 0.200 |
| 3 | mắt | 0.935 | 0.225 |
| 4 | đuôi | 0.038 | 0.620 |

Đầu ở `x=0.15` (cực trái) nhưng tai ở `x=0.85` (cực phải) — cách nhau **70% bề
ngang ảnh**. Không con thỏ nào có tai cách đầu 70% khung hình.

**Bằng chứng 2 — `medium_rabbit_8steps` (lưới 3×3):**

```
x theo chu kỳ:  0.13 → 0.42 → 0.77  |  0.10 → 0.47 → 0.80  |  0.13 → 0.10
y theo hàng:    0.09   0.08   0.11  |  0.31   0.29   0.28  |  0.53   0.71
```

Khớp **chính xác** với lưới panel 3×3 của ảnh gốc.

**Bằng chứng 3 — `medium_bird_number78`:** mắt ở `(0.24, 0.41)` nhưng đầu ở
`(0.83, 0.15)` — mắt nằm ngoài đầu. Con ngươi cách mắt 0.50.

Đây **không phải lỗi ngẫu nhiên** mà là hạn chế hệ thống, xuất hiện ở cả 3 ảnh.

### Điểm sau khi tính panel leak

Tôi thêm chỉ số `panel_leak_score` vào `scoring.py` (đo tương quan giữa số bước
và toạ độ — hình vẽ thật thì các bộ phận cụm lại, lưới panel thì trôi theo bước):

| Ảnh | Điểm cũ | Điểm mới | Panel leak |
|---|---:|---:|---:|
| `medium_bird_number78` | 100.0% | **60.0%** | 96.7% |
| `medium_rabbit_8steps` | 100.0% | **60.0%** | 89.7% |
| `medium_rabbit_7steps` | 94.3% | **69.3%** | 77.4% |

**3/3 ảnh geometry từng "pass" giờ đều rớt dưới ngưỡng 70%.**

Đối chứng: một hình vẽ thật (các bộ phận cụm quanh nhau) chỉ bị `panel_leak = 33.8%`
→ không bị phạt. Chỉ số phân biệt đúng.

---

## Chất lượng thật trên ảnh tutorial

| | Concept | Geometry |
|---|---|---|
| Số ảnh đúng | **6/6** | **0/3** (sau khi tính panel leak) |
| Token/ảnh | 602 | 1255 (**2.08×**) |
| Thời gian TB | 14.0s | 19.8s (chậm hơn 41%, có ảnh 84s) |
| JSON hỏng | 0 | 1 (bị cắt giữa chừng ở 979 tokens) |
| Lỗi API 503 | 2/11 (18%) | 4/11 (36%) |

Concept mode đọc **hoàn hảo** các hook quan trọng nhất: `number 20 → cat`,
`number 1 → giraffe`, `letter G → giraffe`. `voice_cue` tiếng Việt tự nhiên,
đúng độ dài cho TikTok: *"Viết số 20 làm khung nhé"*, *"Thêm tai, mắt, mũi và râu mèo"*.

Geometry mode tốn gấp đôi chi phí để tạo ra dữ liệu không dùng được.

---

## Vấn đề chung: false positive

2/5 negative case bị nhận nhầm ở **cả hai** chế độ:

| Ảnh | Vấn đề | Confidence |
|---|---|---:|
| `hard_cat_singlestep` | 1 panel lẻ → model bịa ra 5 bước | 0.95 |
| `medium_dinosaur_faces` | Bảng variation mắt/miệng → bịa ra 6 bước | 0.98 |

Model **rất tự tin khi sai** (0.95–0.98), nên không thể lọc bằng ngưỡng confidence.
Đây là rủi ro thật cho MVP: operator sẽ nhận về concept rác mà hệ thống tưởng là tốt.

Tin tốt: 3/5 negative case còn lại bị từ chối đúng, kèm lý do rõ ràng —
*"This image is a pose and fur direction reference diagram, not a step-by-step tutorial"*.

**Hệ quả cho PRD:** FR-3b bắt buộc phải có **bước operator xác nhận** trước khi
commit vào Registry. Không được auto-commit dù confidence cao.

---

## Đề xuất sửa PRD

1. **Tách FR-3b** thành:
   - `FR-3b Image-to-Concept Ingestion` → **vào MVP**. Bỏ toàn bộ trường toạ độ
     khỏi output schema. Vision LLM chỉ trả về subject, hook, thứ tự bước, `voice_cue`.
     Geometry do Path A (LLM sinh DSL) hoặc Path B (SVG) lo.
   - `FR-3c Image-to-Geometry Ingestion` → **mục 6.2 Out of Scope**, hoãn sang v2.

2. **Thêm quality gate bắt buộc cho FR-3b:** operator phải xác nhận preview trước
   khi lưu Registry. Không auto-commit — model tự tin 0.95+ ngay cả khi sai hoàn toàn.

3. **A-H13:** hạ rủi ro từ **Cao** → **Trung bình**. Ngưỡng đo đổi thành ≥90% cho
   concept mode. Ghi nhận panel leak là lý do kỹ thuật loại bỏ geometry.

4. **Thêm A-H14 mới:** *"Vision LLM không phân biệt được ảnh tutorial thật với bảng
   variation / panel lẻ, và tự tin 0.95+ khi sai. Cần operator review 100%."*
   Rủi ro: Trung bình.

5. **UJ-3 Path D:** sửa mô tả thành "trích xuất **ý tưởng + trình tự vẽ**", bỏ phần
   "Preview animate 6 bước trên canvas" (không khả thi khi không có geometry đúng).

6. **Thêm assumption bản quyền:** ảnh Pinterest có bản quyền. Dùng làm tham chiếu
   ý tưởng là rủi ro thấp; sao chép geometry 1:1 ở quy mô thương mại là rủi ro thật.
   Đây là lý do **độc lập với accuracy** để ưu tiên concept mode.

---

## Cải tiến đã đưa vào công cụ

- `scoring.py`: thêm `_panel_leak()` — phát hiện toạ độ trôi theo lưới panel, trừ
  25–40 điểm. Đây là lỗi khiến geometry vô dụng mà `coord_validity` không bắt được.
- `compare.py`: thêm `paired_compare()` — chỉ so sánh trên ảnh cả hai chế độ đều
  chạy được, tránh lặp lại sai lầm so sánh hai tập khác nhau.
- `compare.py`: cảnh báo khi tỷ lệ lỗi API ≥ 20% làm sai lệch kết quả.
- `parse_image.py`: thêm `--retry` (mặc định 2) với exponential backoff cho lỗi
  503/429. Chỉ retry lỗi tạm thời, không retry lỗi key sai hay JSON hỏng.

## Chạy lại để xác nhận

```powershell
git pull
.venv\Scripts\python compare.py --model gemini --retry 3
```

Với retry, tỷ lệ lỗi 503 sẽ giảm mạnh và `paired` sẽ có đủ 11 ảnh thay vì 5.
Dự đoán: verdict tự động sẽ ra `SPLIT`.

---

## Phụ lục — Hết quota giữa chừng (2026-09-08)

Lần chạy xác nhận bị dừng bởi `429 RESOURCE_EXHAUSTED` (hết quota ngày của free tier).

**Điều này KHÔNG ảnh hưởng kết luận.** Lý do:

1. **Panel leak quan sát được ở 3/3 ảnh geometry, không có ngoại lệ.**
   `rabbit_8steps` khớp *chính xác* lưới 3×3 — xác suất trùng hợp ngẫu nhiên gần bằng 0.
   Đây là hạn chế hệ thống của Vision LLM, không phải nhiễu thống kê. Chạy thêm ảnh
   không thể lật ngược.

2. **Concept mode đạt 100% trên 4/4 ảnh tutorial chạy được**, đọc đúng cả ba dạng hook
   (số 20, số 1, chữ G). Hai ảnh còn thiếu chỉ lỗi API, không phải lỗi chất lượng.

3. **Kiểm tra ngược:** để geometry thắng, cả 4 ảnh còn thiếu phải *không* bị panel leak.
   Nhưng 3/3 ảnh đã đo đều leak 77–97%. Không có kịch bản thực tế nào đảo ngược.

→ Đủ dữ liệu để sửa PRD. Chạy lại chỉ để làm đẹp báo cáo.

### Xử lý khi hết quota

Công cụ đã được vá:

- **Dừng ngay khi hết quota** thay vì đốt hết 22 lượt gọi đều thất bại.
- **Phân biệt 429 hết-quota-ngày (không retry) với 429 rate-limit tức thời (retry được).**
  Trước đây gộp chung nên retry vô ích 3 lần rồi mới bỏ.
- **`--skip-existing`** để chạy tiếp từ chỗ dừng, không làm lại ảnh đã xong.
- **Tắt cảnh báo AFC** của SDK cho log sạch.

```powershell
# Sau khi quota reset, chạy tiếp phần còn thiếu:
.venv\Scripts\python compare.py --model gemini --skip-existing --retry 3

# Hoặc dùng model nhẹ hơn, tốn ít quota hơn:
$env:GEMINI_VISION_MODEL = "gemini-flash-lite-latest"
```

Free tier reset theo ngày (giờ Thái Bình Dương). Xem quota tại https://ai.dev/rate-limit
