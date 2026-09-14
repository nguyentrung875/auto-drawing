# Đánh giá ý tưởng — Universal AI Game Video Engine v1
**Ngày:** 2026-09-11 | **Người đánh giá:** BMAD PRD (Validate mode) | **Trạng thái:** Idea Review — chưa phải PRD chuẩn
**Nguồn:** PRD draft 25 mục do trung cung cấp (LLM → Game JSON → Validator → Remotion)

---

## Overall Verdict (2-3 câu)

**Ý tưởng có thesis rất rõ và kiến trúc đúng hướng:** tách *sáng tạo nội dung (LLM)* khỏi *logic & rendering (Engine)* qua Universal Game JSON là quyết định nền tảng chuẩn — nó giải đúng nỗi đau "100 video/ngày mà không code từng video" và mở đường cho factory 100+ mechanic sau này. Draft hiện tại viết **như một Architecture Spec rất tốt**, nhưng **chưa đạt chuẩn PRD quyết định được** — thiếu Glossary neo chặt, FR có điều kiện test được, User Journey có nhân vật, Assumptions Index, và Non-Goals/Scope honesty ở độ chi tiết BMAD yêu cầu. Nếu giữ nguyên draft này để giao cho kiến trúc/dev, team sẽ phải tự điền ~40% quyết định sản phẩm.

**Rủi ro lớn nhất:** *premature universalization* — thiết kế framework cho 20 mechanic trong khi MVP chỉ chứng minh 3 mechanic tương đồng (đều là price/choice). Nếu không neo bằng Entity Model + Validator 2 tầng + Product DB như đã nêu, LLM sẽ lọt giá ảo vào video và cả factory mất niềm tin.

---

## 1. Decision-readiness — thin

PRD liệt kê *lựa chọn* rất nhiều nhưng ít chỗ nói *đã chọn gì và bỏ gì*.

**Giữ tốt:**
- §10 Game Engine tuyên bố dứt khoát "LLM không được điều khiển trực tiếp Remotion" — đây là quyết định kiến trúc load-bearing.
- §8 Entity/Data layer chặn LLM tự đoán giá — đúng.

**Thiếu:**
- **Trade-offs không được nêu:** Tại sao chọn Remotion (Commercial/Company License) trong khi PRD hiện tại của repo (`auto-drawing` v2, ADR-01/03) đã *loại Remotion* để giữ 100% MIT/Apache 2.0 với Motion Canvas + viPiper vì mục tiêu cost ~0đ? Đây là mâu thuẫn chiến lược cần quyết định ngay, không thể để downstream tự chọn.
- **Open Questions không có:** Draft có 25 mục nhưng không có mục Open Questions / Assumptions Index — mọi giả định (Product DB có sẵn? TTS tiếng Việt tự nhiên đủ giữ chân? TikTok có quét trùng lặp nếu chỉ đổi màu mực?) đang được coi như sự thật.
- **[NOTE FOR PM] không xuất hiện:** Ví dụ §12 nói 20 mechanic quy về 7 interaction type — đây là tuyên bố rất mạnh, cần NOTE kiểm chứng: liệu `SAFE_CRACKERS (CODE)` và `CLOCK_GAME (NUMBER+TIMING)` thực sự dùng chung TimerScene/PuzzleScene được không?

*Fix:* Thêm § Open Questions (5-6 câu) + Assumptions Index đánh số A-01..A-0N với risk + kế hoạch kiểm chứng (copy mẫu từ PRD auto-drawing v2). Thêm ADR ngắn trong addendum: Remotion vs Motion Canvas, tại sao đổi.

## 2. Substance over theater — adequate (sắp thin nếu không gọt)

**Không phải theater:**
- Luận điểm "không xây 20 hệ thống, xây 1 engine" là thesis thật, không phải slogan.
- Pipeline `LLM → JSON → Validator (Schema+Game) → Asset Resolver → Engine → Audio → Remotion → MP4` là substance.

**Nguy cơ theater:**
- **Vision theater nhẹ:** §25 Vision "Universal Game Engine cho Short-form Content" có thể gắn cho bất kỳ factory quiz nào. Thiếu *insight người dùng cụ thể* — ví dụ: "người xem đoán giá giữ lại 3s lâu hơn vì họ đã neo giá trong đầu" — insight này mới dẫn tới thiết kế countdown 3s.
- **NFR theater:** §24 Success Metrics nêu `JSON validation >99%` nhưng không neo vào FR nào; `Cost/video càng thấp càng tốt` không phải NFR đo được. Cần thay bằng NFR-3 kiểu PRD v2: `cost ≤ $0.01/video, render ≤45s trên CPU 8 nhân, RAM ≤4GB`.
- **Mechanic list theater:** Liệt kê 20 mechanic (§6) tạo cảm giác đầy đủ nhưng chưa chứng minh chúng quy về 7 interaction — cần bảng mapping + ví dụ JSON cho mỗi interaction, nếu không downstream sẽ nghi ngờ.

