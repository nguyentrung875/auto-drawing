```md
# Transformation Factory (LLM → “8→Bear” → video hand-drawn)  
*Tài liệu tổng hợp stack “REUSE / FORK / ADAPT / BUILD” + kiến trúc khuyến nghị*

**Ngày tổng hợp:** 2026-09-04  
**Mục tiêu:** tránh tự xây lại nền tảng kỹ thuật; tập trung vào “moat” = **Transformation Engine + AI Planner**.

> Ghi chú độ tin cậy: File này là bản tổng hợp từ nội dung bạn đưa + các repo gợi ý trong trao đổi. Một số chi tiết “sao / phiên bản / trạng thái archive / license thay đổi theo thời gian” cần bạn mở repo và kiểm tra lại tại thời điểm chốt stack.

---

## 0) TL;DR (kết luận nhanh)

- Bạn **có thể tránh tự code** phần lớn “video engine / renderer / TTS / encoder”.
- Phần nên tự xây (moat) chủ yếu là:
  1) **Transformation Library/Registry (dataset + rules)**  
  2) **Transformation Engine (compiler + validator + constraints)**  
  3) **AI Planner (LLM → Transformation DSL/IR)**  
  4) **Factory Orchestrator** (queue/cache/retry/concurrency)

- Các khối **nên reuse/adapt**:
  - Drawing/hand-drawn animation engine: **Sketchling**, **HandDraw-Skill**, **svg-draw-motion**
  - Whiteboard end-to-end pipeline: **chalkboard**
  - GUI maker/benchmark exporter: **Inkplainer-OS**
  - Video rendering: **Remotion** (có điều kiện license) hoặc **Motion Canvas** (MIT) tùy chiến lược
  - TTS: **Piper** (cần kiểm chứng license/nhánh) hoặc **viPiper** (MIT)

---

## 1) Phân rã theo phase (đã có gì tốt + khuyến nghị)

| Phase | Đã có gì tốt? | Bạn nên làm gì? |
|---|---|---|
| **1. Drawing Engine** | **Sketchling**, **HandDraw-Skill**, **svg-draw-motion**, **Inkplainer-OS**, **chalkboard** | **Reuse/Adapt**, *không* code renderer từ 0 |
| **2. Transformation Library** | Repo “chuyển hình 8→Bear” theo dạng IP của bạn hầu như chưa có sẵn | **BUILD** dataset + registry + QA tools |
| **3. Voice + Video** | **Piper/viPiper**, Edge TTS (tuỳ), **Remotion**, FFmpeg, (alt) **Motion Canvas** | **Reuse**, chỉ ghép/đóng gói |
| **4. AI Planner** | **Sketchling** chứng minh “LLM → drawing language”; **chalkboard** có SceneScript JSON | **ADAPT + BUILD** phần rule/constraint theo registry |
| **5. Batch Factory** | Remotion có renderer API; chalkboard có render concurrency; FFmpeg | **Reuse**, chỉ viết orchestration |
| **6. Analytics** | API nền tảng/CSV | **Defer** trong MVP |
| **7. Affiliate** | Network/API sẵn | **Chỉ build mapping + tracking** |

---

## 2) Nguyên tắc kiến trúc (để LLM không “vẽ bậy”)

### 2.1. Không làm “LLM → SVG thô”
Thay vào đó:

```
LLM
 ↓
Transformation DSL / Scene IR (schema cứng)
 ↓
Registry + Validator (constraint)
 ↓
Renderer (reuse)
 ↓
MP4
```

- LLM chỉ được “lắp ghép” primitives/steps đã có trong registry.
- Mọi output của LLM phải pass validator trước khi render.

### 2.2. Moat của bạn = data + constraint + planner
- Dataset transformation + stroke order + timing + script voice/subtitle.
- Constraint: “được phép dùng primitives nào, theo thứ tự nào”.
- Planner: chuyển “ý định” thành “kịch bản” đúng schema.

---

## 3) Repo shortlist (3–5 cái đáng dùng làm nền)

> Tất cả link để dạng inline-code để bạn copy nhanh.

### 3.1. Sketchling (MIT) — “LLM-oriented drawing language”
- Repo: `https://github.com/AnayGarodia/sketchling`
- Điểm mạnh:
  - Có “drawing vocabulary” thay vì SVG thô.
  - Có tư duy validate + render pipeline (headless browser).
- Khuyến nghị: **ADAPT/FORK** nếu bạn muốn DSL giàu biểu đạt cho agent.

### 3.2. HandDraw-Skill (MIT) — JSON DSL → SVG → Remotion → FFmpeg
- Repo: `https://github.com/ToBeWin/HandDraw-Skill`
- Điểm mạnh:
  - “Skeleton kỹ thuật” rất sát engine bạn cần.
  - Deterministic mindset + pipeline rõ.
