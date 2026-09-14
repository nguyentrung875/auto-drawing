import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';

export const dynamic = 'force-dynamic';

function getRootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith('studio') ? path.resolve(cwd, '..') : cwd;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { game?: any };
    const game = body?.game;

    if (!game) {
      return NextResponse.json(
        { error: 'game object is required in request body' },
        { status: 400 }
      );
    }

    const rootDir = getRootDir();
    const timeline = (game.timeline && game.timeline.sceneTimings && game.timeline.sceneTimings.length > 0)
      ? {
          totalDuration: game.timeline.totalDuration ?? 18.0,
          slots: game.timeline.sceneTimings.map((s: any) => ({
            type: s.type,
            duration: s.duration,
            start: s.startAt ?? s.start ?? 0,
            end: s.endAt ?? s.end ?? 0,
          })),
        }
      : (game.timeline?.slots
          ? game.timeline
          : {
              totalDuration: 18.0,
              slots: [
                { type: 'hook', start: 0, end: 2, duration: 2 },
                { type: 'product', start: 2, end: 5, duration: 3 },
                { type: 'question', start: 5, end: 8, duration: 3 },
                { type: 'countdown', start: 8, end: 11, duration: 3 },
                { type: 'reveal', start: 11, end: 13, duration: 2 },
                { type: 'result', start: 13, end: 15, duration: 2 },
                { type: 'cta', start: 15, end: 18, duration: 3 },
              ],
            });

    const renderInput = {
      game,
      timeline,
      rootDir,
      diversification: {
        bgColor: '#0f172a',
        tilt: 0,
        bgm: 'default',
      },
      jobId: game.metadata?.gameId ?? 'preview',
      seed: game.metadata?.seed ?? 12345,
      frames: [],
      audio: {},
    };

    const scriptPath = path.join(rootDir, 'scripts', 'generate-preview-html.ts');

    const html = await new Promise<string>((resolve, reject) => {
      const proc = spawn(
        process.execPath,
        ['--import', 'tsx', scriptPath],
        {
          cwd: rootDir,
          env: { ...process.env },
        }
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        reject(err);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      proc.stdin.write(JSON.stringify(renderInput));
      proc.stdin.end();
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
