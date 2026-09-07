---
title: "Feasibility Assessment — Drawing Transformation Video Factory"
type: feasibility-assessment
status: final
created: 2026-09-07
author: Arena agent
scope: "Đánh giá tính khả thi toàn dự án, tập trung vào rủi ro 'AI không biết vẽ gì / vẽ sao cho đúng'"
sources:
  - _0TaiLieu/Product Requirements Document — Drawing Transformation Video Factory.md
  - _0TaiLieu/tools.md
  - _0TaiLieu/gpt_review_clip.md
  - _bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/prd.md
  - _bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/validation-report.md
  - _bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/review-adversarial.md
  - _bmad-output/planning-artifacts/architecture/architecture-auto-drawing-2026-09-05/ARCHITECTURE-SPINE.md
companions:
  - proof/index.html   # demo tương tác, chạy `node serve.mjs`
  - proof/gate.mjs     # gate C0..C3, chạy `node gate.mjs`
  - proof/templates.json
---

# Feasibility Assessment — Drawing Transformation Video Factory

## 0. Verdict

> **CONDITIONAL GO.**
> Khả thi về **pipeline kỹ thuật**: **~85–90%**.
> Khả thi về **content engine đúng như PRD đang mô tả** (LLM sinh Drawing DSL làm đường nhập liệu chính): **~20–25%**.
> Khả thi **sau khi sửa 1 điểm kiến trúc** (tách *Transformation Authoring* ra khỏi *AI Runtime Planner*, thêm gate C0–C5): **~70%**.

**Nỗi lo của bạn là đúng — nhưng cần tách nó thành hai nửa, vì một nửa đúng và một nửa sai:**

| Bạn lo | Đánh giá | Vì sao |
|---|---|---|
| "AI không đủ **sáng tạo**" | ❌ **Sai chỗ** | Sáng tạo *không nên* xảy ra lúc runtime. Nếu bạn phải cầu AI sáng tạo cho từng video thì kiến trúc đã sai. Sáng tạo chỉ nên bỏ ra **một lần**, lúc authoring template. |
| "AI không **hiểu cần vẽ gì**" | ✅ **Đúng** | Đây là *LLM spatial reasoning*. Đã có benchmark đo được: GPT-4 chỉ ~50% accuracy trên SVG, và lỗi nguy hiểm nhất là lỗi **"compile được nhưng hình sai"** — đúng loại lỗi mà DSL Validator của dự án **không bắt được**. |
| "AI không biết **vẽ sao cho đúng**" | ✅ **Đúng, và nghiêm trọng hơn bạn nghĩ** | PRD chỉ validate **schema + Canvas Bounds**. Không có gate nào kiểm tra **"hình này có phải con gấu không"**. Một con thỏ đúng toạ độ nhưng xấu vẫn pass 100% cổng và được dán nhãn `production-ready`. |
| "Đề xuất đại 99 → hổ rồi giao con tự vẽ" | ✅ **Đúng — và đây là lỗi thiết kế, không phải lỗi model** | `99 → hổ` fail về **hình học**, trước cả khi AI vào cuộc. Đổi model mạnh hơn **không** sửa được. Đã demo + đo được bằng số. |

**Điểm quan trọng nhất:** `validation-report.md` của chính dự án đã flag đúng vấn đề này ở mức **HIGH** — *"LLM spatial reasoning cho DSL Generation không có assumption tag"* và *"UJ-3 thiếu quality gate cho thẩm mỹ LLM-generated components"*. Hai finding đó **chưa được xử lý**: PRD vẫn chưa có `A-07`, vẫn chưa có gate thẩm mỹ. Nghĩa là nỗi lo của bạn không phải cảm tính — nó là **finding đã ghi nhận nhưng bị bỏ quên**.

---

## 1. Bảng khả thi theo khối

Chấm trên bằng chứng đã kiểm chứng ngày 2026-09-07, không phải cảm tính.

