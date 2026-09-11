---
title: Universal AI Game Video Engine
created: 2026-09-11
updated: 2026-09-11
status: draft
changelog:
  - 2026-09-11: Khởi tạo từ idea PRD 25 mục (Universal Game Video Engine v1). Bound workspace, chọn Coaching path + Internal Factory Local-first.
  - 2026-09-11: Coaching §0-§11 hoàn chỉnh (Vision, JTBD, 3 UJ, Glossary 10 terms, FR-1..FR-11, Non-Goals, MVP 3 mechanics HI_LO/MOST_EXPENSIVE/ONE_AWAY, SM 6+2, NFR 5, OQ 6, A-01..A-08, Entity Model). Pivot: dừng Drawing SVG, PRD này supersede auto-drawing v2.
---

# PRD: Universal AI Game Video Engine
*Working title — confirm. Tên tạm trong draft gốc: Universal Game Video Engine*

## 0. Document Purpose

Tài liệu này xác định yêu cầu sản phẩm cho **Universal AI Game Video Engine** — hệ thống nội bộ sản xuất video short-form dạng game tương tác 15-30s (đoán giá, cao hơn/thấp hơn, chọn đáp án...) theo pipeline `LLM → Game JSON → Validator (Schema + Game Logic) → Game Engine → Asset/Audio Resolver → Renderer (Motion Canvas/FFmpeg, Local-first) → MP4`.

Đây là **PRD pivot, supersede** `prd-auto-drawing-2026-09-04-v2` (Drawing Transformation Factory). Toàn bộ effort vẽ SVG/hand-drawn animation (spike `dsl-generation`, `singleline-spiral`, Hand Engine, Drawing DSL) được **dừng ở v1** — không làm tiếp. Mọi tài liệu, spike và ADR cũ được giữ lại trong `_bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/` và `spike/` để tham chiếu, nhưng **không còn là scope phát triển**.

Đối tượng đọc: PM, Architect (`bmad-architecture`), và Dev (`bmad-create-epics-and-stories`). Đích cuối của engine là **tích hợp headless vào Hermes Agent** để Hermes tự động gọi batch 50-100 video/ngày mà không cần operator giám sát. Mọi thuật ngữ được neo chặt tại [§3 Glossary]; mọi giả định lớn được tag `[ASSUMPTION]` và gom tại [§10 Assumptions Index]. Chi tiết kỹ thuật sâu (Scene catalog, Audio spec, so sánh Remotion vs Motion Canvas) lưu tại `addendum.md`.

---

## 1. Vision

> **Chỉ cần khai báo game + data — hệ thống tự sinh 50 video 15s hoàn chỉnh với HOOK, countdown, reveal và lồng tiếng Việt, sẵn sàng đăng.**

Universal AI Game Video Engine không phải là AI video generator (Sora/Kling/Veo) và không phải app cho người xem chơi live. Đây là **Content Factory nội bộ, Local-first** tự động hóa 100% chuỗi:

$$ \text{Khai báo (Game + Product Data)} \xrightarrow{\text{LLM sáng tạo}} \text{Universal Game JSON} \xrightarrow{\text{Validator 2 tầng}} \text{Game Engine (tính đáp án, dựng timeline)} \xrightarrow{\text{Asset + Audio Resolver}} \text{Renderer code (Motion Canvas/FFmpeg)} \rightarrow \text{MP4 1080×1920 9:16 + caption/hashtag} $$

LLM chỉ sáng tạo *lời dẫn, câu hỏi, lựa chọn, hook/CTA* — **không được tự đoán giá**. Mọi con số, đáp án, logic game do Engine quyết định deterministically qua `seed`, đảm bảo `pen tip = drawing path` với quiz (text/price/timer không vỡ như AI video đen).

**Why Now:** TikTok Shop và Shopee Affiliate đang ở đỉnh — commission cao, nhu cầu video quiz/đoán giá 15-30s tăng vọt, nhưng sản xuất thủ công không thể ra 50-100 video/ngày. Đồng thời stack Local-first đã chín muồi (Motion Canvas MIT, viPiper TTS offline, FFmpeg) cho phép factory chạy trên máy trạm với **cost tiệm cận 0đ/video**, thay vì trả $0.20-0.50/video cho AI generator.

**Tầm nhìn tích hợp:** Engine được thiết kế như một **module headless cho Hermes Agent** — Hermes gọi qua API/queue, engine tự chạy batch, tự retry, tự xuất MP4 + metadata mà **không cần operator theo dõi**. Đây là nền móng để sau này thay `PRICE` bằng `WORD/LOGO/FOOD/ANIMAL...` mà vẫn dùng chung Scene System, Audio Engine và Validator — *không xây 20 hệ thống, xây một engine sinh hàng trăm loại game video.*

---

## 2. Target User

### 2.1 Jobs To Be Done (JTBD)

