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
