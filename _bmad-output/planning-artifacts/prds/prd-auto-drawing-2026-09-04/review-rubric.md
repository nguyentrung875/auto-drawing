# PRD Quality Review — Drawing Transformation Video Factory

**Run at:** 2026-09-04T16:33:46+07:00

## Overall verdict
Bản PRD thể hiện tư duy sản phẩm xuất sắc về mặt kiến trúc: xác định đúng đơn vị nguyên tử là "Transformation" chứ không phải video, kiên định với nguyên tắc "Deterministic Drawing" để triệt tiêu ảo giác AI, và phân định ranh giới rành mạch giữa Product và Tech Stack. Tuy nhiên, PRD xếp loại **Fair** do thiếu các tiêu chuẩn nghiệm thu định lượng (Done-ness) cho cơ chế đồng bộ âm thanh–nét vẽ, các NFR chưa có ngưỡng kỹ thuật cụ thể, và chưa giải quyết nút thắt cốt lõi là quy trình tạo lập và quản lý dữ liệu Registry.

---

## Decision-readiness — adequate

PRD đưa ra 4 quyết định nền tảng (§ 26) rất dứt khoát và có lý:
1. Drawing phải mang tính xác định (Deterministic) — không để AI can thiệp ngẫu nhiên vào pixel khi render.
2. Transformation là primitive gốc; video chỉ là một projection.
3. Tách rời hoàn toàn đặc tả logic khỏi công nghệ render (§ 24).
4. Registry đi trước Generative Freedom để kiểm soát hình học đầu ra.

Tuy nhiên, tính sẵn sàng hành động bị giảm ở 2 điểm:
- **Đồng bộ Âm thanh & Nét vẽ (§ FR-003, FR-008):** Không có quyết định rõ về "ai làm chủ timeline" — Audio-driven hay Animation-driven. Khi câu thoại ngắn (1.2s) mà nét vẽ dài (3.5s), hệ thống sẽ xử lý thế nào?
- **Quy mô khởi tạo Registry (§ FR-004):** PRD chọn Registry nhưng né tránh quyết định về cách nhập liệu (thủ công, bán tự động, Authoring Tool) và quy mô tối thiểu cần thiết.

### Findings
- **[high]** Thiếu quyết định kiến trúc về Audio-Visual Timing Master (§ FR-003, FR-008, § 26) — Voiceover phải khớp với step vẽ nhưng không định nghĩa ai làm chủ timeline. *Fix:* Bổ sung: "Video timeline lấy TTS audio duration làm mốc tham chiếu chính (Audio-driven) và co giãn tốc độ vẽ nét tương ứng."
- **[medium]** Chưa xác định cơ chế và quy mô khởi tạo Registry cho MVP (§ FR-004, § 20) — Cần bao nhiêu component để đạt 20 transformation? *Fix:* Thêm phạm vi rõ: Registry MVP gồm tối thiểu 10 hooks (số 0–9) và 20 subject components hoàn chỉnh.

---

## Substance over theater — adequate

PRD tránh được bẫy sân khấu hóa ở hầu hết các phần:
- Không có persona thừa thãi; chỉ tập trung vào 1 Content Operator / Solo Creator (§ 5).
- Vision (§ 2) và Problem Statement (§ 3) gắn chặt với bài toán giữ chân người xem (Curiosity Loop), không sáo rỗng.
- Non-Goals (§ 8) rất thực chất: từ chối rõ 3D, photorealism, character animation, SaaS platform.

Còn tồn tại "Theater" ở 2 khu vực:
- **NFR Theater (§ 14):** "Pipeline không được tạo video thành công giả", "Hệ thống phải cache các bước tốn chi phí" — không ngưỡng định lượng, không thể kiểm chứng.
- **Transformation Scoring Theater (§ 17):** 5 tiêu chí chấm điểm (Curiosity, Simplicity, Feasibility, Transformation, Retention) không có công thức, thang điểm, hay đơn vị thực thi.

### Findings
- **[medium]** NFR thiếu ngưỡng định lượng kỹ thuật và chi phí (§ 14 NFR-001, NFR-004) — Không thể kiểm chứng. *Fix:* Thêm SLO: Chi phí API ≤ 0.05$/video, thời gian render ≤ 45s/video 1080p 30fps, tỷ lệ thành công ≥ 95%.
- **[medium]** Transformation Scoring thiếu cơ chế thực thi (§ 17) — *Fix:* "Chấm điểm bằng LLM Validator, thang điểm 1–5 theo rubric cố định, lưu vào concept metadata; chỉ concept ≥ 18/25 mới vào queue vẽ."

---

## Strategic coherence — strong

Chiến lược sản phẩm mạch lạc và nhất quán:
- Thesis cốt lõi "Biến nét vẽ từng bước thành động lực tò mò (Curiosity) để tối ưu Retention & Completion Rate" được duy trì xuyên suốt.
- Lộ trình Release R0→R4 (§ 25) sắp xếp đúng triết lý giảm rủi ro: Chứng minh nét vẽ trước → Hoàn thiện nội dung → Tự động hóa AI → Batch → Affiliate.
- Định nghĩa MVP North Star cực kỳ sắc nét (§ 20): "Người xem có thực sự muốn xem loại transformation content này hay không?" — không phải số tính năng.

### Findings
- **[medium]** Thiếu Counter-metrics để kiềm chế tối ưu hóa số lượng (§ 19) — Khi hệ thống tối ưu batch lớn, nguy cơ video spammy và bị nền tảng phạt là thực. *Fix:* Bổ sung Counter-metrics: Tỷ lệ video bị ẩn/bị báo cáo, tỷ lệ concept bị hủy ở khâu preview, giới hạn số video đăng tải an toàn mỗi kênh/ngày.

