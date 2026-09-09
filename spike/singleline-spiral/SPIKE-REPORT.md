# Spike Report — Single-Line Spiral Art

**Ngày:** 2026-09-09 · **Input:** chân dung AI-generate (`input/portrait.png`, toàn quyền sử dụng)
**Câu hỏi spike:** Ảnh chân dung → 1 nét xoắn ốc duy nhất, có đủ giống để làm video viral không?

## 1. Verdict: GO có điều kiện ✅⚠️

| Tiêu chí | Kết quả |
|---|---|
| 1 nét duy nhất, không nhấc bút (S1) | ✅ 1 stroke / 1 lệnh M, verify bằng parser pipeline |
| Nhìn ra mặt người (mắt người) | ✅ Bản v4: thấy rõ trán–mắt–mũi–môi–vai khi nheo mắt/thumbnail |
| Gate S1..S4 | ✅ v4 PASS 4/4; v1/v2 FAIL đúng (bản mờ/bậc thang) |
| Thời lượng video | ⚠️ Realtime 5.3 phút → cần timelapse **~7x** cho video 45s |
| Metric S2 tự động | ⚠️ Dùng được để sàng lọc, **bắt buộc kèm mắt người** (v5 game được metric) |

## 2. Bản champion: v4 (AM spiral)

- **Params:** `--mode am --turns 100 --amp 3.2 --pp-turn 140 --gamma 0.7`
- 14.000 điểm · path 79.7k px · file 191KB · S2 = 0.266
- Xem: `output/v4/render.png`, `output/v4/spiral.svg`
- **Demo animation:** `output/v4/player.html` — bấm ▶ để xem nét vẽ 24s + reveal so ảnh gốc
  (chạy `python3 -m http.server 8077 --directory output/v4` rồi mở `http://localhost:8077/player.html`)

So sánh các bản:

| Bản | Params | S2 | Mắt thấy |
|---|---|---|---|
| v1 | turns 90, amp 2.2 | 0.234 FAIL | Mờ, chỉ thấy khi nheo mắt kỹ |
| v2 | turns 100, amp 4.0, nearest-sampling | 0.243 FAIL | Thấy mặt nhưng bậc thang xấu |
| **v4** | turns 100, amp 3.2, **bilinear + blur + gamma** | **0.266 PASS** | ✅ Mượt, rõ mặt — **champion** |
| v5 | FM zigzag 48 vòng/turn | 0.285 PASS | ❌ Moiré/thêu che mất mặt — **false positive của S2** |

## 3. Ba phát hiện kỹ thuật (đã chứng minh bằng ảnh + số)

### F1. Spiral AM là "edge-emphasis", không phải "tone-mapping"

Công thức `r = r0 + amp·brightness` chỉ dồn nét ở **biên** sáng–tối, còn vùng
phẳng (trán, má) bị rút nét → test hình tròn/vuông phẳng cho ra viền sáng,
ruột tối (`output/synth` đã xóa sau khi xác nhận). Với ảnh chân dung thật
(gradient khắp nơi) thì vẫn đọc được mặt — đúng phong cách spiral art viral —
nhưng đừng kỳ vọng tái tạo tone da mịn.

### F2. Hai lần metric sai trước khi đúng (bài học đo lường)

1. **MAE thumbnail**: bản càng xấu (v3 nát) điểm càng... xem lại mới biết sai
   registration (resize méo khung hình) → sửa crop-then-resize.
2. **Pearson tone**: ÂM cho cả bản đẹp (-0.17) vì F1 (ruột sáng bị vẽ tối) →
   chuyển sang **Pearson trên gradient (cạnh)**: v1 < v2 < v4 đơn điệu đúng.
3. **Edge-pearson vẫn game được**: v5 texture moiré đạt điểm cao nhất (0.285)
   dù mắt thấy tệ nhất → S2 là điều kiện cần, **preview PNG + mắt người là
   điều kiện đủ**. Đúng triết lý gate của repo.

### F3. Lấy mẫu quyết định 80% chất lượng

- Nearest-neighbor + amp lớn = bậc thang hình khối (v2, v3).
- Fix = **bilinear + blur nhẹ ảnh làm việc (r=1.2) + gamma 0.7** (v4 mượt).
- Chi phí: không đáng kể (<1s cho 14k điểm trên CPU).

## 4. Gắn vào pipeline hiện tại

- `oneline.json` đã đúng shape DSL: 1 template = 1 stroke, parse được bằng
  `gate.mjs` (`strokeLength` đo lại khớp số Python).
- Phần phải làm thêm cho video thật (ngoài scope spike):
  1. **Pacing profile**: timelapse ~7x toàn cục + chậm lại ở đoạn reveal cuối
     (mở rộng AD-11, hiện cap 1.8x không đủ cho track này).
  2. **Pen-follow 14k điểm**: `getPointAtLength` trên path 191KB — cần đo FPS,
     nếu lag thì rút gọn điểm (RDP epsilon ~0.5px).
  3. **Công thức video**: hook 0–2s (show ảnh gốc 0.5s → che → "vẽ không nhấc bút"),
     timelapse thân, reveal đặt cạnh ảnh gốc. Xem phân tích chiến lược đầy đủ
     trong thread ngày 2026-09-09.
  4. **Nguồn ảnh**: AI-generate (đã dùng ở spike, sạch bản quyền) hoặc public domain.
     Không dùng ảnh Pinterest trôi nổi cho bản publish.

