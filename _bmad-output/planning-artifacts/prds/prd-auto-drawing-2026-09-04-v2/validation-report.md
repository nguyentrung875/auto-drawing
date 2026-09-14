# Validation Report — Drawing Transformation Video Factory

- **PRD:** `d:\source_code\auto-drawing\_bmad-output\planning-artifacts\prds\prd-auto-drawing-2026-09-04-v2\prd.md`
- **Rubric:** `assets/prd-validation-checklist.md`
- **Run at:** 2026-09-05T21:28:00+07:00
- **Grade:** Good

## Overall verdict

PRD v2 là một tài liệu chất lượng cao — thesis chiến lược rõ ràng (zero-API-cost content factory cho solo affiliate operator), FRs có testable consequences chi tiết đến mức pixel (≤ 5px deviation, ±35° clamping, 0.2s–0.4s lift), Entity Model sẵn sàng cho architecture team source-extract. Tuy nhiên, adversarial review bổ sung hai blind spot đáng kể: (1) PRD thiếu content-level diversification strategy — chỉ diversify visual trong khi TikTok algorithm phát hiện trùng lặp ở tầng content structure, và (2) LLM spatial reasoning cho DSL generation là rủi ro cốt lõi chưa được assumption-tagged. Không có finding nào critical; các high findings đều fixable trong 1 iteration.

## Dimension verdicts
- Decision-readiness — adequate
- Substance over theater — strong
- Strategic coherence — strong
- Done-ness clarity — adequate
- Scope honesty — strong
- Downstream usability — strong
- Shape fit — adequate

## Findings by severity

### Critical (0)

Không có finding critical.

### High (4)

**[Decision-readiness]** — LLM spatial reasoning cho DSL Generation không có assumption tag (§FR-2, §UJ-3)
PRD giả định ngầm rằng LLM đủ khả năng sinh tọa độ hình học chính xác qua prompt, nhưng không có assumption tag, không có kế hoạch kiểm chứng, và không đề cập fallback nếu LLM liên tục sinh geometry sai về mặt thẩm mỹ.
Fix: Thêm `[ASSUMPTION] A-07` cho LLM geometry reasoning, kèm kế hoạch kiểm chứng 20 concept × 3 LLM.

**[Done-ness clarity]** — FR-5 Scoring thiếu rubric chi tiết cho 5 tiêu chí (§4.2)
5 tiêu chí được đặt tên nhưng không có trọng số, không rõ ai chấm (LLM hay rule-based), không có ví dụ đạt/không đạt. Engineer không biết "done" trông như thế nào.
Fix: Thêm bảng trọng số, nêu rõ scoring mechanism, kèm ≥ 1 ví dụ.

**[Adversarial]** — Diversification Engine chống sai vấn đề — thiếu content-level diversification (§FR-18)
FR-18 chỉ diversify visual (màu, nét, góc, nhạc) trong khi TikTok phát hiện spam ở tầng content structure và narrative pattern. 50 video cùng pattern "số → con vật" sẽ bị cluster detection.
Fix: Mở rộng FR-18 với content-level diversification: multiple narrative templates, hook category rotation, voice pacing variation.

**[Adversarial]** — UJ-3 thiếu quality gate cho thẩm mỹ LLM-generated components (§UJ-3, §FR-2)
FR-2 chỉ validate schema và bounds, không validate thẩm mỹ. Con thỏ đúng schema nhưng xấu vẫn pass.
Fix: Thêm consequence: preview kèm reference comparison, operator confirm trước khi lưu Registry.

### Medium (5)

**[Decision-readiness]** — Open Question §9.4 quá implementation-level cho PRD
"Cần hệ số suy giảm bao nhiêu" là câu hỏi architecture, không phải product decision.
Fix: Rephrase thành product-level question, dời chi tiết sang architecture doc.

**[Done-ness clarity]** — FR-14 Color Fill: "mảng kín" chưa được định nghĩa kỹ thuật (§FR-14)
Closed region detection algorithm không được nêu; edge case khi geometry không tạo closed path.
Fix: Bổ sung consequence cho closed region detection + fallback behavior.

**[Done-ness clarity]** — FR-19 Quality Gate: "0% False Positive" là aspirational, không testable (§FR-19)
Cần liệt kê ≥ 5 automated checks cụ thể mà Quality Gate phải pass.
Fix: Liệt kê checks cụ thể (pen tracking, dead air, audio sync, bounds, render completion).

**[Scope honesty]** — Thiếu Assumption riêng cho Motion Canvas headless rendering (§A-03)
A-03 quá chung chung — "Motion Canvas / headless canvas" gộp 2 công nghệ khác nhau.
Fix: Tách assumption riêng cho Motion Canvas headless capability.

**[Shape fit]** — FR-13 bị chia quá nhỏ (FR-13, FR-13b, FR-13c) — phụ thuộc lẫn nhau hoàn toàn (§4.5)
Downstream story creation sẽ khó cắt stories vì 3 sub-FRs này là 1 đơn vị triển khai.
Fix: Merge hoặc ghi rõ "đơn vị triển khai không tách rời".

### Low (6)

**[Substance over theater]** — UJ-2 climax "35 phút" thiếu cơ sở liên kết SM-4 (§UJ-2)
Fix: Ghi chú "(dựa trên mục tiêu SM-4: ≤ 45s/video)".

**[Scope honesty]** — FR-6 Deterministic Seed: chưa clarify logic-level vs pixel-level (§FR-6)
Fix: Clarify "Deterministic ở tầng logic, không yêu cầu pixel-perfect."

**[Downstream usability]** — SM-8 gắn "(Giả định nội dung)" nhưng không có Assumption Index entry (§SM-8)
Fix: Thêm A-07 hoặc reclassify SM-8.

**[Shape fit]** — Color Fill Reveal: mâu thuẫn "tùy chọn" (FR-14) vs bắt buộc (UJ-1, §6.1) (§FR-14)
Fix: Chọn một hướng nhất quán.

**[Adversarial]** — Thiếu data retention / cleanup strategy cho disk management (§4.6)
Batch 50 video/ngày → ~30GB/tháng trên laptop 256GB.
Fix: Thêm NFR cho disk monitoring và auto-archive.

**[Adversarial]** — SM-8 Completion Rate không actionable ở MVP (§SM-8)
Fix: Reclassify là "Hypothesis to validate post-launch"; thêm proxy metric tự đo.

## Mechanical notes
- **Glossary drift:** "Chalk Pivot" (§3) vs "ChalkPivot" (§11 Entity Model) — casing không nhất quán.
- **ID convention:** FR-13b, FR-13c dùng sub-numbering khác convention chính (FR-N integer).
- **Assumptions roundtrip:** SM-8 gắn "(Giả định nội dung)" nhưng không có entry trong Assumptions Index.
- **Cross-ref path lỗi:** §0 link `addendum.md` trỏ tới path có "My Folder" — có thể sai trên workspace hiện tại.
- **UJ naming:** Nhất quán — 3 UJs đều dùng Huy.

## Reviewer files
- `review-rubric.md`
- `review-adversarial.md`
