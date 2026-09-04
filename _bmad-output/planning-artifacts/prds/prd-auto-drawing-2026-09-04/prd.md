# Product Requirements Document — Drawing Transformation Video Factory

**Version:** 1.1  
**Status:** Draft  
**Product Type:** Internal Content Factory  
**Primary Market:** Short-form video / Affiliate Content  
**Language:** Vietnamese-first  
**Document Owner:** Product  
**Last Updated:** 2026-09-04  
**Changelog v1.1:** Bổ sung Registry Ingestion Pipeline (FR-018), Pacing Orchestration (FR-019), Video Diversification Engine (FR-020), Color Fill Reveal (FR-021); bổ sung Decision 5 (Audio-Visual Timing Master); làm rõ Acceptance Criteria cho FR-005, FR-006, FR-011; thêm ngưỡng định lượng cho NFR; bổ sung Glossary, Entity Model, Assumptions Index, Counter-metrics.

---

# 1. Executive Summary

Drawing Transformation Video Factory là một hệ thống sản xuất video short-form tự động.

Sản phẩm biến một **hook hình ảnh đơn giản** như:

- số
- chữ cái
- ký hiệu
- hình học đơn giản

thành một **hình hoàn thiện dễ hiểu và có tính bất ngờ**, thông qua quá trình vẽ từng nét.

Ví dụ:

```text
8
↓
8 + ears
↓
8 + eyes
↓
8 + nose
↓
8 + mouth
↓
Bear
```

Video được kết hợp với:

- lời thoại tiếng Việt
- hiệu ứng âm thanh
- animation vẽ
- reveal cuối
- CTA

Mục tiêu không phải xây một ứng dụng chỉnh sửa video.

Mục tiêu là xây một **content factory** có khả năng biến:

```text
Idea
→ Transformation
→ Drawing Sequence
→ Video
```

với chi phí thấp, chất lượng ổn định và khả năng tạo hàng loạt.

---

# 2. Product Vision

> **Turn simple shapes into surprising drawings — automatically, repeatedly, and at scale.**

Sản phẩm hướng tới việc tạo ra một format video có tính lặp lại cao:

```text
Simple Hook
      ↓
Curiosity
      ↓
Drawing Progression
      ↓
Reveal
      ↓
CTA
```

Ví dụ người xem nhìn thấy:

> "Số 8 này sẽ biến thành con gì?"

và phải xem quá trình vẽ để biết kết quả.

---

# 3. Problem Statement

Hiện tại việc sản xuất loại video này thủ công yêu cầu nhiều công đoạn:

```text
Idea
→ Drawing
→ Animation
→ Voice
→ Sound
→ Editing
→ Export
```

Điều này tạo ra ba vấn đề chính.

## P1 — Production Cost

Một video đơn giản vẫn yêu cầu nhiều thao tác thủ công.

## P2 — Low Production Throughput

Một creator khó duy trì hàng chục video chất lượng ổn định mỗi ngày.

## P3 — Inconsistent Drawing Animation

Các công cụ AI video hiện tại có thể tạo hình hoặc chuyển động nhưng không đảm bảo:

```text
pen tip
=
drawing path
```

và cũng không đảm bảo hình cuối thực sự là kết quả của quá trình vẽ.

---

# 4. Product Opportunity

Format này có một đặc điểm quan trọng:

**Người xem có lý do để tiếp tục xem.**

Ví dụ:

```text
8
```

không cho người xem biết kết quả.

Họ cần xem:

```text
8
→ ears
→ eyes
→ nose
→ mouth
→ reveal
```

Do đó sản phẩm không chỉ tối ưu "video đẹp".

Nó tối ưu:

```text
Curiosity
→ Retention
→ Completion
→ Replay
→ Engagement
→ Click
```

---

# 5. Target User

## Primary User

**Solo creator / content operator**

Người muốn sản xuất số lượng lớn short video nhưng không muốn tự:

- vẽ
- animate
- thu voice
- dựng
- render

cho từng video.

## Secondary User

Content/affiliate operator muốn thử nghiệm nhiều concept khác nhau và đo hiệu quả.

---

# 6. User Jobs

Người dùng cần có khả năng:

### J1 — Tạo một concept

Ví dụ:

```text
subject = bear
hook = 8
language = vi
```

### J2 — Biến concept thành video

Người dùng không cần tự dựng animation.

### J3 — Tạo nhiều biến thể

Ví dụ:

```text
Generate 20 concepts
```

### J4 — Kiểm tra video trước khi xuất bản

Người dùng cần biết:

- drawing có đúng không
- voice có đúng không
- timing có hợp lý không
- final drawing có đúng concept không

### J5 — Theo dõi hiệu quả

Sau khi publish, người dùng cần có khả năng liên hệ:

```text
Concept
→ Video
→ Performance
```

---

# 7. Product Goals

## G1 — Automated Video Generation

Một concept hợp lệ có thể được chuyển thành video hoàn chỉnh mà không cần chỉnh sửa thủ công.

## G2 — Deterministic Drawing

Quá trình vẽ phải xác định được:

- thứ tự nét
- geometry
- thời gian
- vị trí đầu bút

## G3 — Drawing-to-Reveal Consistency

Hình cuối phải là kết quả của chính geometry được sử dụng trong quá trình vẽ.

## G4 — Vietnamese Voice

