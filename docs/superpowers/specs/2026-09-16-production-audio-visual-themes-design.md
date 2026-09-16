# Master Design Spec: Production Audio, Visual Themes & Video QA (Phase D)

- **Author / Lead**: Architecture & Core Engine
- **Target**: Universal AI Game Video Engine (`auto-drawing`)
- **Status**: Approved Design Spec (Incorporating 7 Architectural Review Refinements)
- **Primary Goal**: Establish production-grade visual theming, elastic speech pacing with timeline conflict validation, audio mix policy with ducking, two-tier QA (Pre-render Layout vs. Post-render Acoustic/Artifact), and resilient 3-state output triaging (`PASS` | `REMEDIATED` | `QUARANTINED`).

---

## 1. Tầm Nhìn Kiến Trúc & Quy Trình 8 Bước (Production Pipeline)

Để hỗ trợ sản xuất quy mô lớn từ 100 đến 10.000 video/ngày mà không làm sập pipeline khi một video gặp sự cố, hệ thống xử lý Phase D được tổ chức thành quy trình 8 bước:

```text
┌─────────────────────────────────────────────────────────────┐
│ D1. VisualTheme Tokens (Colors, Typography, Geometry)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D2. VoiceDirector & AudioMixPolicy                          │
│     - Speech synthesis (EdgeTTS / ViPiper)                  │
│     - AudioMixPolicy (voiceDuckDb, attackMs, releaseMs)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D3. Elastic Timeline & TimelineConflictValidator (P0 Gate)  │
│     - Voice <= Slot duration, No overlap, No negative gaps  │
│     - Question -> Reveal -> CTA sequencing audit            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D4. G7 Multi-Round Renderer                                 │
│     - 3-item tray layout for GROCERY_BASKET                 │
│     - Itemized bill, surplus/deficit visualization          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D5. Pre-Render QA Gate (Deterministic Layout Geometry)      │
│     - Safe-zone bounding box (Y in [150, 1480])             │
│     - Card overlap & text overflow audit                    │
│     - Zero price/SKU leakage (GameplayValidator)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ FFmpeg Video & Audio Rendering (Canvas Frames -> MP4)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D6. Post-Render Acoustic & Artifact QA                      │
│     - ebur128 (Integrated LUFS, True Peak, LRA, Silence)    │
│     - blackdetect & frozendetect                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D7. Auto-Remediation (Audio Stream-Copy loudnorm)           │
│     - Re-encode audio ONLY (-c:v copy, no video re-render)  │
│     - 2-pass EBU R128 normalization & peak limiting         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ D8. Re-QA & State Triaging                                  │
│     ├── PASS (Đạt chuẩn ngay lần 1)                         │
│     ├── REMEDIATED (Đã tự động sửa lỗi âm thanh an toàn)    │
│     └── QUARANTINED (Lỗi không thể tự sửa -> cách ly)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Đặc Tả D1: Hệ Thống `VisualTheme` Tokens & Style Config

Tách biệt giao diện khỏi logic vẽ canvas. Canvas chỉ nhận Token:

```typescript
// src/core/theme/types.ts

export type VisualThemeId = 'tv_game_show' | 'clean_shopping' | 'cyber_arcade';

export interface ThemeColors {
  backgroundGradient: [string, string];
  stageOverlay?: 'grid' | 'spotlight' | 'scanline' | 'none';
  cardBackground: string;
  cardBorder: string;
  cardShadow: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  countdownRing: string;
  revealBannerSuccess: string;
  revealBannerWarning: string;
}

export interface ThemeTypography {
  fontFamilyHeadline: string;
  fontFamilyBody: string;
  fontFamilyPrice: string;
  textTransformHeadline: 'uppercase' | 'none';
}

export interface ThemeGeometry {
  cardBorderRadius: number; // 24 (tv), 16 (shopping), 0 (arcade)
  cardBorderWidth: number;
  glowIntensity: number;    // 0 (shopping) -> 24px (arcade neon)
}

export interface VisualTheme {
  id: VisualThemeId;
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  geometry: ThemeGeometry;
  assets: {
    bgmTrack: string;
    correctSfx: string;
    wrongSfx: string;
    countdownSfx: string;
  };
}
```

### 3 Theme Tiêu Chuẩn
1. **`tv_game_show`**: Sang trọng, kịch tính. Nền xanh than `#0f172a` $\to$ `#1e1b4b`, nhấn vàng kim `#fbbf24`, bo góc 24px, nhạc đố vui truyền hình.
2. **`clean_shopping`**: Hiện đại, tối giản. Nền xám đen `#18181b`, viền mỏng tinh tế, accent cam sàn TMĐT `#f97316`, bo góc 16px.
3. **`cyber_arcade`**: Retro neon, góc cạnh. Nền `#09090b`, viền cyan `#06b6d4` & hồng `#f43f5e`, glow 20px, bo góc 0px (vuông góc), nhạc 8-bit điện tử.

