# Validation Report — Drawing Transformation Video Factory

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-auto-drawing-2026-09-04-v2/prd.md`
- **Rubric:** `.agents/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Run at:** 2026-09-04T17:28:00+07:00
- **Grade:** Good

## Overall verdict
Bản PRD đạt chất lượng rất cao (**Strong trên cả 7 chiều kích của Rubric**), thể hiện sự thấu hiểu sâu sắc bài toán kinh doanh và kỹ thuật của một hệ thống Content Factory nội bộ. Mọi quyết định kiến trúc then chốt (Local-first, 100% MIT, chống Dead Air bằng Pacing Engine, giải quyết nút thắt dữ liệu bằng DSL + Semi-auto SVG Ingestion) đều được định hình rõ ràng, có tiêu chuẩn nghiệm thu định lượng và liên kết trực tiếp với các chỉ số đo lường hiệu quả.

Bản phản biện Adversarial bổ sung 1 cảnh báo mức Cao (High) về việc cần kiểm soát chặt chẽ số luồng render song song (Concurrency Semaphore) để tránh nguy cơ tràn bộ nhớ RAM (đỉnh tải 4GB) trên máy cá nhân của operator.

## Dimension verdicts
- Decision-readiness — **strong**
- Substance over theater — **strong**
- Strategic coherence — **strong**
- Done-ness clarity — **strong**
- Scope honesty — **strong**
- Downstream usability — **strong**
- Shape fit — **strong**

---

## Findings by severity

### Critical (0)
*Không có phát hiện mức Critical.*

---

### High (1)

**[Adversarial Reviewer]** — Nguy cơ tràn RAM khi Render Concurrency không có giới hạn ngặt nghèo (§ 4.6 FR-17, § 8 NFR-3)  
Bản PRD đặt mục tiêu render 50–100 video trong batch trên máy trạm cá nhân và đặt trần RAM ≤ 4GB. Tuy nhiên, nếu dùng Chromium headless hoặc Motion Canvas worker đa luồng theo số nhân CPU (ví dụ máy 8 core mở 8 luồng render), mỗi instance headless browser có thể ngốn từ 600MB đến 1GB RAM, dễ dàng dẫn tới đỉnh tải (peak memory) 6–8GB gây treo máy hoặc tràn swap disk.  
*Fix:* Bổ sung quy định rõ ràng trong FR-17: "Hệ thống SHALL sử dụng Semaphore / Worker Pool khống chế số luồng render đồng thời (mặc định tối đa 2 worker đồng thời trên máy 16GB RAM) để đảm bảo tổng RAM không bao giờ vượt quá 4GB."

---

### Medium (1)

**[Adversarial Reviewer]** — Rủi ro phát âm sai tên riêng / từ mượn ngoại lai của TTS viPiper (§ 4.4 FR-10)  
viPiper được huấn luyện tối ưu cho tiếng Việt thuần. Khi kịch bản chứa các từ tiếng Anh (như "Bear", "Cat", "Dolphin") hoặc các từ mượn, mô hình TTS offline có thể đọc ngọng hoặc ngắt quãng kỳ quặc, làm giảm cảm giác chuyên nghiệp của video short-form.  
*Fix:* Bổ sung cơ chế Custom Pronunciation Dictionary (Từ điển phiên âm) vào Registry hoặc pipeline TTS: cho phép map tự động từ tiếng Anh sang phiên âm tiếng Việt gần đúng (ví dụ: Bear $\to$ con gấu, Cat $\to$ con mèo) trước khi đưa vào synthesis.

---

### Low (2)

**[Rubric Validator]** — Chuẩn hóa mức giảm âm lượng (Audio Ducking) (§ 4.4 FR-12)  
FR-12 yêu cầu tự động ducking nhạc nền khi có giọng đọc nhưng chưa chỉ định mức giảm cụ thể (ví dụ: giảm -12dB đến -18dB).  
*Fix:* Bổ sung ngưỡng decibel cụ thể vào Consequences của FR-12.

**[Adversarial Reviewer]** — Rủi ro font tiếng Việt bị lỗi dấu khi hiển thị CTA trên các nền tảng khác nhau (§ 4.5 FR-15)  
FFmpeg khi vẽ text tiếng Việt có dấu thường xuyên gặp lỗi hiển thị ô vuông nếu font không được đóng gói trực tiếp vào asset của project.  
*Fix:* Đóng gói sẵn ít nhất 3 font chữ Unicode mã nguồn mở (như Be Vietnam Pro, Montserrat) vào thư mục asset của Registry.

---

## Mechanical notes
- Danh mục FR-1 đến FR-20: Đầy đủ, liền mạch, không trùng lặp.
- Các liên kết thuật ngữ Glossary đồng nhất 100% trong toàn bộ các phần.
- 5 mục giả định trong Assumptions Index đều khớp chính xác với các nhãn `[ASSUMPTION]` trong nội dung tài liệu.

## Reviewer files
- `review-rubric.md`
- `review-adversarial.md`
