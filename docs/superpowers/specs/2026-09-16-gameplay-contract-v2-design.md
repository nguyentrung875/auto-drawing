# Master Design Spec: Gameplay Contract v2.1 & Decoupled Engine Architecture

- **Author / Lead**: Architecture & Core Engine
- **Target**: Universal AI Game Video Engine (`auto-drawing`)
- **Status**: Approved Foundation Spec v2.1 (Proceed to Phase A–B Implementation Planning)
- **Primary Goal**: Decouple Game Logic from Presentation/Audio/Timeline, establish Information-Flow Security against leakage, support scale to 30+ mechanics via lifecycle hooks, and enable policy-driven deterministic verification.

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
│      (Type-safe QuestionPrice)   │  │    - VoiceDirector (TTS & SFX)   │
│    - RevealRenderModel<TReveal>  │  │    - Language & Persona Catalog  │
│    - VisualTheme (TV, Cyber,...) │  └──────────────────┬───────────────┘
└──────────────────┬───────────────┘                     │
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. RENDER TIMELINE LAYER                                               │
│    - RenderPlan (Dynamic Durations: 12s, 15s, 18s, 28s, 38s)           │
│    - Canvas / HTML Frame Painter                                       │
│    - Video QA & Information Leakage Audit                              │
└────────────────────────────────────────────────────────────────────────┘
```

### 6 Nguyên Tắc Kiến Trúc v2.1 Bắt Buộc
1. **Single Responsibility per Layer**: `GameState` không chứa thông tin font chữ, màu sắc, thời lượng giây hay câu thoại voice.
2. **Information-Flow Security (Defensive Typing)**: Renderer trong phase Question tuyệt đối không được cấp `answer` hay `actualPrice`. Trường hiển thị giá là discriminated type `QuestionPrice` (HiddenPrice hoặc ReferencePrice).
3. **Type-Safe Discriminated Unions**: Mọi mechanic phải khai báo `RevealPayload` riêng biệt. Bắt lỗi cấu trúc ở compile-time thay vì runtime.
4. **Composited Forkable PRNG**: `ForkableRng` là full object API (`next()`, `fork()`, `int()`, `pick()`, `shuffle()`), hoàn toàn độc lập với `DiversityManager`.
5. **Two-Tier Content Fingerprint**: Kết hợp `ExactFingerprint` (chống lặp tuyệt đối) và `SemanticFingerprint` (chống lặp nhận thức người xem).
6. **Policy-Driven Configurations**: Tách rời toàn bộ tham số cứng (N=50, M=10, -14 LUFS, safe-zone) thành các Policy object có thể cấu hình linh hoạt.

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

### 2.2 MechanicRegistry & Lifecycle Hooks
Tránh để `PresentationCompiler` hay `ScriptPlanner` phình to các câu lệnh `if (mechanicId === ...)` khi mở rộng tới 30+ game. Mỗi game đóng gói đầy đủ lifecycle:

```typescript
// src/core/registry/MechanicRegistry.ts
import type { IForkableRng } from '../rng/ForkableRng';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export interface CreateStateInput {
  entities: RawEntity[];
  rng: IForkableRng;
  difficultyTarget?: Partial<GlobalDifficulty>;
  roundIndex?: number;
  totalRounds?: number;
}

export interface IMechanicDefinition<TReveal = unknown> {
  readonly id: MechanicId;
  readonly name: string;
  readonly defaultTotalRounds: number;
  
  // 1. Logic State Generation & Validation
  createState(input: CreateStateInput): GameState<TReveal>;
  validateState(state: GameState<TReveal>): void;

  // 2. Presentation Compilation (Lifecycle Hooks)
  compileQuestion(state: GameState<TReveal>, themeId: VisualThemeId): QuestionRenderModel;
  compileReveal(state: GameState<TReveal>): RevealRenderModel<TReveal>;

  // 3. Dynamic Script & Difficulty Extraction
  getDifficultyModel(state: GameState<TReveal>): DifficultyProfile;
  getScriptContext(state: GameState<TReveal>): MechanicScriptContext;
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

  static clear(): void {
    this.mechanics.clear();
  }
}
```

---

## 3. Đặc Tả Tầng 2: PresentationModel & Information-Flow Security

### 3.1 Type-Safe QuestionPrice (Loại bỏ Arbitrary Price String)
Để compiler không thể vô tình truyền `displayPrice: "189.000₫"` trong lúc hỏi:

```typescript
// src/core/presentation/types.ts

export type HiddenPrice = {
  kind: 'hidden';
  label: '???';
};

