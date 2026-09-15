# PRD — Viral Game Video Engine
## Triết lý sản phẩm & nguyên tắc thiết kế game video TikTok

**Phiên bản:** 1.0  
**Trạng thái:** Draft / Foundation  
**Định hướng:** TikTok / Reels / Shorts  
**Nguồn cảm hứng:** format “Hãy chọn giá đúng” / game đoán giá  
**Mục tiêu:** Xây dựng engine tự động sản xuất video game ngắn, có khả năng mở rộng nhiều game và tự tối ưu theo dữ liệu hiệu suất.

---

# 1. Tầm nhìn

Xây dựng một **Viral Game Video Engine** có thể tự động biến dữ liệu sản phẩm thành những video game ngắn khiến người xem:

1. Dừng lướt vì tò mò.
2. Nhìn và suy luận.
3. Chọn đáp án trong đầu.
4. Chờ reveal để kiểm chứng.
5. Có cảm giác thắng/thua hoặc bất ngờ.
6. Muốn bình luận điểm số, lựa chọn hoặc tranh luận.
7. Muốn xem tiếp round/video tiếp theo.

Triết lý cốt lõi:

> **Không làm video để người xem xem. Làm video để người xem phải đưa ra một quyết định trước khi được xem đáp án.**

Nguồn cảm hứng chính là game **“Hãy chọn giá đúng”**: lấy một thứ quen thuộc trong đời sống, biến một thông tin tưởng như đơn giản thành một thử thách nhận thức, sau đó tạo khoảng chờ ngắn trước khi reveal.

Engine không chỉ là video renderer. Nó phải là một **Content Intelligence Engine**:

```text
Product/Data
    ↓
Game Generator
    ↓
Challenge Generator
    ↓
Difficulty Curator
    ↓
Viral Scorer
    ↓
Round Composer
    ↓
Hook / Script Generator
    ↓
Video Renderer
    ↓
Social Performance
    ↓
Learning Loop
    └──────────────→ cải thiện lần sản xuất tiếp theo
```

---

# 2. Mục tiêu sản phẩm

## 2.1. Mục tiêu chính

Engine phải có khả năng:

- Tự động chọn game.
- Tự động chọn sản phẩm/dữ liệu phù hợp.
- Tự động tạo câu hỏi.
- Tự động điều chỉnh độ khó.
- Tự động tạo hook.
- Tự động tạo 1 hoặc nhiều round.
- Tự động tạo reveal.
- Tự động tạo CTA kích thích comment.
- Render video theo template.
- Theo dõi hiệu suất.
- Học từ dữ liệu để cải thiện việc lựa chọn challenge.

## 2.2. Mục tiêu chiến lược

Không tối ưu cho một video đơn lẻ.

Tối ưu cho:

> **Khả năng sản xuất hàng nghìn biến thể game có chất lượng ổn định và liên tục tìm ra format thắng.**

---

# 3. Định nghĩa “viral”

Trong PRD này, viral không đồng nghĩa với nhiều view.

Một video viral tốt phải tạo ra chuỗi hành vi:

```text
STOP
 ↓
THINK
 ↓
CHOOSE
 ↓
WAIT
 ↓
REVEAL
 ↓
EMOTION
 ↓
COMMENT / LIKE / SHARE
 ↓
WATCH NEXT
```

Các chỉ số cần quan tâm:

### Primary

- 1–3 giây đầu / hook retention.
- Average Watch Time.
- Completion Rate.
- Rewatch Rate.
- Comment Rate.
- Share Rate.
- Like Rate.

### Secondary

- Profile Visit Rate.
- Follow Conversion.
- Product Click / Affiliate CTR.
- Conversion nếu có commerce.

Không được tối ưu CTR bán hàng bằng cách phá trải nghiệm game.

---

# 4. Triết lý số 1 — “User phải chơi”

Đây là nguyên tắc quan trọng nhất.

Video không được trở thành:

> “Đây là sản phẩm X, giá Y.”

Mà phải trở thành:

> “Bạn nghĩ X hay Y?”

Ví dụ:

```text
❌ Video:
Robot hút bụi này giá 2.490K.

✅ Game:
Robot hút bụi này:
1.290K hay 2.490K?

Bạn có 5 giây.
```

Người xem phải **tham gia bằng não**, dù không có tương tác trực tiếp.

TikTok chỉ là màn hình game.

Comment chính là nơi người chơi để lại kết quả.