- **Functional Job:** Trung bấm một lệnh là có ngay 1 video 15s hoàn chỉnh (HOOK → Product → Question → 3s Countdown → Reveal → Result → CTA) hoặc cả batch 50 video, mỗi video có lồng tiếng Việt + SFX + caption/hashtag, không cần dựng thủ công. Hermes đảm nhận phần *tìm ý tưởng, đề xuất kịch bản, validate nội dung/video trước khi xuất*.
- **Economic Job:** Sản xuất 50-100 video/ngày cho TikTok Shop / Shopee Affiliate với **cost tiệm cận 0đ/video** (Local-first: Motion Canvas + viPiper + FFmpeg), tận dụng commission cao mà không tốn $0.20-0.50/video cho AI generator hay nhân sự dựng.
- **Quality Job:** Mọi video phải *deterministic* và đúng logic game — giá lấy từ Product DB mock (không do LLM bịa), countdown đúng 3s, đáp án do Engine tính, giọng đọc khớp reveal — để Hermes có thể tự đăng và giao tiếp comment mà không sợ video sai giá/sai đáp án làm mất uy tín affiliate. `[ASSUMPTION: Hermes sẽ chịu trách nhiệm post + comment + re-validate sau render — xem A-06]`
- **Automation Job (Hermes):** Hermes hoạt động như *operator thứ hai* trên cùng máy local: tự đề xuất 100 game ideas từ Product DB, tự gọi Game Engine qua queue/CLI, tự kiểm soát chất lượng (Validator 2 tầng), tự đăng lên TikTok/Reels/Shorts và trả lời comment theo kịch bản — Trung chỉ bấm nút duyệt batch hoặc duyệt exception.

### 2.2 Non-Users (v1)

- **Người xem cuối (viewer TikTok):** Họ chỉ tiêu thụ video, không tương tác live với engine. Engine không phục vụ gameplay real-time.
- **Creator đại chúng / Agency ngoài:** v1 chỉ chạy **local cho Trung + Hermes** trên máy cá nhân, không phải SaaS multi-tenant, không có quản lý user/quota/billing.
- **Editor thủ công:** Người cần kéo thả timeline (Premiere/CapCut) không phải user — engine sinh MP4 hoàn chỉnh, không cung cấp editor.
- **Hermes chưa tồn tại ở v1:** `[ASSUMPTION: Hermes mới ở mức ý tưởng, chưa có code — v1 Engine phải chạy độc lập được bằng CLI/manual trigger, Hermes integration là interface headless để nối sau, không phải dependency cứng — xem A-07]`

### 2.3 Key User Journeys

#### UJ-1: Trung bấm nút tạo 1 video HI_LO để test ý tưởng mới
- **Protagonist:** Trung — solo affiliate operator, đang ngồi trên laptop local.
- **Entry state:** Trung mở terminal/dashboard local. Product DB đã có 50 SKU mock cứng (nước giặt 189K, robot hút bụi 2.49M...), Hermes chưa cần chạy.
- **Path:**
  1. Trung chạy lệnh `game render --mechanic hi_lo --products p001,p042 --seed 839271` (hoặc chọn từ danh sách Hermes đề xuất).
  2. Engine load Game JSON mẫu, LLM chỉ sinh `hook/question/cta/voice script` (không sinh giá); Validator (Schema + Game Logic) kiểm tra `price source == ProductProvider` và `answer == (priceB > priceA)`.
  3. Engine dựng timeline: Hook 2s → Product 3s → Question 3s → Countdown 3s (tick SFX mỗi 0.5s) → Reveal 2s → Result 2s → CTA 3s; viPiper sinh giọng Việt, căn khớp reveal.
  4. Preview bật lên local, Trung xem: countdown đúng 3s, giá reveal khớp DB, giọng nói "Cao hơn hay thấp hơn?" đúng nhịp.
- **Climax:** Video chạy mượt, đáp án đúng deterministically, không có text vỡ.
- **Resolution:** Trung duyệt, nhận `export/hi_lo_p001_p042_839271.mp4` + `caption.json` sẵn sàng để Hermes đăng sau này. Thời gian từ lệnh đến MP4 ≤45s trên CPU 8 nhân.
- **Edge case:** Nếu ProductProvider thiếu giá hoặc LLM trả về JSON thiếu `answer`, Validator chặn với `E_PRICE_SOURCE_INVALID` / `E_MISSING_ANSWER`, trả lỗi chi tiết để Trung sửa, không render lỗi.

#### UJ-2: Trung bấm nút cho Hermes chạy batch 50 video qua đêm
- **Protagonist:** Trung + Hermes (Hermes là actor hệ thống trên cùng máy local).
- **Entry state:** Trung đã duyệt danh sách 50 cặp Product do Hermes đề xuất từ 50 SKU mock (Hermes dùng heuristic đơn giản ở v1: random + price delta >10% để câu hỏi có nghĩa).
- **Path:**
  1. Trung chạy `game batch --count 50 --mechanic hi_lo,most_expensive,check_out --seed auto` — lệnh này đẩy 50 Game JSON vào local queue.
  2. Hermes (ở v1 là script stub, sau này là agent) dequeue từng job: gọi LLM sinh hook/question/cta → Validator 2 tầng → Asset Resolver (ảnh `assets/p001.webp`) → Game Engine tính đáp án → Audio Engine (viPiper + SFX) → Motion Canvas render MP4.
  3. Engine tự retry tối đa 3 lần nếu LLM trả JSON hỏng; log chi tiết `planning/tts/render/encode` + seed + file size.
  4. Diversification Engine phối màu nền giấy, màu mực, tilt ±2° cho mỗi video để tránh TikTok quét trùng.
