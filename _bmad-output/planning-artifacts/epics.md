---
stepsCompleted: ["step-01", "step-02", "step-03", "step-04"]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-universal-game-engine-2026-09-11/prd.md
  - _bmad-output/planning-artifacts/prds/prd-universal-game-engine-2026-09-11/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-auto-drawing-2026-09-11/ARCHITECTURE-SPINE.md
  - spike/universal-game-demo/README.md
---

# auto-drawing - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **Universal AI Game Video Engine**, decomposing the requirements from the PRD (final 2026-09-11, 11 FRs, 5 NFRs), Architecture (10 ADs, modular monolith), and spike demo (10/10 pass) into implementable stories.

**Pivot:** PRD & Architecture này supersede `auto-drawing` drawing factory — chỉ làm Game Video Engine.

## Requirements Inventory

### Functional Requirements

**FR-1: Universal Game JSON Schema** — System can load, validate và version Game JSON theo JSON Schema nghiêm ngặt. Consequences: reject thiếu required fields (`E_SCHEMA_MISSING_FIELD`), seed int determinism, gameId unique.

**FR-2: Mock Product DB** — System provides 50 products mock với schema `productId, name, image, price, currency, source, updatedAt, category, brand, affiliate_link`. Consequences: 50 records, image exists, price/affiliate_link overwrite từ Provider, no code change khi thêm SKU.

**FR-3: Two-Layer Validation** — System validates Game JSON qua 2 tầng trước render. Consequences: Schema reject `E_SCHEMA_SCENE_INVALID`, Game Logic reject `E_GAME_LOGIC_INVALID`, <200ms, JSON error `code/field/hint`.

**FR-4: Deterministic Answer & Timeline** — System computes answer và timeline deterministically từ Game JSON + seed. Consequences: HI_LO answer 100% với 100 seed random, timeline 15–21s, countdown 3.0s ±0.1s, reveal 2.0s ±0.1s.

**FR-5: Seven Reusable Scenes** — System renders 7 scenes với mapping 1-1. Consequences: thiếu countdown/reveal → `E_MISSING_REQUIRED_SCENE`, ProductCard không vỡ 1080×1920, Result variant in_video vs comment visual khác.

**FR-6: HI_LO (BOOLEAN)** — System can generate HI_LO round given 2 products. Consequences: answer higher/lower deterministically, delta ≥5% else `E_HILO_EQUAL_PRICE`, QuestionScene + Countdown 3s tick 0.5s.

**FR-7: MOST_EXPENSIVE (MULTIPLE_CHOICE)** — System can generate MOST_EXPENSIVE với 3-4 products. Consequences: answer max price, tie → `E_MOST_EXPENSIVE_TIE` (delta top2 ≥2%), ChoiceScene 3-4 cards không overlap, highlight max.

**FR-8: ONE_AWAY (DIGIT)** — System can generate ONE_AWAY cho 1 product với hidden digit. Consequences: gameplay chứa correct_digit == price[hidden_index], options 2 digits delta 1, ProductScene `1,8?0,000`, Reveal flip + SFX.

**FR-9: Audio Engine** — System generates Voice + SFX + Music deterministically. Consequences: viPiper <2s, voice khớp reveal ±0.1s, SFX countdown mỗi 0.5s thiếu → `E_AUDIO_MISSING_SFX`, music 0.18 không lấn voice.

**FR-10: Local Render & Export** — System renders MP4 local 1080×1920 30fps H.264/AAC via Motion Canvas+FFmpeg. Consequences: ≤45s/video, RAM ≤4GB (pool min(CPU-1,3)), export MP4 + caption.json + affiliate_link, text/timer không vỡ.

**FR-11: CLI & Queue** — System exposes CLI `game render` + `game batch` với local file queue. Consequences: single job exit 0/1 JSON lỗi, batch 50 enqueue + retry 3× + batch_report.json, file-based queue (no Redis), doc trong addendum.

### NonFunctional Requirements

**NFR-1: Correctness & Determinism** — 100% answer do Engine, cùng Game JSON + seed → cùng answer/timeline ±0.05s.