Video phải có voice tiếng Việt tương ứng với các bước vẽ.

## G5 — Batch Production

Một content operator có thể tạo nhiều video từ một batch request.

## G6 — Measurable Content

Mỗi video phải có metadata đủ để liên kết:

```text
idea
→ concept
→ video
→ performance
→ affiliate
```

---

# 8. Non-Goals

MVP không nhằm xây:

- 3D animation
- photorealistic drawing
- AI video generation
- realistic human hand animation
- character animation
- full video editor
- marketplace
- public SaaS platform
- automatic publishing lên mọi platform
- complex color painting animation (multi-layer, brush stroke, watercolor)
- complex morphing
- image-to-video generation

**Nới lỏng so với Draft v1.0:** Color Fill Reveal đơn giản (đổ màu phẳng — flat color — lên bức vẽ hoàn chỉnh trong ~1 giây trước CTA) được **cho phép** trong MVP để tăng tính thẩm mỹ và khả năng chuyển đổi affiliate. Đây không phải animation tô màu phức tạp — chỉ là SVG `fill` tĩnh. Xem FR-021.

MVP chỉ cần chứng minh:

> Một concept đơn giản có thể được biến thành một short video có quá trình vẽ đáng xem và có khả năng sản xuất lặp lại.

---


# 9. Product Scope

MVP gồm 6 capability chính:

```text
1. Transformation Library
2. Content Planning
3. Drawing Generation
4. Video Generation
5. Quality Validation
6. Batch Production
```

Voice và affiliate là capability hỗ trợ nhưng không phải core moat của MVP.

---

# 10. Core User Flow

```text
User
 ↓
Choose / Generate Concept
 ↓
Review Concept
 ↓
Generate Drawing Plan
 ↓
Validate
 ↓
Generate Video
 ↓
Preview
 ↓
Approve
 ↓
Export
```

Batch:

```text
Generate Ideas
      ↓
Filter
      ↓
Generate Projects
      ↓
Validate
      ↓
Render
      ↓
Review
      ↓
Publish
```

---

# 11. User Journey

## Journey A — Single Video

**Protagonist:** Huy — solo affiliate content creator, muốn tạo video vẽ hoạt hình để kiếm tiền affiliate từ sản phẩm văn phòng phẩm và đồ chơi trẻ em.

### Step 1

Huy nhập:

```text
Bear
```

hoặc:

```text
8 → Bear
```

### Step 2

Hệ thống tạo concept:

```text
Hook: 8

Transformation:
8 → Bear
```

### Step 3

Hệ thống tạo drawing sequence:

```text
8
→ left ear
→ right ear
→ eyes
→ nose
→ mouth
```

### Step 4

Hệ thống kiểm tra concept.

### Step 5

Hệ thống tạo video với voiceover tiếng Việt và pacing tự động.

### Step 6

Huy preview — kiểm tra drawing continuity, timing, voice alignment.

### Step 7

Huy export file MP4 (1080×1920, 30fps).

---


# 12. User Journey — Batch

User yêu cầu:

```text
Generate 50 cute animal transformations.
```

Hệ thống:

```text
50 concepts
      ↓
Concept validation
      ↓
Drawing validation
      ↓
Video generation
      ↓
Quality validation
      ↓
50 videos
```

User chỉ cần review các video đạt validation.

---

# 13. Functional Requirements

## FR-001 — Concept Creation

Hệ thống SHALL cho phép tạo transformation concept gồm tối thiểu:

- hook
- subject
- transformation
- language
- style

Ví dụ:

```json
{
  "hook": "8",
  "subject": "bear",
  "language": "vi",
  "style": "cute_simple"
}
```

---

## FR-002 — Transformation Definition

Mỗi transformation SHALL xác định được:

```text
Input
Output
Drawing Steps
```

Ví dụ:

```text
Input: 8
Output: Bear

Steps:
1. 8
2. left ear
3. right ear
4. eyes
5. nose
6. mouth
```

---

## FR-003 — Drawing Sequence

Mỗi drawing step SHALL có:

- unique ID
- geometry
- drawing order
- duration hoặc timing rule
- voice line tùy chọn

---

## FR-004 — Drawing Registry

Hệ thống SHALL hỗ trợ một registry các drawing components.

Registry có thể chứa:

```text
glyphs
numbers
letters
primitives
animals
templates
hands
voices
SFX
```

Một generated concept không được tham chiếu tới component không tồn tại trong registry.

**Phạm vi Registry cho MVP:**

Registry MVP SHALL chứa tối thiểu:

- 10 hooks: chữ số 0–9 (với stroke order chuẩn hóa)
- 20 subject components hoàn chỉnh (ví dụ: bear, cat, dog, rabbit, fish, bird...)
- Mỗi subject component gồm đầy đủ các part (tai, mắt, mũi, miệng, thân, v.v.) được tách thành từng Drawing Step riêng biệt

---

## FR-005 — Drawing Validation

Hệ thống SHALL từ chối drawing plan nếu:

- component không tồn tại
- geometry không hợp lệ
- path không thể render
- path nằm ngoài canvas
- drawing order không hợp lệ
- step không có geometry
- transformation không thể hoàn thành

**Hành vi khi Validation thất bại:**

