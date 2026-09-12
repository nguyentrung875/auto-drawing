# auto-drawing — Universal AI Game Video Engine

Modular monolith (TypeScript, Node.js ≥22) sinh video game ngắn 1080×1920 cho
TikTok/Shopee affiliate: khai báo **Universal Game JSON** → Validator 2 tầng →
Game Engine (answer/timeline deterministic) → 7 scenes → Audio → Render MP4.
100% local-first, MIT/Apache stack, cost ~0đ/video.

> **Pivot:** PRD `prd-universal-game-engine-2026-09-11` supersede PRD
> `prd-auto-drawing-2026-09-04-v2` (Drawing Transformation). Repo này chỉ build
> Game Video Engine.

## Trạng thái hiện tại — Epic 1: Foundation ✅

- [x] Story 1.1 — Project Scaffolding & Modular Monolith Structure
- [x] Story 1.2 — Universal Game JSON Schema & Versioning (`src/game/schema.ts` + `GameLoader`)
- [x] Story 1.3 — ProductProvider 50 files (`products/pXXX.json`, atomic write, FS watch) + CLI `game products list`

## Epic 2: Game Engine ✅

- [x] Story 2.1 — Two-Layer Validator (`src/validator/Validator.ts`): Schema + Game Logic,
      `code/field/hint`, <200ms, warning `W_AFFILIATE_MISSING` không block (AD-4)
- [x] Story 2.2 — Deterministic Answer & Timeline (`src/game/GameEngine.ts` + `src/game/rng.ts`),
      timeline 18.0s (countdown 3.0s / reveal 2.0s), `E_TIMELINE_DRIFT`, seedrandom bắt buộc
- [x] Story 2.3 — HI_LO (BOOLEAN) → `answer: higher|lower`, `E_HILO_EQUAL_PRICE` khi delta <5%
- [x] Story 2.4 — MOST_EXPENSIVE (MULTIPLE_CHOICE) 3–4 cards, `E_MOST_EXPENSIVE_TIE` khi top2 <2%
- [x] Story 2.5 — ONE_AWAY (DIGIT) `189,?00`, options delta 1 seeded, `DigitReveal`

## Epic 3: Scene & Audio ✅

- [x] Story 3.1 — `src/scene/`: seven renderer-neutral scenes, deterministic frame model,
      `PriceReveal`/`DigitReveal`, ProductCard layout and Result `in_video`/`comment` variants
- [x] Story 3.2 — `src/audio/`: `IAudioEngine`, offline `ViPiperEngine` WAV stub,
      six countdown cues at 0.5s, reveal sync and `E_AUDIO_MISSING_SFX`
- [x] Story 3.3 — `src/preview/`: autoplay HTML preview at 1080×1920, CLI `game render --preview`,
      and CommonJS compatibility for the original spike runner

```bash
game render --mechanic hi_lo --products p001,p042 --seed 839271 --preview
node spike/universal-game-demo/src/run_spike.js
```

```bash
game plan --mechanic hi_lo --products p001,p002 --seed 839271
game plan --mechanic most_expensive --products p001,p015,p028 --seed 839272
game plan --mechanic one_away --products p001 --seed 839273 --hidden-index 3
```

`game plan` chạy hết pipeline Epic 2 (Provider → Mechanic → Validator 2 tầng → Engine)
và in JSON `{answer, timeline, revealType, diversification, game, sceneData}`;
lỗi → exit 1 + `{"code","field","hint"}`.

## Epic 4: Render & Batch ✅

- [x] Story 4.1 — `src/render/`: `RenderEngine.render()` → PNG sequence (software
      rasteriser, Motion Canvas contract giữ nguyên) → FFmpeg `libx264 -crf 18
      -preset fast` 1080×1920@30 + AAC, `export/<gameId>_<seed>.mp4` +
      `<gameId>_<seed>.caption.json`; pixel-scan chứng minh affiliate link
      **không** bị burn vào video; render >45s → `W_RENDER_SLOW` nhưng vẫn xong;
      treo quá 90s → `PROCESS_TIMEOUT` (SIGTERM → SIGKILL); `temp/<jobId>/` xoá
      trong `finally`
- [x] Story 4.2 — `src/cli/`: `game render` (queue file `status: pending` →
      Validator → Engine → Audio → Scene → Render → `status: done` + `logs/<gameId>.json`,
      exit 0 + `batch_report` 1 job; lỗi → exit 1 + `{"code","field","hint"}`),
      `game products list` (50 SKU), `game queue status`, `game logs`, `game config`
- [x] Story 4.3 — `src/queue/` + `src/observability/`: `game batch --count 50`
      hoặc 50 files `queue/job_*.json`, pool `min(CPU-1,3)` (mỗi worker 1 job),
      FIFO, fail-forward (job fail không abort batch), RAM ≤4GB, pre-flight disk
      ≥2GB → `INSUFFICIENT_DISK_SPACE`, LLM stub retry 3×, cuối batch
      `export/batch-<ts>/batch_report.json` + summary `passed 49/50` (SM-1 ≥98%)