*Fix:* Gọt Vision xuống 2 đoạn neo vào insight retention. Biến NFR thành ngưỡng đo được. Thu gọn §6 thành "20 mechanic *dự kiến*, MVP chứng minh 3, Phase 2 chứng minh nhóm NUMBER/DIGIT" — đừng hứa framework đã xong cho 20.

## 3. Strategic coherence — strong

**Thesis rất rõ và nhất quán:**
> Dùng Game JSON làm giao thức trung gian để LLM chỉ sáng tạo *lời & lựa chọn*, còn Engine quyết định *đáp án & rendering* → rẻ, ổn định, hàng loạt.

Mọi Feature (§7-§15) đều phục vụ thesis này. Roadmap 4 phase (§23) đi đúng logic: Engine MVP → Viral mechanics → Advanced → AI Factory (feedback loop).

**Điểm cần làm rõ:**
- MVP kind là **Platform MVP** (xây engine) hay **Problem-solving MVP** (chứng minh 1 video hoàn chỉnh không cần sửa tay)? Draft đang nói cả hai. BMAD khuyến nghị chọn 1 để định nghĩa Done: với factory, nên ưu tiên Platform — MVP done khi "10 video/ngày chạy batch không chạm tay" chứ không chỉ "1 video đẹp".
- Counter-metrics thiếu: nếu tối ưu completion rate, team có thể kéo dài countdown vô hạn. Cần SM-C1: "Không tối ưu replay bằng cách làm countdown >5s gây drop".

*Fix:* Thêm § Success Metrics theo mẫu BMAD: Primary (3s retention, completion), Secondary (comment rate), Counter (không kéo dài video >30s để cày watch time).

## 4. Done-ness clarity — broken (điểm chặn lớn nhất)

Đây là lý do draft chưa thể giao cho dev.

**Hiện tại:** §7-§15 mô tả *behavioral narrative* tốt nhưng **không có FR nào có consequences testable**. Ví dụ:
- "LLM không được tự quyết định giá" — làm sao test? Cần: `FR-X: System rejects Game JSON if product.price source != ProductProvider. Consequence: Validator returns error E_PRICE_SOURCE_INVALID`.
- "Countdown 3s" — test thế nào? Cần: `CountdownScene duration == 3.0s ±0.1s, SFX tick at 0.5s intervals`.

**BMAD yêu cầu:** Mỗi FR phải có ít nhất 1 consequence đo được. Draft hiện tại có 0 FR đánh số — toàn bộ §6-§12 là capability list.

**Cần bổ sung:**
- Đánh số FR-1..FR-N toàn cục (stable IDs) theo template Essential Spine §4.
- Mỗi mechanic là 1 Feature với FR con: `FR-1: HI_LO Boolean`, `FR-2: MOST_EXPENSIVE Multiple Choice`, `FR-3: CHECK_OUT Number` — mỗi FR có 2-3 consequences.
- NFR cross-cutting (§8 trong template) với ngưỡng: render time, cost, reproducibility (seed → same video).

*Fix:* Chuyển §6-§15 thành §4 Features chuẩn BMAD. Mẫu:

> **FR-1: HI_LO higher/lower** — System can generate a HI_LO round given two products with valid prices. Realizes UJ-1. Consequence: answer == (priceB > priceA) deterministically; Validator fails if price delta <5%; CountdownScene always 3s.

Không có bước này, story generation downstream sẽ phải tự bịa AC.

## 5. Scope honesty — thin

**Làm tốt:**
- §22 Non-Goals liệt kê rõ "không làm AI avatar, live multiplayer, editor kéo thả" — tốt.