---

# 5. Triết lý số 2 — “Prediction trước, information sau”

Thông tin không nên được trao ngay.

Cấu trúc:

```text
QUESTION
   ↓
COUNTDOWN
   ↓
PREDICTION
   ↓
REVEAL
```

Nếu người xem đã biết đáp án trước khi họ đoán, game mất tác dụng.

Do đó:

> **Mọi reveal phải đến sau một khoảng thời gian đủ để người xem hình thành dự đoán.**

---

# 6. Triết lý số 3 — “Easy → Tension → WTF”

Đối với multi-round:

```text
Round 1 = Confidence
Round 2 = Tension
Round 3 = Surprise
```

Ví dụ game giá:

### Round 1 — Easy

```text
Nước giặt 189K
vs
Robot hút bụi 2.490K

Cái nào đắt hơn?
```

Mục tiêu:

> Cho người xem cảm giác “Mình chơi được”.

### Round 2 — Medium

```text
Nồi chiên 1.290K
vs
Nồi cơm điện 1.490K
```

Mục tiêu:

> Bắt đầu khiến người xem suy nghĩ.

### Round 3 — WTF

```text
Một món đồ nhỏ 3.990K
vs
Một món đồ lớn 1.100K
```

Mục tiêu:

> Phá vỡ trực giác và tạo cảm xúc.

---

# 7. Triết lý số 4 — “Đừng chỉ khó, hãy thú vị”

Difficulty cao không đồng nghĩa với viral.

Ví dụ:

```text
A = 2.391.000đ
B = 2.392.000đ
```

Khó nhưng không thú vị.

Ngược lại:

```text
Một chiếc kính nhỏ:
2.990K

Một chiếc ghế lớn:
899K
```

Người xem có thể đoán sai vì **perception conflict**.

Đây là loại khó cần ưu tiên.

## Difficulty nên bao gồm:

- Numerical Difficulty.
- Visual Difficulty.
- Semantic Difficulty.
- Perception Conflict.
- Ambiguity.
- Knowledge Requirement.
- Time Pressure.

---

# 8. Triết lý số 5 — “Perception vs Reality”

Đây là vũ khí quan trọng của game giá.

Con người có các heuristic:

- Đồ to → tưởng đắt.
- Đồ nhỏ → tưởng rẻ.
- Brand nổi tiếng → tưởng đắt.
- Nhiều tính năng → tưởng đắt.
- Thiết kế sang → tưởng đắt.
- Sản phẩm quen thuộc → tưởng dễ đoán.

Engine phải tìm các tình huống:

```text
EXPECTED PRICE
      ≠
ACTUAL PRICE
```

Càng lớn khoảng cách nhận thức, càng có khả năng tạo surprise.

---

# 9. Triết lý số 6 — “Reveal phải trả thưởng”

Reveal không đơn giản là:

> “Đáp án: 2.490K.”

Reveal phải tạo cảm xúc.

Ví dụ:

```text
YOUR GUESS
     ↓
REAL PRICE
     ↓
CORRECT / WRONG
     ↓
REACTION
```

Animation, sound và typography phải làm nổi bật khoảnh khắc:

> “Ồ!!!”

Reveal tốt có thể trở thành điểm cao trào của video.

---

# 10. Triết lý số 7 — “Comment phải là một phần của game”

Không dùng CTA chung chung:

```text
❌ Like và follow để xem phần tiếp theo.
```

Ưu tiên CTA có liên quan trực tiếp đến game:

```text
Bạn đúng 1/3, 2/3 hay 3/3?

Team A hay Team B?

Bạn đoán bao nhiêu?

Câu nào bạn sai?

Ai chọn giống tôi?

Bạn có dám câu cuối không?
```

Mục tiêu:

> **Comment không phải hành động sau game. Comment là bảng điểm của game.**

---

# 11. Triết lý số 8 — “Tranh luận tốt hơn bình luận đơn thuần”

Engine phải ưu tiên những challenge có khả năng tạo:

```text
A: Tôi chọn A.
B: Sai rồi, chắc chắn B.
C: Tôi cũng nghĩ A.
A: Nhưng nhìn kích thước là biết...
```

So với:

```text
“3/3”
```

tranh luận có giá trị social cao hơn.

Do đó Viral Scorer cần một signal:

> **Debate Potential**

Các yếu tố làm tăng Debate Potential:

- Hai đáp án đều có vẻ hợp lý.
- Có sự mâu thuẫn giữa visual và price.
- Có định kiến phổ biến.
- Có nhiều người có thể suy luận khác nhau.
- Có khả năng tạo “Tôi nghĩ...” thay vì chỉ “A/B”.

---

# 12. Triết lý số 9 — “Không được quá dễ, không được quá khó”

Có một vùng difficulty tối ưu.

```text
Too Easy
    ↓
No Thinking
    ↓
Swipe

Optimal
    ↓
Prediction
    ↓
Tension
    ↓
Reveal
    ↓
Emotion

Too Hard
    ↓
Random Guess
    ↓
No Satisfaction
    ↓
Swipe
```

Engine cần tối ưu:

> **Perceived Challenge**, không chỉ Objective Difficulty.

---

# 13. Triết lý số 10 — “Hook là câu hỏi, không phải lời giới thiệu”

Hook tốt:

```text
29K hay 299K?

Cái nào đắt hơn?

Bạn có 5 giây.

Đừng nhìn comment.

90% người đoán sai câu này.
```

Hook yếu:

```text
Hôm nay chúng ta sẽ cùng chơi một game rất thú vị...
```

Nguyên tắc:

> **Trong 1–2 giây đầu, người xem phải hiểu họ đang được thử thách điều gì.**

---

# 14. Triết lý số 11 — “Không có tương tác UI, nhưng phải có interaction trong đầu”

Đây là loại game:

> **Passive Interactive Content**

Người xem không bấm A/B.

Nhưng trong đầu họ vẫn:

```text
A?
...
Không, chắc B.
...
Ồ, sai!
```

Video phải tạo cảm giác giống đang chơi game mà không cần UI interaction thật.

---

# 15. Game Family

Engine không nên coi mỗi game là một hệ thống độc lập.

Các game thuộc các family:

## Numeric

- Higher / Lower.
- Most Expensive.
- Guess Price.
- Closest Price.
- Price Ladder.
- Sort Price.
- One Away.
- Discount Guess.
- Rating Guess.
- Review Count Guess.

## Semantic

- Odd One Out.
- Which Doesn't Belong.
- Match Product → Category.
- Match Product → Brand.
- True / False.
- Two Truths One Lie.
- 3 Clues → 1 Product.

## Visual

- Real vs Fake.
- Spot the Difference.
- Macro Guess.
- Blur Reveal.
- Silhouette Guess.
- Zoom Guess.
- Flash Recognition.

## Comparison

- Bigger / Smaller.
- Heavier / Lighter.
- Newer / Older.
- More / Less.
- Better Value.

## Commerce

- Deal or Scam.
- Worth It?
- Better Value?
- Guess Discount.
- Popularity Guess.

---

# 16. Game Definition phải độc lập với Core Engine

Không được xây:

```python
if game == "higher_lower":
    ...
elif game == "most_expensive":
    ...
```

Thay vào đó:

```text
Game Registry
      ↓
Game Definition
      ↓
Candidate Generator
      ↓
Constraint Engine
      ↓
Difficulty Engine
      ↓
Viral Scorer
      ↓
Round Composer
```

Game mới chỉ cần đăng ký definition + strategy cần thiết.

---

# 17. Generic Challenge Pipeline

Mọi game nên đi qua pipeline chung:

```text
1. INPUT VALIDATION
        ↓
2. CANDIDATE GENERATION
        ↓
3. HARD CONSTRAINT FILTER
        ↓
4. DIFFICULTY SCORING
        ↓
5. VIRAL SCORING
        ↓
6. DIVERSITY FILTER
        ↓
7. ROUND COMPOSITION
        ↓
8. HOOK GENERATION
        ↓
9. SCRIPT GENERATION
        ↓
10. VIDEO RENDER
```

---

# 18. Difficulty Engine

Difficulty không được hard-code thành một công thức chung.

Mỗi game có Difficulty Strategy.

Ví dụ Higher/Lower:

```text
difficulty =
    price_gap
  + visual_similarity
  + category_similarity
  + perception_conflict
```

Odd One Out:

```text
difficulty =
    taxonomy_similarity
  + attribute_similarity
  + visual_similarity
```

Spot Difference:

```text
difficulty =
    difference_size
  + visual_complexity
  + camouflage
```

Macro Guess:

```text
difficulty =
    zoom_level
  + texture_ambiguity
  + object_similarity
```

---

# 19. Viral Score

