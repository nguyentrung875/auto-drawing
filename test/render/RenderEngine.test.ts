/**
 * Story 4.1 — RenderEngine: MP4 output, caption sidecar, timings, slow warning,
 * affiliate-link pixel scan, timeout handling and temp cleanup.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { GameEngine, MechanicRegistry } from '../../src/game';
import { ProductProvider } from '../../src/product/ProductProvider';
import { SceneSystem } from '../../src/scene';
import {
  RenderEngine,
  configFrom,
  loadConfigFile,
  type IVideoMuxer,
  type MuxRequest,
  type MuxResult,
  type RenderInput,
} from '../../src/render';
import { mkdirSync, readdirSync } from 'node:fs';
import { FFmpegMuxer } from '../../src/render/ffmpeg';
import { encodePng } from '../../src/render/png';
import { Canvas } from '../../src/render/canvas';
import { muxerAvailable, probeVideoInfo, renderFixture, scanForBurn } from '../helpers/render';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'epic4-render-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function fixtureInput(overrides: Partial<RenderInput> = {}): Promise<RenderInput> {
  const input = await renderFixture({
    rootDir: workDir,
    exportDir: path.join(workDir, 'export'),
    tempDir: path.join(workDir, 'temp'),
    ttsMs: 42,
  });
  return { ...input, ...overrides };
}

/** Deterministic 1×1 muxer stub: pretends to encode and writes a real file. */
class StubMuxer implements IVideoMuxer {
  readonly backend = 'stub';
  calls: MuxRequest[] = [];
  frameCount = 0;
  fail = false;

  async mux(request: MuxRequest): Promise<MuxResult> {
    this.calls.push(request);
    if (this.fail) throw new Error('stub mux failure');
    const frames = countFrames(request.framesPattern);
    this.frameCount = Math.max(this.frameCount, frames);
    writeFileSync(request.outputPath, Buffer.from('stub-mp4'));
    return { outputPath: request.outputPath, fileSize: 8, durationMs: 12.5, stderrTail: '', backend: this.backend };
  }
}

function countFrames(pattern: string): number {
  const directory = path.dirname(pattern);
  const prefix = path.basename(pattern).replace(/%05d/, '').replace('.png', '');
  return readdirSync(directory).filter((file) => file.startsWith(prefix)).length;
}

