import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { generateRenderHtml } from '../../../../../../src/render/template/renderTemplate';
import type { GameJson, Timeline } from '../../../../../../src/types/game';
import type { RenderInput } from '../../../../../../src/render/types';

function getRootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith('studio') ? path.resolve(cwd, '..') : cwd;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { game?: GameJson };
    const game = body?.game;

    if (!game) {
      return NextResponse.json(
        { error: 'game object is required in request body' },
        { status: 400 }
      );
    }

    const rootDir = getRootDir();
    const timeline: Timeline = (game.timeline && game.timeline.slots && game.timeline.slots.length > 0)
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
          sceneTimings: [],
        };

    const renderInput: RenderInput = {
      game,
      timeline,
      rootDir,
      diversification: {
        bgColor: '#0f172a',
        tilt: 0,
        bgm: 'default',
      },
    };

    const html = generateRenderHtml(renderInput);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