- **Climax:** Sau ~35-40 phút (50 video × ~45s, chạy tuần tự hoặc pool `min(CPU-1,3)`), 46-50 video pass 100%, 0-4 job fail có báo cáo lỗi rõ.
- **Resolution:** Trung mở thư mục `export/batch_2026-09-11/`, kiểm ngẫu nhiên 3 video đạt chuẩn. Hermes ở phase sau sẽ tự đăng batch này lên TikTok/Shopee theo lịch.
- **Edge case:** Nếu LLM hallucinate giá hoặc countdown <3s, Validator chặn trước render; Hermes không tự đăng video fail.

#### UJ-3: Hermes tự validate, đăng và giao tiếp comment (tầm nhìn v2, v1 stub)
- **Protagonist:** Hermes — agent chạy local, Trung không cần canh.
- **Entry state:** Batch 50 MP4 đã render xong, mỗi video có `caption.json` + `hashtags` + `answer` do Engine tính.
- **Path (v1 stub → v2 full):**
  1. Hermes chạy `Game Validator` lần cuối: đối chiếu `answer` trong MP4 metadata với Product DB.
  2. Hermes gọi TikTok/Shopee API (v1 mock/post-manual, v2 auto-post) để đăng video kèm caption/hashtag.
  3. Hermes lắng nghe comment ("Mình đoán đúng rồi!") và trả lời theo template từ Game JSON (`cta: "Comment số vòng bạn đúng!"`).
- **Climax:** Video đăng thành công, comment được trả lời trong 5 phút mà Trung không phải mở app.
- **Resolution:** Dashboard local hiển thị `publish_queue: 50 posted, 0 failed, avg 3s retention = X%` (metric stub ở v1).
- **Edge case:** Nếu Hermes phát hiện giá trong DB đã cũ (>7 ngày), nó gắn cờ `stale_price` và không đăng, yêu cầu Trung cập nhật Product DB — tránh đăng giá sai gây khiếu nại affiliate.

---

## 3. Glossary

Mọi tài liệu, mã nguồn và giao diện dòng lệnh downstream **bắt buộc dùng chính xác** các thuật ngữ sau (không dùng synonym):

- **Game:** Một instance video hoàn chỉnh, được biểu diễn bằng **Universal Game JSON**. Chứa `metadata, content, entities, gameplay, scenes, audio, publishing`.
- **Mechanic:** Luật chơi — enum gồm 20 giá trị ở tầm nhìn (HI_LO, MOST_EXPENSIVE, ONE_AWAY...), MVP chỉ hỗ trợ 3: `HI_LO`, `MOST_EXPENSIVE`, `ONE_AWAY`. `[NON-GOAL for MVP: 17 mechanic còn lại → Phase 2/3]`
- **Interaction:** Kiểu tương tác rút gọn mà Engine thực thi. MVP cần 3: `BOOLEAN` (HI_LO), `MULTIPLE_CHOICE` (MOST_EXPENSIVE), `DIGIT` (ONE_AWAY).
- **Entity / Product:** Đối tượng dữ liệu trong Game. Với MVP, `Entity type=product` có schema tối thiểu: `productId, name, image (assets/pXXX.webp), price, currency (VND), source, updatedAt, category, brand, affiliate_link` — `price` bắt buộc lấy từ `ProductProvider`, LLM không được sinh.
- **Scene:** Đơn vị render tái sử dụng. **MVP chỉ 7 scene:** `HookScene, ProductScene, QuestionScene, CountdownScene, RevealScene, ResultScene, CTAScene` — `ResultScene` có 2 biến thể: `variant=in_video` (hiện đáp án trong video) và `variant=comment` (CTA "Xem đáp án trong comment" + không reveal trong video).
- **Validator:** 2 tầng chặn trước render — `Schema Validation` (JSON structure, required fields, enum, duration) và `Game Logic Validation` (đáp án tồn tại, price hợp lệ, countdown ≥3s, không trùng lựa chọn).
- **Asset Resolver:** Ánh xạ `productId → image, background, SFX, music` từ local `assets/`. LLM không được đưa URL tùy ý.
- **Seed:** Số nguyên `int` để đảm bảo **Reproducibility 100%** — cùng `Game JSON + seed` phải ra cùng timeline, geometry và audio.
- **ProductProvider:** Nguồn sự thật cho `price` và `affiliate_link`. MVP là **mock DB 50 SKU cứng** trên local; Phase 2 Hermes sẽ thay bằng crawl TikTok Shop/Shopee.
- **Timeline:** Dãy `scenes` có thứ tự với `duration` và `audioCues`, do Game Engine tính deterministically. Tổng thời lượng MVP: **15–21s** (Hook 2s + Product 3s + Question 3s + Countdown 3s + Reveal 2s + Result/CTA 2-3s).

---

---

## 4. Features

