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
