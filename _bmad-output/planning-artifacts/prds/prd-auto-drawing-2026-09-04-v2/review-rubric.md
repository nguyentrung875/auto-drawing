# PRD Quality Review — Drawing Transformation Video Factory

## Overall verdict

PRD v2 là một tài liệu chất lượng cao với thesis rõ ràng, FRs có testable consequences chi tiết, và Entity Model cụ thể — một bước tiến lớn so với phần lớn các PRD cùng cấp. Tuy nhiên, vẫn tồn tại một số khoảng trống đáng chú ý: (1) thiếu hoàn toàn phần xử lý lỗi và fallback behavior ở tầng LLM DSL generation — nếu LLM liên tục sinh DSL lỗi sau 3 retry thì UJ-3 bị đứng mà PRD không nói gì; (2) một số ngưỡng hiệu năng quan trọng (≤ 45s/video trên CPU 8-core) không có baseline đo lường cũng không có definition cụ thể "máy trạm thông thường" là gì; (3) Color Fill Reveal được mô tả là "tùy chọn" (§FR-14) nhưng đồng thời xuất hiện trong MVP Scope (§6.1) và UJ-1 path như bước bắt buộc — mâu thuẫn này sẽ gây nhầm lẫn cho team architecture/UX.

## Decision-readiness — adequate

PRD xác lập rõ ràng các quyết định cốt lõi: chọn 2D Hand Asset thay vì 3D mesh (Non-Goals §5, Addendum §4.2), Local-first thay vì Cloud API, Drawing DSL thay vì sinh SVG thô. Mỗi quyết định kèm lý do loại bỏ phương án thay thế (Addendum §3). Open Questions (§9) thật sự mở — không có câu trả lời ẩn ngay câu tiếp theo. Assumptions Index (§10) có kế hoạch kiểm chứng cụ thể.

Tuy nhiên, một vài trade-off quan trọng bị smoothed: việc ép LLM chỉ sinh DSL thay vì SVG bỏ qua câu hỏi LLM có đủ khả năng reasoning không gian 2D để sinh geometry chính xác hay không — đây là rủi ro cốt lõi cho UJ-3 mà chỉ được đề cập nhẹ ở A-02 (SVG ingestion order) chứ không phải ở LLM DSL quality.

### Findings
- **[high]** Trade-off bị nuốt: LLM spatial reasoning cho DSL Generation (§FR-2, §UJ-3) — PRD giả định ngầm rằng LLM đủ khả năng sinh tọa độ hình học chính xác qua prompt, nhưng không có assumption tag nào, không có kế hoạch kiểm chứng, và không đề cập fallback nếu LLM liên tục sinh geometry sai về mặt thẩm mỹ (hợp schema nhưng xấu). *Fix:* Thêm `[ASSUMPTION] A-07` cho khả năng LLM reasoning hình học, kèm kế hoạch kiểm chứng (render 20 concept từ 3 LLM khác nhau, đánh giá tỷ lệ output đạt chuẩn thẩm mỹ).
- **[medium]** Open Question §9.4 quá kỹ thuật cho PRD — "Cần hệ số suy giảm bao nhiêu" là câu hỏi implementation, không phải product decision. *Fix:* Rephrase thành "Thuật toán làm mịn góc xoay cần đạt chất lượng nào để người xem không nhận ra sự cứng nhắc?" và dời chi tiết damping factor sang architecture doc.

## Substance over theater — strong

PRD này earned its content. Vision (§1) cụ thể tới mức nêu công thức chuyển đổi cảm xúc (Tò mò → Bất ngờ → Hành động), không thể swap vào PRD khác. Glossary (§3) chi tiết, mỗi term phục vụ ít nhất một FR. User Journeys (§2.3) có protagonist có tên (Huy) với edge case thực tế (Canvas Bounds violation ở UJ-1). Không có persona theater — chỉ 1 persona (Huy), phù hợp solo-operator tool.