### 4.1 Universal Game Schema
**Description:** Mọi video được biểu diễn bằng một **Universal Game JSON** thống nhất (`metadata, content, entities, gameplay, scenes, audio, publishing`). LLM chỉ sinh `content` (hook, question, choices, cta, caption, hashtags, voice_script) — **không sinh `entities.price`**. `seed` trong `metadata` đảm bảo reproducibility. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Universal Game JSON Schema
System can load, validate và version một Game JSON theo JSON Schema nghiêm ngặt. Realizes UJ-1.
**Consequences (testable):**
- System rejects JSON thiếu `metadata.gameId, metadata.mechanic, entities[], gameplay.answer, scenes[]` với error `E_SCHEMA_MISSING_FIELD`.
- `metadata.seed` là `int`; cùng `Game JSON + seed` render 2 lần ra MP4 có `timeline` và `audioCues` giống hệt (byte audio có thể khác do TTS nhưng `duration` phải bằng nhau ±0.05s).
- `gameId` unique trong batch; duplicate `gameId` trong 1 batch → reject `E_DUPLICATE_GAME_ID`.

### 4.2 Product Provider & Mock DB
**Description:** `ProductProvider` là source-of-truth cho `price` và `affiliate_link`. MVP dùng **mock DB 50 SKU cứng** (JSON/CSV local) với ảnh `assets/pXXX.webp` đã chuẩn bị. Game Engine luôn resolve `price` từ Provider, không từ LLM output. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-2: Mock Product DB
System provides 50 products mock với schema tối thiểu `productId, name, image, price (VND int), currency, source="mock", updatedAt, category, brand, affiliate_link`. Realizes UJ-1.
**Consequences:**
- `GET /products` (CLI: `game products list`) trả về đúng 50 records; mỗi record có `price >0` và `image` tồn tại trên đĩa (`assets/pXXX.webp`), nếu thiếu → Validator error `E_ASSET_MISSING`.
- `price` và `affiliate_link` trong Game JSON final **phải bằng** giá trị từ ProductProvider tại thời điểm `updatedAt`; nếu LLM đề xuất giá khác → bị overwrite và log `W_PRICE_OVERWRITTEN`.
- Thêm/sửa 1 product trong mock DB không yêu cầu code change, chỉ reload JSON.

### 4.3 Game Engine & Two-Layer Validator
**Description:** Game Engine chịu trách nhiệm: load Game JSON → chạy Validator 2 tầng → tính `answer` deterministically → dựng `timeline` (scenes + durations + audioCues) → giao cho Renderer. LLM **không được** điều khiển trực tiếp Renderer. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-3: Two-Layer Validation
System validates Game JSON qua 2 tầng trước khi render. Realizes UJ-1, UJ-2.
**Consequences:**
- **Schema layer:** reject nếu `scenes` không phải subset của 7 scene MVP, hoặc `duration` tổng ≠ 15–21s ±0.5s → `E_SCHEMA_SCENE_INVALID`.
- **Game Logic layer:** reject nếu `gameplay.answer` không tồn tại/không khớp với `entities` (ví dụ HI_LO: thiếu `priceA` hoặc `priceB`), hoặc `choices` có giá trị trùng nhau → `E_GAME_LOGIC_INVALID`.
- Validator chạy trong <200ms / Game JSON trên CPU 8 nhân; mọi lỗi trả về JSON có `code, field, hint` để CLI hiển thị.

#### FR-4: Deterministic Answer & Timeline
System computes `answer` và `timeline` deterministically từ `Game JSON + seed`. Realizes UJ-1.
**Consequences:**
- Với cùng `seed`, `HI_LO answer == (priceB > priceA)` luôn đúng; unit test với 100 seed random phải pass 100%.
- `timeline` tổng duration 15–21s, trong đó `CountdownScene.duration == 3.0s ±0.1s`, `RevealScene.duration == 2.0s ±0.1s`; sai số >0.1s → `E_TIMELINE_DRIFT`.

### 4.4 Scene System (7 scenes MVP)
**Description:** Tất cả game dùng chung 7 Scene tái sử dụng. Một Game chỉ khai báo `scenes: ["hook","product","question","countdown","reveal","result","cta"]`, Engine map ra component tương ứng. `ResultScene` hỗ trợ 2 biến thể theo yêu cầu: `result_variant: "in_video"` (hiện đáp án) và `result_variant: "comment"` (giấu đáp án, CTA "Xem đáp án trong comment"). Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-5: Seven Reusable Scenes
System renders 7 scenes với mapping 1-1 từ `scenes[]`. Realizes UJ-1.
**Consequences:**
- Khai báo `scenes` thiếu `countdown` hoặc `reveal` → Validator reject `E_MISSING_REQUIRED_SCENE`.
- Mỗi Scene render đúng `duration` đã khai trong `timeline`; `ProductScene` luôn hiển thị `ProductCard` với `name, image, price (đã format VND)` không bị vỡ text ở 1080×1920.
- `ResultScene variant=in_video` hiển thị `answer` + `correct/wrong` badge; `variant=comment` **không** hiển thị `answer` trong video mà hiển thị CTA "Đáp án ở comment 👇" — kiểm thử visual snapshot phải khác nhau.

### 4.5 Mechanic: HI_LO (BOOLEAN)
**Description:** Người xem đoán "Cao hơn hay Thấp hơn?" giữa 2 sản phẩm. Interaction `BOOLEAN`. Realizes UJ-1, UJ-2.

