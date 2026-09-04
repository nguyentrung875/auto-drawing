# Adversarial Quality Review — Drawing Transformation Video Factory

## Gate Verdict
Bản PRD được thiết kế rất chặt chẽ và phòng thủ tốt trước các cạm bẫy thường gặp của AI (như ảo giác hình học hay trôi dạt ngòi bút); tuy nhiên dưới góc nhìn vận hành thực chiến tàn nhẫn, hệ thống vẫn tiềm ẩn 2 điểm nghẽn về tài nguyên máy trạm khi render hàng loạt và rủi ro phát âm từ ngoại lai của engine TTS tiếng Việt.

---

## Top Findings

### 1. [High] Nguy cơ tràn RAM khi Render Concurrency không có giới hạn ngặt nghèo
- **Vị trí:** § 4.6 FR-17 (Batch Generation Pipeline), § 8 NFR-3 (Cost & Performance).
- **Phân tích rủi ro:** Bản PRD đặt mục tiêu render 50–100 video trong batch trên máy trạm cá nhân và đặt trần RAM ≤ 4GB. Tuy nhiên, nếu dùng Chromium headless hoặc Motion Canvas worker đa luồng theo số nhân CPU (ví dụ máy 8 core mở 8 luồng render), mỗi instance headless browser có thể ngốn từ 600MB đến 1GB RAM, dễ dàng dẫn tới đỉnh tải (peak memory) 6–8GB gây treo máy hoặc tràn swap disk.
- **Biện pháp khắc phục (Fix):** Bổ sung quy định rõ ràng trong FR-17: "Hệ thống SHALL sử dụng Semaphore / Worker Pool khống chế số luồng render đồng thời (mặc định tối đa 2 worker đồng thời trên máy 16GB RAM) để đảm bảo tổng RAM không bao giờ vượt quá 4GB."

---

### 2. [Medium] Rủi ro phát âm sai tên riêng / từ mượn ngoại lai của TTS viPiper
- **Vị trí:** § 4.4 FR-10 (Vietnamese Voiceover).
- **Phân tích rủi ro:** viPiper được huấn luyện tối ưu cho tiếng Việt thuần. Khi kịch bản chứa các từ tiếng Anh (như "Bear", "Cat", "Dolphin") hoặc các từ mượn, mô hình TTS offline có thể đọc ngọng hoặc ngắt quãng kỳ quặc, làm giảm cảm giác chuyên nghiệp của video short-form.
- **Biện pháp khắc phục (Fix):** Bổ sung cơ chế **Custom Pronunciation Dictionary (Từ điển phiên âm)** vào Registry hoặc pipeline TTS: cho phép map tự động từ tiếng Anh sang phiên âm tiếng Việt gần đúng (ví dụ: `Bear` $\to$ `con gấu`, `Cat` $\to$ `con mèo`, hoặc phiên âm bồi `be-ơ`) trước khi đưa vào synthesis.

---

### 3. [Low] Rủi ro font tiếng Việt bị lỗi dấu khi hiển thị CTA trên các nền tảng khác nhau
- **Vị trí:** § 4.5 FR-15 (Configurable CTA & Video Composition).
- **Phân tích rủi ro:** FFmpeg khi vẽ text (drawtext filter) tiếng Việt có dấu thường xuyên gặp lỗi hiển thị ô vuông nếu font không được đóng gói (bundle) trực tiếp vào asset của project.
- **Biện pháp khắc phục (Fix):** Đóng gói sẵn ít nhất 3 font chữ Unicode mã nguồn mở (như Be Vietnam Pro, Montserrat) vào thư mục asset của Registry và cố định đường dẫn font trong lệnh FFmpeg.

---

## Tổng kết số lượng phát hiện
- **Critical:** 0
- **High:** 1
- **Medium:** 1
- **Low:** 1