---

## 3. Đặc Tả D2: `VoiceDirector` & `AudioMixPolicy`

Không hard-code tỷ lệ % ducking; toàn bộ tham số được quản lý qua Policy:

```typescript
// src/core/policy/types.ts

export interface AudioMixPolicy {
  targetLufs: number;            // Mặc định: -14.0 LUFS
  lufsTolerance: number;         // Mặc định: ±1.5 LUFS
  maxTruePeakDbTp: number;       // Mặc định: -1.0 dBTP
  maxLra: number;                // Mặc định: 12.0 LRA (tránh dải động quá lớn)
  maxSilenceDurationSec: number; // Mặc định: 1.2s
  voiceDuckDb: number;           // Mặc định: -8.0 dB (giảm BGM 8dB khi MC nói)
  duckAttackMs: number;          // Mặc định: 150 ms
  duckReleaseMs: number;         // Mặc định: 300 ms
}

export const DEFAULT_AUDIO_MIX_POLICY: AudioMixPolicy = {
  targetLufs: -14.0,
  lufsTolerance: 1.5,
  maxTruePeakDbTp: -1.0,
  maxLra: 12.0,
  maxSilenceDurationSec: 1.2,
  voiceDuckDb: -8.0,
  duckAttackMs: 150,
  duckReleaseMs: 300,
};
```

---

## 4. Đặc Tả D3: Elastic Timeline & `TimelineConflictValidator` (P0 Gate)

Khi độ dài TTS co giãn thực tế, `RenderPlan` phải được tính toán động và thẩm định nghiêm ngặt trước khi gửi sang renderer:

```typescript
// src/core/timeline/TimelineConflictValidator.ts

export interface TimelineSlot {
  id: string;
  name: string;
  phase: 'hook' | 'question' | 'countdown' | 'reveal' | 'cta';
  startSec: number;
  durationSec: number;
  voiceEventId?: string;
  voiceDurationSec?: number;
}

export interface TimelineValidationReport {
  valid: boolean;
  errors: string[];
  totalDurationSec: number;
}

export class TimelineConflictValidator {
  static validate(slots: TimelineSlot[], policy: AudioMixPolicy): TimelineValidationReport {
    const errors: string[] = [];
    
    // 1. No negative duration & strictly sequential
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      if (slot.durationSec <= 0) {
        errors.push(`Slot "${slot.id}" has invalid duration: ${slot.durationSec}s`);
      }
      
      // 2. Voice fits within slot
      if (slot.voiceDurationSec && slot.voiceDurationSec > slot.durationSec) {
        errors.push(`Slot "${slot.id}" voice (${slot.voiceDurationSec.toFixed(2)}s) exceeds slot duration (${slot.durationSec.toFixed(2)}s)`);
      }
      
      // 3. No overlap with next slot & gap within silence policy
      if (i < slots.length - 1) {
        const next = slots[i + 1]!;
        const slotEnd = slot.startSec + slot.durationSec;
        if (slotEnd > next.startSec + 0.01) {
          errors.push(`Slot overlap: "${slot.id}" ends at ${slotEnd.toFixed(2)}s, but next slot "${next.id}" starts at ${next.startSec.toFixed(2)}s`);
        }
        const gap = next.startSec - slotEnd;
        if (gap > policy.maxSilenceDurationSec) {
          errors.push(`Dead silence gap (${gap.toFixed(2)}s) between "${slot.id}" and "${next.id}" exceeds policy (${policy.maxSilenceDurationSec}s)`);
        }
      }
    }
    
    // 4. Structural Phase Ordering
    const phaseOrder = ['hook', 'question', 'countdown', 'reveal', 'cta'];
    let lastOrderIdx = -1;
    for (const slot of slots) {
      const idx = phaseOrder.indexOf(slot.phase);
      if (idx !== -1) {
        if (idx < lastOrderIdx) {
          errors.push(`Invalid phase sequencing: "${slot.phase}" appeared after later phase in timeline`);
        }
        lastOrderIdx = idx;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      totalDurationSec: slots.length > 0 ? slots[slots.length - 1]!.startSec + slots[slots.length - 1]!.durationSec : 0,
    };
  }
}
```

---

## 5. Đặc Tả D4: Multi-Round 3-Item Tray Renderer cho G7 (`GROCERY_BASKET`)

Hỗ trợ layout khay chứa chuyên biệt cho giỏ hàng 3 món:
* **Question Phase**: 3 thẻ sản phẩm nằm trong khay shopping cart, giá hiển thị là `{ kind: 'hidden', label: '???' }`.
* **Reveal Phase**: Khay trượt lên, hiển thị hóa đơn tổng:
  $$\text{Tổng giỏ hàng: } X\text{₫} \quad (\text{Ngân sách: } Y\text{₫})$$
  Badge `ĐỦ TIỀN` (xanh) nếu $\le Y$, hoặc `CHÁY TÚI` (đỏ) nếu $> Y$.

