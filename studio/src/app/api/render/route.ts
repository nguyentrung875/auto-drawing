import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

function getRootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith('studio') ? path.resolve(cwd, '..') : cwd;
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const {
    gameId,
    gameJson,
    mechanic,
    productIds,
    seed,
    resultVariant = 'in_video',
    hiddenIndex,
  } = body as {
    gameId?: string;
    gameJson?: Record<string, unknown>;
    mechanic?: string;
    productIds?: string[];
    seed?: number;
    resultVariant?: string;
    hiddenIndex?: number;
  };

  if (!gameId) {
    return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
  }

  if (!gameJson && (!productIds || !Array.isArray(productIds) || productIds.length === 0)) {
    return NextResponse.json(
      { error: 'Either gameJson or a non-empty productIds array must be provided' },
      { status: 400 }
    );
  }

  const rootDir = getRootDir();
  const gameLauncher = path.join(rootDir, 'bin', 'game.js');

  if (!fs.existsSync(gameLauncher)) {
    return NextResponse.json(
      { error: `Core Engine launcher not found at ${gameLauncher}` },
      { status: 500 }
    );
  }

  const resolvedSeed = seed ?? Math.floor(Math.random() * 900000) + 100000;
  let tempFilePath: string | null = null;
  const args: string[] = ['render'];

  if (gameJson) {
    const tempDir = path.join(rootDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempFilePath = path.join(tempDir, `studio_render_${gameId}_${Date.now()}.json`);
    fs.writeFileSync(tempFilePath, JSON.stringify(gameJson, null, 2), 'utf8');
    args.push('--game', path.relative(rootDir, tempFilePath));
  } else {
    args.push(
      '--mechanic', String(mechanic || 'HI_LO').toLowerCase(),
      '--products', (productIds || []).join(','),
      '--seed', String(resolvedSeed),
      '--result-variant', String(resultVariant)
    );
    if (hiddenIndex !== undefined) {
      args.push('--hidden-index', String(hiddenIndex));
    }
  }

  // Create SSE TransformStream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  function sendEvent(type: string, data: Record<string, unknown>) {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(payload)).catch(() => {});
  }

  // Spawn child process
  const child = spawn(process.execPath, [gameLauncher, ...args], {
    cwd: rootDir,
    env: { ...process.env },
  });

  let stdout = '';
  let stderr = '';
  let currentPercent = 5;

  sendEvent('progress', {
    stage: 'init',
    message: 'Khởi động Core Engine render...',
    percent: currentPercent,
  });

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (!lower.trim()) continue;

      if (lower.includes('audio') || lower.includes('tts') || lower.includes('speech')) {
        currentPercent = Math.max(currentPercent, 20);
        sendEvent('progress', {
          stage: 'audio',
          message: 'Đang tổng hợp giọng lồng tiếng TTS...',
          percent: currentPercent,
        });
      } else if (lower.includes('frame') || lower.includes('scene') || lower.includes('paint')) {
        // Match frame numbers if present, e.g. "frame 120/450"
        const frameMatch = lower.match(/frame\s+(\d+)\s*\/\s*(\d+)/);
        if (frameMatch) {
          const current = parseInt(frameMatch[1], 10);
          const total = parseInt(frameMatch[2], 10);
          if (total > 0) {
            currentPercent = Math.max(currentPercent, Math.round(20 + (current / total) * 65));
          }
        } else {
          currentPercent = Math.min(85, currentPercent + 3);
        }
        sendEvent('progress', {
          stage: 'render',
          message: `Đang vẽ khung hình video: ${line.trim().slice(0, 80)}`,
          percent: currentPercent,
        });
      } else if (lower.includes('ffmpeg') || lower.includes('mux')) {
        currentPercent = Math.max(currentPercent, 90);
        sendEvent('progress', {
          stage: 'mux',
          message: 'Đang nén và ghép âm thanh bằng FFmpeg...',
          percent: currentPercent,
        });
      }
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // ignore cleanup error
      }
    }

    const totalMs = Date.now() - startMs;

    if (code === 0) {
      const exportDir = path.join(rootDir, 'export');
      let videoFilename = `${gameId}_${resolvedSeed}.mp4`;
      let foundPath = path.join(exportDir, videoFilename);

      if (!fs.existsSync(foundPath)) {
        // Try searching export directory for any mp4 with gameId or seed
        if (fs.existsSync(exportDir)) {
          const files = fs.readdirSync(exportDir);
          const matching = files.find(
            (f) => f.endsWith('.mp4') && (f.includes(String(gameId)) || f.includes(String(resolvedSeed)))
          );
          if (matching) {
            videoFilename = matching;
            foundPath = path.join(exportDir, matching);
          }
        }
      }

      // Read caption if available
      const captionFile = videoFilename.replace(/\.mp4$/, '.caption.json');
      const captionPath = path.join(exportDir, captionFile);
      let caption = '';
      let hashtags: string[] = [];
      let affiliateLink = '';

      if (fs.existsSync(captionPath)) {
        try {
          const capJson = JSON.parse(fs.readFileSync(captionPath, 'utf8'));
          caption = capJson.caption || '';
          hashtags = capJson.hashtags || [];
          affiliateLink = capJson.affiliate_link || capJson.affiliateLink || '';
        } catch {
          // ignore parsing error
        }
      }

      sendEvent('done', {
        ok: true,
        gameId,
        seed: resolvedSeed,
        videoUrl: `/api/videos/${videoFilename}`,
        videoFilename,
        caption,
        hashtags,
        affiliateLink,
        renderMs: totalMs,
      });
    } else {
      sendEvent('error', {
        ok: false,
        error: `Quá trình render thất bại (exit code ${code})`,
        stderr: stderr.slice(-1000),
        stdout: stdout.slice(-1000),
      });
    }

    writer.close().catch(() => {});
  });

  // Handle client abort / disconnect
  req.signal.addEventListener('abort', () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 1500);
    }
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // ignore
      }
    }
    writer.close().catch(() => {});
  });

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
