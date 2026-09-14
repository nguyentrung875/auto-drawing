import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

function getRootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith('studio') ? path.resolve(cwd, '..') : cwd;
}

const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_\-]+\.mp4$/;

interface RouteContext {
  params: Promise<{ filename: string }> | { filename: string };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const filename = params?.filename;

    if (!filename || !SAFE_FILENAME_PATTERN.test(filename)) {
      return NextResponse.json(
        { error: 'Invalid video filename. Only alphanumeric, dashes and underscores are allowed with .mp4 extension.' },
        { status: 400 }
      );
    }

    const rootDir = getRootDir();
    const filePath = path.join(rootDir, 'export', filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Video file not found' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.get('range');

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parts[0] ? parseInt(parts[0], 10) : 0;
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
        },
      });
    }

    const nodeStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
        'Content-Type': 'video/mp4',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