---

## 6. Đặc Tả D5: Pre-Render Layout & Safe-Zone Geometry QA

Kiểm tra hình học bố cục **trước khi render**, dựa vào metadata bounding box của các thẻ và chữ:
* **Safe-Zone Top/Bottom**: Toàn bộ bounding box của chữ và thẻ phải nằm trong $Y \in [150, 1480]$.
* **No Element Overlap**: Bounding box của thẻ A không đè lên thẻ B, text question không đè lên thanh đếm ngược.
* Nếu vi phạm $\to$ dừng pipeline ngay lập tức, không tốn tài nguyên chạy FFmpeg.

---

## 7. Đặc Tả D6–D8: Post-Render Video QA, Auto-Remediation & 3-State Triaging

### 7.1 Kiểm Tra Hậu Kỳ (Post-Render Defense-in-Depth)
Sau khi tệp MP4 được tạo ra:
* **Acoustic Audit (`ebur128`)**:
  - `integratedLufs` (Chuẩn: $-14.0 \pm 1.5$ LUFS)
  - `truePeakDbTp` (Chuẩn: $\le -1.0$ dBTP)
  - `loudnessRangeLra` (Chuẩn: $\le 12.0$ LRA)
  - `maxSilenceSec` (Chuẩn: $\le 1.2$s)
* **Visual Anomaly Audit**:
  - `unexpectedBlackFrameSeconds`: Quét khung đen bằng filter `blackdetect=d=0.2:pix_th=0.10`. Trừ đi các đoạn fade transition có chủ đích ở đầu/cuối clip. Nếu còn khung đen bất thường $\to$ lỗi.
  - `frozenFrameSegments`: Quét khung hình bị treo cứng $>1.5$s (`freezedetect`).

### 7.2 Non-Destructive Auto-Remediation (`-c:v copy`)
Nếu chỉ gặp lỗi về âm lượng (LUFS hoặc True Peak lệch chuẩn):
* Chạy pass FFmpeg sửa âm thanh, giữ nguyên video 1080p:
  ```bash
  ffmpeg -y -i input.mp4 -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={I}:measured_TP={TP}:measured_LRA={LRA}" -c:v copy -c:a aac -b:a 192k remediated.mp4
  ```
* Tiêu chí chấp nhận: **Tính chính xác của âm thanh đầu ra** (re-measure đạt chuẩn LUFS và True Peak), không ép buộc thời gian runtime cố định.

### 7.3 Ba Trạng Thái Phê Duyệt (`QAStatus`) & Báo Cáo Truy Vết

```typescript
// src/core/qa/types.ts

export type QAStatus = 'PASS' | 'REMEDIATED' | 'QUARANTINED';

export interface QARemediationRecord {
  type: 'audio_loudnorm' | 'peak_limiter';
  before: { integratedLufs: number; truePeakDbTp: number };
  after: { integratedLufs: number; truePeakDbTp: number };
  timestamp: number;
}

export interface VideoQAReport {
  status: QAStatus;
  attempt: number;
  videoPath: string;
  checks: {
    format: { resolution: string; fps: number; passed: boolean };
    acoustics: { lufs: number; truePeak: number; lra: number; passed: boolean };
    artifacts: { unexpectedBlackSec: number; frozenSec: number; passed: boolean };
  };
  remediations: QARemediationRecord[];
  quarantineReason?: string;
}
```

* **Quy tắc phân loại**:
  - `PASS`: Đạt chuẩn 100% ngay từ lần đo đầu tiên.
  - `REMEDIATED`: Bị lệch LUFS hoặc True Peak, nhưng đã được sửa thành công bằng `loudnorm -c:v copy` và đo lại đạt chuẩn.
  - `QUARANTINED`: Lỗi hình học pre-render, khung đen bất thường, hình bị đóng băng, hoặc remediate 2 lần vẫn không đạt chuẩn. Tệp được chuyển vào thư mục `quarantine/` kèm `qa_report.json` để không làm gián đoạn các video khác trong mẻ batch.

---

## 8. Tiêu Chí Nghiệm Thu Phase D

1. **Gate 1: Compile & Type Safety**: `tsc --noEmit` đạt 0 lỗi.
2. **Gate 2: Timeline Collision Free**: `TimelineConflictValidator` chặn 100% trường hợp voice đọc lấn qua countdown hoặc reveal.
3. **Gate 3: Audio Standardized**: Video thành phẩm đạt Integrated LUFS $-14.0 \pm 1.5$ và True Peak $\le -1.0$ dBTP. Các video lệch được tự động sửa thành `REMEDIATED`.
4. **Gate 4: Batch Resilience**: Một video bị lỗi layout hoặc khung đen sẽ nhận trạng thái `QUARANTINED` mà không làm crash tiến trình render batch.