- Khuyến nghị: **ADAPT**, nhưng cần cân nhắc **license Remotion** nếu dùng thương mại/scale.

### 3.3. svg-draw-motion (MIT) — “bút chạy theo nét”
- Repo: `https://github.com/vorojar/svg-draw-motion`
- Điểm mạnh:
  - Tập trung đúng bài toán “pen follow stroke”.
  - Chạy browser, export video.
- Khuyến nghị: **REFERENCE/ADAPT** lấy thuật toán/approach.

### 3.4. chalkboard (MIT) — prompt/scene → render mp4 theo scene
- Repo: `https://github.com/Atharva-Kanherkar/chalkboard`
- Điểm mạnh:
  - End-to-end pipeline (CLI/server/studio).
  - Có JSON “SceneScript” (tư tưởng IR).
  - Có render concurrency theo scene.
- Khuyến nghị: **FORK** nếu bạn ưu tiên ship nhanh “factory chạy được”.

### 3.5. Inkplainer-OS (Apache-2.0) — whiteboard maker chạy trong browser
- Repo: `https://github.com/NadirWeb-App/Inkplainer-OS`
- Điểm mạnh:
  - GUI maker + export video (hữu ích cho demo/benchmark).
  - Có nhiều thuật toán reveal/redraw + layer.
- Khuyến nghị: **REUSE** làm tool nội bộ/benchmark + tham khảo exporter.

---

## 4) Repo matrix: REUSE / FORK / ADAPT / BUILD

| Repo | Link | Phủ phase | License (cần kiểm tra lại) | Khuyến nghị | Ghi chú |
|---|---|---:|---|---|---|
| Sketchling | `https://github.com/AnayGarodia/sketchling` | 1,4 | MIT | ADAPT/FORK | Vocabulary cho LLM |
| HandDraw-Skill | `https://github.com/ToBeWin/HandDraw-Skill` | 1,5 | MIT | ADAPT | Pipeline Remotion/FFmpeg |
| svg-draw-motion | `https://github.com/vorojar/svg-draw-motion` | 1 | MIT | REFERENCE/ADAPT | Pen-follow stroke |
| chalkboard | `https://github.com/Atharva-Kanherkar/chalkboard` | 1,4,5 | MIT | FORK | SceneScript + studio |
| Inkplainer-OS | `https://github.com/NadirWeb-App/Inkplainer-OS` | 1 | Apache-2.0 | REUSE | Tool/benchmark/export |
| Remotion | `https://github.com/remotion-dev/remotion` | 5 | License riêng | USE có điều kiện | Check kỹ điều kiện commercial |
| Motion Canvas | `https://github.com/motion-canvas/motion-canvas` | 5 | MIT | ALT/REUSE | Alternative nếu muốn MIT |
| Piper TTS | `https://github.com/rhasspy/piper` *(có thể đã đổi trạng thái)* | 3 | *(tuỳ repo/nhánh)* | USE có điều kiện | Xem repo hiện hành + license |
| viPiper | `https://github.com/kiendt/viPiper` | 3 | MIT | REUSE | Tối ưu hướng Vietnamese |

---

## 5) “Không tự xây” (để tiết kiệm 80% effort)

Bạn không nên tự xây:
- ❌ SVG renderer core
- ❌ hand-drawn renderer
- ❌ path animation engine (pen-follow)
- ❌ video encoder/muxer (dùng FFmpeg/WebCodecs)
- ❌ TTS engine
- ❌ headless Chromium rendering plumbing
- ❌ FFmpeg

Bạn chỉ cần “đóng gói / orchestration / constraint / data”.

---

## 6) Phần **nên tự BUILD** (moat thật sự)

### 6.1. Transformation Library / Registry (dataset + schema)
Bạn nên thiết kế registry như sau:

```
Transformation
├── id: "8_to_bear_v1"
├── hook
│   ├── token: "8"
│   ├── geometry_refs: ...
│   └── allowed_primitives: ["loop_top", "loop_bottom", ...]
├── target
│   ├── token: "bear"
│   └── canonical_shape: ...
├── steps (ordered)
│   ├── step_01: "ear_left"
│   ├── step_02: "ear_right"
│   ├── step_03: "eye_left"
│   ├── ...
├── stroke_order (per step)
│   ├── ear_left: [stroke_a, stroke_b]
│   └── ...
├── timing_defaults
│   ├── draw_speed
│   ├── pauses
│   └── emphasis_beats
├── narration
│   ├── voice_lines (vi/en)
│   └── subtitles
└── constraints
    ├── max_strokes
    ├── no_self_intersection (optional)
    └── allowed_transforms: [scale, rotate, translate]
```