**NFR-2: Cost & Local-first** — Cost biên ≤$0.01, mặc định $0.00 (viPiper offline + Motion Canvas + FFmpeg). Swap Edge TTS allowed nhưng không vượt $0.01.

**NFR-3: Performance & Resource** — Render ≤45s/video 1080×1920 30fps CPU 8 nhân; RAM ≤4GB; WORKER_POOL_MAX = min(CPU-1,3); batch 50 ≤40 phút tuần tự.

**NFR-4: Observability** — Mỗi job log planning_ms, tts_ms, render_ms, encode_ms, seed, products[], audio_voice_ms, file_size, validator_errors[] ra logs/<gameId>.json + batch_report.json.

**NFR-5: Extensibility & Licensing** — 100% MIT/Apache 2.0 (Motion Canvas, viPiper, FFmpeg). Thay TTS/Renderer chỉ đổi adapter, không sửa Engine.

### Additional Requirements

*From Architecture (10 ADs):*

- **AR-1:** Paradigm modular monolith — 6 bounded contexts `game/product/validator/scene/audio/render/queue/observability`, dependency queue→validator→game→audio/scene→render→observability, no circular dep.
- **AR-2:** TypeScript Node.js ≥22 LTS, external binaries via child_process typed wrapper.
- **AR-3:** Validator separate filter — `Validator.validate()` 2 tầng, fail → no Engine call, no mutate.
- **AR-4:** Ownership — price hard fail `E_PRICE_SOURCE_INVALID`, affiliate_link warning `W_AFFILIATE_MISSING`, link only in caption/comment not MP4.
- **AR-5:** ProductProvider 50 files `products/pXXX.json` zod, in-memory cache ≤200ms, FS watch reload, atomic tmp→rename, image exists.
- **AR-6:** Scene System 7 scenes `IScene` with variant — 6 shared, Reveal has `PriceReveal` vs `DigitReveal`, Result variant `in_video|comment`.
- **AR-7:** AudioEngine adapter `IAudioEngine` — viPiper offline <2s, SFX local, voice sync ±0.1s, music 0.18.
- **AR-8:** Render Motion Canvas headless → PNG seq → FFmpeg `libx264 -crf 18 -preset fast`, no affiliate_link burn.
- **AR-9:** Queue file-based `queue/*.json` FIFO FS watch, CLI `game render/batch/products list`, Hermes writes queue only.
- **AR-10:** Batch bounded pool min(CPU-1,3) + fail-forward + seeded PRNG (seedrandom bans Math.random) + timeouts (Piper/TTS/FFmpeg/Motion Canvas) + temp cleanup + pre-flight disk ≥2GB.

### UX Design Requirements

*No UX design contract — HTML preview trong spike đủ cho internal factory. No UX-DR.*

### FR Coverage Map

| FR | Epic | Notes |
|---|---|---|
| FR-1 | **Epic 1** — Foundation | Game JSON schema, zod, versioning |
| FR-2 | **Epic 1** — Foundation | 50 files ProductProvider, atomic write |
| FR-3 | **Epic 2** — Game Engine | Validator 2 tầng |
| FR-4 | **Epic 2** — Game Engine | Deterministic answer/timeline |
| FR-5 | **Epic 3** — Scene & Audio | 7 scenes reuse |
| FR-6 | **Epic 2** — Game Engine | HI_LO BOOLEAN |
| FR-7 | **Epic 2** — Game Engine | MOST_EXPENSIVE |
| FR-8 | **Epic 2** — Game Engine | ONE_AWAY DIGIT + DigitReveal |
| FR-9 | **Epic 3** — Scene & Audio | Audio viPiper+SFX |
| FR-10 | **Epic 4** — Render & Batch | Motion Canvas→FFmpeg export |
| FR-11 | **Epic 4** — Render & Batch | CLI+queue batch 50 |

*100% FR coverage — mỗi FR thuộc đúng 1 epic, không missed.*

## Epic List

### Epic 1: Foundation — Trung định nghĩa được Game và Product hợp lệ
Trung có thể khai báo Universal Game JSON, load 50 sản phẩm mock từ 50 files riêng lẻ, và hệ thống từ chối ngay JSON hỏng trước khi tốn tiền render. Xong epic này, `game render` với JSON sai sẽ báo lỗi có `code/field/hint` thay vì crash.