Difficulty và Viral Score phải tách biệt.

Ví dụ:

```yaml
viral_score:
  curiosity: 0.20
  surprise: 0.20
  debate: 0.20
  visual_hook: 0.15
  participation: 0.10
  emotional_reveal: 0.10
  shareability: 0.05
```

Có thể thay đổi trọng số theo game và dữ liệu thực tế.

---

# 20. Viral Score không được chỉ là công thức cố định

Giai đoạn đầu:

```text
Rule Based
```

Sau khi có dữ liệu:

```text
Rule + Historical Performance
```

Sau đó:

```text
Predictive Ranking
```

Mục tiêu cuối:

```text
Challenge
   ↓
Predicted Performance
   ↓
Select highest expected value
```

---

# 21. Multi-Round Composer

Multi-round không đơn giản là ghép 3 câu.

Nó phải tạo **emotional curve**:

```text
Confidence
    ↓
Curiosity
    ↓
Tension
    ↓
Surprise
    ↓
Score
    ↓
Comment
```

Ví dụ:

```yaml
rounds:
  - role: confidence
    difficulty: easy

  - role: tension
    difficulty: medium

  - role: payoff
    difficulty: hard
    surprise: high
```

---

# 22. Không phải game nào cũng cần 3 round

Engine phải hỗ trợ:

```text
Single
2 rounds
3 rounds
4 rounds
5 rounds
```

Single phù hợp khi:

- Challenge cực mạnh.
- Reveal cực mạnh.
- Video cần cực ngắn.

Multi phù hợp khi:

- Có thể tạo progression.
- Người xem muốn biết điểm cuối.
- Có khả năng tạo score.

---

# 23. Product Catalog là nền móng

Product data nên đủ giàu để nhiều game sử dụng:

```yaml
product:
  id
  sku

  identity:
    name
    brand
    category
    subcategory

  commerce:
    price
    original_price
    discount

  physical:
    weight
    width
    height
    depth

  attributes:
    material
    color
    capacity
    power
    size

  social:
    rating
    review_count
    sales_count

  temporal:
    release_date
    price_history

  perception:
    perceived_size
    perceived_price
    luxury_score

  visual:
    image
    embedding
```

Một SKU phải có khả năng trở thành input cho nhiều game.

---

# 24. Filter Architecture

Filter phải composable.

Ví dụ:

```yaml
filters:
  - required_fields

  - no_duplicate_sku

  - category_compatibility

  - price_gap:
      min: 0.15
      max: 0.30

  - visual_similarity:
      min: 0.60

  - perception_conflict:
      min: 0.70

  - viral_score:
      min: 0.75
```

Filter Registry:

```text
price_gap
price_outlier
price_range
taxonomy_distance
attribute_distance
visual_similarity
visual_difference
size_difference
weight_difference
brand_similarity
rating_difference
popularity_difference
temporal_distance
perception_conflict
surprise_score
controversy_score
duplicate_guard
```

Game chỉ compose các filter cần thiết.

---

# 25. Asset-driven Games

Một số game không thể phụ thuộc vào price catalog.

Ví dụ:

### Real vs Fake

Input:

```text
authentic image
replica image
```

Difficulty:

```text
visual_detail
logo_error_size
material_difference
```

### Spot Difference

Input:

```text
image A
image B
```

Difficulty:

```text
difference_size
location
visual_complexity
```

### Macro Guess

Input:

```text
macro asset
original product
```

Difficulty:

```text
zoom
texture ambiguity
```

Core Engine vẫn giống nhau; chỉ thay Data Source + Candidate Generator + Difficulty Strategy.

---

# 26. Video Design Principles

Video phải có:

- Visual hierarchy rõ.
- Chữ lớn.
- Đáp án A/B dễ nhìn.
- Countdown dễ hiểu.
- Reveal mạnh.
- Chuyển cảnh nhanh.
- Không có khoảng chết.
- Âm thanh hỗ trợ tension.
- Không để animation làm chậm game.

Template không nên giới hạn game.

Template nên nhận:

```json
{
  "hook": {},
  "question": {},
  "choices": [],
  "countdown": {},
  "reveal": {},
  "score": {},
  "cta": {}
}
```

---

# 27. Audio Design

Audio có 4 vai trò:

```text
Hook → attention
Tick → tension
Whoosh → transition
Reveal → reward
```

Không dùng âm thanh chỉ để trang trí.

Audio phải hỗ trợ gameplay.