- Hệ thống SHALL ghi log mã lỗi cụ thể vào metadata của concept (field: `validation_error`).
- Concept SHALL được đánh dấu `status: failed_validation` thay vì bị xóa.
- Trong batch: hệ thống SHALL tiếp tục xử lý concept tiếp theo mà không crash toàn bộ batch.
- Operator SHALL có thể xem danh sách concept thất bại và lý do sau khi batch hoàn tất.

---

## FR-006 — Drawing Animation

Hệ thống SHALL tạo animation trong đó tiến trình của nét vẽ tương ứng với geometry thực tế.

Người xem phải nhìn thấy:

```text
pen
 ↓
drawing path
```

thay vì một animation độc lập với hình vẽ.

**Acceptance Criteria — Pen Tip Tracking:**

- Tọa độ đầu bút (pen tip) tại mỗi frame SHALL bám sát tọa độ điểm đầu của đoạn path đang được vẽ, với độ lệch tối đa ≤ 5px.
- Khi chuyển giữa hai nét không liền mạch (pen-up), hệ thống SHALL hiển thị chuyển động nhấc bút tự nhiên trong khoảng 0.2s–0.4s (pen không biến mất đột ngột).
- Animation SHALL không có jump frame: không được có path segment xuất hiện đột ngột mà không qua quá trình vẽ (teleport > 10px giữa 2 frame liên tiếp).

---

## FR-007 — Final Drawing

Final drawing SHALL được tạo từ cùng nguồn geometry với drawing animation.

Hệ thống không được sử dụng một hình final độc lập có khả năng khác với hình đã vẽ.

---

## FR-008 — Voiceover

Mỗi video SHALL có thể chứa voiceover tiếng Việt.

Voiceover SHALL được liên kết với drawing steps.

Ví dụ:

```text
Step 1
"Bắt đầu với số tám."

Step 2
"Thêm hai cái tai."

Step 3
"Vẽ đôi mắt."
```

**Audio-Visual Timing Master (Decision 5):**

Video timeline SHALL lấy **TTS audio duration** làm mốc tham chiếu chính (Audio-driven timeline):

- Tốc độ vẽ nét SHALL được co giãn tự động để khớp với độ dài audio của từng step.
- Nếu audio của một step ngắn hơn thời gian vẽ tự nhiên, renderer SHALL tăng tốc độ vẽ (tối đa 2x).
- Nếu audio của một step dài hơn thời gian vẽ tự nhiên, renderer SHALL chèn khoảng pause sau khi vẽ xong, với SFX tiếng vẽ nháp hoặc nhạc nền lấp khoảng trống.
- Dead air (im lặng hoàn toàn không có âm thanh nền) SHALL không vượt quá 0.5s tại bất kỳ thời điểm nào trong video.

---

## FR-009 — Sound Effects

Hệ thống SHALL hỗ trợ reusable SFX cho:

- drawing
- transition
- reveal

---

## FR-010 — Video Composition

Video SHALL hỗ trợ tối thiểu:

```text
Hook
Drawing
Reveal
CTA
```

---

## FR-011 — Video Export

MVP SHALL export:

```text
1080 × 1920
30 FPS
MP4
```

Target duration:

```text
15–30 seconds
```

**Auto-pacing Rule:**

- Nếu tổng thời gian vẽ tự nhiên (dựa trên stroke speed mặc định) vượt quá 25s, renderer SHALL tự động áp dụng hệ số tăng tốc (speed-up factor) từ 1.2x đến 1.8x cho các nét phụ (non-primary strokes) để tổng thời lượng video không vượt quá 30s.
- Nếu tổng thời lượng vẫn vượt 30s sau khi tăng tốc tối đa, hệ thống SHALL ghi cảnh báo vào metadata (`warning: duration_exceeded`) và vẫn render đầy đủ (không cắt xén nét vẽ) — operator tự quyết định phê duyệt hay điều chỉnh.
- Nếu tổng thời lượng dưới 15s, renderer SHALL tự động thêm khoảng pause tại reveal section để đạt tối thiểu 15s.

---

## FR-012 — CTA

CTA SHALL configurable.

Ví dụ:

```text
"Xem thêm ở bio."
```

CTA không được hard-code vào renderer.

---

## FR-013 — Batch Generation

Hệ thống SHALL hỗ trợ tạo nhiều video trong một batch.

Ví dụ:

```text
batch size = 100
```

---

## FR-014 — Deterministic Generation

Cùng một input và seed SHALL tạo ra cùng một kết quả logic.

```text
input + seed
      ↓
same transformation
same drawing
same timing rules
```

---

## FR-015 — Asset Reuse

Hệ thống SHALL tái sử dụng asset đã tồn tại khi có thể.

---

## FR-016 — Generation Metadata

Mỗi video SHALL có metadata gồm:

- project ID
- concept
- seed
- version
- assets
- generation timestamp
- cost metadata

---

## FR-017 — Quality Gate

Một video không đạt validation SHALL không được đánh dấu là production-ready.

---

## FR-018 — Drawing DSL Generation Pipeline

Hệ thống SHALL cho phép LLM tự động sinh Drawing Component mới vào Registry thông qua một **Drawing DSL có cấu trúc cứng** (Drawing Description Language).

**Luồng hoạt động:**