**FRs covered:** FR-1 (Game JSON Schema), FR-2 (Mock Product DB)
**NFRs:** NFR-1 (determinism chuẩn bị), NFR-5 (MIT stack), NFR-4 (log validator)
**ARs:** AR-1 (monolith structure), AR-2 (TS Node), AR-5 (50 files), AR-3 (Validator scaffold)

### Epic 2: Game Engine — Trung sinh được 3 loại game với đáp án đúng 100%
Trung bấm `game render --mechanic hi_lo|most_expensive|one_away` và nhận đáp án do Engine tính deterministically (không do LLM), với Validator chặn giá ảo, delta <5% hay tie. Xong epic này, 3 mechanics chạy được end-to-end (chưa có voice/video thật, chỉ JSON + answer + timeline), seed giống nhau ra kết quả giống hệt — đủ để Hermes tin tưởng.

**FRs covered:** FR-3 (Validator 2 tầng), FR-4 (Answer/Timeline), FR-6 (HI_LO), FR-7 (MOST_EXPENSIVE), FR-8 (ONE_AWAY)
**NFRs:** NFR-1 (determinism), NFR-2 (cost 0đ vì chưa render)
**ARs:** AR-3, AR-4, AR-10 (seedrandom)

### Epic 3: Scene & Audio — Trung preview được video 15s hoàn chỉnh trong browser
Trung chạy `game render` và xem HTML preview 15s (7 scenes chạy 18s: Hook→CTA, countdown 3s tick 0.5s) với ProductCard không vỡ 1080×1920, DigitReveal flip riêng cho ONE_AWAY, Result 2 variants, và voice stub khớp reveal. Xong epic này, Trung duyệt được video bằng mắt mà chưa cần FFmpeg — spike đã chứng minh 10/10.

**FRs covered:** FR-5 (7 Scenes), FR-9 (Audio)
**NFRs:** NFR-4 (logs), NFR-5 (MIT)
**ARs:** AR-6 (Scene 7 + variant), AR-7 (Audio adapter)

### Epic 4: Render & Batch — Trung bấm 1 nút ra 50 video MP4 hands-free cho Hermes
Trung chạy `game batch --count 50` (hoặc Hermes ghi `queue/*.json`) và nhận 50 MP4 1080×1920 30fps + `caption.json` (+ affiliate_link) + `batch_report.json` mà không cần canh — job fail thì fail-forward, retry LLM 3×, RAM ≤4GB, pool min(CPU-1,3), disk pre-flight. Xong epic này, factory đạt SM-1 (≥98% pass), SM-2 (≤45s/video), SM-3 (hands-free) — sẵn sàng cho Hermes auto-post Phase 2.

**FRs covered:** FR-10 (Render), FR-11 (CLI & Queue)
**NFRs:** NFR-2 (cost), NFR-3 (perf), NFR-4 (observability)
**ARs:** AR-8 (Motion Canvas→FFmpeg), AR-9 (file queue), AR-10 (pool, timeout, temp, health)

## Epic 1: Foundation — Trung định nghĩa được Game và Product hợp lệ

*Goal:* Trung có thể khai báo Universal Game JSON, load 50 SKU từ 50 files riêng, và hệ thống từ chối JSON hỏng với `code/field/hint` trước khi render.

### Story 1.1: Project Scaffolding & Modular Monolith Structure

As a developer,
I want khởi tạo project TypeScript monolith với 6 bounded contexts rỗng,
So that các epic sau có chỗ đặt code mà không circular dep.

**Acceptance Criteria:**

**Given** repo trống (chỉ có spike cũ)
**When** chạy `npm init` với `src/game/ src/product/ src/validator/ src/scene/ src/audio/ src/render/ src/queue/ src/observability/ src/types/ src/utils/` và `config.json` + `tsconfig.json` (Node 22, strict)
**Then** `npm run build` pass với `tsc --noEmit` và `npm test` (vitest/jest) chạy được 1 test dummy
**And** `src/types/game.ts` chứa type `GameJson` stub (metadata, content, entities, gameplay, scenes, audio, publishing) và `seed: number`
**And** dependency rule `queue → validator → game → audio/scene → render → observability` được enforce bằng `eslint import/no-restricted-paths` (queue không import render)