#### FR-6: HI_LO
System can generate a HI_LO round given 2 products `pA, pB` với giá hợp lệ. Realizes UJ-1.
**Consequences:**
- `answer == "higher"` iff `priceB > priceA`, else `"lower"`; nếu `priceB == priceA` → reject `E_HILO_EQUAL_PRICE` (yêu cầu delta ≥5% để câu hỏi có nghĩa).
- `QuestionScene` hiển thị "Sản phẩm B CAO HƠN hay THẤP HƠN A?" + 2 nút `Higher/Lower`; `CountdownScene` 3s với tick SFX mỗi 0.5s.

### 4.6 Mechanic: MOST_EXPENSIVE (MULTIPLE_CHOICE)
**Description:** Chọn sản phẩm đắt nhất trong 3-4 lựa chọn. Interaction `MULTIPLE_CHOICE`. Realizes UJ-2.

#### FR-7: MOST_EXPENSIVE
System can generate a MOST_EXPENSIVE round với 3-4 products. Realizes UJ-2.
**Consequences:**
- `answer` là `productId` có `price == max(prices)`; nếu có 2 sản phẩm cùng max → reject `E_MOST_EXPENSIVE_TIE` (yêu cầu prices distinct, delta tối thiểu 2% giữa top 2).
- `ChoiceScene` render 3-4 `ProductCard` không chồng lấn ở 1080×1920; `RevealScene` highlight card đắt nhất với viền + SFX `correct`.

### 4.7 Mechanic: ONE_AWAY (DIGIT) — thay CHECK_OUT để chứng minh universal
**Description:** Người xem đoán từng chữ số của giá (ví dụ: giá 1,890,000 → đoán digit `8`). Interaction `DIGIT`. Được chọn thay `CHECK_OUT` ở MVP để chứng minh Engine cân được cả `BOOLEAN/MULTIPLE_CHOICE/DIGIT` — 3 họ khác nhau, không chỉ price-choice. `[NOTE: CHECK_OUT (NUMBER) → Phase 2]`. Realizes UJ-2.

#### FR-8: ONE_AWAY
System can generate a ONE_AWAY round cho 1 product với 1 digit bị ẩn. Realizes UJ-2.
**Consequences:**
- `gameplay` chứa `price, hidden_index, correct_digit (0-9), options: 2 digits (1 đúng + 1 sai cách nhau 1 đơn vị, ví dụ 8 vs 9)`; Engine tính `correct_digit == price.toString()[hidden_index]`.
- `ProductScene` hiển thị giá dạng `1,8?0,000` (digit ẩn là `?`); `CountdownScene` 3s; `RevealScene` thay `?` bằng `correct_digit` với animation `flip` + SFX `reveal`.

### 4.8 Audio Engine (Voice + Music + SFX)
**Description:** Audio được điều khiển bằng JSON (`voice, music, sfx`). MVP dùng **viPiper offline** (MIT) cho voice Việt, SFX local (`countdown tick, reveal, correct/wrong, transition`). Realizes UJ-1, UJ-2.

#### FR-9: Audio Engine
System generates Voice + SFX + Music deterministically theo `audio` trong Game JSON. Realizes UJ-1.
**Consequences:**
- `audio.voice.script` (≤30 từ, tiếng Việt) được viPiper render ra `voice.wav` trong <2s; `voice` luôn khớp `RevealScene` (voice nói "Đáp án là 8!" đúng frame reveal ±0.1s).
- `sfx` có `type in [countdown, tick, reveal, correct, wrong, transition]` và `at` (giây); SFX `countdown` phát mỗi 0.5s trong `CountdownScene`, thiếu → `E_AUDIO_MISSING_SFX`.
- Music `tension_01` volume 0.18, không lấn voice (voice LUFS -16, music LUFS -24).

### 4.9 Rendering & Export (Motion Canvas + FFmpeg, Local-first)
**Description:** Renderer dùng **Motion Canvas (MIT)** + FFmpeg, xuất `1080×1920 9:16 H.264 MP4 30fps`. **Không dùng AI video generator** cho text/price/timer — chỉ code. Realizes UJ-1, UJ-2.

#### FR-10: Local Render & Export
System renders MP4 local với spec `1080×1920, 30fps, H.264/AAC` qua Motion Canvas + FFmpeg. Realizes UJ-1, UJ-2.
**Consequences:**
- Render 1 video 15-21s trong ≤45s trên CPU 8 nhân, RAM ≤4GB (`WORKER_POOL_MAX = min(CPU-1,3)` như NFR-3 PRD v2); vượt → log warning `W_RENDER_SLOW`.
- Output `export/<gameId>_<seed>.mp4` + `caption.json {caption, hashtags[], affiliate_link}`; `caption.json` luôn chứa `affiliate_link` từ Product DB để Hermes đăng kèm.
- 100% video pass `pen tip = drawing path` với quiz (text/price không vỡ, timer không giật) — kiểm thử visual diff với baseline.

