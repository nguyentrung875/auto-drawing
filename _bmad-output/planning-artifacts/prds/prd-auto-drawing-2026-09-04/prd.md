# Product Requirements Document — Drawing Transformation Video Factory

**Version:** 1.0  
**Status:** Draft  
**Product Type:** Internal Content Factory  
**Primary Market:** Short-form video / Affiliate Content  
**Language:** Vietnamese-first  
**Document Owner:** Product

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
- sophisticated color painting
- complex morphing
- image-to-video generation

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

### Step 1

User nhập:

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

Hệ thống tạo video.

### Step 6

User preview.

### Step 7

User export.

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

# 14. Non-Functional Requirements

## NFR-001 — Reliability

Pipeline không được tạo video thành công giả khi asset hoặc geometry bị lỗi.

## NFR-002 — Reproducibility

Một project phải có khả năng render lại từ metadata.

## NFR-003 — Extensibility

Có thể thay đổi:

```text
TTS provider
Renderer
Drawing asset
AI provider
```

mà không thay đổi product logic.

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

Mỗi concept SHALL có thể được đánh giá theo:

```text
Curiosity
Simplicity
Drawing Feasibility
Visual Transformation
Retention Potential
```

Điểm số này phục vụ việc **xếp hạng concept**, không phải đảm bảo video viral.

Đây là điểm tôi sửa so với PRD cũ: không nên đưa "watch-through potential" thành một lời hứa kỹ thuật. Nó là **hypothesis cần kiểm chứng bằng dữ liệu thực tế**.

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

## Decision 4 — Registry Before Generative Freedom

MVP ưu tiên:

```text
controlled vocabulary
```

thay vì:

```text
LLM creates arbitrary SVG
```

Mục tiêu là giảm:

- malformed geometry
- invalid paths
- inconsistent drawing
- unpredictable output

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