### Story 1.2: Universal Game JSON Schema & Versioning

As a Trung,
I want load và validate Game JSON theo schema nghiêm ngặt,
So that LLM stub hay tay viết JSON sai đều bị chặn với lỗi rõ ràng.

**Acceptance Criteria:**

**Given** file `games/hi_lo.json` mẫu (từ spike)
**When** gọi `GameLoader.load('games/hi_lo.json')`
**Then** trả về `GameJson` typed, `metadata.seed` là `int`, `metadata.mechanic` enum `HI_LO|MOST_EXPENSIVE|ONE_AWAY`, `scenes` subset của 7 MVP
**And** khi JSON thiếu `metadata.gameId` → throw `E_SCHEMA_MISSING_FIELD` với `field: metadata.gameId, hint`
**And** khi `scenes` chứa `score` (Phase 2) → reject `E_SCHEMA_SCENE_INVALID`
**And** khi `gameId` duplicate trong batch 2 files → reject `E_DUPLICATE_GAME_ID`
**And** `zod` schema được đặt tại `src/game/schema.ts` và version `v1` trong `metadata.version`

### Story 1.3: ProductProvider — 50 files `products/pXXX.json`

As a Trung,
I want có 50 SKU mock mỗi SKU 1 file riêng để Hermes update từng SKU atomically,
So that sửa `p001.json` không ảnh hưởng 49 file còn lại và không cần code change.

**Acceptance Criteria:**

**Given** thư mục `products/` chứa 50 files `p001.json … p050.json` mỗi file schema `productId, name, image, price, currency, source, updatedAt, category, brand, affiliate_link` (zod)
**When** khởi động `ProductProvider` (`new ProductProvider('products/')`)
**Then** load toàn bộ vào memory cache trong ≤200ms và `get('p001')` trả về đúng `price` + `affiliate_link`
**And** khi `assets/p001.webp` thiếu → `get('p001')` vẫn trả product nhưng Validator sẽ báo `E_ASSET_MISSING` (không phải lỗi Provider)
**And** khi ghi `products/p001.tmp.json` → validate zod → `rename → p001.json` (atomic), nếu process kill giữa chừng chỉ `.tmp` hỏng
**And** FS watch: sửa `p001.json` → cache reload trong 100ms mà không restart
**And** `game products list` (CLI) in 50 dòng với `price` formatted VND

## Epic 2: Game Engine — Trung sinh được 3 loại game với đáp án đúng 100%

*Goal:* Trung bấm `game render --mechanic ...` và nhận `answer` do Engine tính deterministically, Validator chặn giá ảo/delta/tie, seed giống → kết quả giống hệt.

### Story 2.1: Two-Layer Validator (Schema + Game Logic)

As a Trung,
I want Game JSON hỏng bị chặn trước khi tốn tiền render,
So that LLM hallucinate không lọt vào video.

**Acceptance Criteria:**

**Given** Game JSON hợp lệ và 1 JSON thiếu `countdown` trong `scenes`
**When** gọi `Validator.validate(game, resolvedProducts)`
**Then** JSON thiếu → trả `Result.err` với `code: E_MISSING_REQUIRED_SCENE, field: scenes, hint: countdown required`
**And** Schema layer reject `E_SCHEMA_SCENE_INVALID` nếu `scenes` không subset 7 MVP, và Game Logic layer reject `E_GAME_LOGIC_INVALID` nếu `choices` trùng giá
**And** Validator chạy <200ms trên CPU 8 nhân và trả `warnings: [W_AFFILIATE_MISSING]` khi thiếu affiliate_link nhưng vẫn `ok: true` (warning not block, AD-4)
**And** mọi lỗi có `code, field, hint` để CLI in JSON cho Hermes đọc

### Story 2.2: Deterministic Answer & Timeline Engine

As a Trung,
I want cùng `Game JSON + seed` luôn ra cùng `answer` và `timeline` để debug khi viewer khiếu nại,
So that Hermes có thể replay đúng video đó.

