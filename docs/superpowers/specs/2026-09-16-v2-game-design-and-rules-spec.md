# V2 Master Game Design & Architecture Specification

- **Author / Lead**: Game Architecture & Experience Lead
- **Target**: Universal AI Game Video Engine (`auto-drawing`)
- **Status**: Approved Master Specification v2.0 (Ready for Implementation by Hermes / Dev Agents)
- **Scope**: Toàn diện 7 game mechanics, Mobile 9:16 UI layouts, Mechanic-specific Timing Profiles, Audio Architecture v2 (Dynamic Ducking & LUFS), Tâm lý học nhận thức (Cognitive Load) và Game Fairness.

---

## 1. Triết Lý Thiết Kế & Nguyên Tắc Cốt Lõi V2

### 1.1 Khắc phục "One-Size-Fits-All" (Độ dài video là Output của Mechanic)
Hệ thống loại bỏ hoàn toàn hằng số `18s cố định` cho toàn bộ các game. Thay vào đó, **thời lượng video là hàm số của tải nhận thức (Cognitive Load)** của từng thể loại game:
- Game so sánh nhị phân nhanh (`HI_LO`, `GUESS_PRICE_2WAY`): **11.5s – 12.5s** (tốc độ cao, giữ retention tối đa).
- Game xử lý trực quan 3–4 đối tượng (`MOST_EXPENSIVE`, `ODD_ONE_OUT`): **14.0s – 15.0s**.
- Game tính nhẩm / quét ký tự (`GROCERY_BASKET`, `ONE_AWAY`): **14.5s – 16.5s** (cần thêm thời gian cho mắt quét và não xử lý).

### 1.2 Nguyên Tắc "One Primary Message per Scene" trên Mobile 9:16
Màn hình dọc 1080×1920 không phải là dashboard máy tính. Mỗi khung hình (Scene) chỉ được phép có:
1. **Một đối tượng thị giác chính (Primary Visual)**.
2. **Một thông điệp trọng tâm (Primary Message)**.
3. **Một hành động định hướng trong đầu (Mental Action)**.
*Loại bỏ:* Hướng dẫn thừa thãi (như text *"Bạn có 3 giây để trả lời"* khi vòng tròn đếm ngược đã chạy), mã Game ID rườm rà, và các nút bấm thừa thãi ở đáy màn hình khi người xem chỉ quan sát thụ động.

### 1.3 Kiến Trúc 4 Tầng Tách Bạch Tuyệt Đối (Strict 4-Layer Separation)
```text
           [1. GAMEPLAY LOGIC & STATE LAYER]
           (Entities, Raw Math, Constraints, Rules)
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
[2. PRESENTATION & LAYOUT]     [3. SCRIPT & AUDIO DIRECTING]
(Satori VDOM, 9:16 Layout,      (Voice Rulebook, Dynamic Ducking,
 Density, Typography, Badges)    Escalating Ticks, Impact SFX)
             │                           │
             └─────────────┬─────────────┘
                           ▼
              [4. COMPOSITION & RENDER QA]
              (FFmpeg Muxer, LUFS -16, Safe Zones,
               No Affiliate Burn, Loop Transition)
```

---

## 2. Bảng Ma Trận Timing Profile Cho Từng Game (`GameTimingProfile`)

Thay thế hoàn toàn `SCENE_DURATIONS` trong `src/scene/SceneSystem.ts`.

