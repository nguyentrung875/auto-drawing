# Adversarial Review — Drawing Transformation Video Factory PRD v2

**Source:** `review-adversarial.md`
**Stance:** Đẩy ngược mọi giả định mà PRD coi là hiển nhiên; tìm blind spots mà team có thể bỏ qua vì quá tập trung vào giải pháp kỹ thuật.

---

## Preamble

PRD này được viết bởi người hiểu sâu bài toán kỹ thuật — nhưng chính sự am tường đó tạo ra blind spots nguy hiểm. Tài liệu thiếu perspective từ phía **nền tảng phân phối** (TikTok/YouTube Shorts algorithm), từ phía **người xem cuối** (viewer retention psychology), và đặc biệt từ phía **rủi ro vận hành thực tế** khi scale từ 1 video demo lên 50 video production/ngày. Dưới đây là các điểm pushback cụ thể.

---

## Findings

### F-ADV-1: "Zero Marginal Cost" là myth khi tính chi phí toàn phần
- **Severity:** high
- **Location:** §1 Vision, §7.1 SM-5, §8 NFR-3
- **Note:** PRD tuyên bố "chi phí tiệm cận 0đ" và SM-5 đặt target "0.00 USD API cost" — nhưng đây chỉ đúng cho chi phí API trực tiếp. Chi phí thực bao gồm: (1) Thời gian operator review 50 video (SM-7 đặt 15 phút — tức ~18 giây/video, liệu đủ để QA nội dung?), (2) Điện năng CPU render liên tục, (3) Chi phí cơ hội — operator dành 15-35 phút render + 15 phút review thay vì tạo nội dung format khác. Vision statement nên honest hơn: "zero *API* cost" thay vì "zero marginal cost".
- **Fix:** Đổi Vision thành "chi phí API bằng 0" và thêm 1 dòng tính toán chi phí toàn phần thực tế cho 50 video/ngày (thời gian operator + compute).

### F-ADV-2: Thiếu hoàn toàn chiến lược nội dung — Diversification Engine chống sai vấn đề
- **Severity:** high
- **Location:** §4.6 FR-18, §7.3 SM-C1
- **Note:** FR-18 diversify về visual (màu nền, nét, góc, nhạc) — nhưng TikTok algorithm chủ yếu detect trùng lặp ở **content structure và narrative pattern**, không phải pixel-level visual similarity. 50 video cùng pattern "số → con vật" với cùng voice cadence và cùng CTA placement sẽ bị algorithm phát hiện là spam cluster bất kể visual variation. PRD không có strategy cho content-level diversification: biến hook type (chữ, hình, ký hiệu), subject category (vật, đồ vật, nhân vật), narrative template (câu mở, rhythm thuyết minh), CTA variation.
- **Fix:** Thêm FR hoặc mở rộng FR-18 với content-level diversification: multiple narrative templates, hook category rotation, voice pacing variation.

### F-ADV-3: UJ-3 "không cần vẽ tay" — nhưng ai QA chất lượng thẩm mỹ?
- **Severity:** high
- **Location:** §2.3 UJ-3, §4.1 FR-2
- **Note:** UJ-3 mô tả Huy nhập mô tả → LLM sinh DSL → Preview 10s → Duyệt. Nhưng nếu LLM sinh ra con thỏ đúng schema, đúng tọa độ, nhưng **xấu** (tai không cân, mắt lệch, toàn bộ trông như clip art thập niên 90)? FR-2 chỉ validate schema và bounds, không validate **thẩm mỹ**. Operator Huy "không biết dùng phần mềm đồ họa" — vậy khả năng Huy nhận biết và sửa lỗi thẩm mỹ cũng hạn chế. PRD không nói gì về quality bar cho generated components.
- **Fix:** Thêm consequence cho FR-2: "Preview hiển thị rendered output kèm template comparison với reference component (nếu có); operator confirm trước khi lưu Registry." Thêm Assumption cho aesthetic quality của LLM-generated drawings.