**Acceptance Criteria:**

**Given** Game JSON HI_LO với `seed=839271` và 2 products `p001 189K, p042 2.49M`
**When** gọi `GameEngine.compute(game, seed)` 2 lần
**Then** cả 2 lần trả `answer: higher` giống hệt và `timeline.totalDuration` 18.0s ±0.05s (Hook 2+Product3+Question3+Countdown3+Reveal2+Result2+CTA3)
**And** `countdown.duration == 3.0 ±0.1` và `reveal.duration == 2.0 ±0.1` else throw `E_TIMELINE_DRIFT`
**And** mọi random (diversification màu, tilt, BGM pick nếu gọi) phải qua `seedrandom(seed)` — `Math.random()` bị cấm (eslint `no-restricted-globals`)
**And** unit test với 100 seed random cho HI_LO đều `answer == (priceB > priceA)`

### Story 2.3: HI_LO Mechanic (BOOLEAN)

As a Trung,
I want tạo video HI_LO "Cao hơn hay Thấp hơn?" giữa 2 sản phẩm,
So that viewer đoán giá và giữ lại 3s countdown.

**Acceptance Criteria:**

**Given** 2 products `p001 189K, p042 2.49M` và `seed=839271`
**When** `MechanicRegistry.get('HI_LO').create({products:[p001,p042], seed})`
**Then** `gameplay.answer == 'higher'` (vì 2.49M >189K) deterministically
**And** nếu `priceB == priceA` hoặc delta <5% → Validator reject `E_HILO_EQUAL_PRICE` với hint `delta X% <5%`
**And** `scenes` tự sinh `['hook','product','question','countdown','reveal','result','cta']` với `result_variant` từ input
**And** `question` mặc định "Sản phẩm B CAO HƠN hay THẤP HƠN A?" + 2 choices Higher/Lower (BOOLEAN)

### Story 2.4: MOST_EXPENSIVE Mechanic (MULTIPLE_CHOICE)

As a Trung,
I want tạo video "Món nào đắt nhất?" với 3-4 lựa chọn,
So that viewer chọn trong nhiều món.

**Acceptance Criteria:**

**Given** 3 products `p001 189K, p015 890K, p028 450K`
**When** `MechanicRegistry.get('MOST_EXPENSIVE').create({products:[p001,p015,p028], seed:839272})`
**Then** `gameplay.answer == 'p015'` (max 890K)
**And** nếu 2 sản phẩm cùng max (tie) → reject `E_MOST_EXPENSIVE_TIE`
**And** nếu delta top2 <2% (ví dụ 890K vs 880K =1.1%) → reject `E_MOST_EXPENSIVE_TIE` với hint `top2 delta X% <2%`
**And** nếu `products.length` không phải 3-4 → reject `E_GAME_LOGIC_INVALID`
**And** `ChoiceScene` data chứa 3 `ProductCard` không overlap (test snapshot 1080×1920)

### Story 2.5: ONE_AWAY Mechanic (DIGIT) + DigitReveal Prep

As a Trung,
I want tạo video ONE_AWAY che 1 chữ số giá `1,8?0,000`,
So that viewer đoán digit và chứng minh engine cân được họ DIGIT khác hẳn BOOLEAN.

**Acceptance Criteria:**

**Given** 1 product `p001 189000` và `hidden_index=3` (chữ số thứ 4)
**When** `MechanicRegistry.get('ONE_AWAY').create({product: p001, hidden_index:3, seed:839273})`
**Then** `gameplay.correct_digit == '0'` (price "189000"[3]) và `options == [0,1]` (đúng + sai delta 1, order seeded random)
**And** nếu `hidden_index >= priceStr.length` → reject `E_GAME_LOGIC_INVALID` với hint `out of range`
**And** `ProductScene` data chứa `maskedPrice: "1,8?0,000"` và `RevealScene` type = `DigitReveal` (khác `PriceReveal` của HI_LO) — test `game.scenes` metadata
**And** `MOST_EXPENSIVE` và `HI_LO` vẫn dùng `PriceReveal`, ONE_AWAY dùng `DigitReveal` — unit test 3 mechanics

