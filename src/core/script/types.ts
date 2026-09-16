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
