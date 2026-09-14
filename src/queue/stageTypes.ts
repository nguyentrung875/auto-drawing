/**
 * Structural render-stage contract owned by the queue context.
 *
 * These are the fields the pipeline produces/consumes; `RenderInput` /
 * `RenderOutput` from the render context are supersets, so the real engine
 * satisfies this port without the queue importing it.
 */
export interface RenderStageInput {
  game: unknown;
  timeline: { slots: Array<{ type: string; duration: number; start: number; end: number }>; totalDuration: number };
  audio: {
    voiceWavPath: string;
    voiceStartAt: number;
    voiceDuration: number;
    duration: number;
    revealAt: number;
    syncDelta: number;
    sfxCues: Array<{ type: string; at: number; assetPath: string }>;
    music: { track: string; volume: number };
  };
  frames: Array<{
    scene: string;
    start: number;
    duration: number;
    end: number;
    elements: Array<Record<string, unknown>>;
    data: Record<string, unknown>;
  }>;
  variant?: 'in_video' | 'comment';
  sceneData?: unknown;
  products?: Array<{ productId: string; name: string; image?: string; price: number }>;
  diversification?: { bgColor: string; tilt: number; bgm: string };
  jobId: string;
  seed: number;
  rootDir?: string;
  exportDir?: string;
  ttsMs?: number;
}

export interface RenderStageOutput {
  videoPath: string;
  captionPath: string;
  fileSize: number;
  frameCount: number;
  warnings: Array<{ code: string; hint: string }>;
  slow: boolean;
  timings: {
    planningMs: number;
    ttsMs: number;
    renderMs: number;
    encodeMs: number;
    audioMixMs: number;
    totalMs: number;
  };
}