## Epic 3: Scene & Audio — Trung preview được video 15s hoàn chỉnh trong browser

*Goal:* Trung chạy `game render` và xem HTML preview 18s (7 scenes) với ProductCard không vỡ, countdown đúng, DigitReveal flip, Result 2 variants, voice stub.

### Story 3.1: Seven Reusable Scenes + Result 2 Variants

As a Trung,
I want 7 scenes tái sử dụng cho cả 3 mechanics với 2 biến thể Result,
So that không phải code riêng mỗi mechanic.

**Acceptance Criteria:**

**Given** Game JSON HI_LO `variant=in_video` và MOST_EXPENSIVE `variant=comment`
**When** `SceneSystem.render(game)` với `game.scenes = ['hook','product','question','countdown','reveal','result','cta']`
**Then** mỗi Scene implement `IScene { render(ctx): Frame[] }` với `ctx.variant`, 6 scenes (`Hook, Product, Question, Countdown, Result, CTA`) giống hệt giữa 3 mechanics (test class identity)
**And** `RevealScene` chọn `PriceReveal` cho HI_LO/MOST_EXPENSIVE và `DigitReveal` cho ONE_AWAY (variant param) — test factory
**And** `ResultScene variant=in_video` render badge `correct/wrong` + answer, `variant=comment` render "Đáp án ở comment 👇" và **không** render answer (snapshot khác)
**And** thiếu `countdown` hoặc `reveal` trong `scenes` → Validator `E_MISSING_REQUIRED_SCENE` (FR-5)
**And** `ProductCard` render không vỡ ở 1080×1920 (visual test: card width ≤ 400px, không overlap)

### Story 3.2: Audio Engine — viPiper + SFX + Sync

As a Trung,
I want voice Việt + SFX countdown/reveal đồng bộ với timeline,
So that giọng "Cao hơn hay thấp hơn?" khớp frame reveal ±0.1s.

**Acceptance Criteria:**

**Given** Game JSON với `audio.voice.script = "Nước giặt 189K. Cao hơn hay thấp hơn?"` và `sfx: [{type:countdown,at:8},{type:reveal,at:11}]`
**When** gọi `AudioEngine.synthesize(game)` (MVP impl `ViPiperEngine` offline)
**Then** trả về `AudioSegment { voiceWavPath, duration, sfxCues }` với `voice duration` <2s và `voiceWavPath` tồn tại (hoặc stub `voice.wav` nếu viPiper chưa cài ở dev)
**And** nếu thiếu `countdown` SFX trong `CountdownScene` → throw `E_AUDIO_MISSING_SFX`
**And** music `tension_01` volume 0.18, SFX tick mỗi 0.5s trong countdown (test `sfxCues.filter(t=>t.type==='countdown').length == 6` cho 3s)
**And** `IAudioEngine` là adapter — swap sang `EdgeTTS` chỉ đổi impl, không sửa Game Engine (test mock impl)

### Story 3.3: HTML Preview Integration (Spike Polish → Production)

As a Trung,
I want `game render --preview` mở browser xem video 18s chạy 7 scenes như spike,
So that duyệt video bằng mắt trước khi tốn 45s render MP4 thật.

**Acceptance Criteria:**

**Given** Game JSON HI_LO hợp lệ đã qua Validator + Engine
**When** chạy `node spike/universal-game-demo/src/run_spike.js` hoặc `game render --mechanic hi_lo --products p001,p042 --seed 839271 --preview`
**Then** sinh `output/preview_hi_lo.html` với 7 scenes auto-play 18s, countdown 3→0, reveal đúng answer, result variant đúng, tilt/BGM random theo seed (spike already 10/10)
**And** preview chạy được `npx serve output` mà không cần Motion Canvas/FFmpeg
**And** story này polish spike thành `src/preview/` trong monolith (copy logic từ spike, không rewrite)

## Epic 4: Render & Batch — Trung bấm 1 nút ra 50 video MP4 hands-free cho Hermes

*Goal:* Trung chạy `game batch --count 50` hoặc Hermes ghi `queue/*.json` và nhận 50 MP4 1080×1920 + caption + batch_report hands-free, fail-forward, RAM ≤4GB.

