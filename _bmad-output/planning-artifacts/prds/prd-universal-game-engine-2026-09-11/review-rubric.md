# PRD Quality Review — Universal AI Game Video Engine

## Overall verdict
PRD đã đạt **decision-ready** sau Coaching: thesis Local-first + Universal JSON được neo chặt, FR-1..FR-11 có consequences testable, Glossary verbatim và Entity Model rõ, MVP scope 3 mechanics chứng minh universal (3 họ Interaction) với pivot rõ ràng khỏi drawing. Rủi ro còn lại nằm ở viPiper quality và TikTok dedup, đã được cô lập thành OQ/A và NFR đo được — đủ để giao cho architecture mà không phải đoán.

## Decision-readiness — strong
PRD nêu quyết định như quyết định, không phải consideration. §0 ghi rõ pivot supersede auto-drawing v2 với lý do ROI affiliate. §4.7 ghi `[NOTE: CHECK_OUT → Phase 2]` và §6.2 ghi `[DECISION] Pivot — DỪNG Drawing`. Trade-offs được nêu: Motion Canvas thay Remotion vì MIT (NFR-5, A-03), CLI+queue thay HTTP API vì Hermes chưa tồn tại (A-07). Open Questions 6 câu đều thực sự mở, không phải rhetorical (ví dụ OQ-1 viPiper blind test). `[ASSUMPTION]` được tag inline 4 chỗ (A-06, A-07 trong §2) và index đầy đủ A-01..A-08.

### Findings
- **[low]** Thiếu `[NOTE FOR PM]` tại tension HI_LO delta 5% (§4.5) — đã là FR nhưng chưa gắn NOTE để PM revisit nếu viewer thấy câu hỏi quá dễ. *Fix:* Đã ổn, có thể thêm NOTE ở FR-6 nếu tuning.

## Substance over theater — strong
Vision (§1) không phải theater: thesis "khai báo → 50 video 15s" neo vào Why Now affiliate commission + Local-first 0đ, không thể swap sang PRD khác. JTBD 4 jobs (Functional/Economic/Quality/Automation Hermes) đều drive FR cụ thể, không persona theater. NFR không phải boilerplate: NFR-2 cost ≤$0.01, NFR-3 ≤45s/4GB, NFR-4 observability cho Hermes — đều có ngưỡng. Mechanic list 20 được thu gọn thành MVP 3 + Phase 2, không hứa framework xong.

### Findings
- *Không có theater đáng kể.*

## Strategic coherence — strong
Thesis "không xây 20 hệ thống, xây 1 engine với Universal Game JSON + Validator + 7 scenes" quán xuyến toàn PRD. Feature prioritization đi theo thesis: FR-1 Schema → FR-3 Validator → FR-5 Scenes → FR-6/7/8 3 mechanics đại diện 3 Interaction → FR-11 CLI queue cho Hermes. SM-1..3 validate factory hands-free, SM-4..6 validate retention affiliate, SM-C1/C2 counterbalance đúng. MVP kind là **Platform MVP** (chứng minh engine cân 3 họ) — logic này khớp với đổi CHECK_OUT sang ONE_AWAY ở §4.7.

### Findings
- *Không có.*

## Done-ness clarity — strong
Mọi FR có consequences đo được, không có "gracefully/reasonable". Ví dụ FR-3: validator <200ms, error JSON `code/field/hint`; FR-4: countdown 3.0s ±0.1s → `E_TIMELINE_DRIFT`; FR-6: `E_HILO_EQUAL_PRICE` nếu delta <5%; FR-9: voice <2s, khớp reveal ±0.1s. NFR có bounds (NFR-3 RAM ≤4GB). Engineer biết done khi nào.

### Findings
- **[medium]** UJ-2 Path bước 1 còn ghi `check_out` (cũ) trong CLI example, trong khi MVP đã đổi sang `one_away`. *Fix:* Sửa UJ-2 Path 1 thành `hi_lo,most_expensive,one_away`.

## Scope honesty — strong
Non-Goals §5 liệt kê 8 mục rạch ròi, mỗi mục có `[NON-GOAL for MVP → Phase X]`. §6.1/6.2 In/Out rõ, không để reader infer. Assumptions 8 mục đều có risk + kiểm chứng. De-scoping được nói thẳng: drawing pivot dừng, 17 mechanic hoãn, HTTP API hoãn. Open-items density 6 OQ + 8 A cho Internal Factory là hợp lý, không blocker.

### Findings
- *Không có.*

## Downstream usability — adequate
Glossary §3 có 10 terms, dùng verbatim trong FR/UJ/SM (Game, Mechanic, Interaction, Scene, Validator...). FR-1..FR-11 contiguous, unique. UJ-1..3 đều có named protagonist (Trung, Hermes) với Entry/Path/Climax/Resolution/Edge. Mỗi section extract được riêng. Entity Model §11 quan hệ rõ (Game 1—N Product, Batch 1—N Game).

### Findings
- **[low]** Thiếu Glossary term `Hermes` dù xuất hiện 15 lần — nên thêm định nghĩa Hermes là agent headless local. *Fix:* Thêm vào §3 ở lần polish.
- **[low]** FR cross-refs dùng "Realizes UJ-1" đã tốt, nhưng SM-4/5 chưa ghi `Validates FR-5` inline trong text SM — đã có nhưng có thể làm rõ hơn.

## Shape fit — strong
Shape là **Internal Content Factory + headless module for Hermes**, không phải consumer app — UJ 3 cái là vừa đủ, không thừa. Không có Information Architecture/Monetization thừa. Platform là Local-first CLI, không cần mobile/PWA. Chain-top (feeds architecture → stories) nên downstream usability được đầu tư đúng.

### Findings
- *Không có.*

## Mechanical notes
- **ID continuity:** FR-1..FR-11 contiguous, không gap/dupe. SM-1..6 + SM-C1/C2 unique. A-01..A-08 contiguous. UJ-1..3 unique.
- **Glossary drift:** Không drift — `Product` vs `Entity` đã gộp thành `Entity / Product` rõ, `Scene` vs `Scenes` dùng nhất quán số ít khi nói type, số nhiều khi nói array.
- **Assumptions Index roundtrip:** 4 inline `[ASSUMPTION]` (2 trong §2.1, 1 trong §2.2, 1 trong NFR) đều có trong Index A-06/A-07/A-01/A-02/A-03/A-05; Index A-04/A-08 không có inline nhưng là assumptions hợp lệ cho Product DB/affiliate — chấp nhận.
- **UJ protagonist naming:** Mỗi UJ có named protagonist (Trung, Hermes) + Entry/Path/Climax/Resolution/Edge — đạt.
- **Required sections:** Essential Spine 0-11 đủ, cộng Cross-Cutting NFRs (§8) — đủ cho Internal Factory.