```text
Operator mô tả concept
        ↓
LLM Agent
        ↓
Drawing DSL (JSON schema cố định)
        ↓
DSL Validator (kiểm tra schema + primitive vocabulary)
        ↓
DSL Compiler (compile → SVG geometry)
        ↓
Geometry Validator (kiểm tra canvas bounds, path hợp lệ)
        ↓
JSON Component chuẩn hóa → Registry
```

**Nguyên tắc DSL:**

- LLM chỉ được phép sử dụng các **primitive đã định nghĩa sẵn** trong hệ thống (xem FR-004). LLM không được sinh SVG path thô.
- DSL mô tả drawing steps bằng ngôn ngữ có cấu trúc, ví dụ:

```json
{
  "component_id": "bear_left_ear",
  "subject": "bear",
  "part": "left_ear",
  "steps": [
    {
      "primitive": "arc",
      "center_relative_to": "hook_top_left",
      "radius_scale": 0.18,
      "start_angle": 200,
      "end_angle": 340,
      "direction": "clockwise"
    }
  ]
}
```

- DSL Compiler SHALL compile DSL → tọa độ SVG path tuyệt đối dựa trên canvas bounds.
- Mọi output của LLM phải pass DSL Validator trước khi đưa vào Compiler.
- Nếu DSL không hợp lệ, hệ thống SHALL trả về lỗi schema và LLM có thể retry tối đa 3 lần.

**Acceptance Criteria:**

- Operator SHALL chỉ cần mô tả bằng ngôn ngữ tự nhiên (ví dụ: "Thêm tai trái của con gấu từ vòng trên của số 8") — không cần vẽ hoặc biết SVG.
- Operator SHALL có thể xem preview geometry trước khi confirm thêm vào Registry.
- Mỗi component được thêm vào Registry SHALL có thể render preview ngay lập tức để operator kiểm tra trực quan.

---

## FR-019 — Pacing Orchestration Engine

Hệ thống SHALL có Pacing Orchestration Engine đảm bảo dòng chảy âm thanh liên tục trong toàn bộ video.

**Quy tắc:**

- Dead air (im lặng hoàn toàn) SHALL không vượt quá 0.5s tại bất kỳ thời điểm nào.
- Khi có khoảng trống giữa các voiceover step, hệ thống SHALL tự động:
  1. Ưu tiên: Chèn SFX tiếng bút vẽ trên giấy tương ứng với nét đang vẽ.
  2. Dự phòng: Chèn nhạc nền (background music) từ thư viện SFX của Registry.
- Pacing Engine SHALL phối hợp với Audio-Visual Timing Master (FR-008) để đảm bảo âm thanh và hình ảnh luôn đồng bộ.

---

## FR-020 — Video Diversification Engine

Hệ thống SHALL áp dụng biến thiên ngẫu nhiên có kiểm soát cho mỗi video trong batch để tránh nội dung trùng lặp.

**Biến thiên bắt buộc (mỗi video trong batch phải có ít nhất 2 trong số sau):**

- Màu/texture nền giấy (background paper style): từ thư viện ≥ 5 kiểu.
- Màu mực nét vẽ (ink color): từ bảng màu được phê duyệt.
- Độ nghiêng canvas: ±2° ngẫu nhiên.
- Nhạc nền: chọn ngẫu nhiên từ thư viện ≥ 5 bản nhạc bản quyền.

**Biến thiên tùy chọn:**

- Tốc độ vẽ: ±15% so với baseline.
- Timing của micro-pause giữa các nét: ±0.1s ngẫu nhiên.

Seed của biến thiên SHALL được lưu vào metadata để đảm bảo reproducibility (FR-014).

---

## FR-021 — Color Fill Reveal

Hệ thống SHALL hỗ trợ tùy chọn Color Fill Reveal ở bước cuối của video.

**Behavior:**

- Sau khi toàn bộ nét vẽ hoàn thành và trước khi hiển thị CTA, hệ thống có thể đổ màu phẳng (flat color fill) lên các vùng kín của bức vẽ.
- Kỹ thuật: SVG `fill` tĩnh — không phải animation tô màu từng vùng.
- Thời gian hiển thị Color Fill: tối thiểu 0.5s, tối đa 2s trước khi chuyển sang CTA.
- Color mapping SHALL được định nghĩa tại cấp concept (mỗi subject có bảng màu mặc định có thể override).
- Color Fill là tùy chọn (opt-in per concept) — không bắt buộc cho toàn bộ pipeline.

---

# 14. Non-Functional Requirements

## NFR-001 — Reliability

Pipeline không được tạo video thành công giả khi asset hoặc geometry bị lỗi.

**SLO:** Tỷ lệ render thành công (không có silent failure) ≥ 95% trên mọi batch.

## NFR-002 — Reproducibility

Một project phải có khả năng render lại từ metadata.

**SLO:** Cùng metadata + seed phải tạo ra output logic giống hệt (transformation, drawing order, timing rules) với xác suất 100%.

## NFR-003 — Extensibility

Có thể thay đổi:

```text
TTS provider
Renderer
Drawing asset
AI provider
```

mà không thay đổi product logic.

**Stack MVP ưu tiên license MIT/Apache 2.0 và khả năng chạy local hoàn toàn để chi phí sinh video tiệm cận 0 trước khi cân nhắc API trả phí.**

## NFR-004 — Cost Efficiency

Hệ thống phải cache các bước tốn chi phí.