### Story 4.1: Local Render — Motion Canvas headless → FFmpeg MP4

As a Trung,
I want render MP4 1080×1920 30fps H.264/AAC local mà không dùng AI generator,
So that text/price/timer không vỡ và cost 0đ.

**Acceptance Criteria:**

**Given** Game JSON + timeline + audio đã sẵn (từ Epic 3)
**When** gọi `RenderEngine.render(game, timeline, audio)`
**Then** sinh `export/<gameId>_<seed>.mp4` 1080×1920 30fps `libx264 -crf 18 -preset fast` + `caption.json {caption, hashtags, affiliate_link}` trong ≤45s trên CPU 8 nhân
**And** không burn `affiliate_link` vào video (check pixel scan góc dưới không chứa link)
**And** nếu `render >45s` → log `W_RENDER_SLOW` nhưng vẫn xong
**And** `RenderEngine` dùng Motion Canvas headless → PNG seq → FFmpeg mux (AD-8), có timeout 90s (AD-10) → `SIGKILL` nếu treo

### Story 4.2: CLI Single — `game render` & `game products list`

As a Trung,
I want gõ `game render --mechanic hi_lo --products p001,p042 --seed 123` và nhận MP4 hoặc lỗi JSON rõ ràng,
So that test 1 video nhanh trước khi batch 50.

**Acceptance Criteria:**

**Given** products `p001, p042` tồn tại và Game JSON template hợp lệ
**When** chạy `game render --mechanic hi_lo --products p001,p042 --seed 839271 --result-variant in_video`
**Then** tạo `queue/job_<uuid>.json` với `status: pending` → poll → Validator → Engine → Audio → Scene → Render → ghi `queue/job_<uuid>.json status: done` + `export/...mp4` + `logs/<gameId>.json`, exit 0 và in `batch_report` 1 job
**And** khi JSON hỏng (thiếu price) → exit 1 và in `{"code":"E_GAME_LOGIC_INVALID","field":"...","hint":"..."}`
**And** `game products list` in bảng 50 SKU với `productId | name | price VND | affiliate_link` (từ `products/pXXX.json`)
**And** CLI help `game --help` liệt kê `render, batch, products list, queue status, logs`

### Story 4.3: Batch 50 + Observability — Fail-Forward Hands-Free

As a Hermes (và Trung),
I want enqueue 50 jobs qua `queue/*.json` và nhận `batch_report.json` mà không cần canh,
So that chạy qua đêm 50 video, job fail không chặn job khác, Trung chỉ xem report sáng mai.

**Acceptance Criteria:**

**Given** `products/` 50 files và 3 mechanics `hi_lo,most_expensive,one_away`
**When** chạy `game batch --count 50 --mechanics hi_lo,most_expensive,one_away --result-variant comment` hoặc Hermes ghi 50 files `queue/job_*.json`
**Then** Engine poll FIFO, chạy pool `WORKER_POOL_MAX = min(CPU-1,3)` (3 workers max), mỗi worker 1 job tại một thời điểm, tổng RAM ≤4GB (check `process.memoryUsage()` trong test)
**And** job fail (Validator/LLM/timeout) → log `logs/<gameId>.json` với `code, filter, cause`, mark `status: failed`, tiếp tục job kế tiếp (fail-forward) — không abort batch
**And** cuối batch ghi `export/batch-<ts>/batch_report.json {total:50, passed:≥49, failed:≤1, avg_render_ms, jobs:[{jobId, gameId, status}]}` và in summary `passed 49/50` — SM-1 ≥98% pass
**And** mỗi job log `planning_ms, tts_ms, render_ms, encode_ms, seed, products[], audio_voice_ms, file_size, validator_errors[]` ra `logs/<gameId>.json` và Hermes có thể đọc `batch_report.json` để biết job nào fail
**And** pre-flight check disk ≥2GB trước batch, nếu thiếu → abort `INSUFFICIENT_DISK_SPACE` trước khi render
**And** LLM stub retry 3× nếu JSON hỏng (mock), temp `temp/<jobId>/` cleanup trong `finally`

