import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  try {
    const body = await req.json();
    const {
      mechanic = 'HI_LO',
      productIds = [],
      seed = Math.floor(Math.random() * 900000) + 100000,
      resultVariant = 'in_video',
      hiddenIndex,
    } = body;

    if (!productIds || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds is required' }, { status: 400 });
    }

    // Resolve path to auto-drawing root directory
    const candidates = [
      path.resolve(process.cwd(), '..'),
      path.resolve(process.cwd()),
      path.resolve('d:/source_code/auto-drawing'),
    ];

    const rootDir = candidates.find((dir) => existsSync(path.join(dir, 'bin', 'game.js'))) || candidates[0];
    const gameLauncher = path.join(rootDir, 'bin', 'game.js');

    const args = [
      gameLauncher,
      'render',
      '--mechanic', String(mechanic).toLowerCase(),
      '--products', productIds.join(','),
      '--seed', String(seed),
      '--result-variant', resultVariant,
      '--renderer', 'browser',
    ];

    if (hiddenIndex !== undefined) {
      args.push('--hidden-index', String(hiddenIndex));
    }

    // Execute render pipeline
    const renderProcess = spawn(process.execPath, args, {
      cwd: rootDir,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    renderProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    renderProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      renderProcess.on('close', resolve);
      renderProcess.on('error', () => resolve(1));
    });

    const totalMs = Date.now() - startMs;
    const gameId = `${String(mechanic).toLowerCase()}_${seed}`;
    const videoFilename = `${gameId}_${seed}.mp4`;
    const captionFilename = `${gameId}_${seed}.caption.json`;
    const captionPath = path.join(rootDir, 'export', captionFilename);

    let captionData = {
      caption: '',
      hashtags: ['doangia', 'affiliate'],
      affiliate_link: '',
    };

    if (existsSync(captionPath)) {
      try {
        captionData = JSON.parse(readFileSync(captionPath, 'utf8'));
      } catch {
        // Fallback
      }
    }

    if (exitCode !== 0) {
      return NextResponse.json(
        {
          error: 'Render process failed',
          code: 'E_RENDER_FAILED',
          stderr,
          stdout,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      gameId,
      seed,
      videoUrl: `/api/videos/${videoFilename}`,
      caption: captionData.caption,
      hashtags: captionData.hashtags,
      affiliateLink: captionData.affiliate_link,
      renderMs: totalMs,
      stdout,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