### 4.10 CLI + Local Queue (Headless for Hermes)
**Description:** Engine chạy **headless** qua CLI và local queue để Hermes gọi sau này, nhưng v1 Trung bấm tay vẫn chạy được. Không có HTTP API ở MVP. Realizes UJ-1, UJ-2, UJ-3.

#### FR-11: CLI & Queue
System exposes CLI `game render` và `game batch` với local queue (JSON files trong `queue/`). Realizes UJ-1, UJ-2.
**Consequences:**
- `game render --mechanic hi_lo --products p001,p002 --seed 123` tạo 1 job, chạy Validator → Render → Export trong 1 lần gọi, exit code 0 nếu pass, 1 nếu fail với JSON lỗi.
- `game batch --count 50 --mechanic hi_lo,most_expensive,one_away` enqueue 50 jobs, chạy tuần tự/pool, tự retry LLM hỏng tối đa 3 lần, ghi `batch_report.json {total, passed, failed, avg_render_ms}`.
- Queue là file-based, không cần Redis/DB; Hermes sau này chỉ cần ghi file vào `queue/` là Engine tự pick — interface này phải được document trong `addendum.md`.

---

## 5. Non-Goals (Explicit)

- **Không làm AI video generator cho nội dung chính** — text/price/timer/button phải render bằng code (Motion Canvas), chỉ dùng AI cho background/decor nếu cần ở Phase 2.
- **Không làm AI avatar / character** ở MVP `[NON-GOAL for MVP → Phase 3]`.
- **Không làm live multiplayer / real-time interaction** — viewer chỉ xem video 15s, không chơi live.
- **Không làm mobile app / editor kéo thả** — v1 chỉ CLI + local preview trên máy Trung.
- **Không auto-post đa nền tảng ở MVP** — chỉ xuất `MP4 + caption.json + affiliate_link`; Hermes auto-post là Phase 2 (v1 Hermes chỉ stub validate).
- **Không làm 17 mechanic còn lại ở MVP** — `CHECK_OUT, ONE_RIGHT_PRICE, DOUBLE_PRICES...` → Phase 2/3, MVP chỉ 3 mechanic `HI_LO, MOST_EXPENSIVE, ONE_AWAY` để chứng minh universal với 3 interaction họ khác nhau.
- **Không làm HTTP API ở MVP** — chỉ `CLI + file queue`; API local để Phase 2 khi Hermes cần gọi tần suất cao.
- **Không làm SaaS multi-tenant** — v1 chỉ local cho Trung + Hermes, không có billing/quota/user management.

---

## 6. MVP Scope

### 6.1 In Scope

- **3 mechanics chứng minh universal:** `HI_LO (BOOLEAN)` + `MOST_EXPENSIVE (MULTIPLE_CHOICE)` + `ONE_AWAY (DIGIT)` — mỗi mechanic một họ Interaction khác nhau.
- **Universal Game JSON + Validator 2 tầng** (FR-1, FR-3, FR-4) với `seed` reproducibility.
- **7 scenes tái sử dụng** (FR-5) với 2 biến thể `ResultScene` (`in_video` vs `comment`).
- **Mock Product DB 50 SKU** với `affiliate_link` (FR-2), `ProductProvider` overwrite giá từ LLM.
- **Audio Engine viPiper offline + SFX local** (FR-9).
- **Local Render Motion Canvas + FFmpeg** 1080×1920 30fps, ≤45s/video, RAM ≤4GB (FR-10).
- **CLI + Local file queue** headless cho Hermes (FR-11), `batch 50` với `batch_report.json`.
- **Export MP4 + caption.json + hashtags + affiliate_link** để Hermes đăng sau.

### 6.2 Out of Scope for MVP

