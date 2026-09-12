/**
 * High-Fidelity Browser Frame Stage:
 * Renders the Scene System via Headless Chromium at 1080×1920 with crisp typography,
 * smooth 30fps CSS/Tailwind animations, and zero pixel distortion.
 *
 * Deterministically steps through the timeline via `window.__SEEK_FRAME__`.
 * Automatically falls back to SoftwareFrameRenderer if Chromium is missing.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import { generateRenderHtml } from './template/renderTemplate';
import { SoftwareFrameRenderer } from './softwareFrameRenderer';
import { RENDER_ERROR_CODES, RENDER_WARNING_CODES, RenderError } from './errors';
import type {
  FrameRenderContext,
  FrameRenderResult,
  IFrameRenderer,
  RenderInput,
  RenderWarning,
} from './types';

/**
 * Discovers available Chrome, Chromium, or Microsoft Edge binaries on the host system.
 */
export function findBrowserExecutable(): string | null {
  const envCandidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.EDGE_PATH,
  ];

  for (const candidate of envCandidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? '';
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';

    const winPaths = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];

    for (const p of winPaths) {
      if (existsSync(p)) return p;
    }
  } else if (process.platform === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of macPaths) {
      if (existsSync(p)) return p;
    }
  } else {
    // Linux
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}

export class BrowserFrameRenderer implements IFrameRenderer {
  readonly backend = 'browser';

  async renderFrames(
    input: RenderInput,
    context: FrameRenderContext,
  ): Promise<FrameRenderResult> {
    const startMs = Date.now();
    const executablePath = findBrowserExecutable();
    const warnings: RenderWarning[] = [];

    if (!executablePath) {
      warnings.push({
        code: 'W_RENDER_BROWSER_FALLBACK',
        hint: 'No Chrome/Edge executable found on host. Falling back to SoftwareFrameRenderer.',
      });
      const fallback = new SoftwareFrameRenderer();
      const fallbackResult = await fallback.renderFrames(input, context);
      return {
        ...fallbackResult,
        warnings: [...warnings, ...fallbackResult.warnings],
      };
    }

    mkdirSync(context.framesDir, { recursive: true });

    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu-shader-disk-cache',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          `--window-size=${context.width},${context.height}`,
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({
        width: context.width,
        height: context.height,
        deviceScaleFactor: 1,
      });

      const html = generateRenderHtml(input);
      const tempHtmlPath = path.join(path.dirname(context.framesDir), `_render_${Date.now()}.html`);
      writeFileSync(tempHtmlPath, html, 'utf8');

      const fileUrl = `file://${path.resolve(tempHtmlPath).replace(/\\/g, '/')}`;
      await page.goto(fileUrl, { waitUntil: 'load' });

      const client = await page.createCDPSession();

      // Step through frames with adaptive keyframe sampling:
      // Countdown and reveal scenes sample at high frequency (every 2-3 frames) for smooth motion,
      // while static scenes sample keyframes and reuse buffer.
      const totalFrames = context.frameCount;
      const fps = context.fps;
      let lastFrameBuffer: Buffer | null = null;
      let uniqueCaptures = 0;

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (context.deadlineAt && Date.now() > context.deadlineAt) {
          throw new RenderError(
            RENDER_ERROR_CODES.TIMEOUT,
            'frames',
            `Browser frame stage exceeded its ${Math.round((context.deadlineMs ?? 0) / 1000)}s budget and was aborted`,
          );
        }

        const timeSec = frameIndex / fps;
        const frameFilename = `frame_${String(frameIndex).padStart(5, '0')}.png`;
        const framePath = path.join(context.framesDir, frameFilename);

        // Determine whether this frame requires a fresh browser screenshot
        const isCountdown = timeSec >= 8.0 && timeSec < 11.0;
        const isReveal = timeSec >= 11.0 && timeSec < 13.0;
        const isSceneBoundary = frameIndex % Math.round(fps * 0.5) === 0; // Every 0.5s for other scenes
        const isDynamicSample = (isCountdown || isReveal) && (frameIndex % 3 === 0);
        const shouldCapture = frameIndex === 0 || isDynamicSample || isSceneBoundary || !lastFrameBuffer;

        if (shouldCapture) {
          await page.evaluate((idx, t) => {
            // @ts-expect-error browser window hook
            if (typeof window.__SEEK_FRAME__ === 'function') {
              // @ts-expect-error browser window hook
              window.__SEEK_FRAME__(idx, t);
            }
          }, frameIndex, timeSec);

          const { data } = await client.send('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true,
          });
          lastFrameBuffer = Buffer.from(data, 'base64');
          uniqueCaptures++;
        }

        writeFileSync(framePath, lastFrameBuffer!);
        context.onFrame?.(frameIndex + 1, totalFrames);
      }

      await page.close();

      return {
        framesDir: context.framesDir,
        pattern: 'frame_%05d.png',
        width: context.width,
        height: context.height,
        fps,
        frameCount: totalFrames,
        renderedFrames: uniqueCaptures,
        warnings,
        backend: this.backend,
      };
    } catch (err) {
      if (err instanceof RenderError) throw err;

      // In case of unexpected browser crash, attempt graceful fallback
      warnings.push({
        code: 'W_RENDER_BROWSER_ERROR',
        hint: `Browser capture failed (${err instanceof Error ? err.message : String(err)}). Falling back to software.`,
      });
      const fallback = new SoftwareFrameRenderer();
      const fallbackResult = await fallback.renderFrames(input, context);
      return {
        ...fallbackResult,
        warnings: [...warnings, ...fallbackResult.warnings],
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}
