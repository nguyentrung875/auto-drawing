# PRD Adversarial Review — Drawing Transformation Video Factory

**Run at:** 2026-09-04T16:33:46+07:00

## Overall verdict
Bản PRD có kiến trúc tư duy sắc bén nhưng né tránh 4 điểm tử huyệt thực tế: **(1) Nút thắt con gà – quả trứng của Drawing Registry, (2) Bẫy "khoảng lặng chết người" (Dead Air) khi đồng bộ tiếng và nét vẽ, (3) Rủi ro bị nền tảng quét Spam khi xả hàng loạt video cùng khuôn mẫu, (4) Giả định lạc quan về sức hút thương mại của nét vẽ đơn sắc với kênh affiliate.** Nếu không xử lý các nút thắt này ngay trong đặc tả, dự án sẽ tạo ra một cỗ máy render hoàn hảo kỹ thuật nhưng không tạo ra được giá trị thương mại.

---

## Findings

### 1. Nút thắt Registry: "Nhà máy tự động" nhưng tài sản phải vẽ tay
- **[critical]** The Lego Myth — Tự động hóa bị chặn bởi khâu vẽ tay component vào Registry (§ FR-004, § 26 Decision 4)
  - *Phân tích:* Decision 4 cấm LLM tự sinh SVG tùy tiện, chỉ cho phép lắp ráp component từ Registry. Nhưng ai tạo ra các component đó? Một "8 → Bear" cần nét tai, mắt, mũi, miệng được bóc tách thành tọa độ path, thứ tự nét, đường cong Bezier khép kín. Nếu phải vẽ tay và bóc tách từng nét bằng Illustrator/Inkscape, đây không phải nhà máy tự động mà là xưởng may thủ công dùng máy khâu tự động. Khi Registry chỉ có vài chục mẫu, batch 50–100 video sẽ tạo ra nội dung lặp lại và nhàm chán.
  - *Fix:* Định nghĩa ngay trong PRD một **Registry Ingestion Pipeline**: quy trình bán tự động chuyển SVG/ảnh có sẵn thành Drawing Component chuẩn hóa (tự động tách stroke, tính bounding box, gán metadata) hoặc chỉ rõ Authoring Tool dành cho operator.

### 2. Dead Air — Khoảng lặng chết người phá vỡ retention short-form
- **[critical]** Mâu thuẫn thời lượng Voice vs. Nét vẽ không có cơ chế điều phối (§ FR-003, FR-008, § 15 Q5)
  - *Phân tích:* Trong video ngắn (TikTok/Reels), 1 giây im lặng là người xem lướt đi ngay. Câu thoại "Thêm hai cái tai" mất ~1.1s để phát xong, nhưng vẽ 2 đường cong elip mượt mà tự nhiên có thể mất 3.5s. Nếu vẽ xong trong 1.1s thì nét giật cục, nếu để tự nhiên 3.5s thì 2.4s dead air. PRD chỉ nói "voiceover SHALL liên kết với drawing steps" mà không có thuật toán Pacing Orchestration.
  - *Fix:* Quy định rõ: Hệ thống phải chèn tự động hiệu ứng âm thanh phụ (SFX bút vẽ, nhạc nền lấp khoảng trống) hoặc tự động co giãn pause giữa các nét để dòng chảy âm thanh liên tục, không có dead air > 0.5s.

### 3. Rủi ro Spam / Unoriginal Content
- **[high]** Batch 100 video cùng cấu trúc kích hoạt thuật toán quét Spam của TikTok/Shorts (§ FR-013, § 18)
  - *Phân tích:* 100 video/ngày với cùng nền trắng, cùng giọng TTS, cùng cấu trúc hook–vẽ–reveal–CTA sẽ bị AI của TikTok/YouTube Shorts đánh dấu "Low-effort / Repetitive / Automated Content", dẫn đến shadowban toàn kênh và chỉ số về lượt xem, affiliate rớt về 0.
  - *Fix:* Bổ sung yêu cầu **Video Diversification Engine**: mỗi video trong batch phải có biến thiên ngẫu nhiên có kiểm soát về texture/màu nền giấy, độ nghiêng canvas, màu mực nét vẽ, pitch/speed giọng đọc TTS, nhạc nền từ thư viện bản quyền.

### 4. Affiliate Conversion — Nét đen trắng khó kích thích mua hàng
- **[high]** Non-Goal cấm tô màu đối nghịch với mục tiêu Affiliate (§ 8, § 22)
  - *Phân tích:* PRD loại bỏ "sophisticated color painting" khỏi MVP. Tuy nhiên, video dạy vẽ động vật bán bút màu, tập vẽ trên TikTok Shop chỉ chốt đơn tốt khi bức tranh hoàn thiện có màu sắc bắt mắt. Bức gấu chỉ gồm nét đen nguệch ngoạc trên nền trắng rất khó tạo động lực "mua ngay bộ bút này."
  - *Fix:* Nới lỏng Non-Goal: Cho phép **Color Fill Reveal** đơn giản ở bước cuối (sau khi vẽ xong, tự động fill màu phẳng — flat color — bằng SVG `fill` trong ~1 giây trước CTA). Không cần animation tô màu phức tạp, chỉ cần snapshot màu phẳng để tăng tính thẩm mỹ của bức tranh hoàn thiện.

### 5. Chi phí và License Stack
- **[medium]** Rủi ro bản quyền thương mại và chi phí render tiềm ẩn (§ 24, § 14 NFR-004)
  - *Phân tích:* `tools.md` đề xuất Remotion (Company License đắt nếu vượt ngưỡng doanh thu hoặc deploy cloud thương mại) và ElevenLabs/Piper (TTS chất lượng cao tốn phí lớn khi batch hàng trăm video). Nếu dùng Motion Canvas (MIT) + viPiper (MIT), chất lượng có đủ chuẩn thương mại không?
  - *Fix:* PRD nên ghi rõ: "Toàn bộ stack MVP phải ưu tiên giấy phép MIT/Apache 2.0 và chạy local hoàn toàn để chi phí sinh video ≈ 0 trước khi cân nhắc API trả phí."
