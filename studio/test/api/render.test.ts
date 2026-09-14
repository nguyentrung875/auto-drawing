import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/render/route';

describe('POST /api/render', () => {
  it('returns 400 when body is invalid or missing required parameters', async () => {
    const invalidBodies = [
      {},
      { gameId: 'g1' }, // missing both productIds and gameJson
      { productIds: [] }, // empty productIds and missing gameId
    ];

    for (const body of invalidBodies) {
      const req = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    }
  });

  it('returns a text/event-stream response for a valid request', async () => {
    const req = new NextRequest('http://localhost:3000/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: 'test_game_123',
        mechanic: 'HI_LO',
        productIds: ['605899', '605900'],
        seed: 12345,
        resultVariant: 'in_video',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
  });
});