| Mechanic ID | Hook (s) | Product / Setup (s) | Question (s) | Countdown (s) | Reveal (s) | Result (s) | CTA / Loop (s) | **Tổng Thời Lượng** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `HI_LO` | 1.5 | 2.0 | 2.0 | 2.5 | 1.5 | 1.0 | 1.5 | **12.0s** |
| `MOST_EXPENSIVE` | 1.5 | 2.5 | 2.0 | 3.0 | 2.0 | 1.5 | 1.5 | **14.0s** |
| `GUESS_PRICE_2WAY` | 1.5 | 2.0 | 2.0 | 2.5 | 1.5 | 1.0 | 1.5 | **12.0s** |
| `GUESS_PRICE_BRACKET` | 1.5 | 2.5 | 2.0 | 3.0 | 1.5 | 1.5 | 1.5 | **13.5s** |
| `ODD_ONE_OUT` | 1.5 | 2.5 | 2.5 | 3.0 | 2.0 | 1.5 | 1.5 | **14.5s** |
| `ONE_AWAY` | 1.5 | 2.5 | 2.5 | 3.5 | 1.5 | 1.5 | 1.5 | **14.5s** |
| `GROCERY_BASKET` | 1.5 | 3.0 | 2.5 | 4.0 | 2.0 | 1.5 | 1.5 | **16.0s** |
| `DEAL_CHECK` | 1.5 | 2.5 | 2.5 | 3.0 | 2.0 | 1.5 | 1.5 | **14.5s** |

### TypeScript Interface:
```typescript
// src/scene/types.ts
export interface SceneTimingProfile {
  hook: number;
  product: number;
  question: number;
  countdown: number;
  reveal: number;
  result: number;
  cta: number;
  totalDuration: number;
}
```

---

## 3. Đặc Tả Chi Tiết 7 Game Mechanics V2

---

### Game 1: `HI_LO` (Hi-Lo Price Challenge)

#### A. Mục tiêu & Tâm lý học nhận thức
- So sánh giá sản phẩm B với sản phẩm A (Mốc chuẩn - Price Anchor).
- **Tạo xung đột trực quan (Visual Deception / Perception Conflict)**:
  - Cặp loại 1 (*Size Disparity*): Đồ cồng kềnh rẻ tiền (chậu rửa, giá để giày) vs Đồ siêu nhỏ đắt tiền (tai nghe hi-res, củ sạc GaN 140W).
  - Cặp loại 2 (*Reverse Trap*): Đồ trông sang xịn nhưng là đồ decor bình dân vs Đồ trông mộc mạc nhưng là đồ thủ công cao cấp.

#### B. Dữ liệu & Quy tắc sinh câu hỏi (Constraints)
- Đầu vào: Đúng 2 `RawEntity` (A và B).
- Bắt buộc `a.price !== b.price`.
- Tỷ lệ chênh lệch giá tối thiểu: `Math.abs(b.price - a.price) / Math.max(a.price, b.price) >= 0.15` (15% gap để tránh tranh cãi về số lẻ).

#### C. Headline & Copywriting chuẩn
- Hook: `"Bạn đoán đúng được món này không?"` hoặc `"Xem mắt bạn tinh đến đâu!"` (Tuyệt đối không dùng claim giả: "90% người sai").
- Question Headline: `"{Tên SP B} CAO HƠN hay THẤP HƠN {Tên SP A}?"`
- Thẻ A: Badge `MỐC CHUẨN`, hiện giá rõ ràng `189.000₫`.
- Thẻ B: Badge `ĐOÁN GIÁ`, giá hiển thị `? GIÁ BÍ MẬT ?`.

#### D. Hiển thị UI 9:16
- 2 thẻ sản phẩm xếp dọc (Vertical Stack), mỗi thẻ cao 270px, rộng 940px.
- Chân màn hình: 2 nút trắc nghiệm lớn:
  - Nút trái: `▲ CAO HƠN` (Tone xanh lá dịu)
  - Nút phải: `▼ THẤP HƠN` (Tone đỏ cam dịu)
- Khi Reveal: Thẻ B bung giá thật (Màu xanh neon `#34d399` nếu cao hơn, hoặc đỏ cam nếu thấp hơn). Nút đúng sáng viền 3px, nút sai mờ đục.

---

### Game 2: `MOST_EXPENSIVE` (Món Nào Đắt Nhất?)