NFRs (§8) có ngưỡng cụ thể: 45s/video, 4GB RAM, 0% crash rate. Không có boilerplate "scalable/secure/reliable". Entity Model (§11) là chi tiết thực tế, không phải furniture.

### Findings
- **[low]** UJ-2 climax nêu "35 phút" cho 46 video — con số này có cơ sở tính toán nào không? Nếu SM-4 đặt ≤ 45s/video thì 46 video mất tối thiểu ~35 phút là hợp lý, nhưng UJ claim "35 phút" như sự thật mà không liên kết với SM-4. *Fix:* Ghi chú "(dựa trên mục tiêu SM-4: ≤ 45s/video)".

## Strategic coherence — strong

PRD có thesis rõ ràng: **zero marginal cost content factory cho solo affiliate operator**. Mọi feature phục vụ thesis này: Local-first (chi phí 0), batch pipeline (quy mô), Diversification Engine (chống shadowban để bảo toàn kênh phân phối). Success Metrics (§7) validate thesis: SM-5 (Zero API Cost) là metric chiến lược, không phải metric hoạt động. Counter-metrics (SM-C1 shadowban, SM-C2 reject rate) kiềm chế đúng rủi ro batch-at-scale.

MVP scope kind: problem-solving (xóa nút thắt nhân lực) + revenue enabler (affiliate). Scope logic nhất quán — không có feature thừa không phục vụ thesis.

### Findings
- Không có finding. Chiều này strong.

## Done-ness clarity — adequate

Phần lớn FRs có testable consequences rất tốt: FR-13 nêu ≤ 5px deviation, ±35° clamping, 0.2s–0.4s lift time. FR-11 nêu dead air ≤ 0.5s, speed scaling max 2x. FR-16 nêu 15–30s duration, auto-accelerate 1.2x–1.8x.

Tuy nhiên một số FRs kém rõ ràng hơn:

### Findings
- **[high]** FR-5 Scoring: 5 tiêu chí chấm điểm được đặt tên nhưng không có rubric cho từng tiêu chí (§4.2). Mỗi tiêu chí chiếm bao nhiêu điểm? Tất cả 5 đều 5 điểm tối đa? Ai chấm — LLM hay rule-based? Nếu LLM, output format nào? Engineer đọc FR-5 sẽ không biết "done" trông như thế nào cho bộ chấm điểm. *Fix:* Thêm bảng trọng số từng tiêu chí, nêu rõ ai/cái gì chấm (LLM prompt + schema output → rule-based threshold), và ít nhất 1 ví dụ concept đạt/không đạt.
- **[medium]** FR-14 Color Fill: "đổ màu phẳng lên các mảng kín" — định nghĩa "mảng kín" (closed region) thế nào khi geometry từ DSL có thể không tạo closed path hoàn hảo? Bước phát hiện closed region là rule gì? *Fix:* Bổ sung consequence: "Hệ thống tự động phát hiện closed regions bằng [thuật toán X]; nếu không tìm thấy mảng kín, bỏ qua Color Fill và ghi log warning."
- **[medium]** FR-19 Quality Gate: "Không có video hỏng nào bị gắn nhãn thành công giả (False Positive)" — đây là aspirational, không testable. Cần nêu cụ thể quality gate checks gồm những gì (pen tracking deviation? dead air scan? audio sync tolerance?). *Fix:* Liệt kê ≥ 5 automated checks cụ thể mà Quality Gate phải pass.

## Scope honesty — strong

Non-Goals (§5) làm việc thật sự — mỗi mục loại bỏ một phương hướng cụ thể với lý do rõ ràng (3D hand, AI video gen, full video editor, auto-upload, multi-tenant). Assumptions (§10) có 6 entries với risk level và verification plan. Out of Scope (§6.2) nêu rõ phase dời.