- `CHECK_OUT (NUMBER)` và 16 mechanic còn lại → Phase 2 (`[NON-GOAL for MVP]`).
- 8 scenes mở rộng (ScoreScene, ProgressScene, TimerScene, PuzzleScene...) → Phase 2.
- HTTP API local → Phase 2.
- Hermes full (crawl giá live, auto-post, comment AI) → Phase 2; v1 Hermes chỉ stub đề xuất ideas + validate file.
- AI video generator, AI avatar, mobile app, SaaS, analytics phức tạp → Phase 3.
- **Drawing Transformation (auto-drawing SVG):** `[DECISION] Pivot — DỪNG.** Toàn bộ pipeline Drawing DSL, Hand Engine, Chalk/Pen animation, `spike/dsl-generation` và `spike/singleline-spiral` **không còn là scope**. PRD `prd-auto-drawing-2026-09-04-v2` được đánh dấu `superseded` và giữ lại chỉ để tham chiếu ADR Local-first/Validator. Lý do pivot: Game Video Engine cho ROI affiliate trực tiếp hơn (TikTok/Shopee commission), cost thấp hơn và reuse 100% stack Local-first đã spike, trong khi drawing factory cần nhiều R&D Hand Engine hơn.

---

---

## 7. Success Metrics

**Primary (validate factory có chạy được 100% không cần canh)**
- **SM-1 — Render success:** ≥98% jobs trong batch 50 pass Validator + render ra MP4 không lỗi. Validates FR-3, FR-10, FR-11. *Đo:* `batch_report.json passed/total`.
- **SM-2 — Time-to-MP4:** Trung gõ `game render` → có preview MP4 trong ≤45s (CPU 8 nhân, 1080×1920 30fps). Validates FR-10. *Đo:* log `render_ms`.
- **SM-3 — Hands-free batch:** Hermes stub (hoặc Trung) enqueue 50 jobs qua `game batch` và nhận `batch_report.json` mà không cần can thiệp tay trong lúc chạy. Validates FR-11, UJ-2. *Đo:* `manual_interventions == 0`.

**Secondary (validate video có giữ chân để bán affiliate)**
- **SM-4 — 3-second retention hook:** ≥45% viewers xem qua 3s đầu (Hook + Product). Validates FR-5, FR-6/7/8. *Đo:* TikTok Analytics (Phase 2).
- **SM-5 — Completion rate 15s:** ≥30% xem hết video (đến CTA). Validates FR-5 + Audio. *Đo:* TikTok Analytics.
- **SM-6 — Comment rate với variant=comment:** `variant=comment` có comment rate cao hơn `variant=in_video` ≥20%. Validates FR-5 (2 biến thể Result). *Đo:* A/B 10 video mỗi variant.

**Counter-metrics (không tối ưu)**
- **SM-C1 — Không kéo dài video để cày watch time:** Không tối ưu bằng cách tăng `CountdownScene` >3s hoặc tổng duration >21s. Counterbalances SM-5. *Guardrail:* Validator reject `countdown >3.5s` hoặc `total >21s`.
- **SM-C2 — Không spam Product DB:** Không tối ưu bằng cách nhồi cùng 5 SKU hot vào mọi video. Counterbalances SM-4. *Guardrail:* batch 50 phải cover ≥20 distinct `productId`.

## 8. Cross-Cutting Non-Functional Requirements

### NFR-1: Correctness & Determinism
- 100% `answer` do Engine tính, không do LLM. Cùng `Game JSON + seed` → cùng `answer` và `timeline` (±0.05s). `[ASSUMPTION: Seed là cơ chế duy nhất cho reproducibility — xem A-01]`

### NFR-2: Cost & Local-first
- **Cost biên mỗi video ≤$0.01, mặc định $0.00** (viPiper offline + Motion Canvas + FFmpeg local). Cho phép swap sang Edge TTS free nếu viPiper không đủ hay, nhưng không vượt $0.01. Validates FR-9. `[ASSUMPTION: Local-first giữ cost 0đ như PRD v2 — xem A-02]`

### NFR-3: Performance & Resource
- Render ≤45s / video 1080×1920 30fps trên CPU 8 nhân; RAM ≤4GB cả batch; `WORKER_POOL_MAX = min(CPU-1,3)`. Batch 50 xong trong ≤40 phút tuần tự hoặc ≤20 phút với pool 3. Validates FR-10.

### NFR-4: Observability (cho Hermes tự vận hành)
- Mỗi job log `planning_ms, tts_ms, render_ms, encode_ms, seed, products[], audio_voice_ms, file_size, validator_errors[]` ra `logs/<gameId>.json` và `batch_report.json`. Hermes đọc log để tự retry/skip mà không cần Trung canh. Validates FR-11.

### NFR-5: Extensibility & Licensing
- 100% stack MVP dùng license **MIT/Apache 2.0** (Motion Canvas, viPiper/Piper, FFmpeg). Thay TTS hoặc Renderer chỉ cần đổi adapter, không sửa Game Engine. Validates FR-9, FR-10. `[ASSUMPTION: Không dùng Remotion ở MVP vì license — xem A-03]`

## 9. Open Questions

1. **Chất lượng viPiper cho quiz:** Giọng viPiper offline có đủ tự nhiên để giữ chân TikTok cho câu "Cao hơn hay thấp hơn?" không, hay cần thêm EQ/filter? *Kiểm chứng tại R0 với 5 mẫu voice.*
2. **Ngưỡng TikTok dedup:** Chỉ đổi màu mực/tilt ±2°/nhạc nền + `seed` có đủ để TikTok coi 50 video cùng mechanic là unique không, hay cần thêm biến thiên layout? *Test A/B 20 video cùng 5 SKU.*
3. **Giá mock → giá thật:** Khi nào cần thay mock 50 SKU bằng crawl TikTok Shop/Shopee thật? Giá mock sai lệch bao nhiêu % thì bị viewer bóc phốt trong comment? *Theo dõi SM-C1 và Hermes `stale_price` flag.*
4. **Result variant nào win:** `in_video` vs `comment` — variant nào cho retention + comment rate cao hơn cho affiliate click? *A/B SM-6.*
5. **ONE_AWAY độ khó:** Ẩn 1 digit trong giá 6 chữ số có quá dễ/khó không? Có nên ẩn 2 digits ở Phase 2 không? *Test với 10 video ONE_AWAY, đo completion.*
6. **Hermes interface v2:** Khi Hermes cần tần suất cao (>100 video/ngày), `CLI + file queue` có đủ không hay phải lên HTTP API + DB queue? *Benchmark queue file với 200 jobs.*

## 10. Assumptions Index

| Mã | Giả định `[ASSUMPTION]` | Rủi ro | Kiểm chứng |
|---|---|:---:|---|
| **A-01** | `[ASSUMPTION]` `seed` + `Game JSON` đủ để Engine tái tạo 100% timeline/audio deterministically, không cần lock phiên bản Motion Canvas/viPiper. | Thấp | Test replay 20 jobs với cùng seed sau khi update lib. |
| **A-02** | `[ASSUMPTION]` viPiper offline phát âm tiếng Việt đủ tự nhiên cho quiz 15s mà không cần TTS cloud trả phí, giữ cost 0đ. | Trung bình | Render 5 mẫu voice R0, cho 3 người nghe blind test. |
| **A-03** | `[ASSUMPTION]` Motion Canvas (MIT) đủ thay Remotion cho quiz (text/price/timer) mà không thiếu feature quan trọng. | Thấp | Spike render 1 video HI_LO bằng Motion Canvas tại R0. |
| **A-04** | `[ASSUMPTION]` Mock 50 SKU cứng đủ đa dạng để test 3 mechanic (BOOLEAN/MULTIPLE_CHOICE/DIGIT) mà không cần crawl live ở MVP. | Trung bình | Batch 50 với 50 SKU, check coverage ≥20 distinct products (SM-C2). |
| **A-05** | `[ASSUMPTION]` 7 scenes MVP + 2 biến thể Result là đủ để video 15-21s mượt, không cần Score/Progress/Puzzle ở MVP. | Thấp | Review 10 video với 7 scenes, đo SM-5 completion. |
| **A-06** | `[ASSUMPTION]` Hermes sẽ đảm nhận post + comment + re-validate sau render (Trung chỉ bấm nút batch). Hermes mới là ý tưởng, v1 Engine phải chạy độc lập qua CLI. | Trung bình | v1 test `game batch` không cần Hermes; v2 Hermes stub đọc `batch_report.json` để post. |
| **A-07** | `[ASSUMPTION]` `CLI + file queue (queue/*.json)` đủ cho Hermes gọi headless ở MVP, chưa cần HTTP API/DB queue. | Thấp | Benchmark 50 jobs queue file, đo dequeue latency <100ms. |
| **A-08** | `[ASSUMPTION]` Thêm `affiliate_link` vào Product DB và `caption.json` không vi phạm policy TikTok/Shopee khi đăng kèm video quiz. | Trung bình | Test đăng 5 video kèm link, check không bị flag. |

## 11. Entity Model

```text
Game (gameId, mechanic: enum[HI_LO|MOST_EXPENSIVE|ONE_AWAY], seed, createdAt)
 ├── metadata { gameId, mechanic, language="vi-VN", difficulty, seed, result_variant: enum[in_video|comment] }
 ├── content { title, hook, question, choices[], cta, caption, hashtags[], voice_script }
 │        └── (LLM sinh, không chứa price)
 ├── entities: Product[] (1..4 items, resolved từ ProductProvider)
 │        ├── productId: string (p001..p050)
 │        ├── name: string
 │        ├── image: string (assets/pXXX.webp)
 │        ├── price: int (VND)
 │        ├── currency: "VND"
 │        ├── source: "mock"
 │        ├── updatedAt: datetime
 │        ├── category, brand: string
 │        └── affiliate_link: string (url)
 ├── gameplay { answer, hidden_index?, correct_digit? }  // Engine tính
 │        ├── HI_LO: { priceA, priceB, answer: enum[higher|lower] }
 │        ├── MOST_EXPENSIVE: { productIds[3..4], answer: productId }
 │        └── ONE_AWAY: { productId, price, hidden_index, correct_digit, options[2] }
 ├── scenes: Scene[] (ordered, 7 items)
 │        ├── Scene { type: enum[hook|product|question|countdown|reveal|result|cta], duration: float, componentRefs[] }
 │        └── ResultScene { variant: enum[in_video|comment], answerVisible: bool }
 ├── timeline { totalDuration: 15..21s, sceneTimings[] }
 ├── audio { voice: { script, wavPath, duration }, music: { track, volume }, sfx: [{type, at}] }
 └── publishing { caption, hashtags[], affiliate_link, outputPath: export/<gameId>_<seed>.mp4 }

ProductProvider (local JSON: products.json — 50 records)
 └── Product (schema như trên)

Queue (file-based: queue/<jobId>.json)
 └── Job { jobId, gameId, mechanic, productIds[], seed, status: enum[pending|running|done|failed], retries: 0..3, logsRef }

BatchReport (export/batch_<date>/batch_report.json)
 └── { batchId, total, passed, failed, avg_render_ms, jobs[] }

Logs (logs/<gameId>.json)
 └── { gameId, seed, planning_ms, tts_ms, render_ms, encode_ms, file_size, validator_errors[] }
```

*Quan hệ chính:* `Game 1—N Product` (qua ProductProvider), `Game 1—1 Timeline`, `Game 1—1 Audio`, `Batch 1—N Game`, `Job 1—1 Game`.

---

*File này đang ở trạng thái coaching — mỗi section sẽ được điền sau từng vòng hỏi đáp. Xem `idea-validation.md` để hiểu vì sao draft 25 mục chưa đủ chuẩn downstream.*
