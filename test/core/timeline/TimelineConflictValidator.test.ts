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
