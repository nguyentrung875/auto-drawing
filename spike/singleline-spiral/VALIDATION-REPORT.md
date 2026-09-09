# Validation Report — Ngưỡng S2 trên 9 ảnh (điều kiện vào CI)

**Ngày:** 2026-09-09 · **Generator:** v4 champion (`--turns 100 --amp 3.2 --pp-turn 140`)
**Bộ test:** 9 ảnh AI-generate (sạch bản quyền) — 4 chân dung dễ, 1 hoa, 1 mèo,
1 profile tối, 3 bẫy (phố đông, sương mù, nhóm 4 người).

## 1. Kết quả: ngưỡng S2 = 0.25 ĐỨNG VỮNG — 9/9 khớp mắt người ✅

| Ảnh | S0 input | S2 | Gate | Mắt người | Khớp? |
|---|---|---|---|---|---|
| man | PASS | 0.315 | **PASS** | Rõ nhất | ✅ |
| rose | PASS | 0.266 | **PASS** ⚠xám | Rõ hoa | ✅ |
| portrait (gốc) | PASS | 0.266 | **PASS** ⚠xám | Rõ mặt | ✅ |
| elder | PASS | 0.253 | **PASS** ⚠xám | Rõ, hơi mờ | ✅ |
| cat | PASS (mù) | 0.242 | FAIL ⚠xám | Yếu | ✅ |
| group | **LOẠI SỚM** (nền sáng 19%) | 0.229 | FAIL | Rối | ✅ |
| profile | PASS (mù) | 0.216 | FAIL | Rất mờ | ✅ |
| street | **LOẠI SỚM** (nền sáng, rối) | 0.120 | FAIL | Hỗn độn | ✅ |
| fog | **LOẠI SỚM** (phẳng) | 0.008 | FAIL | Trống | ✅ |

## 2. Quyết định ngưỡng (đưa vào CI)

```
S2 < 0.23          → REJECT tự động
0.23 ≤ S2 < 0.27   → VÙNG XÁM: PASS có điều kiện, bắt buộc mắt duyệt kỹ
S2 ≥ 0.27          → PASS (vẫn duyệt mắt mẫu đầu mỗi batch — nguyên tắc không đổi)
```

Margin thực đo: PASS thấp nhất 0.253 (elder) vs FAIL cao nhất 0.242 (cat).
Vùng xám đã implement trong `gate-singleline.mjs` (cờ ⚠).

## 3. S0 — gate input mới (loại sớm 3/5 ca xấu, rẻ, giải thích được)

| Rule | Bắt ca nào | Ảnh tốt nằm đâu |
|---|---|---|
| `std < 0.10` → flat | fog (0.043) | 0.15 – 0.30 |
| `dark% < 50%` → nền không tối | street (43%), group (19%), fog (0%) | 60 – 85% |
| `edge > 0.06` → quá rối | street (0.072) | 0.012 – 0.036 |

S0 mù với 2 ca (cat, profile — chỉ số input đẹp nhưng output yếu) → S2 bắt.
Hai tầng bổ sung cho nhau, không thay thế nhau.

## 4. Phạm vi hợp lệ của generator (đã chứng minh)

**HỢP:** mặt người chính diện/bán diện nền tối (4/4), hoa close-up (1/1).
**KHÔNG HỢP:**
- Texture mịn (lông mèo): 100 turns thiếu phân giải → mờ. Muốn làm thú lông
  phải tăng turns (~150) hoặc chấp nhận phong cách mờ.
- Low-key quá đà (profile tối 85%): cạnh rim-light mỏng mất sau blur → mờ.
- Ảnh đông / rối / phẳng: S0 loại từ input.

## 5. Giới hạn còn lại (chưa chặn CI)

1. Mẫu mới 9 ảnh, 1 thể loại nguồn (AI-generate). Ảnh thật (điện thoại, nén JPEG,
   noise) có thể lệch phân phối → validate bổ sung khi có ảnh thật.
2. S2 vẫn game được bằng texture (v5 FM 0.285 nhưng xấu) → mắt người là bắt buộc,
   không auto-publish.
3. Chưa test mặt trẻ em, người đeo kính/phụ kiện, ảnh màu (pipeline chuyển L
   nên màu rực có thể mất chi tiết sau grayscale).

## 6. Tái chạy

```bash
cd spike/singleline-spiral
for f in man elder cat profile rose street fog group phone isoluminant color_ok color_man; do
  .venv/bin/python spiral.py input/val_$f.png --turns 100 --amp 3.2 --pp-turn 140 \
    --out output/validate/$f
  node gate-singleline.mjs output/validate/$f
done
```

Ảnh: `input/val_*.png` · Render: `output/validate/*/render.png`

## 7. Bổ sung: ảnh màu & ảnh điện thoại (5 ca, 2026-09-09)

**Câu hỏi:** pipeline chỉ nhận trắng đen — ảnh màu chụp điện thoại được không?

**Trả lời: MÀU KHÔNG PHẢI VẤN ĐỀ — pipeline mù màu từ dòng đầu (`convert("L")").
Yếu tố quyết định là ánh sáng + nền, không phải màu sắc.**

| Ca | S0 | S2 | Mắt | Kết luận |
|---|---|---|---|---|
| color_man (màu, side-light mạnh, nền đen) | PASS | 0.246 ⚠xám | **RÕ** | Màu đạt chuẩn → đẹp như B&W. False-negative của ngưỡng cứng, **vùng xám cứu đúng** |
| color_ok (màu, sáng đều, tàn nhang) | PASS | 0.231 ⚠xám | Yếu | Thua vì sáng đều + texture mịn (bệnh của cat/selfie), không vì màu |
| phone (selfie ban ngày, nền công viên) | LOẠI (nền sáng 30%) | 0.205 | Yếu/rối | Thua vì phẳng + nền rối. Vignette cứu S0 nhưng S2 vẫn FAIL (0.209) |
| phone+mask da thủ công | PASS | 0.179 | Tệ hơn | Mask thủ công lỗi (giữ cỏ, cắt tóc) → tiền xử lý nửa vời còn hại hơn |
| isoluminant (hoa đỏ/lá xanh cùng xám) | LOẠI (**color-loss** 0.42) | 0.060 | Trống | **Giới hạn CỨNG**: tin nằm ở hue, gộp xám là mất. Không cứu được → anti-pattern |

**S0 rule mới:** `colorful > 0.12 và luma-std < 0.16` → `color-loss`. Bắt đúng
isoluminant, không bắt nhầm ảnh màu tốt (color_man/color_ok PASS).

**Quy tắc chụp/chọn ảnh (từ bằng chứng):** nền tối + ánh sáng xiên tạo khối +
1 subject lớn ở giữa + tránh texture mịn và subject phân biệt bằng hue.
Ảnh selfie ban ngày nền công viên thì không — không phải vì màu, mà vì phẳng và rối.

**Chưa thử:** xóa nền bằng model segmentation (rembg không tải được model trong
sandbox do SSL). Dự đoán cũng không cứu được selfie phẳng vì thiếu gradient gốc.