Ví dụ:

```text
same concept
+
same voice text
=
reuse TTS
```

**SLO:** Chi phí API tối đa ≤ 0.05 USD/video (khi dùng cloud API). Thời gian render ≤ 45s/video ở độ phân giải 1080×1920 30fps trên môi trường local.

## NFR-005 — Observability

Mỗi generation phải ghi nhận:

```text
success/failure
duration
cost
validation result
```

---

# 15. Content Quality Requirements

Một video hợp lệ phải đáp ứng:

### Q1 — Hook Clarity

Người xem phải hiểu hook trong những giây đầu.

### Q2 — Transformation Clarity

Các bước vẽ phải tạo cảm giác:

```text
simple
→ progressively recognizable
→ reveal
```

### Q3 — Final Recognition

Người xem phải nhận diện được hình cuối.

### Q4 — Drawing Continuity

Không được có cảm giác:

```text
drawing disappears
teleport
jump
```

### Q5 — Voice Alignment

Voice phải liên quan đến hành động đang xảy ra.

---

# 16. Content Strategy

MVP ưu tiên các transformation đơn giản.

### Category 1 — Numbers

```text
0–9
```

### Category 2 — Letters

```text
A–Z
```

### Category 3 — Symbols

```text
+
×
@
$
&
```

### Category 4 — Geometry

```text
circle
triangle
line
spiral
wave
```

### Category 5 — Combination

```text
8 + Y
O + |
C + -
```

---

# 17. Transformation Scoring

Mỗi concept SHALL có thể được đánh giá theo 5 tiêu chí, thang điểm 1–5 mỗi tiêu chí (tổng tối đa 25 điểm):

| Tiêu chí | Mô tả | Thang điểm |
|---|---|---|
| **Curiosity** | Hook có tạo được câu hỏi trong đầu người xem không? | 1–5 |
| **Simplicity** | Hook có đơn giản và nhận diện ngay được không? | 1–5 |
| **Drawing Feasibility** | Transformation có thực hiện được bằng Registry hiện tại không? | 1–5 |
| **Visual Transformation** | Mức độ bất ngờ và thỏa mãn của quá trình biến đổi? | 1–5 |
| **Retention Potential** | Concept có khả năng giữ chân người xem đến cuối không? | 1–5 |

**Cơ chế thực thi:**

- Chấm điểm SHALL được thực hiện tự động bằng LLM Validator với rubric prompt cố định (lưu trong Registry).
- Kết quả điểm SHALL được lưu vào concept metadata (field: `scoring`).
- **Ngưỡng vào queue vẽ:** Chỉ concept có tổng điểm ≥ 18/25 mới được đưa vào Drawing Generation queue.
- Concept dưới ngưỡng SHALL được đánh dấu `status: low_score` và operator có thể override thủ công nếu cần.

Điểm số này phục vụ việc **xếp hạng và lọc concept**, không phải đảm bảo video viral. "Retention Potential" là hypothesis cần kiểm chứng bằng dữ liệu thực tế từ nền tảng.

---

# 18. Content Experimentation

Hệ thống phải cho phép thử nhiều biến thể:

```text
Hook
Voice
Drawing Speed
Reveal Timing
CTA
```

Ví dụ:

```text
8 → Bear
```

có thể tạo:

```text
Variant A — curious hook
Variant B — challenge hook
Variant C — direct hook
```

Mục tiêu là tìm:

```text
winning format
```

thay vì giả định trước format tốt nhất.

---

# 19. Success Metrics

MVP không được đánh giá chủ yếu bằng:

```text
SVG đẹp
code đẹp
AI thông minh
```

Mà bằng khả năng tạo ra content có tín hiệu thị trường.

## Product Metrics

```text
Generation Success Rate
Validation Pass Rate
Render Failure Rate
Average Generation Cost
Generation Time
```

## Content Metrics

```text
3-second retention
Average Watch Time
Completion Rate
Replay Rate
Share Rate
Save Rate
Profile Visit Rate
```

## Monetization Metrics

```text
Affiliate CTR
Conversion Rate
Revenue / 1,000 views
Revenue / Video
```

## Counter-metrics (Chỉ số kiềm chế)

Nhằm tránh tối ưu hóa số lượng mà đánh đổi chất lượng và uy tín kênh:

```text
Tỷ lệ video bị người dùng bấm "Không quan tâm" / Ẩn / Báo cáo
Tỷ lệ concept bị operator từ chối ở khâu preview (reject rate)
Tỷ lệ video bị nền tảng hạn chế phân phối (reach reduction)
```

**Ngưỡng cảnh báo:** Nếu tỷ lệ video bị ẩn/báo cáo vượt 5% trong một tuần, operator SHALL dừng batch mới và review chất lượng nội dung trước khi tiếp tục.

---

# 20. MVP Success Criteria

MVP được coi là đạt nếu:

### Production

- Có thể tạo ít nhất 20 transformation hợp lệ.
- Mỗi transformation có ít nhất 3 drawing steps.
- Có thể tự động tạo MP4.
- Có voice tiếng Việt.
- Có validation.
- Có batch generation.

### Drawing

- Drawing animation và final drawing dùng cùng geometry.
- Không có lỗi pen/path nghiêm trọng.
- Có thể render lại cùng project.

### Business Experiment

