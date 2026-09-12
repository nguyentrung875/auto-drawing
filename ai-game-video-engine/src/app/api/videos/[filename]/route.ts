import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith('.mp4')) {
    return new NextResponse('Invalid file type', { status: 400 });
  }

  // Look for video in auto-drawing export directory
  const possiblePaths = [
    path.resolve(process.cwd(), '..', 'export', safeFilename),
    path.resolve(process.cwd(), 'export', safeFilename),
    path.resolve('d:/source_code/auto-drawing/export', safeFilename),
  ];

  const filePath = possiblePaths.find((p) => existsSync(p));
  if (!filePath) {
    return new NextResponse('Video not found', { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.get('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(stream);

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'video/mp4',
      },
    });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream);

  return new NextResponse(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  });
}
