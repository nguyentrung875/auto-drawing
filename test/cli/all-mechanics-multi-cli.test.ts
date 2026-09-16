import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runRenderCommand } from '../../src/cli/render';
import type { RenderStagePort } from '../../src/queue/ports';

function createFakeRenderStage(): RenderStagePort {
  return {
    async render(job) {
      return {
        jobId: job.jobId,
        gameId: job.game.metadata.gameId,
        videoPath: path.resolve(job.rootDir, job.exportDir ?? 'export', `${job.game.metadata.gameId}_fake.mp4`),
        captionPath: path.resolve(job.rootDir, job.exportDir ?? 'export', `${job.game.metadata.gameId}_fake.caption.json`),
        timings: { renderMs: 42, encodeMs: 10, totalMs: 52 },
      };
    },
  };
}

describe('CLI — Multi-round rendering across all 7 mechanics', () => {
  const ROOT = process.cwd();
  const mechanics = [
    'hi_lo',
    'most_expensive',
    'one_away',
    'odd_one_out',
    'guess_the_price',
    'grocery_basket',
    'deal_or_scam',
  ];

  for (const mechanic of mechanics) {
    it(`renders multi-round for mechanic '${mechanic}' with fake renderer`, async () => {
      const result = await runRenderCommand({
        mechanic,
        mode: 'multi',
        seed: 839271,
        rounds: 3,
        timer: 5.0,
        rootDir: ROOT,
        queueDir: 'queue',
        renderer: createFakeRenderStage(),
        productIds: [],
      });

      expect(result.exitCode).toBe(0);
      expect(result.jobId).toContain('job_multi_');
      expect(result.videoPath).toBeDefined();
    });
  }
});
