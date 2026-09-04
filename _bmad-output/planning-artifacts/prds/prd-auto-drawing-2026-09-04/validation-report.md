# Validation Report — Drawing Transformation Video Factory

- **PRD:** `_0TaiLieu/Product Requirements Document — Drawing Transformation Video Factory.md`
- **Rubric:** `.agents/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Run at:** 2026-09-04T16:33:46+07:00
- **Grade:** Fair

## Overall verdict

Bản PRD thể hiện tư duy kiến trúc sắc sảo: xác định đúng đơn vị nguyên tử là "Transformation", thiết lập nguyên lý "Deterministic Drawing" để chặn ảo giác AI, và phân tầng lộ trình Release R0–R4 khoa học. Tuy nhiên, bản PRD được xếp loại **Fair** do vướng 2 phát hiện Chí mạng (Critical) và 5 phát hiện mức Cao (High): nút thắt tạo lập dữ liệu thủ công cho Drawing Registry làm vô hiệu hóa lời hứa "nhà máy tự động"; mâu thuẫn độ dài giữa âm thanh và nét vẽ tạo ra Dead Air phá vỡ retention; và thiếu tiêu chuẩn nghiệm thu định lượng cho thuật toán bám nét bút và điều hòa nhịp độ video.

Bản phản biện Adversarial bổ sung: nếu không có giải pháp bán tự động hóa nhập liệu Registry và cơ chế tạo biến thiên (Diversification) tránh thuật toán quét Spam của TikTok/Shorts, hệ thống sẽ trở thành cỗ máy render cô lập không tạo được giá trị thương mại.

## Dimension verdicts

| Chiều kích | Đánh giá |
|---|:---:|
| 1. Decision-readiness | adequate |
| 2. Substance over theater | adequate |
| 3. Strategic coherence | **strong** |
| 4. Done-ness clarity | thin |
| 5. Scope honesty | adequate |
| 6. Downstream usability | thin |
| 7. Shape fit | **strong** |

---

## Findings by severity

### Critical (2)

**[Adversarial — § FR-004, § 26 Decision 4]** — The Lego Myth: Cỗ máy tự động bị chặn bởi khâu vẽ tay component vào Registry  
Decision 4 cấm LLM sinh SVG tùy tiện và bắt buộc lắp ráp từ Registry. Nhưng nếu mọi component phải vẽ tay và bóc tách từng nét bằng Illustrator/Inkscape, đây không phải nhà máy tự động mà là xưởng may thủ công dùng máy khâu tự động. Khi Registry chỉ có vài chục mẫu, batch 50–100 video tạo ra nội dung lặp lại nhàm chán.  
*Fix:* Định nghĩa ngay trong PRD một **Registry Ingestion Pipeline** bán tự động (tự động tách stroke, bounding box, gán metadata từ SVG/ảnh có sẵn) hoặc chỉ rõ Authoring Tool dành cho operator.

---

**[Adversarial — § FR-003, FR-008, § 15 Q5]** — Mâu thuẫn thời lượng Voice vs. Nét vẽ gây Dead Air  
Câu thoại "Thêm hai cái tai" mất ~1.1s, nhưng vẽ 2 đường cong elip mượt tự nhiên mất ~3.5s. Không có thuật toán Pacing Orchestration, dẫn đến 2.4s dead air trong short-form video. Trong môi trường TikTok/Reels, 1 giây im lặng là người xem lướt đi ngay.  
*Fix:* Quy định Pacing Engine: tự động chèn SFX bút vẽ / nhạc nền lấp khoảng trống, hoặc co giãn tốc độ vẽ để dòng chảy âm thanh liên tục, dead air không vượt quá 0.5s.

---

### High (5)

**[Decision-readiness — § FR-003, FR-008, § 26]** — Thiếu quyết định về Audio-Visual Timing Master  
*Fix:* Bổ sung quyết định rõ: "Video timeline lấy TTS audio duration làm mốc tham chiếu chính (Audio-driven) và co giãn tốc độ vẽ nét tương ứng."

---

**[Done-ness clarity — § FR-006]** — Chưa định nghĩa tiêu chuẩn nghiệm thu cho Pen Tip Tracking  
*Fix:* Acceptance Criteria: Đầu bút bám path với độ lệch ≤ 5px; pen-up transition hiển thị chuyển động nhấc bút tự nhiên 0.2s–0.4s.

---

**[Done-ness clarity — § FR-011]** — Thiếu quy tắc Auto-pacing khi thời lượng vượt ngưỡng  
*Fix:* "Nếu tổng thời gian vẽ tự nhiên > 25s, renderer áp dụng hệ số tăng tốc 1.2x–1.8x cho nét phụ để tổng video ≤ 30s."

---

**[Adversarial — § FR-013, § 18]** — Batch 100 video cùng cấu trúc kích hoạt thuật toán quét Spam  
*Fix:* Bổ sung **Video Diversification Engine**: biến thiên ngẫu nhiên có kiểm soát về texture/màu nền, độ nghiêng canvas, màu mực, pitch giọng TTS, nhạc nền bản quyền.

---

**[Adversarial — § 8, § 22]** — Non-Goal cấm tô màu đối nghịch với mục tiêu Affiliate  
*Fix:* Nới lỏng Non-Goal: cho phép **Color Fill Reveal** đơn giản (fill màu phẳng SVG trong ~1 giây trước CTA) để tăng tính thẩm mỹ bức tranh hoàn thiện và tỷ lệ chuyển đổi affiliate.

---

### Medium (6)

**[Decision-readiness — § FR-004, § 20]** — Chưa xác định quy mô khởi tạo Registry cho MVP  
*Fix:* Registry MVP tối thiểu: 10 hooks (số 0–9) + 20 subject components hoàn chỉnh.

**[Substance over theater — § 14 NFR-001, NFR-004]** — NFR thiếu ngưỡng định lượng  
*Fix:* Chi phí API ≤ 0.05$/video, thời gian render ≤ 45s/video 1080p 30fps, tỷ lệ thành công ≥ 95%.

**[Substance over theater — § 17]** — Transformation Scoring thiếu cơ chế thực thi  
*Fix:* Chấm điểm bằng LLM Validator, thang 1–5, chỉ concept ≥ 18/25 mới vào queue vẽ.

**[Strategic coherence — § 19]** — Thiếu Counter-metrics kiềm chế tối ưu số lượng  
*Fix:* Bổ sung: Tỷ lệ video bị ẩn/báo cáo, tỷ lệ concept hủy ở preview, giới hạn video đăng tải an toàn mỗi kênh/ngày.

**[Done-ness clarity — § FR-005, FR-013]** — Thiếu hành vi phục hồi Batch khi Validation thất bại  
*Fix:* Ghi log mã lỗi vào metadata, đánh dấu 'failed_validation', tiếp tục batch mà không crash.

**[Downstream usability — § 1–30]** — Thiếu Glossary và Entity Model tối thiểu  
*Fix:* Bổ sung Glossary định nghĩa Transformation / Hook / Primitive / Component / DrawingStep; sơ đồ thực thể Concept 1-N Transformation 1-N DrawingStep N-1 Component.

---

### Low (2)

**[Scope honesty]** — Chưa lập Assumptions Index  
*Fix:* Gắn nhãn `[ASSUMPTION]` trên các giả định kỹ thuật lớn (chất lượng TTS tiếng Việt, chi phí render local, khả năng tách stroke từ SVG).

**[Downstream usability — § 11, § 12]** — User Journey thiếu named protagonist  
*Fix:* Đặt tên cụ thể: "Huy — solo affiliate content creator."

---

## Mechanical notes
- FR-001 đến FR-017: liền mạch, không trùng lặp hay bỏ sót.
- NFR-001 đến NFR-005: nhất quán.
- § 17 có đoạn meta-commentary lọt vào body ("Đây là điểm tôi sửa so với PRD cũ...") — nên chuyển vào changelog hoặc xóa.
- Chưa có Assumptions Index và Open Questions Index tập trung.

## Reviewer files
- `review-rubric.md`
- `review-adversarial.md`