Có thể xuất bản đủ video để kiểm tra:

> **Người xem có thực sự muốn xem loại transformation content này hay không?**

Đây là **North Star của MVP**, không phải số lượng tính năng.

---

# 21. MVP Constraints

MVP phải ưu tiên:

```text
Determinism
>
Reliability
>
Production Cost
>
Throughput
>
Visual Complexity
```

Không hy sinh tính xác định của drawing chỉ để đạt visual effect đẹp hơn.

---

# 22. Monetization

Affiliate là monetization layer của sản phẩm.

Relationship:

```text
Transformation
      ↓
Content
      ↓
Audience
      ↓
Product relevance
      ↓
Affiliate CTA
      ↓
Click
      ↓
Conversion
```

Affiliate SHALL được thiết kế dưới dạng metadata, không gắn cứng vào drawing engine.

---

# 23. Future Scope

Sau MVP có thể mở rộng:

### Content

```text
Color drawing
More complex animals
Objects
Characters
Educational drawing
```

### Distribution

```text
TikTok
YouTube Shorts
Instagram Reels
Facebook Reels
```

### Monetization

```text
Amazon
TikTok Shop
Shopee
Other affiliate networks
```

### Intelligence

```text
Performance feedback
→ identify winning transformations
→ generate similar concepts
→ automatically iterate
```

Mục tiêu dài hạn:

```text
Performance Data
      ↓
Learning Loop
      ↓
Better Concepts
      ↓
More Videos
      ↓
More Data
```

---

# 24. Product Architecture Boundary

PRD chỉ định nghĩa các capability sau:

```text
Content Planning
Drawing Planning
Drawing Generation
Voice Generation
Video Generation
Validation
Batch Production
Metadata
Experimentation
```

PRD **không khóa implementation** vào:

```text
Remotion
Kokoro
ElevenLabs
SVG implementation details
Specific LLM
Specific cloud provider
Specific programming language
```

Các quyết định này thuộc Architecture.

---

# 25. Release Strategy

## Release 0 — Drawing Proof

Mục tiêu:

```text
Input
→ Drawing Plan
→ Animated Drawing
→ Final Drawing
```

Không cần AI.

## Release 1 — Content MVP

Thêm:

```text
Concept Library
Voice
Video Composition
Validation
```

## Release 2 — AI Generation

Thêm:

```text
Creative Agent
Drawing Planner
```

## Release 3 — Factory

Thêm:

```text
Batch generation
Caching
Cost tracking
Experiments
```

## Release 4 — Monetization

Thêm:

```text
Affiliate mapping
CTA experiments
Performance tracking
```

---

# 26. Key Product Decisions

## Decision 1 — Deterministic Drawing

Drawing phải là deterministic system.

AI có thể đề xuất:

```text
what to draw
```

nhưng không được toàn quyền quyết định:

```text
how pixels randomly change during rendering
```

---

## Decision 2 — Transformation Is the Product Primitive

Đơn vị cơ bản của hệ thống không phải là video.

Nó là:

```text
Transformation
```

Ví dụ:

```text
8 → Bear
```

Từ một transformation có thể sinh:

```text
Video A
Video B
Video C
```

với các biến thể về:

- hook
- voice
- timing
- style
- CTA

Điều này giúp content library trở thành tài sản có thể tái sử dụng.

---

## Decision 3 — Video Is a Projection

Video không phải nguồn dữ liệu gốc.

Concept và drawing definition mới là nguồn dữ liệu.

```text
Transformation
       ↓
Drawing Definition
       ↓
Video
```

Nếu sau này đổi renderer:

```text
Remotion
→ Motion Canvas
→ another renderer
```

concept vẫn tồn tại.

---

## Decision 4 — LLM Sinh DSL, Không Sinh SVG Thô

LLM SHALL sinh Drawing DSL có cấu trúc cứng, không phải SVG path thô.

```text
LLM sinh:         Drawing DSL (JSON schema cố định)
LLM không sinh:   SVG path thô (<path d="M 120 C 130..."/>)
```

**Sự khác biệt then chốt:**

| | LLM sinh SVG thô | LLM sinh DSL (quyết định này) |
|---|---|---|
| Kiểm soát | Không thể validate cú pháp SVG phức tạp | Schema validator chặn DSL sai ngay lập tức |
| Predictability | LLM có thể hallucinate tọa độ tùy tiện | LLM chỉ điền giá trị vào primitive đã định nghĩa |
| Determinism | Cùng input → output SVG có thể khác nhau | Cùng DSL → Compiler luôn ra cùng geometry |
| Debug | Khó truy vết lỗi trong SVG path dài | DSL ngắn gọn, dễ đọc, dễ sửa |

**Primitive vocabulary** (danh sách LLM được phép dùng trong DSL):

```text
arc          — đường cong tròn
circle       — hình tròn/ellipse khép kín
line         — đoạn thẳng
bezier_2     — bezier bậc 2 (quadratic)
bezier_3     — bezier bậc 3 (cubic)
polyline     — chuỗi đoạn thẳng
rect         — hình chữ nhật
```

Mở rộng vocabulary phải thông qua cập nhật DSL schema, không phải qua LLM prompt.

Mục tiêu là giảm:

- malformed geometry
- invalid paths
- inconsistent drawing
- unpredictable output

---