**Tư duy:** transformation = “kịch bản có kiểm soát”, không phải “ảnh đẹp”.

### 6.2. Transformation Engine (compiler + validator)
Engine của bạn làm 4 việc:
1) Parse Transformation DSL/IR  
2) Validate (schema + constraint + safety)
3) Resolve refs → primitives/strokes có thật trong registry
4) Emit “render script” cho renderer (Sketchling/HandDraw-Skill/chalkboard)

### 6.3. AI Planner (LLM → DSL/IR)
- Input: “8 → Bear, tone vui, 20s, giọng trẻ em…”
- Output: JSON IR:
  - list steps
  - per-step timing
  - narration/subtitle per step
  - camera/zoom (nếu có)
- **Cứng hoá** bằng JSON schema + unit tests (golden outputs).

### 6.4. Factory Orchestrator (batch)
Pipeline khuyến nghị:

```
N transformations
  ↓
Job queue (idempotent)
  ↓
validate (cheap)
  ↓
render (expensive, concurrent)
  ↓
mux VO + music + SFX
  ↓
upload / schedule publish
  ↓
log metrics
```

Có 4 feature “đáng tiền”:
- cache assets (fonts, voice files, intermediate frames)
- retry có backoff
- deterministic naming + content hashing
- resource-aware concurrency (CPU/RAM)

---

## 7) 3 option kiến trúc chốt (tuỳ mục tiêu)

### Option A — Ship nhanh nhất (khuyên cho MVP)
**Base:** chalkboard  
- Bạn tập trung build registry + planner → xuất SceneScript/IR → chalkboard render.

Khi MVP chạy ổn, bạn có thể thay renderer dần mà không đổi data/DSL.

### Option B — Deterministic DSL + Remotion ecosystem (nhanh, nhưng check license)
**Base:** HandDraw-Skill + Remotion  
- Giữ đúng mô hình JSON DSL → Remotion → FFmpeg.
- Phù hợp nếu bạn quen Node/React video pipeline.

### Option C — Vocabulary-first cho LLM (giảm hallucination)
**Base:** Sketchling  
- Phù hợp nếu bạn muốn “ngôn ngữ vẽ” giàu biểu đạt nhưng vẫn constrained.

---

## 8) Roadmap triển khai (thực dụng)

### MVP (1–2 tuần)
- [ ] Chốt 1 renderer base (A/B/C)
- [ ] Định nghĩa schema IR (TransformationScript/SceneScript)
- [ ] Build 20 transformations “đinh” (8→Bear, 2→Swan, C→Cat…)
- [ ] Planner prompt + validator + golden tests
- [ ] Render batch 200 videos

### V1 (3–6 tuần)
- [ ] Tool nội bộ để author transformations (UI + preview)
- [ ] Style packs (stroke thickness, wobble, texture, background)
- [ ] Multi-voice + subtitle timing templates
- [ ] Basic analytics ingestion (CSV/API)

### V2
- [ ] Auto-derive biến thể (tempo, framing, narration)
- [ ] A/B testing CTA + affiliate mapping

---

## 9) Checklist rủi ro & quyết định sớm (không hỏi, chỉ nêu để bạn chốt)

- License: nếu dùng Remotion/Piper nhánh nào → cần chốt theo mô hình thương mại.
- Determinism: muốn output reproducible 100% hay chấp nhận randomness có seed?
- Chất lượng nét bút: ưu tiên “pen-follow đúng path” hay “cảm giác tay vẽ” (wobble/rough)?
- Thời gian render: headless browser vs node renderer; concurrency trên server.

---

## 10) Phụ lục: Links (copy/paste)

- Sketchling: `https://github.com/AnayGarodia/sketchling`
- HandDraw-Skill: `https://github.com/ToBeWin/HandDraw-Skill`
- svg-draw-motion: `https://github.com/vorojar/svg-draw-motion`
- chalkboard: `https://github.com/Atharva-Kanherkar/chalkboard`
- Inkplainer-OS: `https://github.com/NadirWeb-App/Inkplainer-OS`
- Remotion: `https://github.com/remotion-dev/remotion`
- Motion Canvas: `https://github.com/motion-canvas/motion-canvas`
- Piper: `https://github.com/rhasspy/piper`
- viPiper: `https://github.com/kiendt/viPiper`

---
*Kết luận: thay vì xây “video engine”, hãy xây **Transformation Factory** trên các engine có sẵn. Moat nằm ở transformation registry + planner + constraint + orchestration.*
```