#### A. Khắc phục lỗi Delta 2% (Phân tầng độ khó chuẩn)
Loại bỏ hoàn toàn ngưỡng `delta >= 0.02`. Hệ thống phân tầng 3 mức độ khó rõ ràng:
- **Dễ (`EASY`)**: `delta = (highest - runnerUp) / highest >= 0.35` (35% - 70%). Nhận diện rõ ràng.
- **Vừa (`MEDIUM`)**: `delta >= 0.15 && delta < 0.35` (15% - 35%). Đòi hỏi suy luận về thương hiệu/tính năng.
- **Khó (`HARD`)**: `delta >= 0.08 && delta < 0.15` (8% - 15%). Gay cấn, gây tranh cãi cao.
- **Reject Guard**: Bất kỳ bộ sản phẩm nào có `delta < 0.08` (<8%) đều bị từ chối (`throw new Error`) để ngăn chặn việc người xem phải đoán mò ngẫu nhiên.

#### B. Headline & Layout 9:16
- Question Headline: `"Món nào ĐẮT NHẤT trong 4 món này?"` (Ngắn gọn, bỏ chữ thừa).
- Layout 4 thẻ dạng Grid 2×2:
  - Tối giản hóa thông tin trong từng ô: Ảnh sản phẩm to (180×180px), Badge góc `[A]`, `[B]`, `[C]`, `[D]`, Tên rút gọn <= 2 dòng.
  - Chữ giá ở phase Question: `"???"`.
- Khi Reveal: Cả 4 ô đồng loạt mở giá thật. Ô đắt nhất nổ viền phát sáng xanh lục neon `#10b981`, 3 ô còn lại viền tối `rgba(148, 163, 184, 0.2)`.

---

### Game 3: Tách Thành 2 Mechanic Riêng Biệt

#### Game 3A: `GUESS_PRICE_2WAY` (A/B Price Guess)
- **Bản chất**: Đưa ra 2 con số cụ thể cho 1 sản phẩm.
- Headline: `"Giá chuẩn của {Tên SP} là số nào?"`
- Lựa chọn:
  - `[A] {Giá A}` (vd: 299.000₫)
  - `[B] {Giá B}` (vd: 890.000₫ - fake gap 2x - 3x)
- Timing: Siêu ngắn **12.0s** (Tension đếm ngược nhanh 2.5s).

#### Game 3B: `GUESS_PRICE_BRACKET` (True Price Bracket)
- **Bản chất**: Đưa ra các khoảng giá liên tục (Price Intervals).
- Headline: `"{Tên SP} nằm trong KHOẢNG GIÁ nào?"`
- 3 hoặc 4 khoảng giá logic (ví dụ):
  - `[A] Dưới 500K`
  - `[B] 500K - 1 Triệu`
  - `[C] 1 Triệu - 2 Triệu`
  - `[D] Trên 2 Triệu`
- Timing: **13.5s** (cần 3s countdown để đối chiếu khoảng giá).

---

### Game 4: `ODD_ONE_OUT` (Minh Bạch Hóa Luật Chơi)

#### A. Phân tách dứt khoát 2 Sub-types
Không dùng chung câu hỏi mơ hồ `"Kẻ lạ là món nào?"`. Phân tách thành 2 loại với metadata rõ ràng:

1. **Loại 1: `ODD_CATEGORY` (Khác biệt Ngành hàng)**
   - 3 món cùng Category (vd: Gia dụng - Nồi, Chảo, Dao) + 1 món khác Category (vd: Tai nghe).
   - Headline Bắt Buộc: `"MÓN NÀO KHÁC NHÓM VỚI CÁC MÓN CÒN LẠI?"`
   - Reveal Subtitle: `"{Tên món} là thiết bị Điện tử, 3 món còn lại là Đồ gia dụng!"`

2. **Loại 2: `ODD_PRICE` (Khác biệt Mức giá)**
   - 4 món cùng Category và cùng tầm công năng, nhưng 1 món có giá gấp >3 lần hoặc <1/3 so với trung bình 3 món kia.
   - Headline Bắt Buộc: `"MÓN NÀO CÓ MỨC GIÁ LỆCH HẲN?"`
   - Reveal Subtitle: `"{Tên món} có giá {Giá}₫, lệch hoàn toàn so với tầm giá {Tầm giá trung bình}₫!"`

