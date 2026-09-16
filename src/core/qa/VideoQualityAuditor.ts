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