**Thiếu:**
- **Assumptions không được tag:** Product DB (§9) là dependency sống còn nhưng không có `[ASSUMPTION: Product DB có 1000 SKU với giá cập nhật hàng ngày]`. Nếu DB trống, LLM có gì để sinh?
- **Non-Goal trong feature thiếu:** Ví dụ `PLINKO_INSPIRED (RANDOM)` — với MVP, nên tag `[NON-GOAL for MVP]` ngay trong §6 để tránh dev tưởng phải làm.
- **Scope creep ẩn:** §5 MVP nói 3 mechanic nhưng §11 Scene System liệt kê 15 scene — có cần đủ 15 cho MVP không? Hay MVP chỉ cần 7 scene (Hook, Product, Question, Countdown, Reveal, Result, CTA)? Không nói rõ → dev sẽ build thừa.

*Fix:* Thêm §6 MVP Scope với In/Out rành mạch (copy cấu trúc PRD v2). Tag mọi mechanic ngoài 3 cái đầu là `[NON-GOAL for MVP → Phase 2/3]`. Mỗi FR có `Out of Scope` nếu cần.

## 6. Downstream usability — broken

**Vấn đề lớn:**
- **Không có Glossary neo:** Draft dùng `Game, Entity, Mechanic, Interaction, Scene, Component, Asset` lẫn lộn. BMAD bắt buộc §3 Glossary định nghĩa chính xác mỗi noun và FR/UJ/SM phải dùng *verbatim*. Ví dụ: `Product` trong §9 có phải là `Entity type=product` trong §7 không? Không rõ.
- **Không có UJ với nhân vật:** §4 Target Users chỉ nêu "faceless creator" chung chung. Không có UJ-1..UJ-N dạng "Huy, solo creator..." như PRD v2 — downstream UX và architecture không có neo để trace FR → UJ.
- **ID không liên tục:** Không có FR-ID, UJ-ID, SM-ID → không thể trace.
- **Entity Model thiếu:** §9 cho ví dụ product JSON nhưng không có Entity Model tổng thể (như §11 trong PRD v2) — downstream không biết quan hệ Game ↔ Round ↔ Scene ↔ Asset.

*Fix:* Thêm §3 Glossary (8-10 thuật ngữ, định nghĩa 1 lần, dùng y nguyên). Thêm 2-3 UJ có tên (ví dụ: `UJ-1: Linh — affiliate creator chạy 20 video/ngày để test hook`). Thêm §11 Entity Model (Game, Round, Entity, Scene, AudioCue).

## 7. Shape fit — adequate (đang hơi lệch)

Sản phẩm là **Internal Content Factory** (giống PRD v2), không phải consumer app. Shape phù hợp là **capability spec + factory pipeline**, không cần Information Architecture hay Monetization chi tiết. Draft đang đúng hướng.

**Lệch nhẹ:**
- Thiếu Platform section: factory chạy ở đâu? Local-first như PRD v2 (0đ/video) hay Cloud queue? Quyết định này ảnh hưởng NFR cost.
- Thừa "Publishing" (§18) ở mức MVP — nên đánh dấu là Phase 4, MVP chỉ xuất MP4 ra folder.

*Fix:* Thêm § Platform: `Local-first (FFmpeg + Motion Canvas) mặc định, Cloud queue là Phase 4`. Thu gọn §18 thành "Output 1080x1920 MP4 + caption/hashtag JSON, auto-post là Phase 4".

---

## Mechanical notes (không lái verdict nhưng chặn downstream)

- **ID continuity:** 0/25 mục có ID — cần FR-1..FR-N, UJ-1..N, SM-1..N, A-01..N.
- **Glossary drift:** `gameId` vs `mechanic` vs `variant` — chọn 1 tên, dùng xuyên suốt. Đề xuất: `mechanic` là enum 20 giá trị, `game` là instance.
- **Assumptions Index roundtrip:** Chưa có — cần 6-8 assumptions (Product DB, TTS quality, TikTok dedup, Panel Leak tương tự nếu dùng ảnh sản phẩm, v.v.)
- **Cross-refs:** §6 nói "20 mechanic trên cùng engine" nhưng §12 Interaction Model lại nói 7 type — cần mapping table mechanic → interaction → scene list.

---

## 5 phát hiện quan trọng nhất (ưu tiên sửa trước khi viết PRD chuẩn)

1. **[critical] Thiếu FR testable — chặn dev.** Chuyển toàn bộ §6-§15 thành §4 Features với FR đánh số + consequences. Không có, không thể tạo epic/story. *Vị trí: toàn bộ §6-§15.*

2. **[critical] Mâu thuẫn stack với PRD hiện tại.** PRD v2 đã quyết *loại Remotion* vì license, chọn Motion Canvas + viPiper để giữ cost 0đ. Draft mới lại chọn Remotion. Phải ra ADR mới trước khi code. *Vị trí: §15 vs addendum ADR-01/03.*