```bash
game batch --count 50 --mechanics hi_lo,most_expensive,one_away --result-variant comment
game batch --count 50 --quiet                 # report vẫn ghi ra disk
game logs --gameId hi_lo_839271
game queue status
```

### Usage notes (Trung & Hermes)

**`game render`** — một video, dùng trước khi batch:

```bash
game render --mechanic hi_lo --products p001,p042 --seed 839271 --result-variant in_video
game render --game games/hi_lo.json --products p001,p042     # Game JSON tự soạn
```

Kết quả: `queue/job_<uuid>.json` (`done`), `export/<gameId>_<seed>.mp4`,
`export/<gameId>_<seed>.caption.json {caption, hashtags, affiliate_link}`,
`logs/<gameId>.json`. `affiliate_link` **chỉ** nằm trong caption/comment —
pixel-scan sẽ fail render (`E_AFFILIATE_BURNED_IN`) nếu link xuất hiện trong
pixels. Lỗi → exit 1 + JSON `{code, field, hint}` (`E_GAME_LOGIC_INVALID`,
`E_PRICE_SOURCE_INVALID`, …).

**`game batch`** — 50 video qua đêm, không cần canh:

- Pool `WORKER_POOL_MAX = min(CPU-1, 3)`, mỗi worker một job; `--concurrency`
  chỉ dùng khi test/CI.
- Job fail (Validator / LLM / timeout / render) → `logs/<gameId>.json`
  `{code, filter, cause}`, queue job `status: failed`, batch chạy tiếp.
- `export/batch-<ts>/batch_report.json`:
  `{total, passed, failed, pass_rate, avg_render_ms, worker_pool_max, duration_ms, manual_interventions, jobs[], failed_jobs[], warnings[]}`.
  Exit 0 khi SM-1 đạt (`pass_rate ≥ 0.98`), exit 1 khi dưới.
- Mỗi `logs/<gameId>.json` có `planning_ms, tts_ms, audio_voice_ms, render_ms,
  encode_ms, audio_mix_ms, total_ms, seed, products[], file_size,
  validator_errors[], warnings[]`.
- Hermes có thể tự ghi `queue/job_<uuid>.json` rồi chạy `game batch` không kèm
  `--count`; file hỏng bị từ chối (`E_QUEUE_JOB_INVALID`, hiện trong
  `failed_jobs[]`) nhưng không chặn các job khác.
- `filter` trong log/report để Hermes route: `schema`, `game_logic`,
  `price_source`, `asset`, `audio`, `scene`, `render`, `timeout`, `disk`, `llm`,
  `queue`.

**Sự cố thường gặp**

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| `E_FFMPEG_MISSING` | `@ffmpeg-installer/ffmpeg` chưa cài → `npm install`, hoặc set `FFMPEG_PATH` / `config.json → render.ffmpegPath` |
| `W_RENDER_SLOW` | Render >45s (máy yếu, video dài) — video vẫn hợp lệ, chỉ là cảnh báo trong log |
| `PROCESS_TIMEOUT` | Frame stage hoặc encode treo quá ngưỡng (AD-10) → xem `logs/<gameId>.json`, giảm `--count` |
| `INSUFFICIENT_DISK_SPACE` | Dưới 2GB trống — batch abort trước khi render job nào |
| `E_RENDER_STAGE_MISSING` | Job chạy qua `JobRunner` mà không inject renderer (chỉ xảy ra khi gọi API trực tiếp, CLI đã wire sẵn) |

## Cấu trúc (modular monolith)

```
src/
├── game/        # Game JSON schema (zod v1) + GameLoader + GameEngine + mechanics/ + rng
├── product/     # ProductProvider — 50 SKU files, cache, atomic write, FS watch
├── validator/   # Two-layer validation (Validator.ts) — Epic 2
├── scene/       # (Epic 3) 7 reusable scenes
├── audio/       # (Epic 3) viPiper + SFX
├── render/      # (Epic 4) Motion Canvas → FFmpeg
├── queue/       # (Epic 4) file-based job queue
├── observability/ # (Epic 4) logs + batch_report
├── types/       # shared types (GameJson, …)
├── utils/       # format helpers
└── cli/         # `game` CLI entry
products/        # 50 mock SKU files p001.json … p050.json
games/           # sample Game JSON (hi_lo.json)
```

**Dependency rule (enforced by `eslint import/no-restricted-paths`):**

```
queue → validator → game → {audio, scene} → render → observability
```

## Commands

```bash
npm install
npm run build          # tsc --noEmit (strict)
npm test               # vitest
npm run lint           # eslint (dependency rule)
npm run products:list  # = game products list
node bin/game.js products list

# Epic 4 — render & batch
node bin/game.js render --mechanic hi_lo --products p001,p042 --seed 839271
node bin/game.js batch --count 50 --mechanics hi_lo,most_expensive,one_away
node bin/game.js queue status
node bin/game.js logs --gameId hi_lo_839271
```

## Planning artifacts

Kế hoạch đầy đủ trong `_bmad-output/planning-artifacts/` (PRD, Architecture,
Epics). Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`.