---

## Done-ness clarity — thin

Đây là điểm yếu lớn nhất. Kỹ sư đọc PRD sẽ gặp nhiều khoảng trống không thể xác định "done":
- **FR-005 (Drawing Validation):** Liệt kê điều kiện từ chối nhưng không mô tả hành vi hệ thống khi gặp lỗi — bỏ qua, cảnh báo, thử lại, hay scale path vào trong canvas?
- **FR-006 & FR-007 (Pen tip = drawing path):** Yêu cầu này cần tiêu chí định lượng: sai số tọa độ tối đa, xử lý pen-up transition giữa các nét không liền mạch.
- **FR-011 (15–30 giây):** Nếu transformation vẽ tự nhiên hết 38 giây thì cắt nét hay tua nhanh? Với tốc độ bao nhiêu?
- **Q1–Q5 (§ 15, Content Quality):** Cả 5 tiêu chí chất lượng nội dung ("Người xem phải nhận diện được hình cuối", "không có cảm giác jump") đều mô tả cảm quan người xem, không có tiêu chí kỹ thuật kiểm chứng tự động được.

### Findings
- **[high]** Chưa định nghĩa tiêu chuẩn nghiệm thu kỹ thuật cho 'Pen Tip Tracking' (§ FR-006) — *Fix:* Bổ sung Acceptance Criteria: Đầu bút bám sát tọa độ path với độ lệch ≤ 5px; pen-up transition hiển thị chuyển động nhấc bút tự nhiên 0.2s–0.4s.
- **[high]** Thiếu quy tắc Auto-pacing khi thời lượng vượt ngưỡng (§ FR-011) — *Fix:* "Nếu tổng thời gian vẽ tự nhiên > 25s, renderer áp dụng hệ số tăng tốc 1.2x–1.8x cho nét phụ để tổng video ≤ 30s."
- **[medium]** Thiếu hành vi phục hồi Batch khi Validation thất bại (§ FR-005, FR-013) — *Fix:* Khi validation thất bại, ghi log mã lỗi vào metadata, đánh dấu status 'failed_validation', tiếp tục xử lý concept tiếp theo mà không crash batch.
- **[medium]** Content Quality Requirements (§ 15) chỉ mô tả cảm quan chủ quan — *Fix:* Bổ sung tiêu chí kỹ thuật: ví dụ "FR-006 Animation Continuity được coi là đạt nếu không có jump frame > 2 frame và không có path teleport > 10px giữa 2 frame liên tiếp."

---

## Scope honesty — adequate

- Non-Goals (§ 8) rất thẳng thắn và thực chất.
- Tách bạch rõ mục tiêu kiểm chứng nhu cầu thị trường vs. mục tiêu tính năng (§ 20).
- Open Questions (§ 28) liệt kê 8 câu hỏi thực sự cần kiểm chứng thực tế — không phải câu hỏi tu từ.

Điểm chưa đủ: Chưa gắn nhãn `[ASSUMPTION]` trên các giả định kỹ thuật ngầm hiểu (TTS chất lượng đủ để giữ chân người xem; SVG path dễ dàng tách stroke thành component; chi phí render local đủ thấp để cho ROI dương).

### Findings
- **[low]** Chưa lập Assumptions Index — *Fix:* Gắn nhãn các giả định lớn như `[ASSUMPTION: viPiper/Piper TTS tiếng Việt đủ biểu cảm để giữ chân người xem short-form]` và theo dõi rủi ro.

---

## Downstream usability — thin

Tốt cho người đọc tổng quan, nhưng còn thiếu cho team Architecture và Dev:
- **Thiếu Glossary:** Các thuật ngữ `Transformation`, `Hook`, `Primitive`, `Component`, `Registry`, `Drawing Sequence`, `Drawing Step`, `Canvas Bounds` dùng đan xen không có định nghĩa chuẩn một chỗ.
- **Thiếu Entity Model tối thiểu:** Mới chỉ có một ví dụ JSON nhỏ ở FR-001. Team Architecture cần biết quan hệ giữa Concept, Transformation, Component, DrawingStep, VideoAsset.
- **User Journey thiếu named protagonist:** § 11, § 12 dùng "User" trừu tượng thay vì nhân vật định danh.

### Findings
- **[medium]** Thiếu Glossary định nghĩa thuật ngữ domain (§ 1–30) — *Fix:* Bổ sung mục Glossary.
- **[medium]** Thiếu Entity Model tối thiểu phục vụ Architecture (§ 10, § 13) — *Fix:* Bổ sung sơ đồ quan hệ Concept 1-N Transformation 1-N DrawingStep N-1 Component.
- **[low]** User Journey thiếu named protagonist (§ 11, § 12) — *Fix:* Đặt tên cụ thể: "Huy — solo affiliate content creator."

---

## Shape fit — strong

- Hoàn toàn phù hợp với dạng "Internal Content Factory".
- Không bị ép vào khuôn SaaS người dùng cuối (không có phần UI quản trị phức tạp, user management, billing, permissions thừa).
- Trọng tâm đúng vào pipeline dữ liệu và pipeline render.
- Release phân tầng R0–R4 cực kỳ phù hợp với quy mô solo/nhóm nhỏ.

---

## Mechanical notes
- FR-001 đến FR-017: liền mạch, không có ID trùng lặp hay bỏ sót.
- NFR-001 đến NFR-005: nhất quán.
- § 17 có đoạn meta-commentary lọt vào body ("Đây là điểm tôi sửa so với PRD cũ...") — nên chuyển vào changelog hoặc xóa để giữ tone tài liệu nhất quán.
- Chưa có Assumptions Index và Open Questions Index tập trung để reviewer cross-check.
