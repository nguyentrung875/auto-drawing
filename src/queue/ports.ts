/**
 * Ports the queue context depends on (dependency inversion).
 *
 * AD-1 forbids `queue → render` as a *direct* dependency (Story 1.1's rule is
 * enforced by eslint). The queue therefore declares the render stage it needs
 * as a port with structural types, and the composition root (the CLI) wires
 * `RenderEngine` in. Tests wire fakes the same way.
 */
import type { RenderStageInput, RenderStageOutput } from './stageTypes';

export interface RenderStagePort {
  /** Render one job: frames + audio → MP4 + caption; cleans its own temp dir. */
  render(input: RenderStageInput): Promise<RenderStageOutput>;
}
