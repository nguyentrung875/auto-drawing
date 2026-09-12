/**
 * FFmpeg mux stage (AD-8): PNG sequence + audio bed → H.264/AAC MP4 at
 * 1080×1920. License stays LGPL: the binary is external, nothing links libx264.
 */
import { existsSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { RENDER_ERROR_CODES, RenderError } from './errors';
import { resolveBinary, runProcess } from './process';
import type { IVideoMuxer, MuxRequest, MuxResult } from './types';

export class FFmpegMuxer implements IVideoMuxer {
  readonly binaryPath?: string;
  readOnly = true;

  get backend(): string {
    return 'ffmpeg';
  }

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath;
  }

  /** Resolved ffmpeg path, or null when the binary is unavailable. */
  resolve(): string | null {
    return resolveBinary('ffmpeg', this.binaryPath);
  }

  async mux(request: MuxRequest): Promise<MuxResult> {
    const binary = this.resolve();
    if (!binary) {
      throw new RenderError(
        RENDER_ERROR_CODES.FFMPEG_MISSING,
        'ffmpeg',
        'ffmpeg was not found — install it or set FFMPEG_PATH (render.ffmpegPath in config.json)',
      );
    }

    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-framerate', String(request.fps),
      '-i', request.framesPattern,
      '-i', request.audioWavPath,
      '-c:v', request.cc.codec,
      '-crf', String(request.cc.crf),
      '-preset', request.cc.preset,
      '-pix_fmt', 'yuv420p',
      '-r', String(request.fps),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-movflags', '+faststart',
      '-shortest',
      request.outputPath,
    ];

    const started = performance.now();
    const result = await runProcess(binary, args, {
      timeoutMs: request.timeoutMs,
      onStderr: request.onProgress,
    });

    if (result.timedOut) {
      throw new RenderError(
        RENDER_ERROR_CODES.TIMEOUT,
        'ffmpeg',
        `ffmpeg exceeded ${request.timeoutMs}ms and was killed (${result.signal ?? 'SIGKILL'})`,
      );
    }
    if (result.code !== 0) {
      throw new RenderError(
        RENDER_ERROR_CODES.ENCODE_FAILED,
        'ffmpeg',
        `ffmpeg exited with code ${result.code}: ${tail(result.stderr)}`,
      );
    }
    if (!existsSync(request.outputPath)) {
      throw new RenderError(
        RENDER_ERROR_CODES.OUTPUT_MISSING,
        'outputPath',
        `ffmpeg reported success but '${request.outputPath}' does not exist`,
      );
    }

    return {
      outputPath: request.outputPath,
      fileSize: statSync(request.outputPath).size,
      durationMs: Number((performance.now() - started).toFixed(2)),
      stderrTail: tail(result.stderr, 800),
      backend: this.backend,
    };
  }
}

function tail(text: string, length = 400): string {
  const trimmed = text.trim();
  return trimmed.length <= length ? trimmed : trimmed.slice(-length);
}

export interface ProbeResult {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  videoCodec: string;
  audioCodec: string;
}

/**
 * Verification helper (used by tests and evidence runs): inspect an encoded MP4
 * with ffprobe when the binary is available (bundled installer or `FFPROBE_PATH`).
 */
export async function probeVideo(filePath: string, ffmpegBinary?: string): Promise<ProbeResult | null> {
  if (!resolveBinary('ffmpeg', ffmpegBinary)) return null;
  const probe = resolveBinary('ffprobe');
  if (!probe) return null;

  const result = await runProcess(
    probe,
    [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath,
    ],
    { timeoutMs: 15_000 },
  );
  if (result.code !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
        codec_name?: string;
      }>;
      format?: { duration?: string };
    };
    const streams = parsed.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === 'video');
    const audio = streams.find((stream) => stream.codec_type === 'audio');
    if (!video) return null;
    const [numerator, denominator] = (video.r_frame_rate ?? '0/1').split('/').map(Number);
    return {
      width: video.width ?? 0,
      height: video.height ?? 0,
      fps: denominator ? numerator! / denominator : 0,
      durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
      videoCodec: video.codec_name ?? '',
      audioCodec: audio?.codec_name ?? '',
    };
  } catch {
    return null;
  }
}
