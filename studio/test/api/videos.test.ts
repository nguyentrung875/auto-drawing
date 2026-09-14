import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { GET } from '../../src/app/api/videos/[filename]/route';

describe('GET /api/videos/[filename]', () => {
  const rootDir = process.cwd().endsWith('studio')
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
  const exportDir = path.join(rootDir, 'export');
  const dummyFile = 'test_sample_video.mp4';
  const dummyPath = path.join(exportDir, dummyFile);
  const sampleContent = Buffer.from('FAKE_MP4_BINARY_DATA_FOR_TESTING_PURPOSES_1234567890');

  beforeAll(() => {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    fs.writeFileSync(dummyPath, sampleContent);
  });

  afterAll(() => {
    if (fs.existsSync(dummyPath)) {
      fs.unlinkSync(dummyPath);
    }
  });

  it('rejects invalid or path-traversal filenames with 400', async () => {
    const malicious = ['../secret.mp4', '..\\secret.mp4', 'malicious.exe', 'folder/video.mp4'];
    for (const name of malicious) {
      const req = new NextRequest(`http://localhost:3000/api/videos/${encodeURIComponent(name)}`);
      const res = await GET(req, { params: Promise.resolve({ filename: name }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    }
  });

  it('returns 404 if video does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/videos/non_existent_game_999.mp4');
    const res = await GET(req, { params: Promise.resolve({ filename: 'non_existent_game_999.mp4' }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 with full content when no Range header is provided', async () => {
    const req = new NextRequest(`http://localhost:3000/api/videos/${dummyFile}`);
    const res = await GET(req, { params: Promise.resolve({ filename: dummyFile }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(Number(res.headers.get('Content-Length'))).toBe(sampleContent.length);

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.equals(sampleContent)).toBe(true);
  });

  it('returns 206 Partial Content when valid Range header is provided', async () => {
    const req = new NextRequest(`http://localhost:3000/api/videos/${dummyFile}`, {
      headers: {
        range: 'bytes=0-10',
      },
    });
    const res = await GET(req, { params: Promise.resolve({ filename: dummyFile }) });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe(`bytes 0-10/${sampleContent.length}`);
    expect(res.headers.get('Content-Length')).toBe('11');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(11);
    expect(buf.equals(sampleContent.subarray(0, 11))).toBe(true);
  });
});
