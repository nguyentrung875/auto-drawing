# Master Design Spec: Gameplay Contract v2 & Decoupled Engine Architecture

- **Author / Lead**: Architecture & Core Engine
- **Target**: Universal AI Game Video Engine (`auto-drawing`)
- **Status**: Approved Foundation Spec (Ready for Implementation Planning)
- **Primary Goal**: Decouple Game Logic from Presentation/Audio/Timeline, establish Information-Flow Security against leakage, support scale to 30+ mechanics, and enable rigorous deterministic verification.

---

## 1. Tầm Nhìn & Nguyên Tắc Cốt Lõi (Architecture Principles)

Hệ thống được tái cấu trúc từ nền tảng nguyên khối sang **4 tầng phân lập nghiêm ngặt (4-Layer Separation)**:

```text
               CATALOG / DATABASE
                       │
                       ▼
               CHALLENGE CURATOR (Sampling & Diversity Filter)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. GAMEPLAY STATE LAYER (Pure Math & Logic)                 │
│    - GameState (Entities, Hidden Values, Choices, Answer)   │
│    - DifficultyProfile (Global + Mechanic Specific)         │
│    - Completely renderer-agnostic, language-agnostic        │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ 2. PRESENTATION LAYER            │  │ 3. SCRIPT & AUDIO PLAN LAYER     │
│    - QuestionRenderModel         │  │    - ScriptPlan (Events & Copy)  │
│      (Actual price stripped!)    │  │    - VoiceDirector (TTS & SFX)   │
│    - RevealRenderModel<TReveal>  │  │    - Language & Persona Catalog  │
│    - VisualTheme (TV, Cyber,...) │  └──────────────────┬───────────────┘
└──────────────────┬───────────────┘                     │
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. RENDER TIMELINE LAYER                                               │
│    - RenderPlan (Dynamic Durations: 15s, 18s, 28s, 38s)                │
│    - Canvas / HTML Frame Painter                                       │
│    - Video QA & Information Leakage Audit                              │
└────────────────────────────────────────────────────────────────────────┘
```

### 5 Nguyên Tắc Kiến Trúc Bắt Buộc
1. **Single Responsibility per Layer**: `GameState` không chứa thông tin font chữ, màu sắc, thời lượng giây hay câu thoại voice.
2. **Information-Flow Security (Defensive Typing)**: Renderer trong phase Question tuyệt đối không được cấp `answer` hay `actualPrice`. Dữ liệu đáp án chỉ tồn tại trong `RevealRenderModel`.
3. **Type-Safe Discriminated Unions**: Mọi mechanic phải khai báo `RevealPayload` riêng biệt. Bắt lỗi cấu trúc ở compile-time thay vì runtime.
4. **Forkable PRNG & Separated Diversity**: PRNG có cơ chế phân nhánh namespace (`rng.fork(...)`), tách biệt hoàn toàn với `DiversityManager` (quản lý lịch sử và chống va chạm nội dung).
5. **Content Fingerprint & Contract Testing**: Mỗi video có mã băm định danh lưu trữ tại `data/fingerprints/history.json`. Mỗi mechanic có suite test hợp đồng (contract test) bất biến.

---

## 2. Đặc Tả Tầng 1: GameState & MechanicRegistry

### 2.1 GameState & DifficultyProfile
`GameState` đại diện cho trạng thái toán học của vòng chơi:

```typescript
// src/core/state/types.ts

export type MechanicId = string;

export interface GlobalDifficulty {
  priceProximity: number;   // 0.0 (xa) -> 1.0 (sát nút)
  familiarity: number;      // 0.0 (hiếm lạ) -> 1.0 (phổ thông)
  visualDeception: number;  // 0.0 (trực quan) -> 1.0 (xung đột nhận thức cực độ)
}

export interface DifficultyProfile {
  global: GlobalDifficulty;
  mechanicData?: Record<string, number | string>;
}

export interface RawEntity {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  brand?: string;
  category: string;
}

export interface ChoiceState {
  id: string;              // "A", "B", "C", "D"
  label: string;           // Nhãn lựa chọn logic: "higher", "scam", "bracket_1"
  value?: unknown;
}

export interface GameState<TRevealPayload = unknown> {
  gameId: string;
  mechanicId: MechanicId;
  seed: number;
  roundIndex: number;
  totalRounds: number;
  entities: RawEntity[];
  choices: ChoiceState[];
  answer: {
    winningChoiceId: string;
    revealPayload: TRevealPayload;
  };
  difficulty: DifficultyProfile;
  metadata: {
    createdAt: number;
    seriesNumber?: number;
  };
}
```

### 2.2 MechanicRegistry & Extensibility Pattern
Không hard-code enum 7 game. Mọi game đăng ký qua `MechanicRegistry`:

