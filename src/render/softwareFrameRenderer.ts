/**
 * Built-in frame stage: rasterizes the Scene System's frames to a PNG sequence
 * (AD-8's `PNG seq`) at 1080×1920 with no browser, GPU or native module.
 *
 * Cost model: the static part of a scene is rasterized once per animation key
 * (≤4 keys per scene), and every output frame reuses the nearest key with a
 * cheap per-frame overlay (countdown pulse, progress bar). That keeps a full
 * 18s/30fps clip inside the 45s render budget on an 8-core CPU.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Canvas } from './canvas';
import { encodePng } from './png';
import { RENDER_ERROR_CODES, RENDER_WARNING_CODES, RenderError } from './errors';
import { paintFrame, paintOverlay, type PaintContext } from './scenePainter';
import type {
  FrameRenderContext,
  FrameRenderResult,
  IFrameRenderer,
  RenderFrame,
  RenderInput,
} from './types';

/**
 * A CPU-bound rasterizer cannot be interrupted from the outside, so the frame
 * stage enforces AD-10's timeout cooperatively: the deadline is checked between
 * every key frame and every output frame (each is well under a second of work).
 */
function assertWithinDeadline(context: FrameRenderContext): void {
  if (context.deadlineAt && Date.now() > context.deadlineAt) {
    throw new RenderError(
      RENDER_ERROR_CODES.TIMEOUT,
      'frames',
      `frame stage exceeded its ${Math.round((context.deadlineMs ?? 0) / 1000)}s budget and was aborted`,
    );
  }
}

/** Animation keys sampled across a scene (start, ¼, ½, ¾ of the scene). */
const KEY_FRACTIONS = [0, 0.25, 0.5, 0.75];

/** Scenes whose overlay changes on every output frame (countdown ring). */
const ANIMATED_OVERLAY_SCENES = new Set(['countdown']);

interface SceneTimelineEntry {
  frame: RenderFrame;
  startFrame: number;
  endFrame: number;
}

function buildTimeline(frames: RenderFrame[], fps: number, frameCount: number): SceneTimelineEntry[] {
  const entries: SceneTimelineEntry[] = [];
  for (const frame of frames) {
    const startFrame = Math.max(0, Math.round(frame.start * fps));
    const endFrame = Math.min(frameCount, Math.round(frame.end * fps));
    if (endFrame <= startFrame) continue;
    entries.push({ frame, startFrame, endFrame });
  }
  entries.sort((a, b) => a.startFrame - b.startFrame);
  return entries;
}

export class SoftwareFrameRenderer implements IFrameRenderer {
  readonly backend = 'software';

