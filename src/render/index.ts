/**
 * Bounded context: render — Motion Canvas-compatible frames → FFmpeg MP4.
 *
 * Story 4.1 (`RenderEngine`). The context exposes a pluggable frame stage
 * (`IFrameRenderer`) and mux stage (`IVideoMuxer`) so the AD-8 pipeline stays
 * swappable, plus the offline pixel scan that proves the affiliate link never
 * reaches the video.
 */
export const RENDER_CONTEXT = 'render';
export {
  RenderEngine,
  configFrom,
  loadConfigFile,
  type RenderEngineConfigSource,
  type RenderEngineOptions,
} from './RenderEngine';
export {
  RENDER_ERROR_CODES,
  RENDER_WARNING_CODES,
  RenderError,
  filterForCode,
  type JobFilter,
  type RenderErrorCode,
} from './errors';
export {
  DEFAULT_RENDER_CONFIG,
  type FrameRenderContext,
  type FrameRenderResult,
  type IFrameRenderer,
  type IVideoMuxer,
  type MuxRequest,
  type MuxResult,
  type RenderAudioView,
  type RenderCardView,
  type RenderConfig,
  type RenderFrame,
  type RenderFrameElement,
  type RenderGameView,
  type RenderInput,
  type RenderOutput,
  type RenderProductView,
  type RenderSceneDataView,
  type RenderTimeline,
  type RenderTimings,
  type RenderWarning,
} from './types';
export { SoftwareFrameRenderer } from './softwareFrameRenderer';
export { FFmpegMuxer, probeVideo, type ProbeResult } from './ffmpeg';
export { buildAudioBed, AUDIO_BED_SAMPLE_RATE, type AudioBedRequest } from './audioBed';
export { assertNoAffiliateBurn, scanForAffiliateBurn, linkVariants } from './pixelScan';
export { scanLayout, assertLayoutClean } from './layoutScan';
export type { LayoutFinding } from './layoutScan';
export { Canvas, parseColor } from './canvas';
export { decodePng, encodePng, pngSize } from './png';
export { ffmpegAvailable, resolveBinary, runProcess } from './process';
export { TextRenderer, resolveFontFile } from './text';