3. **[high] Product DB là single point of failure.** Không có DB → LLM bịa giá → video sai → kênh mất uy tín + rủi ro pháp lý affiliate. Cần FR riêng cho ProductProvider + Validator + Asset Resolver, và assumption về nguồn giá (crawl, manual, API). *Vị trí: §9.*

4. **[high] Premature universalization.** Cam kết 20 mechanic trên cùng engine khi MVP chỉ test 3 mechanic cùng họ (price choice). Rủi ro: `CLOCK_GAME` và `RANGE_GAME` cần timing interaction khác hẳn `HI_LO`, tái dùng Scene sẽ vỡ. *Fix:* MVP cam kết chứng minh 2 họ khác nhau (ví dụ HI_LO + CHECK_OUT) để test universal thật. *Vị trí: §6, §12.*

5. **[high] Thiếu 2 tầng Validator chi tiết.** Draft nêu ý đúng (§16) nhưng không định nghĩa error codes, ngưỡng (price delta tối thiểu, countdown tối thiểu, số lựa chọn trùng). Cần spec Validator để LLM retry tối đa 3 lần như PRD v2 FR-2. *Vị trí: §16.*

---

## Khuyến nghị lộ trình (để biến draft này thành PRD chuẩn BMAD)

**Option A — Fast path (nếu trung muốn PRD trong 1-2 vòng):**
Tôi batch 6-8 câu hỏi còn thiếu (stakes, platform, Product DB source, TTS, TikTok dedup, cost budget) → tôi tự draft PRD chuẩn Essential Spine (Vision, JTBD, UJ-1..3, Glossary, Features FR-1..12, MVP Scope, SM, NFR, Open Questions, Assumptions, Entity Model) với `[ASSUMPTION]` tags → trung review và sửa.

**Option B — Coaching path (nếu muốn cùng nghĩ):**
Đi từng mục: Vision + Features → Journey-led (viết UJ với Linh/Huy) → Validator & Entity Model → NFR & Roadmap. Mỗi bước tôi hỏi, trung kể, tôi cấu trúc lại.

**Dù chọn A hay B, thứ tự ưu tiên:**
1. Chốt stakes + platform (Local-first hay Cloud) — 5 phút
2. Viết Glossary + UJ-1..3 — 15 phút
3. Chuyển §6-§15 thành FR có consequences — 30 phút
4. Thêm Validator spec + Product DB FR — 15 phút
5. Thêm NFR đo được + Assumptions — 10 phút

Sau đó chạy `bmad-architecture` và `bmad-create-epics-and-stories` như PRD v2.

---

## Câu hỏi để trung quyết trước khi draft PRD chuẩn

1. **Mối quan hệ với auto-drawing hiện tại:** đây là *pivot thay thế* Drawing Transformation Factory, hay *product thứ 2 chạy song song*? (ảnh hưởng tên PRD và output_folder)
2. **Product DB:** giá sản phẩm lấy từ đâu trong MVP? (CSV manual, crawl TikTok Shop, hay mock 100 sản phẩm cứng?)
3. **Stack:** giữ quan điểm 100% MIT/Apache 2.0 (Motion Canvas + viPiper, cost 0đ) như PRD v2, hay chấp nhận Remotion + TTS cloud (ElevenLabs) để đổi lấy giọng hay hơn?
4. **MVP proof:** 3 mechanic HI_LO / MOST_EXPENSIVE / CHECK_OUT đều là *choice/number về giá* — có muốn thay 1 trong 3 bằng mechanic họ khác (ví dụ ONE_AWAY — DIGIT) để chứng minh "universal" thật không?
5. **Stakes:** đây là Internal Factory cho 1 operator (như PRD v2) hay có ý định bán SaaS cho creator khác? (quyết định độ nặng của Compliance, Platform, Monetization)

---

*Gợi ý:* trung có thể gọi `bmad-advanced-elicitation` bất kỳ lúc nào để đào sâu 1 mục (ví dụ: elicitation cho Universal Schema), hoặc `bmad-party-mode` để lấy góc nhìn đa agent (PM, Architect, UX).

Workspace đã bound tạm: `_bmad-output/planning-artifacts/prds/prd-universal-game-engine-2026-09-11/` — sẵn sàng để `prd.md` + `addendum.md` + `.memlog.md` khi trung chọn hướng.