---

### Game 5: `ONE_AWAY` (Thiết Kế Lại Toàn Diện Layout 9:16)

#### A. Bài toán UI & Khắc phục Visual Noise
- Hiện tại: 10 button số xếp chen chúc hoặc bị cắt xén xuống đáy màn hình gây mỏi mắt (mắt phải đảo liên tục từ giá ở trên xuống đáy màn hình).
- **Giải pháp V2**: Loại bỏ hoàn toàn thanh Action Buttons ở chân trang. Đưa **Bảng số Digit Grid (2 hàng × 5 cột)** lên nằm **ngay sát phía dưới** mức giá bị che `maskedPrice`.

#### B. Sơ đồ bố cục Mobile 9:16
```text
┌──────────────────────────────────────────────┐
│  HOOK / HEADLINE: SỐ NÀO BỊ CHE?             │
│                                              │
│          [ Ảnh Sản Phẩm 380x380 ]            │
│               Tên Sản Phẩm                   │
│                                              │
│           2  .  ?  5  0  .  0  0  0  ₫        │
│                                              │
│       ┌───┬───┬───┬───┬───┐                  │
│       │ 0 │ 1 │ 2 │ 3 │ 4 │                  │
│       ├───┼───┼───┼───┼───┤                  │
│       │ 5 │ 6 │ 7 │ 8 │ 9 │                  │
│       └───┴───┴───┴───┴───┘                  │
│                                              │
│             [ Đồng Hồ Đếm Ngược 3.5s ]       │
└──────────────────────────────────────────────┘
```
- Khi Countdown chạy: Các con số hiển thị sắc nét, chữ số to (fontSize: 44px).
- Khi Reveal: Chữ số đúng trong bảng số phát sáng xanh ngọc `#34d399` và phóng to (scale 1.2), đồng thời chữ số `?` trên giá lật mở (flip animation) thành số thật.

---

### Game 6: `GROCERY_BASKET` (Đi Chợ Tính Nhẩm)

#### A. Phân tầng độ khó tính nhẩm (Mental Math Calibration)
Loại bỏ trường hợp bài toán quá lộ liễu (vd: 3 món cộng lại 240k với budget 300k).
- **Dễ (`EASY`)**: `|total - budget| / budget` nằm trong khoảng **15% - 25%** (dễ nhận biết chênh lệch rõ).
- **Vừa (`MEDIUM`)**: Chênh lệch nằm trong khoảng **5% - 12%** (cần cộng nhẩm hàng chục).
- **Căng thẳng tột độ (`TENSION / HARD`)**: Chênh lệch chỉ từ **1% - 4%** (ví dụ: Budget 300K, tổng 3 món ra 303.000₫ hoặc 297.000₫). Đây là mỏ vàng tạo comment: *"Suýt soát 3 nghìn!", "Cháy túi vì 3k!"*.

#### B. Timing riêng biệt
- Cho phép Countdown **4.0 giây** (thay vì 3s) và Setup 3.0s để người xem kịp đọc 3 sản phẩm và thực hiện phép tính nhẩm.

---

### Game 7: Tái Cấu Trúc `DEAL_OR_SCAM` Thành `DEAL_CHECK`

#### A. Khắc phục rủi ro pháp lý & Heuristic võ đoán
- Thay thế hoàn toàn thuật ngữ "SCAM" (lừa đảo) bằng **`RED_FLAG` (Cảnh báo giá ảo / Giảm sốc bất thường)**.
- Phân định kết quả dựa trên **Bằng chứng thị trường (Evidence-based)**:
  ```typescript
  export interface DealEvidence {
    salePrice: number;
    originalPrice: number;
    discountPercent: number;
    historicalPriceAvg?: number;
    sellerRating?: number;
    salesVelocity?: number;
    classification: 'GOOD_DEAL' | 'RED_FLAG';
    verdictReason: string;
  }
  ```