  async renderFrames(input: RenderInput, context: FrameRenderContext): Promise<FrameRenderResult> {
    const { width, height, fps, framesDir, frameCount } = context;
    if (input.frames.length === 0) {
      throw new RenderError(
        RENDER_ERROR_CODES.FRAMES_MISSING,
        'frames',
        'Scene System produced no frames to render (Scenes.render() must run before the renderer)',
      );
    }

    mkdirSync(framesDir, { recursive: true });
    const paintContext: PaintContext = {
      game: input.game,
      products: input.products,
      sceneData: input.sceneData,
      diversification: input.diversification ?? { bgColor: '#fef3c7', tilt: 0, bgm: 'tension_01' },
      variant: input.variant ?? 'in_video',
      rootDir: input.rootDir ?? process.cwd(),
      tilt: context.config.tilt !== false,
      warnings: [],
    };

    const entries = buildTimeline(input.frames, fps, frameCount);
    if (entries.length === 0) {
      throw new RenderError(
        RENDER_ERROR_CODES.FRAMES_MISSING,
        'timeline',
        `frames cover no output frames at ${fps}fps (frameCount=${frameCount})`,
      );
    }

    // 1. Rasterize the animation keys for each scene, plus a reusable base for
    //    scenes whose overlay changes on every frame (only the countdown ring).
    const baseCanvases = new Map<string, Canvas>();
    const totalDuration = input.timeline.totalDuration;
    const keyBuffers = new Map<string, { index: number; png: Buffer }[]>();
    let renderedFrames = 0;
    for (const entry of entries) {
      const scene = entry.frame.scene;
      if (keyBuffers.has(scene)) continue;
      const length = entry.endFrame - entry.startFrame;
      const keyIndices = [...new Set(KEY_FRACTIONS.map((fraction) =>
        Math.min(entry.endFrame - 1, entry.startFrame + Math.floor(length * fraction)),
      ))].sort((a, b) => a - b);
      const buffers: { index: number; png: Buffer }[] = [];
      for (const index of keyIndices) {
        const sceneProgress = length > 0 ? (index - entry.startFrame) / length : 0;
        const canvas = new Canvas(width, height);
        paintFrame(canvas, entry.frame, paintContext);
        paintOverlay(canvas, {
          time: index / fps,
          totalDuration,
          frame: entry.frame,
          sceneProgress,
        });
        buffers.push({ index, png: encodePng({ width, height, data: canvas.data }) });
        renderedFrames += 1;
        assertWithinDeadline(context);
      }
      keyBuffers.set(scene, buffers);
      if (ANIMATED_OVERLAY_SCENES.has(scene)) {
        const base = new Canvas(width, height);
        paintFrame(base, entry.frame, paintContext);
        baseCanvases.set(scene, base);
        renderedFrames += 1;
      }
    }

    // 2. Emit the full PNG sequence (`frame_%05d.png`, 1-based like ffmpeg).
    const pattern = 'frame_%05d.png';
    const written = new Set<number>();
    for (const entry of entries) {
      const keys = keyBuffers.get(entry.frame.scene)!;
      const length = entry.endFrame - entry.startFrame;
      for (let index = entry.startFrame; index < entry.endFrame; index += 1) {
        if (written.has(index)) continue;
        written.add(index);
        const sceneProgress = length > 0 ? (index - entry.startFrame) / length : 0;
        const time = index / fps;
        // Reuse the nearest animation key when the overlay is static, otherwise
        // composite the animated overlay onto the cached base canvas.
        let png: Buffer;
        const base = baseCanvases.get(entry.frame.scene);
        if (!base) {
          const nearest = keys.reduce((best, candidate) =>
            Math.abs(candidate.index - index) < Math.abs(best.index - index) ? candidate : best,
          keys[0]!);
          png = nearest.png;
        } else {
          const canvas = new Canvas(width, height);
          canvas.copyFrom(base);
          paintOverlay(canvas, { time, totalDuration, frame: entry.frame, sceneProgress });
          png = encodePng({ width, height, data: canvas.data });
        }
        writeFileSync(path.join(framesDir, `frame_${String(index + 1).padStart(5, '0')}.png`), png);
        context.onFrame?.(index, frameCount);
        assertWithinDeadline(context);
      }
    }

    if (written.size !== frameCount) {
      throw new RenderError(
        RENDER_ERROR_CODES.FRAMES_MISSING,
        'frames',
        `emitted ${written.size} of ${frameCount} frames — scene durations do not cover the timeline`,
      );
    }

    return {
      framesDir,
      pattern,
      width,
      height,
      fps,
      frameCount,
      renderedFrames,
      warnings: paintContext.warnings,
      backend: this.backend,
    };
  }
}

/** Reference to the deterministic fallback used when Motion Canvas is absent. */
export function softwareFallbackWarning(reason: string, elapsedMs: number) {
  void elapsedMs;
  return {
    code: RENDER_WARNING_CODES.RENDERER_FALLBACK,
    hint: reason,
  };
}

/** Wall-clock helper so callers can attribute time to the frame stage. */
export function stageTimer(): { stop: () => number } {
  const start = performance.now();
  return { stop: () => Number((performance.now() - start).toFixed(2)) };
}