## 5. Cách chạy lại

```bash
cd spike/singleline-spiral
python3 -m venv .venv && .venv/bin/pip install pillow numpy
.venv/bin/python spiral.py input/portrait.png --turns 100 --amp 3.2 --pp-turn 140 --out output/v4
node gate-singleline.mjs output/v4
```

## 6. File trong spike

| File | Nội dung |
|---|---|
| `spiral.py` | Generator AM/FM + render PIL + S2 edge-metric |
| `gate-singleline.mjs` | Gate S1..S4 (dùng parser của pipeline) |
| `player-template.html` | Template demo animation (nhúng path + ảnh gốc) |
| `input/portrait.png` | Chân dung test (AI-generate) |
| `output/v1 v2 v4 v5/` | Mỗi bản: `render.png`, `spiral.svg`, `oneline.json`, `stats.json` |
| `output/v4/player.html` | Demo xem được ngay (251KB, standalone) |

---

## 6. Bản v6 — phản hồi người dùng "khó nhìn": density spiral (tone-mapping thật)

**Phản hồi:** output spiral khó nhìn, cần sắc nét giống ảnh gốc.

**Chẩn đoán:** v4 dùng AM (`r = r0 + amp·brightness`) — F1 đã chứng minh đây là
*edge-emphasis*: chỉ nhấn biên sáng–tối, vùng phẳng (trán, má) bị rút nét nên
mặt mờ, phải nheo mắt mới thấy. Muốn "nhìn ra mặt" phải là *tone-mapping*:
vùng sáng (mặt) phải có **mật độ vòng xoắn cao** (sáng trắng), vùng tối phải
**thưa** (tối).

**Giải pháp v6 — recursion level-set theo góc** (mode `density`):

```
r_{k+1}(φ) = r_k(φ) + gap(b(r_k(φ), φ))
gap(b) = min(gap_max, gap_min·((1+eps)/(b+eps))^p)
```

- Khoảng cách 2 vòng xoắn liên tiếp **tại góc φ** = gap của độ sáng **tại góc φ**
  → tone-mapping cục bộ đúng nghĩa, mặt giữ nguyên hình dạng (không thành đĩa
  tròn như bản radial-only trung gian).
- Mỗi vòng là đường khép kín không tự cắt (gap > 0) → vẫn **1 nét duy nhất** (S1).
- Nền tối "chạy" ra ngoài nhanh (gap lớn) → nền sạch, tối; `--rim` chặn bán kính
  tại 250 tạo khung tròn gọn (tránh nét vẽ tràn góc).
- Preprocessing `--prep sharp`: stretch 2–98 + unsharp 0.5 + blur 0.8 (v4 dùng
  stretch 5–95 + blur 1.2 — mềm hơn). Render 2x (1080×1520), stroke 1.5.

**Kết quả (portrait.png):**

| Bản | S2 (edge) | Tone Pearson | Sharpness | Timelapse | Gate |
|---|---|---|---|---|---|
| v4 (cũ) | 0.266 | **−0.29** (sai tone) | 0.138 | 7.1x | PASS |
| **v6** | **0.401** | **+0.73** | 0.236 | 13.6x | S3 sát ngưỡng ⚠️ |
| **v6-video** | 0.374 | +0.76 | 0.250 | **11.4x** | **PASS 5/5** |

Tone Pearson lật dấu −0.29 → +0.73 = bằng chứng số cho việc v6 giờ tái tạo
tone ảnh thật (trước đây F2 ghi nhận metric tone âm là do AM chỉ vẽ biên).

- `output/v6/` — bản nét mịn nhất (gap-min 1.3, S2 cao nhất). S3 13.6x (vượt 12x
  1.6 điểm) do ưu tiên mật độ nét — dùng cho ảnh tĩnh.
- `output/v6-video/` — bản cân bằng (gap-min 1.6): **PASS toàn bộ S0–S4**, dùng
  cho track video 45s.
- Xem so sánh: `comparison-v4-v6.png`; demo animation: `output/v6/player.html`
  và `output/v6-video/player.html` (bấm ▶ Vẽ 24s + reveal).

**Tổng quát hoá (cùng tham số v6 trên ảnh validation):** val_man S2=0.368,
val_cat S2=0.453, val_elder S2=0.320, val_rose S2=0.171 (rose thấp — ảnh chủ thể
nhỏ/isolated, lưu ý khi chọn nguồn ảnh).

**Cách chạy:**

```bash
.venv/bin/python spiral.py input/portrait.png --mode density --prep sharp \
  --gap-min 1.3 --gap-max 8.0 --stroke-w 1.5 --gap-p 2.0 --eps 0.12 \
  --gamma 0.85 --rim 250 --edge-k 0.08 --out output/v6
node gate-singleline.mjs output/v6
```
