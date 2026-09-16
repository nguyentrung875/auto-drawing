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
