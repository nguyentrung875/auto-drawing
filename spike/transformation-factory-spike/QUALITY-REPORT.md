# Báo cáo chất lượng — Transformation Factory Spike

> **Nhận xét của operator (2026-09-09):** _"Nhìn ra đúng con vật (thiên nga, mèo...)
> nhưng chất lượng rất xấu."_ — **Nhận xét đúng 100%.** Báo cáo này chứng minh bằng
> số liệu + ảnh render, và đưa ra cách khắc phục cụ thể.

## 1. Kết luận trước (TL;DR)

| Câu hỏi | Trả lời |
|---|---|
| Concept "số → con vật" có đúng không? | ✅ Đúng — 7/7 mẫu đều nhận ra được con gì |
| Nét vẽ có đạt chuẩn publish không? | ❌ Không — **0/8 mẫu pass** gate thẩm mỹ A1..A7 |
| Gate C0..C3 hiện tại có bắt được hình xấu không? | ❌ Không — 7/8 mẫu xấu vẫn **PASS** vì C0..C3 chỉ đo hình học, không đo thẩm mỹ |
| Sửa bằng cách đổi model/prompt có được không? | ❌ Không — lỗi nằm ở **tọa độ vẽ tay + kiến trúc variation**, không phải ở model |
| Khắc phục thế nào? | **Vẽ lại theo craft-rules (đã chứng minh bằng 2 mẫu v2) + thêm gate A1..A7 + bỏ deform toàn cục** |

## 2. Bằng chứng: render toàn bộ mẫu v1

Render bằng `preview.mjs` (zero-dependency, dùng chung parser với gate nên số liệu khớp):

| Mẫu | Nhìn thấy gì | Lỗi chính |
|---|---|---|
| `9_to_cat` | Mặt tạm được, thân là chữ U rỗng | Tai mỏng lơ lửng; mắt 2 chấm tí hon; râu gạch thẳng đơ; chân = 1 gạch ngang |
| `2_to_swan` | Cổ đẹp, còn lại lạ | Mỏ tam giác rời; thân+cánh là 2 lens lồng nhau như **con mắt**; đuôi 1 nét; sóng rời rạc |
| `9_to_dog` | Số 9 + que củi | Mõm lơ lửng; **chỉ 1 mắt**; tai 1 đường cong; chân que |
| `9_to_pig` | **Tệ nhất** | **Đầu tách rời mũi** (hở 14px, thấy rõ khe trắng); chân = 4 gạch đâm vào bụng |
| `9_to_eagle` | Chim lạ | Mỏ như phễu đâm ngang; mắt = tam giác + gạch ngang như ký hiệu; lông vũ = 3 gạch chéo |
| `9_to_lion` | Bờm đẹp, thân xấu | Chân que rời thân 32px; đuôi có vòng tròn lạ ở cuối |
| `8_to_bear` | **Đẹp nhất** ✅ | Hook congruence hoàn hảo (8 = đầu + bụng). Chỉ còn mắt chấm nhỏ + tay đơn |
| `2_to_swan_v2` / `9_to_cat_v2` | **Bản vẽ lại** ✅ | Cùng concept, mắt/cánh/mỏ/râu/chân vẽ thật → đẹp hơn hẳn (xem `preview-v2/`) |

Ảnh: `preview/*.png` (v1), `preview-v2/*.png` (v2). Mở `index.html` → dropdown
"✨ Bản vẽ lại v2" để xem animation so sánh trực tiếp.

## 3. Chẩn đoán: 5 nguyên nhân gốc (theo thứ tự nghiêm trọng)

### N1. Gate C0..C3 mù thẩm mỹ — hình xấu vẫn PASS, dán nhãn "production-ready"

`gate.mjs` chỉ kiểm tra: nét mồ côi (C0), số cụm (C1), tỷ lệ mực (C2), số nét
(C3). **Không có check nào hỏi "mắt có nhìn được không", "đầu có liền thân
không", "phụ kiện có lơ lửng không".** Kết quả: 7/8 mẫu xấu PASS toàn bộ.

> Đây chính là lỗ hổng mà Feasibility Assessment §5.2 đã cảnh báo:
> _"validator hiện tại chỉ bắt lỗi cú pháp, không bắt lỗi ngữ nghĩa."_

### N2. Chi tiết mặt vẽ "cho có" — mắt chấm `l 0.01 0`, râu gạch thẳng

