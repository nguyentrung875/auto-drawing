/**
 * Fake render stage for queue/CLI tests: enforces the same output contract as
 * `RenderEngine` (MP4 + caption, timings, temp cleanup) without spawning ffmpeg,
 * so fail-forward, logging and batch behaviour stay fast to test.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RenderStageInput, RenderStageOutput } from '../../src/queue/stageTypes';
import type { RenderStagePort } from '../../src/queue/ports';

export interface FakeStageOptions {
  /** Throw instead of rendering (per-job failure injection). */
  failWith?: (input: RenderStageInput) => Error | undefined;
  renderMs?: number;
  encodeMs?: number;
  /** Simulate the AD-8 slow render (`W_RENDER_SLOW`). */
  slow?: boolean;
  /** Leave `temp/<jobId>/` behind to prove the runner cleans it. */
  leakTemp?: boolean;
  delayMs?: number;
}

export interface FakeStageStats {
  calls: number;
  lastInput?: RenderStageInput;
}

export function createFakeRenderStage(options: FakeStageOptions = {}): RenderStagePort & {
  stats: FakeStageStats;
} {
  const stats: FakeStageStats = { calls: 0 };
  const stage = {
    stats,
    async render(input: RenderStageInput): Promise<RenderStageOutput> {
      stats.calls += 1;
      stats.lastInput = input;
      const error = options.failWith?.(input);
      if (error) throw error;
      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      const rootDir = input.rootDir ?? process.cwd();
      const exportDir = path.resolve(rootDir, input.exportDir ?? 'export');
      const tempDir = path.join(rootDir, 'temp', input.jobId);
      mkdirSync(exportDir, { recursive: true });
      const videoPath = path.join(exportDir, `${input.game && (input.game as { metadata?: { gameId?: string } }).metadata?.gameId}_${input.seed}.mp4`);
      const captionPath = `${videoPath.replace(/\.mp4$/, '')}.caption.json`;
      writeFileSync(videoPath, Buffer.from('fake-mp4'));
      writeFileSync(
        captionPath,
        JSON.stringify({ caption: 'fake', hashtags: ['quiz'], affiliate_link: 'https://shopee.vn/p001?aff=123' }),
      );
      if (options.leakTemp) {
        mkdirSync(tempDir, { recursive: true });
        writeFileSync(path.join(tempDir, 'frame_00001.png'), 'leak');
      } else {
        rmSync(tempDir, { recursive: true, force: true });
      }
      const renderMs = options.renderMs ?? 1234;
      const encodeMs = options.encodeMs ?? 777;
      return {
        videoPath,
        captionPath,
        fileSize: 8,
        frameCount: Math.round(input.timeline.totalDuration * 30),
        warnings: [],
        slow: options.slow ?? false,
        timings: {
          planningMs: 1,
          ttsMs: input.ttsMs ?? 0,
          renderMs,
          encodeMs,
          audioMixMs: 5,
          totalMs: renderMs + encodeMs + 6,
        },
      };
    },
  };
  return stage;
}
