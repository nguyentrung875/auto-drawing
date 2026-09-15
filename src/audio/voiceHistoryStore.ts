import type { VoiceIntent } from './types';

export interface VoiceHistoryRecord {
  mechanic: string;
  templateId: string;
  script: string;
  intent: VoiceIntent;
  timestamp: number;
}

export interface VoiceHistoryStoreOptions {
  maxCapacity?: number;
}

export class VoiceHistoryStore {
  private readonly records: VoiceHistoryRecord[] = [];
  private readonly maxCapacity: number;

  constructor(options: VoiceHistoryStoreOptions = {}) {
    this.maxCapacity = options.maxCapacity ?? 20;
  }

  record(entry: VoiceHistoryRecord): void {
    this.records.unshift(entry);
    if (this.records.length > this.maxCapacity) {
      this.records.length = this.maxCapacity;
    }
  }

  getRecent(limit = 10): VoiceHistoryRecord[] {
    return this.records.slice(0, limit);
  }

  calculatePenalty(
    mechanic: string,
    templateId: string,
    script: string,
    intent: VoiceIntent,
  ): number {
    const relevant = this.records.filter((r) => r.mechanic === mechanic);
    if (relevant.length === 0) return 0;

    // 1. Exact script match in recent history -> 100
    if (relevant.some((r) => r.script === script)) {
      return 100;
    }

    // 2. Same templateId in last 3 videos -> 50
    const inLast3 = relevant.slice(0, 3);
    if (inLast3.some((r) => r.templateId === templateId)) {
      return 50;
    }

    // 3. Same intent penalty:
    // If last 3 in a row had the same intent -> 30
    if (
      relevant.length >= 3 &&
      relevant[0]?.intent === intent &&
      relevant[1]?.intent === intent &&
      relevant[2]?.intent === intent
    ) {
      return 30;
    }

    // If immediate previous video had the same intent -> 15
    if (relevant[0]?.intent === intent) {
      return 15;
    }

    return 0;
  }
}