- 5/7 mẫu dùng mắt chấm: `M 240 310 l 0.01 0` → render thành chấm ~6px trên đầu
  130px (chưa tới 5%) — nhìn xa gần như vô hình (dog chỉ có **1 mắt**).
- Râu mèo là 4 đường thẳng nằm ngang tuyệt đối, đâm xuyên viền đầu.
- Mỏ thiên nga là tam giác cân đặt hờ lên mép cổ, không theo tangent của cổ.

### N3. Thân và chân vẽ bằng "gạch que" — 1 đường thẳng = 1 chi

Chân pig/eagle = gạch đứng đơn; chân sau cat = 1 gạch ngang 50px; đuôi swan =
1 đường cong; lông vũ eagle = 3 gạch chéo. Không có bàn chân, khớp, hay khối
nào. Thân cat/dog là khoảng trống giữa 2 đường (ngực + đuôi số 9) — rỗng ruột.

### N4. Đầu pig TÁCH RỜI khỏi thân (lỗi cấu trúc, không phải gu thẩm mỹ)

`9_to_pig` step3 (vòm đầu) hở hook **14px** — render thấy rõ khe trắng giữa đầu
và mũi. Đây là lỗi "không chạm nhau", bắt được bằng máy 100% (gate A5).

### N5. Factory variation phá hình đẹp — deform toàn cục + phụ kiện tọa độ cứng

Ngay cả khi template đẹp, bật biến thể vẫn xấu:

- **Deform toàn cục** (`scale(1.08, 0.94)`...) méo vòng đầu tròn thành trứng:
  chibi lệch **17–20px**, chubby **24–28px**, slender **22–25px** (gate A7 đo).
  Chibi "đầu to thân nhỏ" **không thể** làm bằng scale toàn hình — phải là rig
  theo bộ phận.
- **Phụ kiện tọa độ cứng** trong `index.html` (`birthday_hat` ở y≈212,
  `sunglasses` ở y=300, `bow_collar` ở (270,380)) chỉ vừa đúng 1 mẫu. Đặt lên
  swan (đầu ở y≈243, cổ x≈220) hay bear (đầu y≈310) → lơ lửng/đè sai chỗ.
  Không template nào khai báo `anchors{}` (gate A6).

## 4. Cách khắc phục

### Lớp 1 — Chặn hình xấu lọt qua: gate thẩm mỹ A1..A7 (ĐÃ LÀM — `gate-aesthetic.mjs`)

Heuristic, zero-dependency, chạy cùng `gate.mjs`:

| Check | Bắt lỗi gì | v1 | v2 |
|---|---|---|---|
| A1 Floating dots | mắt chấm vô hình | 5/8 FAIL | PASS |
| A2 Face loops ≥2 | mặt thiếu chi tiết khép kín | 6/8 FAIL | PASS |
| A3 Whisker curves | râu gạch thẳng | cat FAIL | PASS |
| A4 Exterior attach ≤25px | chân/cánh rời thân (lion 32px) | lion FAIL | PASS |
| A5 Head connected ≤12px | đầu rời thân (pig 14px) | pig FAIL | N/A (đầu = hook) |
| A6 Accessory anchors | phụ kiện thiếu anchor | 7/7 FAIL | PASS (đã khai báo) |
| A7 Deform sanity | deform méo đầu >10px | FAIL toàn bộ | cat FAIL ⚠️ (xem Lớp 3) |

```
node gate.mjs              # C0..C3 (hình học) — giữ nguyên
node gate-aesthetic.mjs    # A1..A7 (thẩm mỹ) — thêm vào CI
node preview.mjs           # render PNG review bằng mắt — bắt buộc trước khi duyệt
```

**Kết quả:** v1 **0/8 PASS**, v2 swan **PASS**, v2 cat chỉ còn FAIL A7.
A1–A6 = lỗi authoring (vẽ lại là hết). A7 = lỗi kiến trúc (phải sửa factory).

### Lớp 2 — Sửa gốc: vẽ lại theo craft-rules (ĐÃ CHỨNG MINH bằng 2 mẫu v2)

`templates.v2.json` + `preview-v2/*.png` chứng minh cùng concept vẽ đúng cách thì đẹp.
Rules rút ra (áp cho mọi mẫu vẽ lại):

1. **Mắt/mũi/mỏ là loop khép kín** (ellipse/tam giác, bbox ≥ 8px), không bao giờ
   là chấm `l 0.01 0`. Con ngươi là loop nhỏ **nằm trong** mắt.