| # | Khối | Khả thi | Conf. | Căn cứ |
|---|---|---|---:|---|
| 1 | Pen-follow + stroke reveal animation | Rất cao | **98%** | Đã demo trong `proof/`. `getPointAtLength()` + `atan2()`, ~30 dòng JS, **độ lệch 0px** (tốt hơn ngưỡng ≤5px của `SM-2`) |
| 2 | Determinism / seed / reproducibility | Rất cao | **95%** | Thuần logic. `AD-9` viết đúng |
| 3 | Batch orchestration + FFmpeg encode | Cao | **90%** | Chuẩn công nghiệp. `AD-7`, `AD-12`, `AD-13`, `AD-14` là phần **tốt nhất** của architecture spine |
| 4 | Gate C0–C3 (đo được, không cần ML) | Rất cao | **95%** | **Đã có code chạy được** — `proof/gate.mjs` |
| 5 | Gate C4–C5 (recognizability / surprise) | Khá | **70%** | Cần sketch classifier. QuickDraw 50M ảnh / 345 lớp / **CC-BY-4.0** có sẵn |
| 6 | 2D Hand + occlusion + texture | Khá | **72%** | Toán dễ, **thẩm mỹ mới khó**. `A-06` ("7/10 realism") là assumption chưa kiểm chứng — nên giữ nguyên tag |
| 7 | Render engine headless (`AD-5`) | **Trung bình** | **55%** | Motion Canvas headless **không phải first-class workflow** — issue [#1218](https://github.com/motion-canvas/motion-canvas/issues/1218): *"No documented CLI method for headless rendering"*. Cộng đồng phải tự script Puppeteer + Vite dev server |
| 8 | TTS tiếng Việt local đạt chuẩn content | **Thấp–TB** | **45%** | `rhasspy/piper` đã **ARCHIVED**. Chỉ có 3 giọng Việt, tốt nhất là `vais1000-medium` — model card ghi rõ **"Finetuned from U.S. English lessac voice"**. `viPiper` trong docs trỏ tới repo **404**; repo thật `EraX-AI/viPiper` là **training pipeline cần GPU**, không ship sẵn giọng |
| 9 | **LLM sinh geometry đạt chuẩn publish** | **Thấp** | **18%** | VGBench / SGP-GenBench / Math-Vision Diagrams — xem §5.2 |
| 10 | **Authoring 20+ transformation tốt** | TB **nếu làm tay** / Thấp nếu giao LLM | **65% / 10%** | **Đây mới là bottleneck thật** — xem §2, §6 |
| 11 | `SM-0` (3s retention ≥60%, completion ≥25%) | **Không đánh giá được** | — | `F-ADV-8` nói đúng: phụ thuộc algorithm + kênh 0 follower, **không phải thuộc tính sản phẩm** |

**Đọc bảng này theo cách sau:** mọi thứ ở nửa trên (1–6) là **engineering đã biết cách làm**. Mọi rủi ro thật nằm ở **7, 8, 9, 10** — và ba trong bốn cái đó **không nằm trong phần mà tài liệu coi là khó**.

> `gpt_review_clip.md` kết luận *"90% độ khó nằm ở bàn tay, không phải drawing engine"* và chấm Hand Engine **9/10**, Drawing **5/10**.
> **Nhận định này sai chỗ.** Bám nét là 30 dòng code tất định (khối 1 = 98%). Bàn tay 2D là bài toán thẩm mỹ ở mức 72%.
> Độ khó thật — thứ quyết định dự án sống hay chết — là **khối 10: authoring hình vẽ**, đang bị tài liệu chấm 5/10 và định giao cho LLM.

---

## 2. Ba tầng của bài toán — và AI nên đứng ở đâu

PRD hiện gộp cả ba tầng vào một khái niệm mơ hồ là "AI Planner". Phải tách ra:

```
TẦNG 1 — TRANSFORMATION AUTHORING          (khó · hữu hạn · làm MỘT LẦN)
  "Số 8 có thể hoá thân thành con gì, và bằng nét nào?"
  → KHÔNG giao cho AI tự do. Con người thiết kế, AI trợ lý, gate máy kiểm tra.
  → Output: TransformationTemplate (geometry cố định + stroke order + mapping bộ phận)
                        │
                        ▼
TẦNG 2 — PLANNING & COMBINATORICS          (dễ · vô hạn · làm MỖI VIDEO)
  "Chọn template nào, narration nào, pacing nào, style nào, CTA nào, seed nào?"
  → ĐÂY mới là chỗ AI giỏi thật. Tài liệu tự chấm 2/10 độ khó — chính xác.
  → Output: VideoPlan (tham chiếu template + tham số)
                        │
                        ▼
TẦNG 3 — RENDERING                         (đã giải · tất định · làm MỖI VIDEO)
  geometry → frames → audio → MP4
  → Không AI. Không ngẫu nhiên ngoài seeded PRNG.
```

**PRD đang đặt AI ở Tầng 1** (`FR-2 Drawing DSL Generation` là *primary* ingestion path trong `ADR-02`).
**Phải dời AI xuống Tầng 2**, và để Tầng 1 là công việc thiết kế có kiểm soát.

Đây không phải hạ thấp tham vọng — đây là **đổi chỗ đặt rủi ro**. `§30 Final Product Principle` của PRD cũ đã viết đúng: *"AI tạo ý tưởng và kế hoạch. Drawing system quyết định nét vẽ."* Nhưng `FR-2` + `ADR-02` lại contradicts chính nguyên tắc đó, vì chúng cho LLM **quyết định nét vẽ** (sinh toạ độ primitive) chứ không chỉ lập kế hoạch.

---

## 3. Giải phẫu ca fail `99 → Hổ`

Đây là ví dụ bạn đưa ra, và nó fail vì **4 lý do hình học độc lập**, không lý do nào liên quan tới AI:

| # | Lý do | Giải thích |
|---|---|---|
| **1** | **Không có shape congruence** | `2 → thiên nga` hoạt động vì nét cong của số 2 **chính là** đầu + cổ thiên nga. `99` là *hai vòng tròn có đuôi*. Không bộ phận nào của con hổ đọc ra là "hai vòng tròn có đuôi" theo cách tạo nên **silhouette**. |
| **2** | **Nét mồ côi (orphan stroke)** | Hai cái **đuôi** của số 9 không map được vào bộ phận nào. Chúng **đâm xuyên qua má hổ**. Không có chỗ cho chúng trong giải phẫu con hổ. |
| **3** | **Hook không chịu lực** | Bỏ `99` đi → con hổ **vẫn nguyên vẹn** (chỉ thiếu 2 tai). Fragmentation = **1 cụm**. Hook là trang trí, không phải hoá thân. |
| **4** | **Vượt stroke budget** | Hổ cần vằn (≥3), râu, 4 chân, đuôi → **15 nét / 13.2s vẽ**, chưa cộng narration. Vượt ngưỡng 14 nét. |

**Và đây là chỗ chết:** với 2 nét mồ côi ở lý do #2, bạn chỉ có đúng 2 lựa chọn, và **cả hai đều vi phạm requirement sẵn có của chính dự án**:

```
Giấu nét thừa đi   → vi phạm FR-9 Drawing-to-Reveal Consistency
                     ("hình cuối bắt buộc được kết xuất từ chính tập geometry đã vẽ")

Giữ nguyên nét thừa → vi phạm Q3 Final Recognition
                     (người xem thấy "số 99 dán lên mặt con hổ", không thấy con hổ)
```

Nghĩa là `99 → hổ` **không phải là một transformation khó — nó là một transformation không tồn tại.** Không prompt engineering nào, không model nào sinh ra được nó, vì ràng buộc hình học không có nghiệm.

### 3.1 Kết quả đo thật (`node proof/gate.mjs`)

```
── 8 → Gấu       [PASS]     C0 ✓ 0 orphan · C1 ✓ 9 cụm · C2 ✓ 0.505 · C3 ✓ 12 nét/10.2s
── 2 → Thiên nga [PASS]     C0 ✓ 0 orphan · C1 ✓ 3 cụm · C2 ✓ 0.393 · C3 ✓  7 nét/ 7.6s
── 99 → Hổ       [REJECT]   C0 ✗ 2 orphan · C1 ✗ 1 cụm · C2 ✓ 0.328 · C3 ✗ 15 nét/13.2s
```

**Chú ý dòng C2 của con hổ: PASS (0.328).** Đây là bằng chứng quan trọng nhất trong toàn bộ tài liệu này:

> Một **scalar score** luôn bị game được. Chỉ cần vẽ hai cái đuôi số 9 thật dài là ink-ratio tăng, trong khi transformation vẫn rỗng.
> Thang `≥ 18/25` trong `FR-5` mắc **đúng lỗi này** — nó cộng 5 tiêu chí mềm thành một số cứng, rồi cắt ngưỡng.
> Phải dùng **bộ gate bất đẳng thức** (mọi gate phải pass), không phải **tổng điểm có trọng số**.

---

## 4. Gate C0–C5: thay thế cho "Transformation Scoring" trong FR-5

| Gate | Tên | Định nghĩa | Cách đo | Ngưỡng | Trạng thái |
|---|---|---|---|---|---|
| **C0** | Glyph Absorption | Mọi nét hook phải hoá thân thành **một bộ phận có tên**. Không nét dư thừa. | Khai báo lúc authoring + xác minh bằng ảnh. Ở R0: VLM chỉ vào từng nét hook, hỏi *"nét này là bộ phận gì?"* — không trả lời được ⇒ orphan | `orphan = 0` | ✅ **code đã chạy** (khai báo) · 🔬 R0 (VLM) |
| **C1** | Hook Load-bearing | Bỏ hook đi thì hình **phải sập** | **Tự động 100%**: Fragmentation Index = số cụm nét rời còn lại (đồ thị bbox-overlap, pad 14px) | `≥ 3 cụm` | ✅ **code đã chạy** |
| **C2** | Hook Ink Ratio | Tỷ lệ mực hook / tổng mực | **Tự động, chính xác**: `getTotalLength()` | `≥ 0.30` | ✅ **code đã chạy** |
| **C3** | Stroke & Time Budget | Số nét + thời lượng vẽ | **Tự động**: đếm | `≤ 14 nét, ≤ 25s vẽ` | ✅ **code đã chạy** |
| **C4** | Final Recognizability | Hình cuối line-art phải được nhận diện **đúng** là subject | Sketch classifier (QuickDraw) hoặc VLM trên frame cuối | `top-1 = subject` | 🔬 **R0** |
| **C5** | Progressive Surprise | confidence(subject) **thấp** ở nét đầu, **cao** ở nét cuối, tăng gần đơn điệu | Chạy chính classifier đó trên **từng frame trung gian** — pipeline vốn render từng bước nên gần như miễn phí | `Δconf ≥ 0.5` | 🔬 **R0** |

**C4 là gate mà dự án hoàn toàn không có, và nó là gate quan trọng nhất cho nỗi lo của bạn.**
`FR-2` + `FR-8` chỉ check *schema*, *Canvas Bounds*, *self-intersection*, *component tồn tại*. Tất cả đều là **cú pháp**. Không có gì check **ngữ nghĩa**. Mà lỗi LLM sinh geometry chủ yếu là lỗi ngữ nghĩa (hình đúng toạ độ, sai hình dạng).

**C5 biến "sự tò mò" thành số đo được** — điều mà PRD §17 từ chối làm (*"không nên đưa watch-through potential thành lời hứa kỹ thuật"*). Quyết định đó **đúng một nửa**: không thể hứa *retention*, nhưng **hoàn toàn** có thể đo *độ trễ nhận diện* — và đó là proxy cơ học trực tiếp của curiosity.

**Chi phí C4+C5:** một classifier QuickDraw nhỏ (CNN trên ảnh 28×28 grayscale) train trong ~15 phút trên CPU, hoặc dùng model có sẵn. Line-art trắng-đen là **đúng domain** của QuickDraw nên độ chính xác cao bất thường so với ảnh tự nhiên. Đây là khoản đầu tư ~1 ngày cho một gate dùng mãi mãi.

---

## 5. Reality check stack — những gì tôi đã kiểm chứng hôm nay

### 5.1 Repo shortlist trong `tools.md`

`tools.md` mở đầu bằng *"tránh tự xây lại nền tảng kỹ thuật"* và chấm effort tiết kiệm 80%. Tôi đã gọi GitHub API cho từng repo:

| Repo | tools.md nói | Thực tế (2026-09-07) | Hệ quả |
|---|---|---|---|
| `AnayGarodia/sketchling` | MIT | ✅ MIT · **19★** · TS · push 2026-08-16 · *"hand-drawn illustration and animation language for LLMs"* | Đúng chủ đề. **Đọc để tham khảo DSL design**, không fork làm nền |
| `ToBeWin/HandDraw-Skill` | MIT | ✅ MIT · **2★** · push 2026-08-26 | 2 star = dự án cá nhân. Không phải "skeleton kỹ thuật" để dựa vào |
| `vorojar/svg-draw-motion` | **MIT** | ❌ **KHÔNG CÓ LICENSE** · 1★ | **Vi phạm pháp lý nếu dùng code.** `NFR-5` ("100% MIT/Apache") bị phá ngay tại đây. Chỉ được *đọc* để hiểu thuật toán, phải tự viết lại |
| `Atharva-Kanherkar/chalkboard` | MIT | ✅ MIT · **10★** | Nhỏ nhưng thật, có prompt→mp4 end-to-end |
| `NadirWeb-App/Inkplainer-OS` | Apache-2.0 | ✅ Apache-2.0 · 26★ | OK |
| `kiendt/viPiper` | MIT · "tối ưu hướng Vietnamese" | ❌ **404 — repo không tồn tại.** Repo thật là `EraX-AI/viPiper` (MIT · 27★ · C++ · push **2025-04-24**) | `viPiper` **không phải TTS engine dùng được ngay** — nó là **training pipeline** (prune/finetune), README ghi *"we are actively training a new Vietnamese model"* tức **chưa có**. Muốn dùng phải **tự train giọng** ⇒ cần GPU (README ví dụ 4×RTX3090) ⇒ **phá vỡ hoàn toàn** mô hình "local-first, laptop, $0" |
| `rhasspy/piper` | "có thể đã đổi trạng thái" | ⚠️ **ARCHIVED** · MIT · 11.3k★ | Kiến trúc spine đã biết và xử lý đúng (`AD-3` adapter). Nhưng xem tiếp ↓ |
| Giọng Việt của Piper | "phát âm tiếng Việt chuẩn" | Chỉ **3** giọng: `vivos` (**x_low**), `25hours_single` (**low**), `vais1000` (**medium**). Model card của `vais1000`: **"Finetuned from U.S. English lessac voice (medium quality)"**, phonemizer `espeak-ng voice=vi` | Giọng Việt **tốt nhất có sẵn** là medium, finetune từ giọng Anh. Đây là **rủi ro cao**, không phải "trung bình" như `A-01` đang ghi |
| `motion-canvas` headless | "Ưu tiên số 1, MIT" | ✅ MIT, nhưng headless render **không phải first-class**: issue [#1218](https://github.com/motion-canvas/motion-canvas/issues/1218) (2025-10) *"No documented CLI method for headless rendering — `Renderer` class exists but lacks documentation"*; so sánh độc lập 2026-07 xác nhận *"teams that need it end up scripting a browser or leaning on community tooling"* | `AD-5` + `ADR-01` xây cả kế hoạch RAM/worker-pool trên một API **không được document**. Ước tính "150–250MB/instance" là **đoán** |

**Tổng số sao của toàn bộ "nền tảng" được đề xuất: ~85 sao.**
Đây là các dự án hobby, không phải foundation. Kết luận *"tiết kiệm 80% effort"* là **quá lạc quan**: bạn *đọc* được chúng, nhưng không *fork* được một content factory production từ một repo 2 sao. Con số thực tế tôi ước lượng là **tiết kiệm 30–40%**, chủ yếu ở phần thuật toán đã biết (pen-follow, dash-offset animation, SceneScript shape).

### 5.2 Nghiên cứu về LLM sinh vector graphics — trả lời trực tiếp nỗi lo của bạn

Đây không phải ý kiến. Có benchmark:

- **VGBench (EMNLP 2024)** — benchmark vector graphics đầu tiên. Kết luận: *"GPT-4 shows inferior performance in low-level vector graphics tasks, especially on tasks related to reasoning"*; với SVG, GPT-4 chỉ đạt **~50% accuracy** trên các câu hỏi category/reasoning — trong khi chính model đó đạt **81–84%** trên TikZ/Graphviz. Nghĩa là: **LLM hiểu cấu trúc đồ hoạ, nhưng kém ở toạ độ SVG cụ thể.** ([aclanthology.org](https://aclanthology.org/2024.emnlp-main.213.pdf))
- **SGP-GenBench (arXiv 2509.05208, 2025)** — open-source LLM baseline đạt compositional score **8.8/100**, lỗi chính là *"invalid SVG code, poor attribute binding, weak multi-object handling"*. Frontier model tốt hơn nhiều nhưng **vẫn cần RL với cross-modal verifiable rewards** mới lên được 60.8. Lưu ý: "verifiable reward" chính là **gate C4** mà tôi đề xuất — nghiên cứu này độc lập xác nhận hướng đi. ([emergentmind.com](https://www.emergentmind.com/papers/2509.05208))
- **Math-Vision Diagrams (arXiv 2608.08964, 2026)** — phát hiện đáng sợ nhất, và **khớp chính xác** với lo ngại của bạn: *"manual inspection shows it often generates ... **coordinate miscalculations that survive compilation but produce incorrect diagrams**"*. Ngoài ra 7–29% output fail ngay ở bước compile. ([arxiv.org](https://arxiv.org/html/2608.08964))

> **"Survive compilation but produce incorrect diagrams"** — đây chính xác là lỗ hổng của dự án.
> `DSL Validator` của bạn **là compiler**. Nó sẽ **pass** những hình vẽ sai.
> `NFR-1` hứa *"không bao giờ tạo ra thành công giả (silent failure)"* — nhưng với validator hiện tại, **lời hứa đó không giữ được**, vì định nghĩa "failure" của nó chỉ gồm lỗi cú pháp.

**Hệ quả thực dụng:** `FR-2` cho LLM retry ≤ 3 lần khi vi phạm schema. Nhưng lỗi thật **không vi phạm schema**. Retry 3 lần sẽ sinh ra 3 con thỏ khác nhau, **cả ba đều xấu**, và cả ba đều pass. `ADR-02` coi Path A (LLM DSL) là đường chính và Path B (SVG ingestion) là fallback — **thứ tự này nên đảo ngược**.

---

## 6. Câu hỏi bạn thật sự cần trả lời: có bao nhiêu transformation tốt?

Đây là câu hỏi **không có trong bất kỳ tài liệu nào của dự án**, và nó quyết định tính khả thi của cả business case.

`R2` của PRD cũ viết: *"Nếu chỉ có 8 → animal, content nhanh chóng trở nên nhàm chán"* và xếp nó vào **rủi ro**, mitigation là *"xây transformation library"*.
**Đánh giá này quá nhẹ.** Đây không phải rủi ro — đây là **trần nội dung có thể đếm được**:

Tôi ước lượng số cặp (hook → subject) đạt cả C0–C3 trong không gian PRD §16 khai thác:

| Category | Hook khả dụng | Cặp tốt/hook (ước lượng) | Tổng |
|---|---|---:|---:|
| Chữ số 0–9 | `0 2 3 5 6 8 9` mạnh; `1 4 7` yếu | 3–6 | **~35–45** |
| Chữ cái A–Z | `C O S B D G J P Q U` mạnh (~10 chữ) | 3–5 | **~30–50** |
| Ký hiệu / hình học | `○ △ ♡ ☾ ✦ ∞ ~` | 2–4 | **~15–25** |
| **Tổng (hook đơn)** | | | **~80–120** |

**Nghĩa là:** pool nội dung "độc bản về mặt hình vẽ" của bạn là **~100 cặp**, không phải vô hạn.
Ở 3 video/ngày → cạn sau **~1 tháng**. Ở 50 video/ngày (mục tiêu `UJ-2`) → cạn sau **2 ngày**.

Đây là **con số quyết định** và cần được kiểm chứng bằng authoring thật ở R0, nhưng kể cả nếu tôi sai ±50% thì kết luận không đổi: **`FR-13 batch size = 100` và `SM-4 ≤45s/video` đang tối ưu cho một throughput mà pool nội dung không cung cấp được.**

### 6.1 Ba cách phá trần — và cái nào khả thi

| Cách | Cơ chế | Khả thi | Ghi chú |
|---|---|---|---|
| **A. Multi-glyph hook** | `88`, `20`, `C+O`, `∞` — glyph lặp map vào **bộ phận đối xứng hai bên** (2 tai, 2 mắt, 2 bướu) | ✅ Cao | Có bằng chứng thị trường: nội dung *"88 → bear"* đang tồn tại và được xem trên TikTok. Nhưng **`99 → hổ` KHÔNG thuộc nhóm này** — 2 đuôi số 9 không phải bộ phận đối xứng. Cần quy tắc: *glyph lặp chỉ valid nếu phần lặp map vào cặp bộ phận đối xứng VÀ không sinh nét mồ côi* |
| **B. Variation trên cùng template** | đổi medium (bảng/giấy), màu, tốc độ, narration template, CTA, seed | ✅ Đã có (`FR-18`, `ADR-04`) | ~3–8 variant/template → **~300–900 video**. Đủ cho MVP. Nhưng `F-ADV-2` đúng: đây là **biến thiên pixel**, TikTok detect ở tầng **content structure**. Dùng được ~2–4 tuần rồi hết tác dụng |
| **C. Format variation** | guess-the-animal, speed-draw challenge, "vẽ sai rồi sửa", duel 2 hook, reverse (con vật → số) | 🔬 Chưa được PRD đề cập | Đây là hướng **duy nhất phá trần thật sự**, và nó rẻ: cùng một template library, khác narrative structure. Nên thêm vào `§18 Content Experimentation` |

**Khuyến nghị:** chấp nhận rằng MVP **không** phải "factory 50 video/ngày". MVP là **"~100 template được author tốt × 3–8 variant × 3 format"** — đủ ~1.000 video để test `SM-0`. Con số đó đạt được, nhưng **không trong 1–2 tuần**, và **không tự động 100%**.

### 6.2 Chi phí authoring thật

| Cách | Thời gian / template | Chất lượng | Đánh giá |
|---|---|---|---|
| LLM sinh DSL tự do (`FR-2` hiện tại) | ~2 phút | **~18% dùng được** (mục 9 bảng §1) | Cần ~11 lần thử cho 2 template dùng được, **và vẫn cần mắt người duyệt từng cái** ⇒ không tiết kiệm gì |
| SVG ingestion (`FR-3`) từ nguồn CC0/CC-BY | ~10–20 phút | **Khá**, nhưng `A-02` (thứ tự path trong SVG = thứ tự vẽ tự nhiên) là **rủi ro CAO** và tôi đồng ý — Illustrator xuất path theo thứ tự layer, **không** theo thứ tự bút | Cần UI reorder. `A-02` ghi "bổ sung kéo thả đổi thứ tự trong 5 giây" — **đánh giá thấp**: reorder 15 nét bằng kéo thả không phải 5 giây |
| **Trace tay trên tablet / digitize từ sách "how to draw"** | **~30–60 phút** | **Cao** | **Đây là đường nên chọn làm primary.** Mỗi template dùng lại cho 3–8 video ⇒ chi phí ~10 phút/video, chấp nhận được |
| **QuickDraw dataset** (50M ảnh, 345 lớp, **CC-BY-4.0**, có **timestamped stroke order**) | ~5 phút lọc | Trung bình (doodle style) | **Bị bỏ sót hoàn toàn trong tài liệu.** Đây là nguồn **stroke-order thật, miễn phí, hợp pháp** duy nhất tồn tại. Research xác nhận *"the closest available dataset for ordered stroke sequences is QuickDraw"* ([arXiv 2502.20119](https://arxiv.org/html/2502.20119v1)). Rất hợp với style "vẽ tay trên bảng" — không hợp style "sách tô màu". **Nên thêm vào `ADR-02` làm Path D** |

---

## 7. R0 — Spike 3 ngày để trả lời dứt điểm

`§25 Release Strategy` có `Release 0 — Drawing Proof` nhưng **không có tiêu chí pass/fail**. Đây là bản cụ thể. **Không viết một dòng code pipeline nào trước khi R0 xong.**

### Ngày 1 — Rendering & Hand (khối 1, 3, 6, 7)
**Việc:** Render `8 → Gấu` từ `proof/templates.json` ra MP4 1080×1920 30fps. **Bỏ qua Motion Canvas** — dùng thẳng `node-canvas`/`skia-canvas` + FFmpeg, vì (a) ít dependency hơn, (b) `ADR-01` đã coi node-canvas là fallback, và (c) issue #1218 cho thấy Motion Canvas headless sẽ đốt ngày 1 của bạn vào việc đọc source.
**Đo:** RAM thực tế / worker; giây render / video; ghép 1 ảnh PNG bàn tay + pivot, xuất 3 frame kiểm tra occlusion.
**Pass khi:** ≤ 60s render/video trên 2 core, RAM ≤ 1.5GB/worker, pen-tip lệch **0px** (không phải ≤5px).
**Nếu fail:** vấn đề ở máy, không ở thiết kế → dừng, xem lại NFR-3.

### Ngày 2 — Authoring & Gate C0–C3 (khối 4, 10) ← **NGÀY QUAN TRỌNG NHẤT**
**Việc:** Author **8 template** bằng tay: 4 cặp bạn tin là tốt (`8→gấu`, `2→thiên nga`, `0→?`, `S→?`), 2 cặp bạn **nghi ngờ**, và **2 cặp cố ý sai** (`99→hổ`, và một cặp do LLM tự do đề xuất + tự sinh DSL). Chạy `gate.mjs` trên cả 8.
**Đo:** phút/template thực tế; gate có **phân loại đúng** dự đoán của bạn không; cặp do LLM sinh ra fail ở gate nào.
**Pass khi:** gate C0–C3 **bắt được cả 2 cặp cố ý sai** (không false negative), và **không** đánh trượt 4 cặp tốt (không false positive). Đồng thời ghi lại **số phút authoring trung bình** — con số này quyết định toàn bộ business case §6.
**Nếu gate bắt sai:** chỉnh ngưỡng C1/C2 **trước khi** build tiếp. Đây là lý do phải làm ngày 2 trước ngày 3.

### Ngày 3 — C4/C5 + TTS (khối 5, 8) ← **trả lời trực tiếp nỗi lo của bạn**
**Việc (a):** Train/kiếm sketch classifier trên QuickDraw (grayscale 28×28, CNN 3 lớp). Chạy trên **frame cuối** và **từng frame trung gian** của 8 template ngày 2.
**Việc (b):** Sinh 5 câu thoại Việt đại diện (câu ngắn, câu dài >10 từ, từ vay mượn "TikTok"/"gấu bông", câu cảm thán lúc reveal) bằng `vi_VN-vais1000-medium`. **Nghe bằng tai, trên loa điện thoại**, không nghe bằng tai nghe.
**Pass khi:**
- C4: `top-1 == subject` cho **≥ 6/8** template tốt, và **không** đoán ra subject cho 2 template sai.
- C5: confidence(subject) ở nét đầu **< 0.2**, ở nét cuối **> 0.7**, với **≥ 6/8** template.
- TTS: **bạn sẵn sàng đăng** ít nhất 3/5 mẫu mà không thấy xấu hổ.
**Nếu C4/C5 fail:** gate cần VLM thay vì classifier nhỏ → chi phí/video tăng, `SM-5 ≤ $0.01` phải xét lại.
**Nếu TTS fail:** chuyển `A-01` sang **rủi ro CAO** và chốt Plan B ngay: Edge TTS (free, cần mạng) hoặc Kokoro. `AD-3` adapter pattern đã cho phép swap không sửa pipeline — kiến trúc đó **đúng**, chỉ có assumption là sai.

### Kết quả R0 cần đạt để GO tiếp
```
✓ Ngày 1 pass                     → pipeline khả thi, bỏ được rủi ro AD-5/ADR-01
✓ Ngày 2 pass + authoring ≤ 90'   → content engine khả thi ở quy mô ~100 template
✓ Ngày 3 C4/C5 pass               → có gate NGỮ NGHĨA, nỗi lo "vẽ sai mà vẫn pass" được giải
✓ Ngày 3 TTS pass (hoặc Plan B)   → chi phí biên giữ được ~$0
```
**Bốn dấu ✓ = GO. Ba = GO có điều kiện (thu hẹp scope). Hai trở xuống = NO-GO, quay lại PRD.**

---

## 8. Thay đổi cụ thể cần áp vào PRD / Architecture

| # | Tài liệu | Vị trí | Thay đổi | Lý do |
|---|---|---|---|---|
| **1** | `prd.md` | §4.1 `FR-2` | **Hạ LLM DSL Generation từ *primary* xuống *assist*.** Đổi thành: LLM **đề xuất cấu trúc** (part list + mapping bộ phận + narration), **không** sinh toạ độ tự do. Toạ độ đến từ trace tay / SVG ingestion / QuickDraw | §5.2 — LLM sinh toạ độ là điểm yếu đã được benchmark |
| **2** | `ARCHITECTURE-SPINE.md` | `ADR-02` | **Đảo thứ tự path:** Path **B** (SVG/trace) thành primary, Path **A** (LLM DSL) thành assist. **Thêm Path D — QuickDraw dataset ingestion** (CC-BY-4.0, có stroke order thật) | `ADR-02` hiện coi LLM là first-class và SVG là fallback khi LLM "kiệt retry" — sai thứ tự ưu tiên |
| **3** | `prd.md` | §4.2 `FR-5` | **Thay thang `≥18/25` bằng bộ gate bất đẳng thức C0–C5.** Không cộng điểm. Mọi gate phải pass. Kèm `proof/gate.mjs` làm reference implementation | §3.1 — scalar score bị game được; chính `validation-report.md` đã flag FR-5 là HIGH ("thiếu rubric chi tiết") |
| **4** | `prd.md` | §10 Assumptions | **Thêm `A-07`** (rủi ro **CAO**): *"[ASSUMPTION] LLM có khả năng sinh geometry đạt chuẩn publish qua Drawing DSL."* Kế hoạch kiểm chứng = R0 ngày 2 | `validation-report.md` finding HIGH đã yêu cầu đúng việc này từ 2026-09-05, **chưa làm** |
| **5** | `prd.md` | §4.3 `FR-8` | **Thêm hệ quả kiểm thử được:** *"Validator SHALL từ chối plan nếu hình cuối không được classifier nhận diện đúng là subject (C4), hoặc nếu confidence(subject) không tăng ≥0.5 từ nét đầu đến nét cuối (C5)."* | Đây là lỗ hổng lớn nhất: validator hiện tại chỉ bắt lỗi **cú pháp**, không bắt lỗi **ngữ nghĩa** ⇒ `NFR-1` "không có thành công giả" **không giữ được** |
| **6** | `prd.md` | §10 `A-01` | **Nâng rủi ro `A-01` từ Trung bình → CAO.** Sửa mô tả: `viPiper` là **training pipeline cần GPU**, không phải TTS engine dùng ngay. Giọng Việt tốt nhất của Piper là `vais1000-medium`, **finetune từ giọng Anh**. Mở rộng test lên **20+ câu** (không phải 5) và **chốt Plan B trước** (Edge TTS / Kokoro) | §5.1 — `F-ADV-5` đã nghi ngờ; kiểm chứng hôm nay cho thấy còn tệ hơn |
| **7** | `tools.md` | §3.3, §4 | **Xoá `svg-draw-motion` khỏi danh sách dùng được** — repo **không có license**. Sửa `kiendt/viPiper` → `EraX-AI/viPiper` kèm ghi chú "training pipeline, chưa ship giọng". Ghi lại sao thực tế của từng repo | `NFR-5` ("100% MIT/Apache") hiện **bị vi phạm** bởi chính shortlist |
| **8** | `ARCHITECTURE-SPINE.md` | `AD-5`, `ADR-01` | **Đổi node-canvas/skia-canvas từ *fallback* thành *primary*.** Motion Canvas headless xuống phương án B, chỉ dùng nếu R0 ngày 1 chứng minh được RAM/throughput | Issue #1218: headless không được document. Cả kế hoạch RAM của `ADR-01` đang xây trên con số **đoán** |
| **9** | `prd.md` | §6.1 MVP Scope | **Cắt:** `batch 50 video`, `--variants N`, `Diversification Engine` (FR-18) khỏi MVP. **Giữ:** 8–12 template author tốt + gate C0–C5 + 1 pipeline render + TTS | §6 — pool nội dung ~100 cặp. Batch 50 chỉ có ý nghĩa **sau khi** có template. Build batch engine trước khi có content là build nhà máy trước khi có nguyên liệu |
| **10** | `prd.md` | §16 Content Strategy | **Thêm quy tắc multi-glyph:** *"Hook nhiều ký tự chỉ hợp lệ nếu phần lặp map vào một cặp bộ phận đối xứng hai bên và không sinh nét mồ côi (C0)."* Kèm ví dụ PASS (`88`) và FAIL (`99`) | §6.1 cách A — đây là hướng phá trần nội dung khả thi nhất, cần rule để không lặp lại lỗi `99→hổ` |
| **11** | `prd.md` | §7.1 `SM-0` | **Giữ nguyên nhưng ghi rõ là *hypothesis*, không phải success metric của MVP.** Thay bằng metric đo được trong hệ thống: *"≥ 70% template author ra pass C0–C5 mà không cần sửa tay quá 2 vòng"* | `F-ADV-8` đúng: completion rate trên kênh 0 follower phụ thuộc algorithm, không phải sản phẩm. Cần metric mà **bạn kiểm soát được** |
| **12** | `gpt_review_clip.md` | §1, §10 | **Đính chính bảng độ khó:** Hand Engine **không** phải 9/10 ở phần toán (đã chứng minh 0px, ~30 dòng). Transformation Authoring **mới** là 9/10 và đang bị chấm 5/10 | §1 — nếu giữ nguyên bảng này, effort sẽ bị phân bổ sai: đổ thời gian vào bàn tay trong khi hình vẽ mới là thứ chết |

---

## 9. Go / No-Go

| Câu hỏi | Trả lời | Điều kiện |
|---|---|---|
| Pipeline kỹ thuật (concept → MP4) có build được không? | ✅ **CÓ** | ~85–90%. Không có rủi ro hiện sinh. `AD-1`, `AD-6`..`AD-14` viết **tốt** — đây là phần chín nhất của bộ tài liệu |
| "Bút bám nét, tất định, không teleport" có đạt được không? | ✅ **CÓ, đã chứng minh** | Lệch 0px. `SM-2` đặt ngưỡng ≤5px là **thừa rộng** |
| LLM tự sinh hình vẽ đạt chuẩn publish? | ❌ **KHÔNG** | ~18%. **Đừng xây kiến trúc quanh giả định này** |
| Có cách nào biết hình vẽ **đúng** mà không cần mắt người? | ✅ **CÓ** | Gate C0–C3 **đã chạy được hôm nay**; C4–C5 cần ~1 ngày R0 |
| `99 → hổ` có cứu được bằng model tốt hơn? | ❌ **KHÔNG** | Fail về hình học, không phải về AI |
| Có đủ nội dung để chạy "factory 50 video/ngày"? | ⚠️ **KHÔNG, ở MVP** | Pool ~100 cặp tốt. Đủ ~1.000 video với variant + format variation — đủ **test**, chưa đủ **scale** |
| TTS Việt local có đạt chuẩn content marketing? | ⚠️ **CHƯA BIẾT — 45%** | Đây là ẩn số lớn thứ hai. R0 ngày 3 trả lời. Plan B (Edge TTS) khả thi và `AD-3` đã cho phép swap sạch |
| **Kết luận** | **CONDITIONAL GO** | **Chạy R0 3 ngày trước. Không viết pipeline trước R0.** |

---

## 10. Điều tôi *không* lo (để bạn không tốn năng lượng sai chỗ)

- **Rendering, encode, batch, retry, disk, temp-dir, atomic write.** `AD-7` → `AD-14` là phần **chắc nhất** trong toàn bộ tài liệu. Timeout contract, fail-forward, pre-flight disk check, registry corruption threshold — đây là tư duy của người đã từng vận hành pipeline thật. Không cần sửa.
- **Pen-follow / determinism.** Đã giải. Demo đang chạy.
- **Kiến trúc tổng thể.** *Pipes-and-filters* + immutable data + seeded PRNG là lựa chọn **đúng** cho bài toán này. `Decision 3 — Video Is a Projection` (concept là nguồn dữ liệu, video là phép chiếu) là quyết định **tốt nhất** trong PRD — giữ nguyên.
- **Format content có audience hay không.** Có. Nội dung *"biến số thành con vật"* đang tồn tại và có view trên TikTok (ví dụ `88 → bear`, `2 → swan`, `8→6→9→1 → chó`). Nhưng lưu ý: phần lớn là **tutorial vẽ tay**, không phải **transformation-reveal** — tức góc "reveal bất ngờ" của bạn **có thể** khác biệt, và đó là điều `SM-0` phải kiểm chứng, không phải điều để giả định.
- **Nguyên tắc `Registry Before Generative Freedom`** (`§26 Decision 4` PRD cũ). **Đúng hoàn toàn.** Vấn đề duy nhất: PRD không nói **registry đến từ đâu** — và `FR-2` trả lời là "từ LLM", tức tự mâu thuẫn với chính quyết định đó.

---

## 11. Một câu tóm lại

> Dự án **không** chết vì AI thiếu sáng tạo. Nó sẽ chết nếu bạn **hỏi AI sai câu hỏi**.
>
> Câu hỏi sai: *"Hãy vẽ cho tôi một con gấu từ số 8."* → AI bịa toạ độ → validator pass → hình xấu → bạn phát hiện lúc đã render xong 50 video.
>
> Câu hỏi đúng: *"Trong thư viện 100 template đã được gate C0–C5 duyệt, ghép cái nào với narration nào, pacing nào, medium nào, seed nào?"* → AI làm **xuất sắc** việc này (chính tài liệu của bạn chấm 2/10 độ khó — chính xác).
>
> **Sáng tạo là chi phí cố định, bỏ ra một lần lúc authoring. Không phải chi phí biên, trả cho từng video.**
> Toàn bộ `§22 Monetization` và `§19 Success Metrics` của bạn phụ thuộc vào việc nhận ra điều này trước khi viết code, chứ không phải sau.

---

## Phụ lục A — Chạy proof

```bash
cd _bmad-output/planning-artifacts/feasibility-auto-drawing-2026-09-07/proof

node gate.mjs                      # báo cáo gate C0..C3 (zero dependency)
node gate.mjs --json report.json   # xuất JSON để đưa vào CI

node serve.mjs                     # demo tương tác → http://localhost:4173
```

Trong demo, bật lần lượt:
1. **"Ẩn nét hook"** — thẻ 1 tan thành 9 mảnh, thẻ 3 **vẫn nguyên con hổ**. Đó là C1.
2. **"Tô đỏ nét mồ côi"** — hai đuôi số 9 đỏ lên, đâm xuyên má hổ. Đó là C0.
3. **"Hiện nhãn bộ phận"** — thấy mapping *vòng trên → ĐẦU*, *vòng dưới → THÂN*. Đó là glyph-anchored authoring.

`templates.json` là **nguồn dữ liệu duy nhất** cho cả browser và CLI — số liệu khớp nhau từng chữ số.
Đây chính là hình dạng tối giản của `TransformationTemplate` mà tôi đề xuất thay cho `Component` trong `FR-1`:
**đơn vị của registry không phải là "linh kiện đồ họa" mà là "một phép biến hình hoàn chỉnh đã được gate duyệt".**

## Phụ lục B — Schema `TransformationTemplate` đề xuất

```jsonc
{
  "template_id": "8_to_bear_v1",
  "hook":    { "token": "8", "stroke_ids": ["s01", "s02"] },
  "subject": { "token": "bear", "label_vi": "Gấu" },

  // ★ Phần PRD đang thiếu: mapping tường minh glyph → giải phẫu
  "absorption_map": [
    { "stroke_id": "s01", "becomes": "head",  "diagnostic": true  },
    { "stroke_id": "s02", "becomes": "torso", "diagnostic": true  }
  ],
  "orphan_strokes": [],          // PHẢI rỗng (C0)

  "strokes": [ /* { id, role: hook|part, part, d, dur, voice_cue } */ ],

  "gate_report": {               // sinh bởi gate.mjs, không khai báo tay
    "C0": true, "C1_components": 9, "C2_ink_ratio": 0.505,
    "C3": { "strokes": 12, "draw_seconds": 10.2 },
    "C4": { "top1": "bear", "conf": 0.0 },   // điền sau R0
    "C5": { "delta_conf": 0.0 },             // điền sau R0
    "verdict": "PENDING_R0"
  },

  "variants": { "media": ["chalkboard","paper_sketch"], "narration_templates": 3 },
  "provenance": { "authoring_path": "hand_trace|svg_ingest|quickdraw|llm_assist",
                  "minutes_spent": 0, "source_license": "CC0|CC-BY-4.0|own" }
}
```

`provenance.authoring_path` và `minutes_spent` là hai trường **quyết định business case** —
chúng biến §6.2 từ ước lượng thành số đo được sau mỗi lần author.