```typescript
// src/core/registry/MechanicRegistry.ts

export interface IMechanicDefinition<TReveal = unknown> {
  readonly id: MechanicId;
  readonly name: string;
  readonly defaultTotalRounds: number;
  
  createGameState(input: {
    entities: RawEntity[];
    rng: ForkableRng;
    difficultyTarget?: Partial<GlobalDifficulty>;
    roundIndex?: number;
    totalRounds?: number;
  }): GameState<TReveal>;

  validateGameState(state: GameState<TReveal>): void;
}

export class MechanicRegistry {
  private static readonly mechanics = new Map<MechanicId, IMechanicDefinition<any>>();

  static register<T>(mechanic: IMechanicDefinition<T>): void {
    if (this.mechanics.has(mechanic.id)) {
      throw new Error(`Mechanic ${mechanic.id} already registered`);
    }
    this.mechanics.set(mechanic.id, mechanic);
  }

  static get<T = unknown>(id: MechanicId): IMechanicDefinition<T> {
    const found = this.mechanics.get(id);
    if (!found) throw new Error(`Mechanic "${id}" not found in registry`);
    return found as IMechanicDefinition<T>;
  }

  static list(): string[] {
    return Array.from(this.mechanics.keys());
  }
}
```

---

## 3. Đặc Tả Tầng 2: PresentationModel & Information-Flow Security

### 3.1 Tách Rời QuestionRenderModel & RevealRenderModel
Để triệt tiêu vĩnh viễn nguy cơ lộ giá hoặc rò rỉ đáp án trong pha đếm ngược:

```typescript
// src/core/presentation/types.ts

export interface QuestionProductViewModel {
  productId: string;
  name: string;
  image: string;
  brand?: string;
  displayPrice: string; // "???" hoặc mốc so sánh (ví dụ: "189.000₫")
  badgeTag?: string;    // "MỐC CHUẨN", "SALE -50%"
}

export interface QuestionChoiceViewModel {
  id: string;           // "A", "B", "C", "D"
  label: string;        // Text người xem nhìn thấy: "CAO HƠN ⬆️", "100K - 150K"
}

/**
 * QuestionRenderModel CHỈ ĐƯỢC PHÉP CHỨA dữ liệu hiển thị trước reveal.
 * Tuyệt đối không chứa `isCorrect`, không chứa `actualPrice`.
 */
export interface QuestionRenderModel {
  mechanicId: MechanicId;
  roundIndex: number;
  totalRounds: number;
  questionHeadline: string;
  entities: QuestionProductViewModel[];
  choices: QuestionChoiceViewModel[];
}

/**
 * RevealRenderModel chứa kết quả và payload định danh.
 */
export interface RevealRenderModel<TPayload> {
  winningChoiceId: string;
  headlineBanner: string;
  subDetailBanner: string;
  payload: TPayload;
}

export interface PresentationModel<TPayload> {
  question: QuestionRenderModel;
  reveal: RevealRenderModel<TPayload>;
  cta: {
    bannerText: string;
    subText: string;
    variant: 'single_round_challenge' | 'multi_round_scorecard' | 'comment_debate';
  };
}
```

### 3.2 Discriminated Unions cho RevealPayload
Bắt buộc kiểu dữ liệu kiểm tra đúng theo từng game:

```typescript
// src/core/presentation/reveals.ts

export interface HiLoReveal {
  kind: 'HI_LO';
  priceA: number;
  priceB: number;
  comparison: 'higher' | 'lower';
}

export interface MostExpensiveReveal {
  kind: 'MOST_EXPENSIVE';
  prices: Array<{ productId: string; name: string; price: number }>;
  highestProductId: string;
}

export interface OneAwayReveal {
  kind: 'ONE_AWAY';
  fullPrice: number;
  revealedDigit: number;
  hiddenDigitIndex: number;
}

export interface OddOneOutReveal {
  kind: 'ODD_ONE_OUT';
  oddProductId: string;
  reason: 'category' | 'brand' | 'price_outlier';
  explanation: string;
}

export interface GuessThePriceReveal {
  kind: 'GUESS_THE_PRICE';
  actualPrice: number;
  correctBracketLabel: string;
}

export interface GroceryBasketReveal {
  kind: 'GROCERY_BASKET';
  budget: number;
  totalBill: number;
  isUnderBudget: boolean;
  itemPrices: Array<{ productId: string; name: string; price: number }>;
}

export interface DealOrScamReveal {
  kind: 'DEAL_OR_SCAM';
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  verdict: 'deal' | 'scam';
  explanation: string;
}

export type AnyRevealPayload =
  | HiLoReveal
  | MostExpensiveReveal
  | OneAwayReveal
  | OddOneOutReveal
  | GuessThePriceReveal
  | GroceryBasketReveal
  | DealOrScamReveal;
```

