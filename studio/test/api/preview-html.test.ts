import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/preview/html/route';

describe('POST /api/preview/html', () => {
  it('returns 400 when game is missing in body', async () => {
    const req = new NextRequest('http://localhost:3000/api/preview/html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 200 with 1080x1920 render HTML document for valid game', async () => {
    const mockGame = {
      metadata: {
        gameId: 'test_preview_game',
        mechanic: 'HI_LO',
        language: 'vi-VN',
        difficulty: 'easy',
        seed: 12345,
        resultVariant: 'in_video',
      },
      content: {
        title: 'Mock Title',
        hook: 'Bạn đoán đúng được mấy vòng?',
        question: 'Sản phẩm B CAO HƠN hay THẤP HƠN A?',
        choices: [],
        cta: 'Comment số vòng bạn đúng!',
        caption: 'Mock Caption',
        hashtags: ['doangia'],
        voiceScript: 'Nước giặt 189k',
      },
      entities: [
        { productId: 'p001', name: 'Nước giặt 3.5kg', price: 189000, brand: 'Omo' },
        { productId: 'p002', name: 'Sữa bột trẻ em 900g', price: 720000, brand: 'Vinamilk' },
      ],
      gameplay: {
        answer: 'higher',
        priceA: 189000,
        priceB: 720000,
      },
      scenes: [
        { type: 'hook', duration: 2.0 },
        { type: 'product', duration: 3.0 },
        { type: 'question', duration: 3.0 },
        { type: 'countdown', duration: 3.0 },
        { type: 'reveal', duration: 2.0 },
        { type: 'result', duration: 2.0 },
        { type: 'cta', duration: 3.0 },
      ],
      timeline: {
        totalDuration: 18.0,
        slots: [
          { type: 'hook', start: 0.0, end: 2.0, duration: 2.0 },
          { type: 'product', start: 2.0, end: 5.0, duration: 3.0 },
          { type: 'question', start: 5.0, end: 8.0, duration: 3.0 },
          { type: 'countdown', start: 8.0, end: 11.0, duration: 3.0 },
          { type: 'reveal', start: 11.0, end: 13.0, duration: 2.0 },
          { type: 'result', start: 13.0, end: 15.0, duration: 2.0 },
          { type: 'cta', start: 15.0, end: 18.0, duration: 3.0 },
        ],
        sceneTimings: [],
      },
      audio: {
        voice: { script: '', wavPath: '', duration: 0 },
        music: { track: '', volume: 0 },
        sfx: [],
      },
      publishing: {
        caption: '',
        hashtags: [],
        affiliateLink: '',
        outputPath: '',
      },
    };

    const req = new NextRequest('http://localhost:3000/api/preview/html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: mockGame }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('id="stage"');
    expect(html).toContain('window.__SEEK_FRAME__');
    expect(html).toContain('Nước giặt 3.5kg');
  }, 15000);
});