---

# 28. Comment Design

Mỗi game phải có Comment Strategy.

Ví dụ Higher/Lower:

```text
Bạn chọn A hay B?
```

Guess Price:

```text
Bạn đoán bao nhiêu?
```

Odd One Out:

```text
Món nào là kẻ lạ?
```

Spot Difference:

```text
Bạn tìm thấy mấy điểm?
```

Real/Fake:

```text
A hay B là hàng thật?
```

Mục tiêu là khiến comment trở thành **answer submission**.

---

# 29. Like Design

Like không nên được xin trực tiếp quá sớm.

Thay vì:

```text
Like video nhé!
```

có thể tạo emotional identification:

```text
Nếu bạn cũng đoán sai câu này...
```

Hoặc:

```text
Team đoán đúng đâu?
```

Like phải là hành vi phụ sau khi người xem đã có cảm xúc.

---

# 30. Share Design

Share mạnh khi game có:

- Challenge bạn bè.
- So sánh điểm.
- “Tao chắc mày sẽ sai câu này.”
- Một câu WTF đáng gửi cho người khác.

Ví dụ:

> “Gửi cho đứa lúc nào cũng bảo mình biết giá.”

Shareability phải được xem là một thuộc tính của challenge.

---

# 31. Anti-patterns

Engine phải tránh:

### 1. Random vô nghĩa

```text
random product A
random product B
```

### 2. 3 round giống nhau

```text
easy
easy
easy
```

### 3. Khó nhưng không thú vị

### 4. Reveal không có payoff

### 5. Hook dài

### 6. CTA bán hàng lấn át game

### 7. Lặp sản phẩm quá thường xuyên

### 8. Câu hỏi có đáp án gây tranh cãi vì dữ liệu sai

### 9. Sản phẩm/ảnh chất lượng thấp

### 10. Spoil đáp án trước countdown

---

# 32. Data Quality Guard

Viral engine không được đánh đổi tính đúng.

Mọi challenge phải validate:

```text
Price correctness
SKU correctness
Image correctness
Answer correctness
Category correctness
Duplicate correctness
```

Nếu dữ liệu không chắc chắn:

> Không publish challenge.

Một game viral nhưng bị comment “giá sai” có thể phá niềm tin của cả channel.

---

# 33. Diversity Engine

Không để một kênh biến thành:

```text
Tai nghe
Tai nghe
Tai nghe
Tai nghe
```

Diversity phải xét:

- Category.
- Brand.
- Price range.
- Visual composition.
- Game.
- Hook.
- Difficulty.
- Color.
- Product type.
- Question pattern.

Ví dụ:

```text
Last 20 videos:
max 3 cùng category
max 2 cùng SKU
max 3 cùng hook pattern
```

Các ngưỡng phải configurable.

---

# 34. Channel Personality

Mỗi channel có thể có:

```yaml
channel:
  personality:
    tone: playful
    difficulty: medium
    humor: high
    controversy: medium
    commerce: low
```

Cùng một Product Catalog có thể tạo nhiều channel khác nhau.

---

# 35. A/B Testing

Engine phải tạo nhiều biến thể:

```text
Product Pair
   ×
Hook
   ×
Countdown
   ×
Question Wording
   ×
Reveal Animation
   ×
CTA
```

Ví dụ cùng challenge:

```text
A:
“29K hay 299K?”

B:
“Bạn có đoán đúng giá món này không?”

C:
“Đừng nhìn comment. Đoán ngay!”
```

Sau đó Performance Data quyết định variant thắng.

---

# 36. Learning Loop

Sau khi publish:

```text
Video
 ↓
Performance
 ↓
Feature Attribution
 ↓
Update Score
 ↓
Better Candidate Selection
```

Engine cần lưu:

```text
game_id
product_ids
category
price_gap
difficulty
hook_type
round_curve
reveal_type
CTA_type
duration
```

để biết:

> **Video thắng vì yếu tố nào?**

---

# 37. Content Genome

Mỗi video được biểu diễn bằng một “genome”:

```json
{
  "game": "higher_lower",
  "difficulty": 0.62,
  "price_gap": 0.21,
  "visual_conflict": 0.88,
  "surprise": 0.91,
  "debate": 0.74,
  "hook": "direct_question",
  "round_curve": ["easy", "medium", "wtf"],
  "duration": 38
}
```

Performance được gắn vào genome.

Sau hàng nghìn video, engine có thể tìm:

> “Genome nào có xác suất thắng cao nhất?”

---

# 38. Hermes Agent Architecture

Hermes không nên trực tiếp render mọi thứ.

Nên chia agent:

```text
HERMES ORCHESTRATOR
        │
        ├── Product Research Agent
        │
        ├── Data Quality Agent
        │
        ├── Game Designer Agent
        │
        ├── Challenge Curator Agent
        │
        ├── Viral Analyst Agent
        │
        ├── Script Agent
        │
        ├── Video QA Agent
        │
        └── Performance Analyst Agent
```

Hermes điều phối.

Engine xử lý deterministic task.

LLM xử lý những phần cần reasoning/creative judgment.

---

# 39. Nguyên tắc Hermes

Không để LLM quyết định mọi thứ.

LLM tốt cho:

- Hook.
- Question wording.
- Creative variation.
- Semantic reasoning.
- Debate prediction.
- Content analysis.

Code tốt cho:

- Price calculation.
- Duplicate detection.
- Constraint validation.
- Timing.
- Randomization.
- Rendering.
- Schema validation.

Nguyên tắc:

> **LLM quyết định những thứ cần hiểu. Code quyết định những thứ cần chính xác.**

---

# 40. Definition of Done

MVP được xem là đạt khi:

- Có ít nhất 3 game hoạt động.
- Game có thể chạy Single/Multi.
- Candidate selection không random đơn thuần.
- Difficulty được tính tự động.
- Viral Score được tính tự động.
- Có Hook Generator.
- Có Round Composer.
- Có Comment Strategy.
- Có Video Renderer.
- Có Data Logging.
- Thêm game mới không cần sửa core pipeline.

---

# 41. Roadmap

## Phase 1 — Foundation

Ưu tiên:

1. Product schema.
2. Game Registry.
3. Challenge schema.
4. Filter Registry.
5. Difficulty Engine.
6. Viral Score.
7. Round Composer.
8. Video JSON schema.
9. Renderer.

## Phase 2 — Price Game

Tập trung:

- Higher / Lower.
- Most Expensive.
- Guess Price.
- One Away.
- Closest Price.

Đây là vertical quan trọng nhất.

## Phase 3 — Semantic

- Odd One Out.
- Match Category.
- True / False.
- 3 Clues.

## Phase 4 — Visual

- Real vs Fake.
- Spot Difference.
- Macro.
- Blur.
- Silhouette.

## Phase 5 — Learning

- Performance ingestion.
- Feature attribution.
- Variant testing.
- Predictive scoring.

## Phase 6 — Autonomous Content Factory

Hermes có thể:

```text
Find opportunity
    ↓
Choose game
    ↓
Find products
    ↓
Create challenge
    ↓
Score challenge
    ↓
Generate video
    ↓
QA
    ↓
Publish
    ↓
Analyze
    ↓
Learn
    ↓
Generate next batch
```

---

# 42. North Star Metric

Không lấy:

> Tổng số video sản xuất.

Không lấy:

> Tổng số sản phẩm được quảng bá.

North Star:

> **Số lượng “Playable Viral Challenges” được tạo ra mỗi ngày có xác suất đạt engagement cao.**

Một challenge tốt phải thỏa:

```text
Can understand
+
Can predict
+
Wants to know answer
+
Feels something after reveal
+
Has a reason to comment
```

---

# 43. Triết lý cuối cùng

Engine này không phải:

> “Tool tự động ghép sản phẩm thành video.”

Nó phải là:

> **“Một nhà thiết kế game vô hình, biến dữ liệu đời sống thành những thử thách 15–40 giây.”**

Đối với game giá, nguyên lý nền tảng là:

```text
THỨ QUEN THUỘC
      ↓
CÂU HỎI ĐƠN GIẢN
      ↓
TRỰC GIÁC
      ↓
NGHI NGỜ
      ↓
5 GIÂY SUY NGHĨ
      ↓
REVEAL
      ↓
BẤT NGỜ / CHIẾN THẮNG
      ↓
“TAO ĐOÁN ĐÚNG!”
      ↓
COMMENT
```

**Mục tiêu tối thượng:**

> Người xem không cảm thấy họ đang xem quảng cáo.
>
> Họ cảm thấy họ đang chơi một game.
>
> Sản phẩm chỉ là “quân cờ” để tạo ra trò chơi.

Đó là triết lý cốt lõi của **Viral Game Video Engine**.