### Findings
- **[medium]** Thiếu Assumption cho Motion Canvas render capability — PRD commit vào Motion Canvas (Addendum §1) nhưng không có `[ASSUMPTION]` tag cho khả năng Motion Canvas render headless 1080×1920 30fps mà không cần browser GUI. A-03 chỉ nói "Motion Canvas / headless canvas" rất chung chung. *Fix:* Tách riêng assumption cho Motion Canvas headless rendering vs generic canvas, vì đây là dependency cốt lõi.
- **[low]** FR-6 Deterministic Seed: "cấu trúc Drawing Step, độ dài timeline và tham số biến thiên giống nhau 100%" — nhưng video pixel-level có giống nhau không? Hay chỉ logic-level determinism? Nếu font rendering hoặc anti-aliasing khác nhau giữa 2 máy thì pixel-level sẽ khác. *Fix:* Clarify: "Deterministic ở tầng logic (JSON structure, timeline, parameters), không yêu cầu pixel-perfect trên các hệ điều hành/GPU khác nhau."

## Downstream usability — strong

Glossary (§3) chi tiết 25+ terms, được sử dụng nhất quán trong FRs. FR IDs contiguous (FR-1 → FR-20, FR-13b/13c dùng sub-numbering hợp lý). UJs có protagonist Huy xuyên suốt. Entity Model (§11) cho phép architecture team source-extract trực tiếp. Cross-references giữa SM và FR được ghi rõ "(Xác thực FR-X)".

### Findings
- **[low]** SM-8 "Short-form Completion Rate Hypothesis" gắn tag "(Giả định nội dung)" nhưng không có entry tương ứng trong Assumptions Index (§10). *Fix:* Thêm A-07 hoặc ghi rõ SM-8 là hypothesis metric không cần assumption tag.

## Shape fit — adequate

PRD đúng hình dáng cho internal factory tool / solo operator: capability-spec driven, UJs focused vào workflow operator thay vì end-user, SMs đo operational efficiency. Tuy nhiên, mức độ formalization hơi cao cho một solo-operator hobby/internal tool — 20 FRs, 3 UJs, Entity Model chi tiết. Điều này không sai (stakes cao hơn hobby vì mục tiêu affiliate revenue), nhưng cần cân nhắc:

### Findings
- **[medium]** FR-13 bị chia quá nhỏ (FR-13, FR-13b, FR-13c) — 3 sub-FRs cho Hand Engine controller khi đây vốn là 1 feature coherent. Downstream story creation sẽ khó cắt stories từ 3 sub-FRs này vì chúng phụ thuộc lẫn nhau hoàn toàn. *Fix:* Merge FR-13/13b/13c thành 1 FR duy nhất với 3 nhóm consequences, hoặc giữ nguyên nhưng ghi rõ "FR-13, 13b, 13c là một đơn vị triển khai không tách rời."
- **[low]** Mâu thuẫn Color Fill Reveal: FR-14 nói "tính năng tùy chọn" nhưng UJ-1 step 4 mô tả như bước bắt buộc trong flow, và MVP Scope (§6.1) liệt kê trong In Scope. *Fix:* Chọn một: hoặc bỏ "tùy chọn" trong FR-14, hoặc ghi rõ trong UJ-1 rằng Color Fill có thể bị skip.

## Mechanical notes

- **Glossary drift nhẹ:** "Chalk Pivot" (§3) vs "ChalkPivot" (Entity Model §11 — `ChalkPivot: Point(x, y)`) — cần thống nhất casing.
- **ID continuity:** FR-1 → FR-20 liên tục, nhưng FR-13b và FR-13c dùng sub-numbering khác với convention chính (FR-N integer). Không gây lỗi nhưng không nhất quán.
- **Assumptions Index roundtrip:** 6 entries (A-01 → A-06) đều xuất hiện inline. Tuy nhiên, SM-8 gắn "(Giả định nội dung)" mà không có entry trong Assumptions Index — xem finding ở Downstream usability.
- **Cross-ref path lỗi trong §0:** Link `addendum.md` trỏ tới `/d:/My%20Folder/source_code/auto-drawing/...` — path có "My Folder" có thể không chính xác trên workspace hiện tại. Cần sửa thành path tương đối hoặc path chính xác.
- **UJ protagonist naming:** Nhất quán — 3 UJs đều dùng Huy làm protagonist.