---

## 4. Đặc Tả Tầng 3: ScriptPlan & VoiceDirector

Tách lời thoại ra khỏi Engine logic. `ScriptPlanner` đóng vai trò biên soạn kịch bản từ catalog câu thoại:

```typescript
// src/core/script/types.ts

export type ScriptEventType =
  | 'HOOK'
  | 'QUESTION'
  | 'URGENCY'
  | 'REVEAL'
  | 'MICRO_HOOK'
  | 'SCORECARD'
  | 'CTA';

export interface ScriptEvent {
  id: string;
  type: ScriptEventType;
  text: string;
  timingOffsetSec: number;
  maxDurationSec: number;
  emotion?: 'neutral' | 'excited' | 'urgent' | 'surprised';
}

export interface ScriptPlan {
  roundIndex: number;
  events: ScriptEvent[];
  voiceId: string;
}
```

`VoiceDirector` là bộ xử lý âm thanh kỹ thuật:
- Nhận `ScriptPlan`.
- Gọi TTS engine (ViPiper hoặc EdgeTTS) để sinh âm thanh giọng đọc.
- Kiểm tra độ dài âm thanh thực tế so với `maxDurationSec` (Dynamic Timeline Gap Validation).
- Trộn nhạc nền (BGM), tiếng tick-tock, chuông reo (Chime/Buzzer) với kỹ thuật tự động hạ âm lượng nhạc nền (Audio Ducking) $70\%$ khi có giọng đọc.

---

## 5. Đặc Tả Tầng 4: RenderPlan & Variable Duration

Engine không ép buộc mọi video 1-round là 18s, multi-round là 38s. Thời lượng được tính dựa trên **mật độ thông tin (Information Density)**:

```typescript
// src/core/render/types.ts

export interface RenderSlot {
  name: string;
  phase: 'hook' | 'question' | 'countdown' | 'reveal' | 'transition' | 'cta';
  durationSec: number;
  startSec: number;
  endSec: number;
  activeRoundIndex: number;
}

export interface RenderPlan {
  totalDurationSec: number;
  fps: number;
  themeId: 'tv_game_show' | 'clean_shopping' | 'cyber_arcade' | 'street_quiz';
  slots: RenderSlot[];
}
```

* Quy chuẩn thời lượng linh hoạt:
  * `ONE_AWAY` (nhanh, 1 số): $12.0\text{s} - 15.0\text{s}$.
  * `HI_LO`, `GUESS_THE_PRICE` (chuẩn): $16.0\text{s} - 18.0\text{s}$.
  * `GROCERY_BASKET`, `MOST_EXPENSIVE` (nhiều thẻ): $18.0\text{s} - 22.0\text{s}$.
  * Multi-round 3 vòng: $32.0\text{s} - 38.0\text{s}$.

---

## 6. Hệ Thống RNG Phân Nhánh & Quản Lý Đa Dạng (Diversity & Fingerprint)

### 6.1 Forkable PRNG
```typescript
// src/core/rng/ForkableRng.ts
import seedrandom from 'seedrandom';

export class ForkableRng {
  constructor(private readonly seedValue: string | number) {}

  fork(namespace: string): () => number {
    return seedrandom(`${this.seedValue}::${namespace}`);
  }
}
```

### 6.2 Quản Lý Tránh Trùng Lặp (DiversityManager)
* Quản lý bộ đệm trượt LRU lưu trong file `data/fingerprints/history.json`.
* **Quy tắc ngăn chặn (Collision Policy):**
  1. Không lặp lại cùng bộ tuple sản phẩm trong $N = 50$ video gần nhất.
  2. Không đặt cùng một SKU làm Hero Product trong $M = 10$ video gần nhất.
  3. Cân bằng chuỗi đáp án: `maxConsecutiveSameAnswer <= 3` (không để xuất hiện chuỗi A-A-A-A liên tiếp).

### 6.3 Content Fingerprint
* Hàm băm kiểm tra duy nhất trước khi render:
  $$\text{Fingerprint} = \text{SHA256}(\text{mechanicId} + \text{sortedProductIds} + \text{hookId} + \text{voiceId} + \text{themeId} + \text{answerId})$$
* Nếu phát hiện Fingerprint đã tồn tại trong `data/fingerprints/history.json` $\to$ Từ chối render, kích hoạt Curator chọn tổ hợp mới.

---

## 7. Chốt Chặn Kiểm Tra Toàn Diện: Pre-Render & Post-Render Video QA

