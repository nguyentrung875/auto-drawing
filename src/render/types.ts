/**
 * Render context contracts.
 *
 * AD-1 constrains the dependency direction (`render ↛ audio`, `render ↛ scene`),
 * so the renderer never imports those contexts: it consumes their output as
 * plain structural data (`RenderFrame`, `RenderAudioView`), which keeps the
 * bounded contexts decoupled and makes the engine trivially testable with
 * fixtures.
 */

export interface RenderMetadataView {
  gameId: string;
  mechanic: string;
  seed: number;
  result_variant?: string;
  language?: string;
}

export interface RenderGameView {
  metadata: RenderMetadataView;
  content: {
    title?: string;
    hook?: string;
    question?: string;
    cta?: string;
    caption?: string;
    hashtags?: string[];
  };
  gameplay: {
    answer?: string | number;
    correct_digit?: string;
    hidden_index?: number;
    options?: number[];
    choices?: Array<{ id: string; label: string }>;
  };
  publishing: {
    caption: string;
    hashtags: string[];
    affiliate_link?: string;
  };
}

export interface RenderTimelineSlot {
  type: string;
  duration: number;
  start: number;
  end: number;
}

export interface RenderTimeline {
  slots: RenderTimelineSlot[];
  totalDuration: number;
}

export interface RenderFrameElement {
  kind: string;
  text?: string;
  value?: string | number;
  display?: number;
  role?: string;
  [key: string]: unknown;
}

export interface RenderFrame {
  scene: string;
  start: number;
  duration: number;
  end: number;
  elements: RenderFrameElement[];
  data: Record<string, unknown>;
}

export interface RenderSfxCue {
  type: string;
  at: number;
  assetPath: string;
}

/** Structural mirror of `AudioSegment` from the audio context. */
export interface RenderAudioView {
  voiceWavPath: string;
  voiceStartAt: number;
  voiceDuration: number;
  duration: number;
  revealAt: number;
  syncDelta: number;
  sfxCues: RenderSfxCue[];
  music: { track: string; volume: number };
}

export interface RenderCardView {
  productId: string;
  name: string;
  image?: string;
  priceLabel: string;
  /** True price, shown once the RevealScene plays (see `ProductCard`). */
  revealPriceLabel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  highlight?: boolean;
}

export interface RenderSceneDataView {
  cards?: RenderCardView[];
  maskedPrice?: string;
  resolvedPrice?: string;
  revealType?: 'PriceReveal' | 'DigitReveal';
  stage?: { width: number; height: number };
}

export interface RenderProductView {
  productId: string;
  name: string;
  image?: string;
  price: number;
}

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  codec: string;
  crf: number;
  preset: string;
  /** External ffmpeg binary; falls back to `FFMPEG_PATH` then `PATH`. */
  ffmpegPath?: string;
  /** Frame renderer backend. `software` is the built-in rasterizer. */
  frameRenderer?: 'software' | 'motion-canvas';
  /** Soft budget for the render stage (AD-8 / Story 4.1: ≤45s). */
  renderBudgetMs?: number;
  /** Hard timeout for the frame stage (AD-10: Motion Canvas 90s). */
  frameTimeoutMs?: number;
  /** Hard timeout for the encode stage (AD-10: frameCount × 200ms, max 120s). */
  encodeTimeoutMs?: number;
  /** Draw the diversification tilt on product cards. */
  tilt?: boolean;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  codec: 'libx264',
  crf: 18,
  preset: 'fast',
  frameRenderer: 'software',
  renderBudgetMs: 45_000,
  frameTimeoutMs: 90_000,
  encodeTimeoutMs: 120_000,
  tilt: true,
};

export interface RenderWarning {
  code: string;
  hint: string;
}

export interface RenderTimings {
  /** Asset/frame planning before the first pixel is written. */
  planningMs: number;
  /** Voice/SFX synthesis (measured by the caller, echoed into the log). */
  ttsMs: number;
  /** PNG sequence generation. */
  renderMs: number;
  /** FFmpeg mux. */
  encodeMs: number;
  /** Audio bed build (WAV mixing). */
  audioMixMs: number;
  totalMs: number;
}

export interface RenderInput {
  game: RenderGameView;
  timeline: RenderTimeline;
  audio: RenderAudioView;
  /** Renderer-neutral frames produced by the Scene System (Epic 3). */
  frames: RenderFrame[];
  variant?: 'in_video' | 'comment';
  sceneData?: RenderSceneDataView;
  products?: RenderProductView[];
  /** Diversification colour/tilt/BGM chosen by the deterministic engine. */
  diversification?: { bgColor: string; tilt: number; bgm: string };
  jobId: string;
  seed: number;
  /** Root for `<exportDir>/<gameId>_<seed>.mp4`; defaults to `export/`. */
  exportDir?: string;
  /** Root for `<tempDir>/<jobId>/`; defaults to `temp/`. */
  tempDir?: string;
  /** Project root used to resolve relative asset paths (default cwd). */
  rootDir?: string;
  config?: Partial<RenderConfig>;
  /** Voice synthesis wall-clock time, measured by the caller for the job log. */
  ttsMs?: number;
}

export interface RenderOutput {
  jobId: string;
  gameId: string;
  videoPath: string;
  captionPath: string;
  caption: string;
  hashtags: string[];
  affiliateLink?: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  durationMs: number;
  fileSize: number;
  warnings: RenderWarning[];
  timings: RenderTimings;
  /** True when the encode stage exceeded the render budget. */
  slow: boolean;
}

/** Pluggable frame stage: PNG sequence producer (AD-8). */
export interface IFrameRenderer {
  readonly backend: string;
  renderFrames(
    input: RenderInput,
    context: FrameRenderContext,
  ): Promise<FrameRenderResult>;
}

export interface FrameRenderContext {
  config: Required<Pick<RenderConfig, 'width' | 'height' | 'fps'>> & RenderConfig;
  /** Directory that receives `frame_%05d.png`. */
  framesDir: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  /** Called between frames so the engine can enforce the frame-stage timeout. */
  onFrame?: (index: number, total: number) => void;
  /** Absolute wall-clock deadline (epoch ms); the frame stage aborts past it. */
  deadlineAt?: number;
  /** Budget that produced `deadlineAt` (ms), used in the timeout message. */
  deadlineMs?: number;
}

export interface FrameRenderResult {
  framesDir: string;
  pattern: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  /** Distinct scene frames rasterized (animation keys). */
  renderedFrames: number;
  warnings: RenderWarning[];
  backend: string;
}

/** Pluggable mux stage: frames + audio → MP4. */
export interface IVideoMuxer {
  readonly backend: string;
  mux(request: MuxRequest): Promise<MuxResult>;
}

export interface MuxRequest {
  framesPattern: string;
  fps: number;
  audioWavPath: string;
  outputPath: string;
  cc: RenderConfig;
  timeoutMs: number;
  /** Optional progress hook fed from ffmpeg output. */
  onProgress?: (line: string) => void;
}

export interface MuxResult {
  outputPath: string;
  fileSize: number;
  durationMs: number;
  stderrTail: string;
  backend: string;
}
