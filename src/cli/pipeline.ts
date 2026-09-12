/**
 * Composition root for the Epic 4 pipeline.
 *
 * `queue` may not import `render` (AD-1: `queue → validator → … → render`), so
 * the CLI — the outermost layer — adapts the real `RenderEngine` to the queue's
 * `RenderStagePort`. Tests compose the same way with a fake stage.
 */
import { RenderEngine, type RenderInput } from '../render';
import { JobRunner, type JobOutcome, type RunJobOptions } from '../queue/JobRunner';
import type { RenderStagePort } from '../queue/ports';
import type { QueueJob } from '../queue/schema';

/** Adapt `RenderEngine` to the queue's render port. */
export function createRenderStage(rootDir = process.cwd()): RenderStagePort {
  return {
    render: (input) => RenderEngine.render(input as unknown as RenderInput, { rootDir }),
  };
}

export interface PipelineOptions extends Omit<RunJobOptions, 'job' | 'renderer'> {
  renderer?: RenderStagePort;
}

/** Run one job through the real render engine (CLI path). */
export function runJobWithRenderEngine(options: PipelineOptions & { job: QueueJob }): Promise<JobOutcome> {
  const rootDir = options.rootDir ?? process.cwd();
  return JobRunner.run({
    ...options,
    rootDir,
    renderer: options.renderer ?? createRenderStage(rootDir),
  });
}