2. **Râu/lông/cánh là đường cong** (Q/C), có hướng mọc (từ gốc ra ngọn), không
   gạch thẳng nằm ngang/dọc tuyệt đối.
3. **Mọi bộ phận ngoài phải chạm hook** (gap ≤ 5px khi vẽ mới; gate cho ≤ 25px).
   Riêng stroke "đầu riêng" phải chạm hook ≤ 12px (không lặp lại khe hở của pig).
4. **Chân có bàn** (khúc cong chữ U ở cuối, không gạch đơn), đuôi có độ dày
   (2 nét hội tụ hoặc wedge khép), cánh mở (không lens khép kín lồng nhau).
5. **Mỗi template khai báo `anchors`**: `crown` (đỉnh đầu), `glasses` (giữa 2 mắt),
   `bow` (cổ/chin). Phụ kiện vẽ **tương đối theo anchor**, không tọa độ cứng.
6. **Review bằng mắt là bắt buộc**: `node preview.mjs <id>` → xem PNG → sửa →
   lặp lại. Điểm gate cao là điều kiện cần, mắt duyệt là điều kiện đủ.

### Lớp 3 — Sửa factory: biến thể phải có guardrails (ĐỀ XUẤT — chưa làm)

| Vấn đề | Fix |
|---|---|
| Deform `scale()` toàn hình méo đầu (A7 FAIL cả mẫu đẹp) | Thay bằng **parametric rig theo bộ phận**: head-scale, body-scale, leg-length riêng. Chibi = đầu ×1.2 + thân ×0.85 (giữ vòng tròn là tròn), không phải scale toàn canvas |
| Phụ kiện 1 tọa độ dùng cho mọi mẫu | Vẽ phụ kiện từ `anchors{}` của từng template. Công thức gợi ý: mũ = tam giác đáy tại `crown`; kính = 2 vòng tròn tâm `glasses ± dx`; nơ = 2 tam giác + nút tại `bow`, scale theo headR |
| Mắt biến thể (happy/wink/anime) đè cố định | Mỗi expression là **hàm vẽ theo bbox mắt gốc** của template (tâm + rx/ry), không phải path cứng |
| Không ai duyệt biến thể | Gate chạy trên **ma trận variant** (template × deform × accessory × expression), không chỉ bản base. FAIL 1 ô = template chưa đủ điều kiện factory |

### Lớp 4 — Dài hạn (R0 ngày 3 trong Feasibility Assessment)

- **C4/C5 bằng sketch classifier** (QuickDraw): đo "nhận ra đúng con gì" và
  "bất ngờ tăng dần" — thay mắt người ở quy mô lớn.
- **Nguồn nét vẽ thật**: trace từ sách how-to-draw / QuickDraw stroke-order thay
  vì bịa tọa độ — xem Feasibility §6.2.

## 5. Việc cần làm tiếp (đề xuất thứ tự)

1. [ ] Vẽ lại 5 mẫu còn lại (dog, pig, eagle, lion, bear) theo craft-rules Lớp 2
   (~30–60 phút/mẫu) → đích: **7/7 PASS A1..A6**
2. [ ] Implement phụ kiện theo `anchors` trong `index.html` (thay tọa độ cứng)
3. [ ] Thay deform toàn cục bằng parametric rig theo bộ phận → đích: **PASS A7**
4. [ ] Thêm `gate-aesthetic.mjs` + `preview.mjs` vào CI/batch pipeline
5. [ ] R0 ngày 3: classifier C4/C5 (QuickDraw)

## Phụ lục — Công cụ mới trong spike này

| File | Dùng để gì |
|---|---|
| `preview.mjs` | Render `templates.json` → PNG, zero-dependency (node builtins). `node preview.mjs [id...]`, `--file`, `--out` |
| `gate-aesthetic.mjs` | Gate thẩm mỹ A1..A7. `node gate-aesthetic.mjs [--file ...]` |
| `templates.v2.json` | 2 mẫu vẽ lại (`9_to_cat_v2`, `2_to_swan_v2`) kèm `anchors` |
| `preview/`, `preview-v2/` | Ảnh render v1/v2 để so sánh |
| `index.html` | Đã thêm dropdown "✨ Bản vẽ lại v2 (đẹp hơn)" — chạy `node serve.mjs` để xem |