### F-ADV-4: 30fps @ 1080×1920 — overkill cho short-form?
- **Severity:** medium
- **Location:** §4.5 FR-16, §8 NFR-3
- **Note:** TikTok compress video xuống còn ~720p cho phần lớn viewers trên mobile. Render ở 1080×1920 30fps tốn compute gấp ~2.25x so với 720×1280 24fps, mà viewer trên điện thoại 6" không thấy khác biệt. Nếu batch 50 video, overhead tích lũy đáng kể. PRD không có giải thích tại sao chọn 1080p thay vì 720p.
- **Fix:** Giữ 1080p làm default nhưng thêm configurable resolution vào FR-16; ghi lý do (future-proofing cho YouTube Shorts native 1080p) hoặc chấp nhận 720p làm fast-render option.

### F-ADV-5: viPiper assumption quá lạc quan — chất lượng TTS offline cho content marketing
- **Severity:** medium
- **Location:** §4.4 FR-10, §10 A-01
- **Note:** A-01 đặt kế hoạch kiểm chứng "thử nghiệm 5 mẫu giọng ở tuần đầu" — nhưng 5 mẫu quá ít. Vấn đề thực tế của viPiper: (1) ngữ điệu đơn điệu khi đọc câu dài >10 từ, (2) phát âm sai từ vay mượn ("Bear", "TikTok"), (3) không có cảm xúc (excitement khi reveal). SM-C2 cho phép reject rate ≤ 10% — nhưng nếu 30% video bị reject chỉ vì giọng đọc thì pipeline cost assumption sụp đổ. PRD không có Plan B rõ ràng nếu viPiper fail.
- **Fix:** Nâng A-01 lên "Cao" risk; mở rộng verification plan lên 20+ mẫu câu với đa dạng cấu trúc ngữ pháp; nêu rõ Plan B (Edge TTS free tier hoặc pre-recorded voice clips).

### F-ADV-6: Entity Model thiếu Concept → Video mapping cardinality
- **Severity:** medium
- **Location:** §11 Entity Model
- **Note:** Entity Model nêu `Concept → 1..N → Transformation` và `VideoAsset` riêng biệt, nhưng không có relationship giữa `Transformation` và `VideoAsset`. Cùng 1 Transformation có thể sinh N videos (khác Seed, khác Diversification params) — nhưng model không diễn đạt điều này. Architecture team sẽ phải đoán.
- **Fix:** Thêm link: `Transformation → 1..N → VideoAsset (via Seed + DiversificationConfig)`.

### F-ADV-7: Không có data retention / cleanup strategy
- **Severity:** low
- **Location:** §4.6, §6.1
- **Note:** Batch 50 video/ngày × 30 ngày = 1500 video files + 1500 metadata JSON + audio assets. Ở 1080p, mỗi video ~15–25MB → ~30GB/tháng. PRD không đề cập disk management, archival, hoặc cleanup policy. Solo operator trên laptop 256GB SSD sẽ đầy đĩa trong 6–8 tháng.
- **Fix:** Thêm FR hoặc NFR cho disk usage monitoring và auto-archive/cleanup policy.

### F-ADV-8: SM-8 "Completion Rate ≥ 25%" — metric không có baseline và không actionable
- **Severity:** low
- **Location:** §7.2 SM-8
- **Note:** 25% completion rate trên kênh thử nghiệm mới (0 followers) gần như không thể đạt được — TikTok algorithm cần 500–1000 video để calibrate recommendation cho kênh mới. Metric này không actionable ở MVP vì nó phụ thuộc vào algorithm, không phải sản phẩm.
- **Fix:** Reclassify SM-8 là "Hypothesis to validate post-launch" thay vì Success Metric; thêm proxy metric đo được trong system: "Video playback smoothness score" (tự đo) hoặc "Operator satisfaction rating per batch".
