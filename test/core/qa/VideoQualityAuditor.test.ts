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