- **Quy tắc phân loại an toàn**:
  1. Nếu giá gốc nâng khống cao hơn giá trung bình thị trường 30%: -> `RED_FLAG` (*Bẫy nâng giá trước sale*).
  2. Nếu đồ điện tử/công nghệ xịn giảm >75% nhưng từ shop không có chứng nhận chính hãng: -> `RED_FLAG` (*Nghi vấn hàng dựng / xả hàng lỗi*).
  3. Nếu đồ chính hãng sale 25% - 45% kèm mã độc quyền: -> `GOOD_DEAL` (*Kèo thơm chính hãng*).
- Hai nút lựa chọn trên video:
  - `[ DEAL THẬT ]` vs `[ BẪY ẢO / RED FLAG ]`

---

## 4. Kiến Trúc Âm Thanh V2 (Audio Architecture)

---

### 4.1 Dynamic Auto-Ducking Thật Sự (Envelope Follower)
Loại bỏ việc ghim tĩnh `musicGain = 0.18`. Codebase `src/render/audioBed.ts` phải áp dụng bộ làm mờ đường bao (Volume Envelope Curve):

```text
Music Gain
0.20 ────┐                                           ┌──── 0.20
         │ (Attack: 80ms)             (Release: 200ms)│
         └─────────────┐               ┌─────────────┘
0.05                   └───────────────┘
                              ▲
Voice Narration:       [ Bắt đầu nói ──────── Dứt lời ]
```
- **Khi không có voice**: Nhạc nền chạy ở mức `0.20` (rõ ràng, duy trì nhịp điệu).
- **Khi voice bắt đầu phát**: Âm lượng nhạc nền tự động ép xuống `0.05` trong vòng 80ms (Voice rõ mồn một).
- **Khi voice dứt lời**: Âm lượng nhạc nền hồi phục về `0.20` trong vòng 200ms mượt mà.

---

### 4.2 Đường Cong Cường Độ Tick Countdown (Escalating Tick Intensity)
Thay vì 6 tiếng tick đều đều ở âm lượng `0.5`, chuyển sang chuỗi cường độ tăng dần đẩy căng thẳng lên cực hạn:

| Mốc Thời Gian (Countdown) | Gain Âm Lượng | Cảm Giác Âm Học |
| :---: | :---: | :--- |
| **8.0s** (Tick 1) | `0.30` | Bắt đầu đếm nhịp nhẹ nhàng |
| **8.5s** (Tick 2) | `0.35` | Nhịp bước đều |
| **9.0s** (Tick 3) | `0.42` | Não bắt đầu nhận diện deadline |
| **9.5s** (Tick 4) | `0.50` | Căng thẳng tăng tốc |
| **10.0s** (Tick 5) | `0.62` | Báo động giục giã |
| **10.5s** (Tick 6) | `0.75` | Đỉnh điểm chuẩn bị nổ đáp án |
| **11.0s** (Reveal) | **BOOM (0.90)** | **Hiệu ứng Reveal Stinger nổ tung** |

---

### 4.3 Thay Thế "Correct SFX" Bằng "Reveal Stinger"
- Bỏ file `correct.wav` kiểu game show trắc nghiệm học đường.
- Thay bằng **`reveal_impact.wav`** (âm thanh nổ bass sub kết hợp tiếng chuông kim loại sang trọng) phát tại giây 11.0. Sau đó AI Voice đọc to con số chiến thắng.

---

### 4.4 Kiểm Soát Âm Lượng Chuẩn Phát Hành (Loudness EBU R128)
Trong lệnh FFmpeg muxer (`src/render/ffmpeg.ts`), tích hợp bộ lọc chuẩn hóa âm thanh quốc tế:
```bash
-af "loudnorm=I=-16:TP=-1.5:LRA=11"
```
- **Integrated Loudness**: Đạt chuẩn `-16 LUFS` (chuẩn vàng cho video ngắn TikTok / Reels, không bị nền tảng tự động nén làm méo tiếng).
- **True Peak**: Giới hạn cứng `-1.5 dBFS` (chống tuyệt đối hiện tượng vỡ tiếng / inter-sample clipping sau khi convert sang AAC).

---