export type ReferencePrice = {
  kind: 'reference';
  value: number;
  label: string; // "189.000₫"
  role: 'anchor_benchmark' | 'original_price';
};

export type QuestionPrice = HiddenPrice | ReferencePrice;

export interface QuestionProductViewModel {
  productId: string;
  name: string;
  image: string;
  brand?: string;
  price: QuestionPrice; // Bắt buộc là type-safe QuestionPrice
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

Tách lời thoại ra khỏi Engine logic:

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

export interface MechanicScriptContext {
  productNames: string[];
  benchmarkPriceLabel?: string;
  bracketLabels?: string[];
  discountRateLabel?: string;
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
- Trộn nhạc nền (BGM), tiếng tick-tock, chuông reo (Chime/Buzzer) với Audio Ducking theo `AudioPolicy`.

---

## 5. Đặc Tả Tầng 4: RenderPlan & Variable Duration

Thời lượng được tính dựa trên **mật độ thông tin (Information Density)**:

```typescript
// src/core/render/types.ts
import type { VisualThemeId } from '../theme/types';

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
  themeId: VisualThemeId;
  slots: RenderSlot[];
}
```

* Quy chuẩn thời lượng linh hoạt:
  * `ONE_AWAY` (nhanh, 1 số): $12.0\text{s} - 15.0\text{s}$.
  * `HI_LO`, `GUESS_THE_PRICE` (chuẩn): $16.0\text{s} - 18.0\text{s}$.
  * `GROCERY_BASKET`, `MOST_EXPENSIVE` (nhiều thẻ): $18.0\text{s} - 22.0\text{s}$.
  * Multi-round 3 vòng: $32.0\text{s} - 38.0\text{s}$.

---

## 6. RNG Phân Nhánh & Quản Lý Đa Dạng (Diversity & Fingerprint)

### 6.1 Forkable PRNG Object API
Cung cấp đầy đủ interface hướng đối tượng, cho phép compose sâu:

```typescript
// src/core/rng/ForkableRng.ts
import seedrandom from 'seedrandom';

export interface IForkableRng {
  next(): number;
  fork(namespace: string): IForkableRng;
  int(min: number, max: number): number;
  pick<T>(array: readonly T[]): T;
  shuffle<T>(array: readonly T[]): T[];
  boolean(probability?: number): boolean;
}

export class ForkableRng implements IForkableRng {
  private readonly rng: () => number;

  constructor(private readonly seedValue: string | number) {
    this.rng = seedrandom(String(seedValue));
  }

  next(): number {
    return this.rng();
  }

  fork(namespace: string): IForkableRng {
    return new ForkableRng(`${this.seedValue}::${namespace}`);
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    const index = Math.floor(this.next() * array.length);
    return array[index]!;
  }

  shuffle<T>(array: readonly T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!] as [T, T];
    }
    return copy;
  }

  boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }
}
```

### 6.2 Hệ Thống Policy Độc Lập
Toàn bộ tham số kiểm duyệt được trích xuất thành policy cấu hình, không hard-code:

```typescript
// src/core/policy/types.ts

export interface DiversityPolicy {
  cooldownProductTuple: number;      // Mặc định: 50 videos
  cooldownHeroSku: number;           // Mặc định: 10 videos
  maxConsecutiveSameAnswer: number;  // Mặc định: 3 videos
  targetAnswerRatio: number;         // Mặc định: 0.5 (50%)
  answerRatioTolerance: number;      // Mặc định: 0.05 (±5%)
}

export interface AudioPolicy {
  targetLufs: number;                // Mặc định: -14.0 LUFS
  lufsTolerance: number;             // Mặc định: ±2.0 LUFS
  maxTruePeakDbTp: number;           // Mặc định: -1.0 dBTP
  maxSilenceDurationSec: number;     // Mặc định: 1.2s
  duckingRatio: number;              // Mặc định: 0.3 (hạ 70%)
}

export interface LayoutPolicy {
  safeZoneTop: number;               // Mặc định: 150px
  safeZoneBottom: number;            // Mặc định: 1480px
  cardMaxWidth: number;              // Mặc định: 400px
  gutter: number;                    // Mặc định: 60px
}

export const DEFAULT_DIVERSITY_POLICY: DiversityPolicy = {
  cooldownProductTuple: 50,
  cooldownHeroSku: 10,
  maxConsecutiveSameAnswer: 3,
  targetAnswerRatio: 0.5,
  answerRatioTolerance: 0.05,
};

export const DEFAULT_AUDIO_POLICY: AudioPolicy = {
  targetLufs: -14.0,
  lufsTolerance: 2.0,
  maxTruePeakDbTp: -1.0,
  maxSilenceDurationSec: 1.2,
  duckingRatio: 0.3,
};

export const DEFAULT_LAYOUT_POLICY: LayoutPolicy = {
  safeZoneTop: 150,
  safeZoneBottom: 1480,
  cardMaxWidth: 400,
  gutter: 60,
};
```

### 6.3 Two-Tier Content Fingerprint
* **Tier 1 — ExactFingerprint:** Băm SHA256 chính xác kỹ thuật:
  $$\text{ExactFingerprint} = \text{SHA256}(\text{mechanicId} + \text{sortedProductIds} + \text{hookId} + \text{voiceId} + \text{themeId} + \text{answerId})$$
* **Tier 2 — SemanticFingerprint:** Băm nhận thức người xem (tránh hai video khác hook/voice nhưng cùng kịch bản cấu trúc):
  $$\text{SemanticFingerprint} = \text{SHA256}(\text{mechanicId} + \text{productCategories} + \text{questionIntent} + \text{difficultyBand} + \text{revealStructure})$$
* Lưu trữ tại `data/fingerprints/history.json`.

---

## 7. Chốt Chặn Kiểm Tra Toàn Diện: Pre-Render & Post-Render Video QA

### 7.1 Pre-Render GameplayValidator & Leakage Audit
Kiểm tra tại thời điểm `PresentationModel` vừa được biên dịch:
* **No Price Leak:** Duyệt `QuestionRenderModel.entities`. Đảm bảo `entity.price.kind === 'hidden'` nếu sản phẩm đó thuộc đối tượng cần đoán.
* **No Answer Leak:** Báo lỗi nếu nhãn lựa chọn có dấu hiệu highlight màu khác biệt trước reveal.
* **No Technical ID:** Quét regex `^p\d{3,}$` trên mọi chuỗi text người xem nhìn thấy.

### 7.2 Post-Render Video QA
Kiểm tra tệp MP4 và WAV thành phẩm theo `AudioPolicy` và `LayoutPolicy`:
* **Structural:** Video 1080×1920 @ 30fps $\pm 0.1$, codec h264, không có khung hình đen (black frames).
* **Acoustic Standards:** Kiểm tra Integrated LUFS, True Peak, và khoảng lặng theo `AudioPolicy`.
* **Text & Margin Audit:** Đảm bảo toàn bộ chữ nằm trong Safe Zone quy định bởi `LayoutPolicy`.

---

## 8. Lộ Trình Triển Khai Phân Tầng (Phased Implementation Roadmap)

```text
Phase A: Foundation Core (P0)
  ├── 1. Khởi tạo ForkableRng (full object API: next, fork, int, pick, shuffle)
  ├── 2. Xây dựng GameState & MechanicRegistry với đầy đủ Lifecycle Hooks
  ├── 3. Định nghĩa QuestionRenderModel (Type-safe QuestionPrice) & RevealRenderModel
  ├── 4. Khởi tạo Policy Module (DiversityPolicy, AudioPolicy, LayoutPolicy)
  └── 5. Xây dựng File-based ContentFingerprintStore (Exact + Semantic Fingerprints)

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
   * `QuestionRenderModel.entities` dùng `QuestionPrice`; về mặt hệ thống kiểu dữ liệu không thể chứa `actualPrice` của sản phẩm bí mật.
2. **Gate 2: Determinism (Phân Tầng Rõ Ràng)**
   * **GameplayState, RenderPlan, ScriptPlan:** Bit-for-bit deterministic trên cùng 1 seed.
   * **Audio / Video Thành Phẩm:** Deterministic về mặt **semantic, cấu trúc và timing** (sai số timing $\le 0.033\text{s}$ tương đương 1 frame). Không bắt buộc binary identical do đặc thù bộ mã hóa FFmpeg và rasterizer font.
   * Batch 100 video ngẫu nhiên không có 2 video nào bị trùng `ExactFingerprint` hoặc `SemanticFingerprint`; tỷ lệ đáp án A/B đạt $50\% \pm 5\%$ tuân theo `DiversityPolicy`.
3. **Gate 3: Multi-Round Rendering**
   * CLI `game render --mechanic GROCERY_BASKET --mode multi` hiển thị chuẩn khay 3 món đồ, giá giỏ hàng được giấu kín trước reveal, giọng đọc MC khớp chính xác từng vòng.