## Decision 5 — Audio-Visual Timing Master: Audio Làm Chủ Timeline

Video timeline SHALL lấy TTS audio duration làm mốc tham chiếu chính.

Animation nét vẽ SHALL co giãn tốc độ theo audio, không phải ngược lại.

Lý do:
- Người xem nhận thức thời gian chủ yếu qua âm thanh trong short-form video.
- Nét vẽ giật cục hoặc quá chậm cùng với voice đúng nhịp vẫn dễ chịu hơn nét vẽ mượt mà cùng với dead air.
- Kỹ thuật tăng tốc/giảm tốc nét vẽ (stroke speed interpolation) dễ implement hơn kỹ thuật stretch/compress audio.

---

# 27. Risks

## R1 — Content Isn't Interesting

Hệ thống có thể tạo video kỹ thuật hoàn hảo nhưng người xem không quan tâm.

**Mitigation:**

Đưa content testing vào MVP.

---

## R2 — Transformations Become Repetitive

Nếu chỉ có:

```text
8 → animal
```

content nhanh chóng trở nên nhàm chán.

**Mitigation:**

Xây transformation library và variation system.

---

## R3 — Drawing Looks Too Mechanical

Nếu animation quá deterministic, video có thể mất cảm giác handmade.

**Mitigation:**

Variation ở:

- speed
- pauses
- hand movement
- micro timing
- paper texture

nhưng không thay đổi geometry logic.

---

## R4 — AI Generates Invalid Concepts

**Mitigation:**

Registry + validator + constrained planner.

---

## R5 — Production Cost Exceeds Affiliate Revenue

**Mitigation:**

Cost tracking từ ngày đầu.

---

# 28. Open Product Questions

Các câu hỏi này cần được kiểm chứng trong quá trình MVP:

1. Transformation dạng số/chữ có thực sự tạo retention tốt hơn các hook khác không?
2. Video bao nhiêu giây có completion rate tốt nhất?
3. Voice tiếng Việt có làm tăng retention không?
4. Người xem thích tốc độ vẽ nhanh hay chậm?
5. Reveal nên xảy ra ở giây thứ bao nhiêu?
6. CTA có làm giảm completion rate không?
7. Loại transformation nào tạo nhiều replay nhất?
8. Transformation nào có khả năng gắn với affiliate tốt nhất?

---

# 29. Definition of Done — Product MVP

MVP chỉ được coi là hoàn thành khi một operator có thể thực hiện:

```text
Input:
"8 → Bear"

        ↓

Generate

        ↓

Validate

        ↓

Render

        ↓

Preview

        ↓

Export

        ↓

final.mp4
```

mà không cần:

```text
vẽ thủ công
+
animate thủ công
+
sync voice thủ công
+
edit video thủ công
```

và hệ thống có thể lặp lại quy trình đó cho nhiều transformation.

---

# 30. Final Product Principle

> **The system should not use AI to fake a drawing process. It should know the drawing process first, then render it.**

Kiến trúc sản phẩm vì vậy được xây quanh:

```text
Transformation
      ↓
Drawing Definition
      ↓
Validated Drawing
      ↓
Rendered Video
```

AI tạo **ý tưởng và kế hoạch**.

Drawing system quyết định **nét vẽ**.

Renderer quyết định **cách trình bày video**.

Performance data quyết định **cái gì nên tạo tiếp theo**.

---

# 31. Glossary

| Thuật ngữ | Định nghĩa |
|---|---|
| **Hook** | Hình ảnh/ký hiệu đơn giản ở đầu video kích thích sự tò mò của người xem. Ví dụ: số "8", chữ "O", hình tròn. |
| **Subject** | Kết quả cuối cùng mà Hook sẽ được biến đổi thành. Ví dụ: Bear, Cat, Flower. |
| **Transformation** | Cặp (Hook → Subject) cùng toàn bộ Drawing Sequence để thực hiện sự biến đổi đó. Đây là đơn vị nguyên tử của hệ thống. |
| **Drawing Sequence** | Danh sách có thứ tự các Drawing Step tạo nên một Transformation hoàn chỉnh. |
| **Drawing Step** | Một bước vẽ đơn lẻ, gồm: ID, geometry (path), drawing order, duration rule, voice line (tùy chọn). |
| **Component** | Một phần tử đồ họa có thể tái sử dụng được lưu trong Registry. Một Subject có thể gồm nhiều Component (ví dụ: bear_left_ear, bear_right_ear, bear_eyes). |
| **Primitive** | Component đồ họa cơ bản nhất không thể phân tách thêm: `arc`, `circle`, `line`, `bezier_2`, `bezier_3`, `polyline`, `rect`. LLM chỉ được dùng các primitive này khi sinh DSL. |
| **Drawing DSL** | Drawing Description Language — ngôn ngữ mô tả nét vẽ dạng JSON schema cố định. LLM sinh DSL thay vì sinh SVG path thô. DSL sau đó được Compiler chuyển thành geometry. |
| **DSL Compiler** | Thành phần compile Drawing DSL → tọa độ SVG path tuyệt đối. Cùng một DSL + canvas size → luôn ra cùng geometry (deterministic). |
| **DSL Validator** | Thành phần kiểm tra DSL output của LLM trước khi đưa vào Compiler: kiểm tra schema, primitive vocabulary, giá trị hợp lệ. |
| **Registry** | Kho lưu trữ tập trung tất cả Drawing Components đã được validate và chuẩn hóa. LLM chỉ được tham chiếu đến các component có trong Registry. |
| **Asset** | Tài nguyên phi đồ họa dùng trong video: file âm thanh TTS, SFX, nhạc nền, texture nền giấy. |
| **Canvas Bounds** | Giới hạn không gian vẽ hợp lệ (1080×1920 ở độ phân giải xuất), mọi geometry phải nằm trong bounds này. |
| **Pen Tip** | Điểm đầu của ngòi bút ảo trong animation — phải bám sát tọa độ đầu path đang được vẽ (độ lệch ≤ 5px). |
| **Dead Air** | Khoảng thời gian hoàn toàn im lặng trong video (không có voice, không có SFX, không có nhạc nền). Phải ≤ 0.5s. |
| **Pacing Orchestration** | Cơ chế tự động điều phối nhịp độ âm thanh và tốc độ vẽ để tránh Dead Air và đảm bảo dòng chảy liên tục. |
| **Color Fill Reveal** | Tính năng đổ màu phẳng (flat color) lên bức vẽ hoàn chỉnh trước CTA. Là kỹ thuật SVG fill tĩnh, không phải animation tô màu. |
| **Batch** | Một tập hợp nhiều Concept được xử lý song song hoặc tuần tự trong một lần chạy. |
| **Production-ready** | Trạng thái của một video đã pass toàn bộ validation gates và sẵn sàng để review/export. |
| **Seed** | Giá trị khởi tạo (seed value) đảm bảo tính deterministic: cùng input + seed → cùng output logic. |

