import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { buildSatoriVirtualDom } from '../../src/render/satori/satoriTemplate';
import { SatoriFrameRenderer } from '../../src/render/satoriFrameRenderer';
import { DEFAULT_RENDER_CONFIG } from '../../src/render/types';
import type { VisualThemeId } from '../../src/core/theme';
import type { RenderInput } from '../../src/render/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ALL_5_THEMES: VisualThemeId[] = [
  'hay_chon_gia_dung',
  'sieu_thi_gia_dinh',
  'bep_am_noi_tro',
  'gio_vang_san_deal',
  'tap_hoa_vui_ve',
];

const ALL_7_MECHANICS = [
  'HI_LO',
  'MOST_EXPENSIVE',
  'ONE_AWAY',
  'ODD_ONE_OUT',
  'GUESS_THE_PRICE',
  'GROCERY_BASKET',
  'DEAL_OR_SCAM',
] as const;

function createMockRenderInput(mechanic: string, themeId: VisualThemeId): RenderInput {
  return {
    jobId: `test_job_${mechanic}_${themeId}`,
    seed: 839271,
    theme: themeId,
    game: {
      metadata: {
        gameId: `test_${mechanic.toLowerCase()}`,
        mechanic,
        seed: 839271,
      },
      content: {
        title: `Game ${mechanic}`,
        question: `Câu hỏi cho ${mechanic}?`,
        choices: [
          { id: 'opt_a', label: 'LỰA CHỌN A' },
          { id: 'opt_b', label: 'LỰA CHỌN B' },
        ],
      },
      gameplay: {
        answer: mechanic === 'ONE_AWAY' ? '7' : mechanic === 'DEAL_OR_SCAM' ? 'deal' : 'p001',
        budget: 500000,
      },
      entities: [
        { productId: 'p001', name: 'Nồi chiên không dầu Lock&Lock 5.2L', price: 1590000 },
        { productId: 'p002', name: 'Chảo chống dính Sunhouse 26cm', price: 189000 },
        { productId: 'p003', name: 'Bộ lau nhà 360 độ Thái Lan', price: 299000 },
        { productId: 'p004', name: 'Bình đun siêu tốc Philips 1.8L', price: 450000 },
      ],
      publishing: {
        caption: 'Caption',
        hashtags: ['#test'],
      },
    },
    timeline: {
      slots: [
        { type: 'play', start: 0, end: 10, duration: 10 },
        { type: 'reveal', start: 10, end: 15, duration: 5 },
      ],
      totalDuration: 15,
    },
    audio: {
      voiceWavPath: '',
      voiceStartAt: 0,
      voiceDuration: 10,
      duration: 15,
      revealAt: 10.0,
      syncDelta: 0,
      sfxCues: [],
      music: { track: '', volume: 0.2 },
    },
    frames: [],
    sceneData: {
      maskedPrice: '1.?90.000₫',
    },
  };
}

describe('Satori Dynamic Themes across All 7 Mechanics', () => {
  for (const themeId of ALL_5_THEMES) {
    describe(`Theme: ${themeId}`, () => {
      for (const mechanic of ALL_7_MECHANICS) {
        it(`builds virtual DOM cleanly for ${mechanic}`, () => {
          const input = createMockRenderInput(mechanic, themeId);
          const vdomPlay = buildSatoriVirtualDom({
            input,
            timeSec: 5.0,
            productImages: new Map(),
          });

          expect(vdomPlay.type).toBe('div');
          expect(vdomPlay.props.style?.backgroundImage).toContain('linear-gradient');
          expect(vdomPlay.props.children).toBeDefined();

          // Also test reveal state
          const vdomReveal = buildSatoriVirtualDom({
            input,
            timeSec: 12.0,
            productImages: new Map(),
          });
          expect(vdomReveal.type).toBe('div');
        });
      }
    });
  }

  it('renders real PNG frames with SatoriFrameRenderer using hay_chon_gia_dung theme', async () => {
    const input = createMockRenderInput('HI_LO', 'hay_chon_gia_dung');
    const renderer = new SatoriFrameRenderer();
    const testDir = path.join(ROOT, 'temp', 'test_theme_hay_chon_gia_dung');

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    try {
      const result = await renderer.renderFrames(input, {
        config: { ...DEFAULT_RENDER_CONFIG, width: 1080, height: 1920, fps: 30 },
        framesDir: testDir,
        width: 1080,
        height: 1920,
        fps: 30,
        frameCount: 2,
      });

      expect(result.backend).toBe('satori');
      expect(result.frameCount).toBe(2);
      const files = readdirSync(testDir).filter((f) => f.endsWith('.png'));
      expect(files.length).toBe(2);
    } finally {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    }
  });

  it('renders real PNG frames with SatoriFrameRenderer using sieu_thi_gia_dinh theme', async () => {
    const input = createMockRenderInput('GROCERY_BASKET', 'sieu_thi_gia_dinh');
    const renderer = new SatoriFrameRenderer();
    const testDir = path.join(ROOT, 'temp', 'test_theme_sieu_thi_gia_dinh');

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    try {
      const result = await renderer.renderFrames(input, {
        config: { ...DEFAULT_RENDER_CONFIG, width: 1080, height: 1920, fps: 30 },
        framesDir: testDir,
        width: 1080,
        height: 1920,
        fps: 30,
        frameCount: 2,
      });

      expect(result.backend).toBe('satori');
      expect(result.frameCount).toBe(2);
      const files = readdirSync(testDir).filter((f) => f.endsWith('.png'));
      expect(files.length).toBe(2);
    } finally {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    }
  });
});