### 7.1 Pre-Render GameplayValidator & Leakage Audit
Kiểm tra tại thời điểm `PresentationModel` vừa được biên dịch:
* **No Price Leak:** Duyệt `QuestionRenderModel.entities`. Báo lỗi ngay nếu `displayPrice` chứa giá trị số nguyên của sản phẩm khi chưa đến Reveal.
* **No Answer Leak:** Báo lỗi nếu nhãn lựa chọn có dấu hiệu highlight màu khác biệt trước reveal.
* **No Technical ID:** Quét regex `^p\d{3,}$` trên mọi chuỗi text người xem nhìn thấy.

### 7.2 Post-Render Video QA
Kiểm tra tệp MP4 và WAV thành phẩm:
* **Structural:** Video 1080×1920 @ 30fps $\pm 0.1$, codec h264, không có khung hình đen (black frames).
* **Acoustic Standards:**
  * Âm lượng tích hợp: $-14\text{ LUFS} \pm 2\text{ LUFS}$ (Chuẩn TikTok/Reels).
  * True Peak: $\le -1.0\text{ dBTP}$.
  * Không có khoảng lặng không mong muốn $> 1.2\text{s}$.
* **Text & Margin Audit:** Đảm bảo toàn bộ chữ nằm trong Safe Zone ($y \in [150, 1480]$) để không bị giao diện TikTok che khuất.

---

## 8. Lộ Trình Triển Khai Phân Tầng (Phased Implementation Roadmap)

```text
Phase A: Foundation Core (P0)
  ├── 1. Khởi tạo ForkableRng (rng.fork)
  ├── 2. Xây dựng GameState & MechanicRegistry
  ├── 3. Định nghĩa QuestionRenderModel & RevealRenderModel (Information Security)
  ├── 4. Xây dựng File-based ContentFingerprintStore (data/fingerprints/history.json)
  └── 5. Xây dựng DiversityManager & Bộ kiểm soát Answer Sequence Bias

Phase B: Safety & Validation (P0)
  ├── 6. GameplayValidator & Pre-render Leakage Audit
  ├── 7. Xây dựng Contract Test Runner & Bộ snapshot test mẫu
  └── 8. Tách PresentationCompiler & ScriptPlanner khỏi Renderer

Phase C: Refactor 7 Mechanics Hiện Hữu (P0)
  ├── 9. HI_LO: Tái cấu trúc Split-Card (Thẻ A mốc chuẩn, Thẻ B ảnh + ???)
  ├── 10. GROCERY_BASKET: Ẩn giá toàn bộ trong pha hỏi, phân bổ uncertainty
  ├── 11. MOST_EXPENSIVE: Map answer thành nhãn/tên sản phẩm (xóa sạch "p015")
  ├── 12. GUESS_THE_PRICE: Đồng bộ voice hỏi theo khoảng giá Range A/B
  ├── 13. ONE_AWAY: Ráp DigitReveal payload chuẩn
  ├── 14. DEAL_OR_SCAM: Tích hợp đầy đủ vào CLI render multi-round
  └── 15. ODD_ONE_OUT: Bổ sung text lý do khác biệt vào RevealPayload

Phase D: Production Audio & Visual Themes (P1)
  ├── 16. VoiceDirector & Dynamic Timeline TTS cho Multi-round
  ├── 17. Multi-round Canvas Painter hỗ trợ khay 3 món cho G7
  ├── 18. Tách VisualTheme (TV Game Show, Clean Shopping, Cyber Arcade)
  └── 19. Module Post-render Video QA (LUFS, True Peak, Safe-zone)

Phase E: Continuous Learning & Optimization (P2)
  ├── 20. ContentGenome logging
  ├── 21. Analytics Ingestion (Hold rate, completion rate, drop-off)
  └── 22. Weight Calibrator tự động ưu tiên biến thể thắng
```

---

## 9. Tiêu Chí Nghiệm Thu (Acceptance Criteria & Quality Gates)

1. **Gate 1: Contract Typing & Leakage Proof**
   * Codebase biên dịch `tsc --noEmit` đạt 0 lỗi.
   * Bài kiểm tra `QuestionRenderModel` chứng minh về mặt cấu trúc không thể chứa giá thật trước khi gọi `RevealRenderModel`.
2. **Gate 2: Reproducibility & Diversity**
   * Cùng 1 seed luôn sinh ra 100% video và audio bit-for-bit giống nhau.
   * Batch 100 video ngẫu nhiên không có 2 video nào bị trùng Content Fingerprint; tỷ lệ đáp án A/B đạt $50\% \pm 5\%$, không có chuỗi trùng quá 3 lần liên tiếp.
3. **Gate 3: Multi-Round Rendering**
   * CLI `game render --mechanic GROCERY_BASKET --mode multi` hiển thị chuẩn khay 3 món đồ, giá giỏ hàng được giấu kín trước reveal, giọng đọc MC khớp chính xác từng vòng.
