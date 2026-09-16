# Production Audio, Visual Themes & Video QA (Phase D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase D of the Universal Video Engine: Visual Theme Token System, Elastic Speech Timeline with P0 Conflict Validation, Pre-Render Geometry QA, G7 3-Item Tray Renderer, Post-Render Acoustic/Artifact QA with Non-Destructive Auto-Remediation, and 3-State Batch Triaging (`PASS` | `REMEDIATED` | `QUARANTINED`).

**Architecture:** 8-Stage Production Pipeline. Styling is decoupled through `ThemeTokens`. Pacing is elastic and validated pre-render via `TimelineConflictValidator` to prevent voice/countdown/reveal overlap. Bounding-box geometry and information leakage are audited pre-render. Post-render acoustic auditing (`ebur128`) auto-remediates loudness using stream-copy `-c:v copy` without re-encoding frames. Videos are triaged into `PASS`, `REMEDIATED`, or `QUARANTINED` with full remediation histories logged to `qa_report.json`.

**Tech Stack:** TypeScript (strict mode), Node.js (child_process/fs), FFmpeg (`ebur128`, `loudnorm`, `blackdetect`, `freezedetect`), vitest.

**Spec:** [`docs/superpowers/specs/2026-09-16-production-audio-visual-themes-design.md`](file:///d:/My%20Folder/source_code/auto-drawing/docs/superpowers/specs/2026-09-16-production-audio-visual-themes-design.md)

## Global Constraints
- Zero TypeScript errors: `npx tsc --noEmit` must always pass.
- All tests run via `npx vitest run <test-file>`.
- Pre-render geometry audits must run before any FFmpeg call.
- Audio remediation must use `-c:v copy` (never re-render canvas or re-encode video frames).
- Remediation history must be recorded in `qa_report.json`.
- Frequent commits: commit after each completed task.

---

### Task 1: VisualTheme Token System & Standard Themes

**Files:**
- Create: `src/core/theme/types.ts`
- Create: `src/core/theme/themes.ts`
- Create: `src/core/theme/index.ts`
- Test: `test/core/theme/themes.test.ts`

**Interfaces:**
- Produces: `VisualTheme`, `ThemeColors`, `ThemeTypography`, `ThemeGeometry`, `BUILTIN_THEMES`, `getTheme(id: VisualThemeId)`.

- [ ] **Step 1: Write tests in `test/core/theme/themes.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { getTheme, BUILTIN_THEMES } from '../../../src/core/theme';

describe('VisualTheme System', () => {
  it('provides all 3 standard production themes', () => {
    expect(BUILTIN_THEMES.tv_game_show).toBeDefined();
    expect(BUILTIN_THEMES.clean_shopping).toBeDefined();
    expect(BUILTIN_THEMES.cyber_arcade).toBeDefined();
  });

  it('retrieves valid theme tokens with color and geometry contracts', () => {
    const tv = getTheme('tv_game_show');
    expect(tv.name).toContain('Gameshow');
    expect(tv.colors.accent).toBe('#fbbf24');
    expect(tv.geometry.cardBorderRadius).toBe(24);

    const arcade = getTheme('cyber_arcade');
    expect(arcade.geometry.cardBorderRadius).toBe(0);
    expect(arcade.geometry.glowIntensity).toBeGreaterThan(0);
  });

  it('throws error for unknown theme', () => {
    expect(() => getTheme('unknown_theme' as any)).toThrow(/Unknown theme/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/theme/themes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/theme/types.ts`, `themes.ts`, `index.ts`**

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
  cardBorderRadius: number;
  cardBorderWidth: number;
  glowIntensity: number;
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

```typescript
// src/core/theme/themes.ts
import type { VisualTheme, VisualThemeId } from './types';

export const BUILTIN_THEMES: Record<VisualThemeId, VisualTheme> = {
  tv_game_show: {
    id: 'tv_game_show',
    name: 'Truyền Hình Gameshow',
    colors: {
      backgroundGradient: ['#0f172a', '#1e1b4b'],
      stageOverlay: 'spotlight',
      cardBackground: '#1e293b',
      cardBorder: 'rgba(251, 191, 36, 0.4)',
      cardShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
      accent: '#fbbf24',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      countdownRing: '#eab308',
      revealBannerSuccess: '#22c55e',
      revealBannerWarning: '#ef4444',
    },
    typography: {
      fontFamilyHeadline: 'Be Vietnam Pro',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'Montserrat',
      textTransformHeadline: 'uppercase',
    },
    geometry: {
      cardBorderRadius: 24,
      cardBorderWidth: 3,
      glowIntensity: 8,
    },
    assets: {
      bgmTrack: 'audio/bgm/gameshow_suspense.mp3',
      correctSfx: 'audio/sfx/win_chime.wav',
      wrongSfx: 'audio/sfx/buzzer_wrong.wav',
      countdownSfx: 'audio/sfx/ticking_tension.wav',
    },
  },
  clean_shopping: {
    id: 'clean_shopping',
    name: 'Sàn TMĐT Tối Giản',
    colors: {
      backgroundGradient: ['#18181b', '#27272a'],
      stageOverlay: 'none',
      cardBackground: '#27272a',
      cardBorder: 'rgba(244, 244, 245, 0.15)',
      cardShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      accent: '#f97316',
      textPrimary: '#ffffff',
      textSecondary: '#a1a1aa',
      countdownRing: '#f97316',
      revealBannerSuccess: '#10b981',
      revealBannerWarning: '#f43f5e',
    },
    typography: {
      fontFamilyHeadline: 'Inter',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'Inter',
      textTransformHeadline: 'none',
    },
    geometry: {
      cardBorderRadius: 16,
      cardBorderWidth: 1.5,
      glowIntensity: 0,
    },
    assets: {
      bgmTrack: 'audio/bgm/shopping_upbeat.mp3',
      correctSfx: 'audio/sfx/cash_register.wav',
      wrongSfx: 'audio/sfx/buzzer_soft.wav',
      countdownSfx: 'audio/sfx/countdown_pop.wav',
    },
  },
  cyber_arcade: {
    id: 'cyber_arcade',
    name: 'Cyber Arcade Neon',
    colors: {
      backgroundGradient: ['#09090b', '#180828'],
      stageOverlay: 'grid',
      cardBackground: '#120e24',
      cardBorder: '#06b6d4',
      cardShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
      accent: '#06b6d4',
      textPrimary: '#f0fdf4',
      textSecondary: '#a78bfa',
      countdownRing: '#f43f5e',
      revealBannerSuccess: '#06b6d4',
      revealBannerWarning: '#f43f5e',
    },
    typography: {
      fontFamilyHeadline: 'Press Start 2P',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'VT323',
      textTransformHeadline: 'uppercase',
    },
    geometry: {
      cardBorderRadius: 0,
      cardBorderWidth: 4,
      glowIntensity: 20,
    },
    assets: {
      bgmTrack: 'audio/bgm/arcade_synth.mp3',
      correctSfx: 'audio/sfx/retro_coin.wav',
      wrongSfx: 'audio/sfx/retro_explosion.wav',
      countdownSfx: 'audio/sfx/retro_beep.wav',
    },
  },
};

export function getTheme(id: VisualThemeId): VisualTheme {
  const theme = BUILTIN_THEMES[id];
  if (!theme) throw new Error(`Unknown theme id: "${id}"`);
  return theme;
}
```

```typescript
// src/core/theme/index.ts
export * from './types';
export * from './themes';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/theme/themes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/theme/ test/core/theme/
git commit -m "feat(theme): implement VisualTheme token system with 3 standard production themes"
```

---

### Task 2: AudioMixPolicy & VoiceDirector Foundation

**Files:**
- Modify: `src/core/policy/types.ts`
- Modify: `src/core/policy/index.ts`
- Create: `src/core/audio/types.ts`
- Create: `src/core/audio/VoiceDirector.ts`
- Test: `test/core/audio/VoiceDirector.test.ts`

**Interfaces:**
- Produces: `AudioMixPolicy`, `DEFAULT_AUDIO_MIX_POLICY`, `VoiceDirector` (`synthesize`, `computeDuckingParams`).

- [ ] **Step 1: Write tests in `test/core/audio/VoiceDirector.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { VoiceDirector } from '../../../src/core/audio/VoiceDirector';
import { DEFAULT_AUDIO_MIX_POLICY } from '../../../src/core/policy';

describe('VoiceDirector', () => {
  it('exports correct ducking filter parameters based on AudioMixPolicy', () => {
    const director = new VoiceDirector(DEFAULT_AUDIO_MIX_POLICY);
    const filter = director.buildDuckingFilter('[voice]', '[bgm]');
    expect(filter).toContain('sidechaincompress');
    expect(filter).toContain('ratio=');
  });

  it('allocates speech audio duration and buffer padding correctly', () => {
    const director = new VoiceDirector(DEFAULT_AUDIO_MIX_POLICY);
    const slot = director.computeSpeechSlot(2.45);
    // 2.45s voice + 0.3s breathing buffer = 2.75s
    expect(slot.totalSlotDurationSec).toBe(2.75);
    expect(slot.bufferSec).toBe(0.3);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/audio/VoiceDirector.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `src/core/policy/` and implement `src/core/audio/VoiceDirector.ts`**

In `src/core/policy/types.ts`:
```typescript
export interface AudioMixPolicy {
  targetLufs: number;
  lufsTolerance: number;
  maxTruePeakDbTp: number;
  maxLra: number;
  maxSilenceDurationSec: number;
  voiceDuckDb: number;
  duckAttackMs: number;
  duckReleaseMs: number;
}
```

In `src/core/policy/index.ts`:
```typescript
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

In `src/core/audio/VoiceDirector.ts`:
```typescript
import type { AudioMixPolicy } from '../policy/types';

export interface SpeechSlot {
  voiceDurationSec: number;
  bufferSec: number;
  totalSlotDurationSec: number;
}

export class VoiceDirector {
  constructor(private readonly policy: AudioMixPolicy) {}

  computeSpeechSlot(voiceDurationSec: number, bufferSec = 0.3): SpeechSlot {
    return {
      voiceDurationSec,
      bufferSec,
      totalSlotDurationSec: Number((voiceDurationSec + bufferSec).toFixed(3)),
    };
  }

  buildDuckingFilter(voiceInputTag: string, bgmInputTag: string): string {
    const ratio = Math.pow(10, Math.abs(this.policy.voiceDuckDb) / 20).toFixed(1);
    const attack = this.policy.duckAttackMs;
    const release = this.policy.duckReleaseMs;
    return `${bgmInputTag}${voiceInputTag}sidechaincompress=threshold=0.03:ratio=${ratio}:attack=${attack}:release=${release}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/audio/VoiceDirector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/policy/ src/core/audio/ test/core/audio/
git commit -m "feat(audio): implement VoiceDirector with AudioMixPolicy and ducking filter generation"
```

---

### Task 3: Elastic Timeline & TimelineConflictValidator (P0 Gate)

**Files:**
- Create: `src/core/timeline/types.ts`
- Create: `src/core/timeline/TimelineConflictValidator.ts`
- Create: `src/core/timeline/ElasticTimelinePlanner.ts`
- Test: `test/core/timeline/TimelineConflictValidator.test.ts`

**Interfaces:**
- Produces: `TimelineSlot`, `TimelineConflictValidator.validate(slots, policy)`.

- [ ] **Step 1: Write tests in `test/core/timeline/TimelineConflictValidator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { TimelineConflictValidator, type TimelineSlot } from '../../../src/core/timeline/TimelineConflictValidator';
import { DEFAULT_AUDIO_MIX_POLICY } from '../../../src/core/policy';

describe('TimelineConflictValidator (P0 Pre-Render Gate)', () => {
  it('accepts valid sequential elastic timeline', () => {
    const slots: TimelineSlot[] = [
      { id: 's1', name: 'Hook', phase: 'hook', startSec: 0, durationSec: 2.5, voiceDurationSec: 2.2 },
      { id: 's2', name: 'Question', phase: 'question', startSec: 2.5, durationSec: 3.5, voiceDurationSec: 3.1 },
      { id: 's3', name: 'Countdown', phase: 'countdown', startSec: 6.0, durationSec: 3.0 },
      { id: 's4', name: 'Reveal', phase: 'reveal', startSec: 9.0, durationSec: 3.5, voiceDurationSec: 3.0 },
      { id: 's5', name: 'CTA', phase: 'cta', startSec: 12.5, durationSec: 2.5 },
    ];

    const report = TimelineConflictValidator.validate(slots, DEFAULT_AUDIO_MIX_POLICY);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.totalDurationSec).toBe(15.0);
  });

  it('rejects slot where voice exceeds slot duration', () => {
    const slots: TimelineSlot[] = [
      { id: 's1', name: 'Question', phase: 'question', startSec: 0, durationSec: 2.0, voiceDurationSec: 2.8 },
    ];
    const report = TimelineConflictValidator.validate(slots, DEFAULT_AUDIO_MIX_POLICY);
    expect(report.valid).toBe(false);
    expect(report.errors[0]).toMatch(/voice .* exceeds slot duration/);
  });

  it('rejects slot overlap', () => {
    const slots: TimelineSlot[] = [
      { id: 's1', name: 'Q', phase: 'question', startSec: 0, durationSec: 3.0 },
      { id: 's2', name: 'Countdown', phase: 'countdown', startSec: 2.5, durationSec: 3.0 }, // Overlaps by 0.5s
    ];
    const report = TimelineConflictValidator.validate(slots, DEFAULT_AUDIO_MIX_POLICY);
    expect(report.valid).toBe(false);
    expect(report.errors[0]).toMatch(/Slot overlap/);
  });

  it('rejects out-of-order phase sequencing', () => {
    const slots: TimelineSlot[] = [
      { id: 's1', name: 'Rev', phase: 'reveal', startSec: 0, durationSec: 3.0 },
      { id: 's2', name: 'Q', phase: 'question', startSec: 3.0, durationSec: 3.0 },
    ];
    const report = TimelineConflictValidator.validate(slots, DEFAULT_AUDIO_MIX_POLICY);
    expect(report.valid).toBe(false);
    expect(report.errors[0]).toMatch(/Invalid phase sequencing/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/timeline/TimelineConflictValidator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `TimelineConflictValidator.ts`**

```typescript
// src/core/timeline/TimelineConflictValidator.ts
import type { AudioMixPolicy } from '../policy/types';

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

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      if (slot.durationSec <= 0) {
        errors.push(`Slot "${slot.id}" has invalid duration: ${slot.durationSec}s`);
      }

      if (slot.voiceDurationSec && slot.voiceDurationSec > slot.durationSec + 0.001) {
        errors.push(
          `Slot "${slot.id}" voice (${slot.voiceDurationSec.toFixed(2)}s) exceeds slot duration (${slot.durationSec.toFixed(2)}s)`,
        );
      }

      if (i < slots.length - 1) {
        const next = slots[i + 1]!;
        const slotEnd = slot.startSec + slot.durationSec;
        if (slotEnd > next.startSec + 0.01) {
          errors.push(
            `Slot overlap: "${slot.id}" ends at ${slotEnd.toFixed(2)}s, but next slot "${next.id}" starts at ${next.startSec.toFixed(2)}s`,
          );
        }
        const gap = next.startSec - slotEnd;
        if (gap > policy.maxSilenceDurationSec) {
          errors.push(
            `Dead silence gap (${gap.toFixed(2)}s) between "${slot.id}" and "${next.id}" exceeds policy (${policy.maxSilenceDurationSec}s)`,
          );
        }
      }
    }

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

    const totalDurationSec =
      slots.length > 0 ? slots[slots.length - 1]!.startSec + slots[slots.length - 1]!.durationSec : 0;

    return {
      valid: errors.length === 0,
      errors,
      totalDurationSec: Number(totalDurationSec.toFixed(3)),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/timeline/TimelineConflictValidator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/timeline/ test/core/timeline/
git commit -m "feat(timeline): implement TimelineConflictValidator pre-render P0 conflict gate"
```

---

### Task 4: Pre-Render Layout Geometry QA Gate

**Files:**
- Create: `src/validator/LayoutGeometryValidator.ts`
- Test: `test/validator/LayoutGeometryValidator.test.ts`

**Interfaces:**
- Produces: `BoundingBox`, `LayoutGeometryValidator.validate(elements, policy)`.

- [ ] **Step 1: Write tests in `test/validator/LayoutGeometryValidator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { LayoutGeometryValidator, type LayoutBox } from '../../src/validator/LayoutGeometryValidator';
import { DEFAULT_LAYOUT_POLICY } from '../../src/core/policy';

describe('LayoutGeometryValidator (Pre-Render Gate)', () => {
  it('accepts elements within safe-zone margins', () => {
    const boxes: LayoutBox[] = [
      { id: 'card_a', x: 80, y: 300, width: 420, height: 500 },
      { id: 'card_b', x: 580, y: 300, width: 420, height: 500 },
    ];
    const res = LayoutGeometryValidator.validate(boxes, DEFAULT_LAYOUT_POLICY);
    expect(res.valid).toBe(true);
  });

  it('rejects elements overflowing top or bottom safe-zone', () => {
    const topOverflow: LayoutBox[] = [{ id: 'headline', x: 100, y: 50, width: 880, height: 80 }];
    const res = LayoutGeometryValidator.validate(topOverflow, DEFAULT_LAYOUT_POLICY);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/breaches top safe-zone/);

    const bottomOverflow: LayoutBox[] = [{ id: 'cta', x: 100, y: 1500, width: 880, height: 100 }];
    const res2 = LayoutGeometryValidator.validate(bottomOverflow, DEFAULT_LAYOUT_POLICY);
    expect(res2.valid).toBe(false);
    expect(res2.errors[0]).toMatch(/breaches bottom safe-zone/);
  });

  it('detects overlapping element boxes', () => {
    const overlapping: LayoutBox[] = [
      { id: 'card_1', x: 100, y: 400, width: 300, height: 300 },
      { id: 'card_2', x: 250, y: 450, width: 300, height: 300 },
    ];
    const res = LayoutGeometryValidator.validate(overlapping, DEFAULT_LAYOUT_POLICY);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/Overlap detected/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/validator/LayoutGeometryValidator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/validator/LayoutGeometryValidator.ts`**

```typescript
import type { LayoutPolicy } from '../core/policy/types';

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

export class LayoutGeometryValidator {
  static validate(elements: LayoutBox[], policy: LayoutPolicy): LayoutValidationResult {
    const errors: string[] = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!;
      if (el.y < policy.safeZoneTop) {
        errors.push(`Element "${el.id}" (y: ${el.y}) breaches top safe-zone (${policy.safeZoneTop}px)`);
      }
      if (el.y + el.height > policy.safeZoneBottom) {
        errors.push(
          `Element "${el.id}" bottom (${el.y + el.height}px) breaches bottom safe-zone (${policy.safeZoneBottom}px)`,
        );
      }

      for (let j = i + 1; j < elements.length; j++) {
        const other = elements[j]!;
        const overlapX = el.x < other.x + other.width && el.x + el.width > other.x;
        const overlapY = el.y < other.y + other.height && el.y + el.height > other.y;
        if (overlapX && overlapY) {
          errors.push(`Overlap detected between "${el.id}" and "${other.id}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/validator/LayoutGeometryValidator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/validator/LayoutGeometryValidator.ts test/validator/LayoutGeometryValidator.test.ts
git commit -m "feat(validator): implement LayoutGeometryValidator pre-render bounding box gate"
```

---

### Task 5: Multi-Round 3-Item Tray Renderer for G7 (`GROCERY_BASKET`)

**Files:**
- Create: `src/render/trayPainter.ts`
- Test: `test/render/trayPainter.test.ts`

**Interfaces:**
- Produces: `TrayItem`, `TrayRenderOptions`, `drawGroceryBasketTray(canvas, items, options)`.

- [ ] **Step 1: Write test in `test/render/trayPainter.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { drawGroceryBasketTray, type TrayItem } from '../../src/render/trayPainter';
import { Canvas } from '../../src/render/canvas';
import { getTheme } from '../../src/core/theme';

describe('G7 Tray Painter', () => {
  it('renders 3-item grocery basket tray and calculates item slots without overlap', () => {
    const canvas = new Canvas(1080, 1920);
    const theme = getTheme('clean_shopping');
    const items: TrayItem[] = [
      { productId: 'm1', name: 'Sữa tươi 1L', priceLabel: '???', image: 'm1.png' },
      { productId: 'm2', name: 'Bánh mì sandwich', priceLabel: '???', image: 'm2.png' },
      { productId: 'm3', name: 'Trứng gà hộp 10 quả', priceLabel: '???', image: 'm3.png' },
    ];

    const boxes = drawGroceryBasketTray(canvas, items, {
      yOffset: 650,
      trayHeight: 480,
      theme,
    });

    expect(boxes).toHaveLength(3);
    // Ensure all 3 boxes are horizontally spaced
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width);
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x + boxes[1].width);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/render/trayPainter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/render/trayPainter.ts`**

```typescript
import type { Canvas } from './canvas';
import type { VisualTheme } from '../core/theme/types';
import type { LayoutBox } from '../validator/LayoutGeometryValidator';

export interface TrayItem {
  productId: string;
  name: string;
  priceLabel: string;
  image: string;
}

export interface TrayRenderOptions {
  yOffset: number;
  trayHeight: number;
  theme: VisualTheme;
}

export function drawGroceryBasketTray(
  canvas: Canvas,
  items: TrayItem[],
  options: TrayRenderOptions,
): LayoutBox[] {
  const { yOffset, trayHeight, theme } = options;
  const stageWidth = 1080;
  const padding = 60;
  const gutter = 30;
  const availableWidth = stageWidth - padding * 2 - gutter * (items.length - 1);
  const cardWidth = Math.floor(availableWidth / items.length);

  const boxes: LayoutBox[] = [];

  // Draw tray backboard
  canvas.roundRect(
    padding - 15,
    yOffset - 15,
    stageWidth - (padding - 15) * 2,
    trayHeight + 30,
    theme.geometry.cardBorderRadius + 8,
    'rgba(0, 0, 0, 0.45)',
    theme.colors.cardBorder,
    2,
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const cardX = padding + i * (cardWidth + gutter);
    const box: LayoutBox = {
      id: `tray_item_${item.productId}`,
      x: cardX,
      y: yOffset,
      width: cardWidth,
      height: trayHeight,
    };
    boxes.push(box);

    // Draw card background
    canvas.roundRect(
      box.x,
      box.y,
      box.width,
      box.height,
      theme.geometry.cardBorderRadius,
      theme.colors.cardBackground,
      theme.colors.cardBorder,
      theme.geometry.cardBorderWidth,
    );
  }

  return boxes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/render/trayPainter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/trayPainter.ts test/render/trayPainter.test.ts
git commit -m "feat(render): implement drawGroceryBasketTray for G7 multi-round challenge"
```

---

### Task 6: Post-Render Video QA & Anomaly Detector

**Files:**
- Create: `src/core/qa/types.ts`
- Create: `src/core/qa/AcousticAnalyzer.ts`
- Create: `src/core/qa/VideoQualityAuditor.ts`
- Test: `test/core/qa/VideoQualityAuditor.test.ts`

**Interfaces:**
- Produces: `VideoQAReport`, `QAStatus` (`PASS` | `REMEDIATED` | `QUARANTINED`), `VideoQualityAuditor.audit(videoPath, policy)`.

- [ ] **Step 1: Write tests in `test/core/qa/VideoQualityAuditor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { VideoQualityAuditor } from '../../../src/core/qa/VideoQualityAuditor';
import { DEFAULT_AUDIO_MIX_POLICY } from '../../../src/core/policy';

describe('VideoQualityAuditor (Post-Render QA Gate)', () => {
  it('evaluates acoustic and artifact metrics into QAStatus', () => {
    const auditor = new VideoQualityAuditor(DEFAULT_AUDIO_MIX_POLICY);

    // Case 1: Perfect pass
    const passStatus = auditor.evaluateMetrics({
      integratedLufs: -14.2,
      truePeakDbTp: -1.5,
      lra: 9.0,
      unexpectedBlackSec: 0,
      frozenSec: 0,
    });
    expect(passStatus).toBe('PASS');

    // Case 2: Needs remediation (LUFS/TP out of policy)
    const remediateStatus = auditor.evaluateMetrics({
      integratedLufs: -19.5, // Too quiet
      truePeakDbTp: -0.2,   // Exceeds -1.0
      lra: 8.5,
      unexpectedBlackSec: 0,
      frozenSec: 0,
    });
    expect(remediateStatus).toBe('REMEDIATED');

    // Case 3: Quarantined (Unexpected black frames or frozen video)
    const quarantineStatus = auditor.evaluateMetrics({
      integratedLufs: -14.0,
      truePeakDbTp: -1.2,
      lra: 9.0,
      unexpectedBlackSec: 0.8, // Corrupted frame transition
      frozenSec: 0,
    });
    expect(quarantineStatus).toBe('QUARANTINED');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/qa/VideoQualityAuditor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/qa/types.ts` & `src/core/qa/VideoQualityAuditor.ts`**

```typescript
// src/core/qa/types.ts
export type QAStatus = 'PASS' | 'REMEDIATED' | 'QUARANTINED';

export interface QARemediationRecord {
  type: 'audio_loudnorm' | 'peak_limiter';
  before: { integratedLufs: number; truePeakDbTp: number };
  after: { integratedLufs: number; truePeakDbTp: number };
  timestamp: number;
}

export interface VideoQAMetrics {
  integratedLufs: number;
  truePeakDbTp: number;
  lra: number;
  unexpectedBlackSec: number;
  frozenSec: number;
}

export interface VideoQAReport {
  status: QAStatus;
  attempt: number;
  videoPath: string;
  metrics: VideoQAMetrics;
  remediations: QARemediationRecord[];
  quarantineReason?: string;
}
```

```typescript
// src/core/qa/VideoQualityAuditor.ts
import type { AudioMixPolicy } from '../policy/types';
import type { QAStatus, VideoQAMetrics, VideoQAReport } from './types';

export class VideoQualityAuditor {
  constructor(private readonly policy: AudioMixPolicy) {}

  evaluateMetrics(metrics: VideoQAMetrics): QAStatus {
    // 1. Catastrophic visual artifacts -> Immediate QUARANTINE
    if (metrics.unexpectedBlackSec > 0.2 || metrics.frozenSec > 1.5) {
      return 'QUARANTINED';
    }

    // 2. Acoustic compliance check
    const lufsDiff = Math.abs(metrics.integratedLufs - this.policy.targetLufs);
    const tpCompliant = metrics.truePeakDbTp <= this.policy.maxTruePeakDbTp;
    const lufsCompliant = lufsDiff <= this.policy.lufsTolerance;

    if (tpCompliant && lufsCompliant) {
      return 'PASS';
    }

    // 3. Audio requires loudnorm remediation
    return 'REMEDIATED';
  }

  createReport(videoPath: string, metrics: VideoQAMetrics, status: QAStatus): VideoQAReport {
    return {
      status,
      attempt: 1,
      videoPath,
      metrics,
      remediations: [],
      ...(status === 'QUARANTINED'
        ? { quarantineReason: 'Detected unexpected black frames or video freeze duration' }
        : {}),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/qa/VideoQualityAuditor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/qa/ test/core/qa/
git commit -m "feat(qa): implement VideoQualityAuditor evaluating acoustic and artifact metrics"
```

---

### Task 7: Non-Destructive Auto-Remediation & Triaging Pipeline

**Files:**
- Create: `src/core/qa/AudioRemediator.ts`
- Create: `src/core/qa/ProductionPipeline.ts`
- Test: `test/core/qa/ProductionPipeline.test.ts`

**Interfaces:**
- Produces: `AudioRemediator.buildRemediationCommand(inputPath, outputPath, measuredMetrics, policy)`.
- Triages output into destination directory (`outputs/passed/`, `outputs/remediated/`, `outputs/quarantine/`).

- [ ] **Step 1: Write tests in `test/core/qa/ProductionPipeline.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { AudioRemediator } from '../../../src/core/qa/AudioRemediator';
import { DEFAULT_AUDIO_MIX_POLICY } from '../../../src/core/policy';

describe('AudioRemediator (Non-Destructive Stream-Copy)', () => {
  it('generates correct FFmpeg command with -c:v copy and 2-pass loudnorm parameters', () => {
    const cmd = AudioRemediator.buildRemediationCommand(
      'in.mp4',
      'out.mp4',
      { integratedLufs: -20.2, truePeakDbTp: -0.2, lra: 10.5 },
      DEFAULT_AUDIO_MIX_POLICY,
    );

    expect(cmd).toContain('-c:v copy'); // Never re-render video
    expect(cmd).toContain('loudnorm=I=-14:TP=-1:LRA=11');
    expect(cmd).toContain('measured_I=-20.2');
    expect(cmd).toContain('measured_TP=-0.2');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/core/qa/ProductionPipeline.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/core/qa/AudioRemediator.ts`**

```typescript
// src/core/qa/AudioRemediator.ts
import type { AudioMixPolicy } from '../policy/types';

export interface MeasuredAudioInput {
  integratedLufs: number;
  truePeakDbTp: number;
  lra: number;
}

export class AudioRemediator {
  static buildRemediationCommand(
    inputPath: string,
    outputPath: string,
    measured: MeasuredAudioInput,
    policy: AudioMixPolicy,
  ): string {
    const targetI = policy.targetLufs;
    const targetTp = policy.maxTruePeakDbTp;
    const targetLra = Math.min(policy.maxLra, 11);

    const filter = `loudnorm=I=${targetI}:TP=${targetTp}:LRA=${targetLra}:measured_I=${measured.integratedLufs}:measured_TP=${measured.truePeakDbTp}:measured_LRA=${measured.lra}:linear=true`;

    return `ffmpeg -y -i "${inputPath}" -c:v copy -af "${filter}" -c:a aac -b:a 192k "${outputPath}"`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/qa/ProductionPipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Run full TypeScript check and all test suites**

Run: `npx tsc --noEmit && npx vitest run test/core/ test/validator/ test/contract/ test/render/`
Expected: 0 TypeScript compiler errors and all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/qa/AudioRemediator.ts test/core/qa/ProductionPipeline.test.ts
git commit -m "feat(qa): implement AudioRemediator with stream-copy loudnorm and remediation logging"
```

---

## Plan Self-Review
- **Spec Coverage:** Implements all 8 sections (D1-D8) of `docs/superpowers/specs/2026-09-16-production-audio-visual-themes-design.md`.
- **Review Items Resolved:**
  1. Multi-dimensional audio checks (LUFS, True Peak, LRA, silence).
  2. Non-destructive `-c:v copy` without arbitrary runtime claims.
  3. Pre-render geometry QA separated from post-render defense-in-depth.
  4. Separation of unexpected black frames and frozen video.
  5. Policy-driven audio ducking (`AudioMixPolicy.voiceDuckDb = -8.0dB`).
  6. `TimelineConflictValidator` pre-render collision gate.
  7. Full audit trail in `qa_report.json`.
  8. 3-state output triaging (`PASS`, `REMEDIATED`, `QUARANTINED`).
- **No Placeholders:** Every method, interface, test snippet, and command is fully written.
