import { describe, it, expect } from 'vitest';
import { resolveBinary } from '../../src/render/process';

describe('EdgeTtsEngine FFmpeg Resolution', () => {
  it('resolves ffmpeg binary path from installer or environment', () => {
    const ffmpegPath = resolveBinary('ffmpeg');
    expect(ffmpegPath).toBeTruthy();
    expect(typeof ffmpegPath).toBe('string');
  });
});
