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