---

# 32. Entity Model

Quan hệ giữa các thực thể cốt lõi của hệ thống:

```text
Concept
 ├── hook: string
 ├── subject: string
 ├── language: enum
 ├── style: enum
 ├── scoring: ScoringResult
 ├── status: enum (draft | validated | failed_validation | low_score | production_ready)
 └── 1..N ──► Transformation
               ├── input: string
               ├── output: string
               ├── seed: string
               └── 1..N ──► DrawingStep
                             ├── id: string (unique)
                             ├── drawing_order: int
                             ├── duration_rule: DurationRule
                             ├── voice_line: string (optional)
                             └── N..1 ──► Component (từ Registry)
                                          ├── id: string
                                          ├── type: enum (glyph | animal_part | primitive | sfx | voice | texture)
                                          ├── geometry: SVGPath
                                          ├── bounding_box: Rect
                                          └── stroke_metadata: StrokeMetadata

VideoAsset
 ├── concept_id: ref → Concept
 ├── seed: string
 ├── version: string
 ├── assets: AssetManifest
 ├── generation_timestamp: ISO8601
 ├── cost_metadata: CostRecord
 ├── validation_result: ValidationResult
 └── diversification_params: DiversificationParams
```

---

# 33. Assumptions Index

Các giả định sau được xem là đúng trong phạm vi MVP. Mỗi giả định cần được kiểm chứng và cập nhật khi có dữ liệu thực tế.

| ID | Giả định | Rủi ro nếu sai | Khi nào kiểm chứng |
|---|---|---|---|
| A-001 | `[ASSUMPTION]` TTS tiếng Việt từ Piper/viPiper (MIT) có chất lượng phát âm đủ tự nhiên để giữ chân người xem short-form. | Cần chuyển sang cloud TTS trả phí (ElevenLabs, Zalo AI) → tăng chi phí/video. | Release 1, trước khi publish video đầu tiên. |
| A-002 | `[ASSUMPTION]` SVG path order trong file SVG từ công cụ thiết kế (Illustrator, Inkscape) phản ánh đúng thứ tự nét vẽ tự nhiên của một họa sĩ vẽ tay. | Registry Ingestion Pipeline tạo ra stroke order không tự nhiên, cần sửa tay nhiều. | Release 0, khi test Ingestion Pipeline lần đầu. |
| A-003 | `[ASSUMPTION]` Motion Canvas (MIT) hoặc Remotion đủ khả năng render 30fps 1080×1920 MP4 trong ≤ 45s trên môi trường local của operator. | Cần upgrade hardware hoặc chuyển sang cloud render → tăng chi phí vận hành. | Release 0, khi benchmark render lần đầu. |
| A-004 | `[ASSUMPTION]` Format "số/chữ → con vật" có đủ tính mới lạ để không bị nền tảng TikTok/Shorts coi là duplicate content trong 3 tháng đầu. | Cần tăng độ phức tạp biến thể (Diversification Engine) hoặc thay đổi format sớm hơn kế hoạch. | 4 tuần sau khi publish batch đầu tiên. |
| A-005 | `[ASSUMPTION]` Affiliate CTR đủ dương để chi phí sản xuất (API + operator time) < doanh thu affiliate trong vòng 60 ngày. | MVP không tạo được ROI → cần cân nhắc lại mô hình kiếm tiền. | Release 4, sau 60 ngày vận hành thực tế. |
| A-006 | `[ASSUMPTION]` Một operator có thể quản lý quy trình review và approve 50–100 video/ngày trong ≤ 2 giờ. | Cần thêm automation hoặc bổ sung nhân sự → tăng chi phí vận hành. | Release 3, khi batch đầu tiên vượt 50 video/ngày. |