describe('RenderEngine (Story 4.1)', () => {
  it('renders a 1080×1920@30fps H.264/AAC MP4 + caption.json within the 45s budget', async () => {
    if (!muxerAvailable()) return;
    const input = await fixtureInput();
    const output = await RenderEngine.render(input, { rootDir: workDir });

    expect(output.videoPath).toBe(path.join(workDir, 'export', 'hi_lo_839271_839271.mp4'));
    expect(existsSync(output.videoPath)).toBe(true);
    expect(output.frameCount).toBe(540); // 18.0s × 30fps
    expect(output.width).toBe(1080);
    expect(output.height).toBe(1920);
    expect(output.slow).toBe(false);
    expect(output.timings.totalMs).toBeLessThan(45_000);

    const caption = JSON.parse(readFileSync(output.captionPath, 'utf8'));
    expect(caption).toEqual({
      caption: input.game.publishing.caption,
      hashtags: input.game.publishing.hashtags,
      affiliate_link: input.game.publishing.affiliate_link,
    });

    const probe = await probeVideoInfo(output.videoPath);
    expect(probe).not.toBeNull();
    expect(probe!.width).toBe(1080);
    expect(probe!.height).toBe(1920);
    expect(probe!.fps).toBeCloseTo(30, 1);
    expect(probe!.videoCodec).toBe('h264');
    expect(probe!.audioCodec).toBe('aac');
    expect(probe!.durationMs).toBeGreaterThan(17_000);
    expect(probe!.durationMs).toBeLessThan(19_000);
  }, 240_000);

  it('never burns the affiliate link into the video (pixel scan)', async () => {
    if (!muxerAvailable()) return;
    const input = await fixtureInput();
    const output = await RenderEngine.render(input, { rootDir: workDir });
    const scan = await scanForBurn(output.videoPath, input.game.publishing.affiliate_link!);
    expect(scan.burned).toBe(false);
  }, 240_000);

  it('detects a link burned into the bottom band (pixel scan guard)', async () => {
    if (!muxerAvailable()) return;
    // Author a synthetic frame with the link drawn in the bottom band, encode it,
    // then confirm the scan rejects that artifact.
    const width = 1080;
    const height = 1920;
    const canvas = new Canvas(width, height);
    canvas.fill(0, 0, width, height, '#101828');
    canvas.drawText('https://shopee.vn/p001?aff=123', {
      x: 60,
      y: 1700,
      size: 40,
      weight: 600,
      color: '#ffffff',
    });
    const framesDir = path.join(workDir, 'burn-frames');
    mkdirSync(framesDir, { recursive: true });
    const png = encodePng({ width, height, data: canvas.data });
    for (let i = 1; i <= 30; i += 1) {
      writeFileSync(path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`), png);
    }
    const audio = path.join(workDir, 'silence.wav');
    writeFileSync(audio, readFileSync((await fixtureInput()).audio.voiceWavPath));
    const outputPath = path.join(workDir, 'burned.mp4');
    const muxer = new FFmpegMuxer();
    await muxer.mux({
      framesPattern: path.join(framesDir, 'frame_%05d.png'),
      fps: 30,
      audioWavPath: audio,
      outputPath,
      cc: configFrom({}, {}),
      timeoutMs: 60_000,
    });

    const scan = await scanForBurn(outputPath, 'https://shopee.vn/p001?aff=123');
    expect(scan.burned).toBe(true);
    expect(scan.matchedAt).not.toBeNull();
    expect(scan.matchedAt!.variant).toContain('shopee');
  }, 300_000);

  it('removes temp/<jobId>/ in finally and keeps queue/export intact', async () => {
    const input = await fixtureInput();
    const muxer = new StubMuxer();
    await RenderEngine.render(input, { rootDir: workDir, muxer, config: { frameTimeoutMs: 120_000 } });
    expect(existsSync(path.join(workDir, 'temp', input.jobId))).toBe(false);
    expect(existsSync(input.exportDir!)).toBe(true);
  }, 240_000);

  it('cleans temp/ even when the mux stage fails', async () => {
    const input = await fixtureInput();
    const muxer = new StubMuxer();
    muxer.fail = true;
    await expect(RenderEngine.render(input, { rootDir: workDir, muxer })).rejects.toThrow();
    expect(existsSync(path.join(workDir, 'temp', input.jobId))).toBe(false);
  }, 240_000);

  it('falls back to the software frame stage and reports the honest warning', async () => {
    const input = await fixtureInput();
    const output = await RenderEngine.render(input, {
      rootDir: workDir,
      muxer: new StubMuxer(),
      config: { frameRenderer: 'motion-canvas' },
    });
    expect(output.warnings.map((warning) => warning.code)).toContain('W_RENDERER_FALLBACK');
  }, 240_000);

  it('fails with PROCESS_TIMEOUT when the frame stage overruns its budget', async () => {
    const input = await fixtureInput();
    await expect(
      RenderEngine.render(input, {
        rootDir: workDir,
        muxer: new StubMuxer(),
        config: { frameTimeoutMs: 1 },
      }),
    ).rejects.toMatchObject({ code: 'PROCESS_TIMEOUT' });
    expect(existsSync(path.join(workDir, 'temp', input.jobId))).toBe(false);
  }, 240_000);

  it('emits W_RENDER_SLOW instead of failing when the budget is exceeded', async () => {
    const input = await fixtureInput();
    const output = await RenderEngine.render(input, {
      rootDir: workDir,
      muxer: new StubMuxer(),
      config: { renderBudgetMs: 0 },
    });
    expect(output.slow).toBe(true);
    expect(output.warnings.map((warning) => warning.code)).toContain('W_RENDER_SLOW');
  }, 240_000);

  it('rejects a job with no frames (scene stage not run)', async () => {
    const input = await fixtureInput({ frames: [] });
    await expect(RenderEngine.render(input, { rootDir: workDir })).rejects.toMatchObject({
      code: 'E_RENDER_FRAMES_MISSING',
    });
  }, 60_000);

  it('resolves config.json values (video size, codec, crf) with CLI overrides winning', () => {
    const file = { video: { width: 720, height: 1280, fps: 24 }, render: { crf: 23, preset: 'medium' } };
    const resolved = configFrom(file, {});
    expect(resolved).toMatchObject({ width: 720, height: 1280, fps: 24, crf: 23, preset: 'medium' });
    const overridden = configFrom(file, { width: 1080, crf: 18 });
    expect(overridden).toMatchObject({ width: 1080, height: 1280, crf: 18 });
    expect(configFrom(loadConfigFile(process.cwd()), {})).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 30,
      codec: 'libx264',
      crf: 18,
      preset: 'fast',
    });
  });
});