## 5. Tối Ưu Hóa Tương Tác & Loop Retention

### 5.1 Rút Ngắn CTA & Tích Hợp Loop Liền Mạch (Seamless Video Loop)
- Rút ngắn thời lượng CTA độc lập từ 3.0s xuống còn **1.2s – 1.5s**.
- **Kỹ thuật Seamless Loop**: Câu chữ cuối cùng của Scene CTA ăn khớp với câu mở đầu của Scene Hook:
  - Cuối CTA: *"Bạn đoán trúng được mấy món..."*
  - Quay về đầu Hook (Giây 0.0): *"...trong thử thách giá lần này?"*
  - Giúp video lặp lại mượt mà, người xem không nhận ra video đã hết, tăng vọt chỉ số `Rewatch Rate`.

### 5.2 Kiểm Soát Biến Thể `comment` ("Đáp án ở comment 👇")
- Mặc định **85% video** sản xuất ở chế độ `in_video` (trả lời ngay để mang lại cảm giác sảng khoái và tin cậy cho kênh).
- **15% video** có thể chạy chế độ `comment`, nhưng **chỉ áp dụng cho những câu có độ xung đột nhận thức cực lớn** kèm theo lời thách đố: *"Câu này 10 người thì 9 người cãi nhau, đáp án ghim dưới comment!"*.

### 5.3 Chuẩn Hóa Phân Loại Hook (Chống Clickbait Giả)
Cấm vĩnh viễn việc sinh text *"90% người xem đoán sai"* khi không có dữ liệu đo lường thực tế. Hệ thống Hook được chia thành 4 nhóm chuẩn:
1. **`CHALLENGE`**: Thách thức trực tiếp: *"Bạn có 3 giây để đoán giá món này!"*, *"Thử tài mua sắm thông thái!"*.
2. **`CURIOSITY`**: Kích thích tò mò: *"Nhìn bé thế này nhưng giá sẽ làm bạn giật mình!"*.
3. **`FACTUAL`**: Trọng tâm câu hỏi: *"29K hay 299K? Đoán ngay!"*.
4. **`SOCIAL_PROOF` (Chỉ dùng khi có log dữ liệu)**: *"Câu hỏi khiến 5.000 người tranh luận tuần trước!"*.

---

## 6. Kế Hoạch Triển Khai Cho Đội Ngũ Kỹ Thuật (Phân Kỳ P0 -> P1 -> P2)

```text
PHASE 1: NỀN TẢNG CỐT LÕI (P0)
├── 1.1 Tạo src/scene/timingProfiles.ts & cập nhật SceneSystem.ts
├── 1.2 Tái cấu trúc OddOneOutDefinition (Category vs Price)
├── 1.3 Refactor DealOrScam thành DealCheckDefinition (Evidence-based)
├── 1.4 Thiết kế lại Layout Digit Grid cho OneAway trên Satori
├── 1.5 Cập nhật Dynamic Ducking & Escalating Ticks trong audioBed.ts
└── 1.6 Bổ sung bộ lọc loudnorm -16 LUFS vào ffmpeg.ts

PHASE 2: TRẢI NGHIỆM & ĐỘ KHÓ (P1)
├── 2.1 Cập nhật ngưỡng Delta trong MostExpensive (>= 8%)
├── 2.2 Tách GuessThePrice thành GUESS_PRICE_2WAY vs GUESS_PRICE_BRACKET
├── 2.3 Phân tầng sai số tính nhẩm trong GroceryBasket
├── 2.4 Cắt giảm CTA xuống 1.5s và thiết lập Seamless Loop
└── 2.5 Thay thế correct.wav bằng Reveal Stinger

PHASE 3: HỌC HỎI TỰ ĐỘNG & TELEMETRY (P2)
├── 3.1 Hook Category Guard (Loại bỏ claim 90% không có dữ liệu)
├── 3.2 Tích hợp A/B testing tự động cho tỷ lệ in_video vs comment
└── 3.3 Analytics Ingestor hiệu chỉnh trọng số ViralScorer theo Retention thực tế
```
