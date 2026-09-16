import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RenderAssetCache } from '../../src/render/assetCache';
import { Canvas } from '../../src/render/canvas';
import { encodePng } from '../../src/render/png';
import { paintMultiRoundFrame, drawProductCard } from '../../src/render/scenePainter';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import type { MultiRoundChallenge } from '../../src/challenge/types';

describe('RenderAssetCache', () => {
  const tempDir = path.resolve(process.cwd(), 'temp', 'test_asset_cache');
  let cache: RenderAssetCache;

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
    cache = new RenderAssetCache();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createTestPng(filename: string, width = 64, height = 64): string {
    const filePath = path.join(tempDir, filename);
    const data = Buffer.alloc(width * height * 4);
    // Fill with non-zero RGBA
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 128;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const png = encodePng({ width, height, data });
    writeFileSync(filePath, png);
    return filePath;
  }

  describe('unit tests', () => {
    it('initializes with size 0', () => {
      expect(cache.size).toBe(0);
    });

    it('returns null for empty or falsy paths', () => {
      expect(cache.getImage('')).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('returns null for nonexistent files', () => {
      const nonExistent = path.join(tempDir, 'does_not_exist.png');
      expect(cache.getImage(nonExistent)).toBeNull();
      expect(cache.size).toBe(0);
      expect(cache.has(nonExistent)).toBe(false);
    });

    it('returns null for non-PNG files', () => {
      const jpgFile = path.join(tempDir, 'sample.jpg');
      writeFileSync(jpgFile, 'fake jpg content');
      expect(cache.getImage(jpgFile)).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('returns null for corrupt PNG files', () => {
      const corruptFile = path.join(tempDir, 'corrupt.png');
      writeFileSync(corruptFile, 'not a real png binary');
      expect(cache.getImage(corruptFile)).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('loads and caches a valid PNG on first request', () => {
      const pngPath = createTestPng('valid.png', 32, 32);
      const img1 = cache.getImage(pngPath);

      expect(img1).not.toBeNull();
      expect(img1?.width).toBe(32);
      expect(img1?.height).toBe(32);
      expect(cache.size).toBe(1);
      expect(cache.has(pngPath)).toBe(true);

      // Second call returns cached instance
      const img2 = cache.getImage(pngPath);
      expect(img2).toBe(img1); // Same reference
      expect(cache.size).toBe(1);
    });

    it('handles relative path with rootDir and deduplicates with absolute path', () => {
      const filename = 'rel_test.png';
      const absPath = createTestPng(filename, 48, 48);

      // Query with relative path + rootDir
      const imgFromRel = cache.getImage(filename, tempDir);
      expect(imgFromRel).not.toBeNull();
      expect(cache.size).toBe(1);

      // Query with absolute path
      const imgFromAbs = cache.getImage(absPath);
      expect(imgFromAbs).toBe(imgFromRel);
      expect(cache.size).toBe(1);

      expect(cache.has(filename, tempDir)).toBe(true);
      expect(cache.has(absPath)).toBe(true);
    });

    it('clears all cached entries when clear() is called', () => {
      const pngPath = createTestPng('clear_test.png', 16, 16);
      const img1 = cache.getImage(pngPath);
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has(pngPath)).toBe(false);

      // Calling getImage again reloads from disk
      const img2 = cache.getImage(pngPath);
      expect(img2).not.toBeNull();
      expect(img2).not.toBe(img1); // Newly loaded object reference
      expect(cache.size).toBe(1);
    });
  });

  describe('integration with paintMultiRoundFrame', () => {
    it('caches product images across multiple frames and avoids redundant I/O', () => {
      const p1Path = createTestPng('prod1.png', 64, 64);
      const p2Path = createTestPng('prod2.png', 64, 64);

      const challenge: MultiRoundChallenge = {
        gameId: 'g9_cache_test',
        seed: 12345,
        title: 'Cache Test Challenge',
        seriesNumber: 1,
        finalCta: 'Bình luận ngay!',
        rounds: [
          {
            roundIndex: 1,
            type: 'confidence_builder',
            question: 'Sản phẩm 1 giá bao nhiêu?',
            products: [
              {
                productId: 'p001',
                name: 'Sản phẩm 1',
                image: 'prod1.png',
                price: 50000,
                currency: 'VND',
                source: 'test',
                updatedAt: '2026',
                category: 'test',
                brand: 'BrandA',
                affiliate_link: 'link',
              },
            ],
            choices: [
              { id: 'A', label: '50K', isCorrect: true },
              { id: 'B', label: '100K', isCorrect: false },
            ],
            correctAnswer: 'A',
            timerSeconds: 5.0,
            scoreVector: {
              difficulty: 0.1,
              visualClarity: 1,
              curiosity: 0.5,
              surprise: 0.5,
              perceptionConflict: 0.1,
              debate: 0.1,
              identity: 0.5,
              familiarity: 0.9,
              commerceRelevance: 0.8,
              revealImpact: 0.5,
            },
            revealText: 'Giá thật: 50K',
          },
          {
            roundIndex: 2,
            type: 'tension_creator',
            question: 'Sản phẩm 2 giá bao nhiêu?',
            products: [
              {
                productId: 'p002',
                name: 'Sản phẩm 2',
                image: 'prod2.png',
                price: 120000,
                currency: 'VND',
                source: 'test',
                updatedAt: '2026',
                category: 'test',
                brand: 'BrandB',
                affiliate_link: 'link',
              },
            ],
            choices: [
              { id: 'A', label: '120K', isCorrect: true },
              { id: 'B', label: '80K', isCorrect: false },
            ],
            correctAnswer: 'A',
            timerSeconds: 5.0,
            scoreVector: {
              difficulty: 0.4,
              visualClarity: 1,
              curiosity: 0.5,
              surprise: 0.5,
              perceptionConflict: 0.2,
              debate: 0.2,
              identity: 0.5,
              familiarity: 0.8,
              commerceRelevance: 0.8,
              revealImpact: 0.5,
            },
            revealText: 'Giá thật: 120K',
          },
        ],
      };

      const scene = new AllInOneScene(challenge);
      const canvas = new Canvas(1080, 1920);
      const getImageSpy = vi.spyOn(cache, 'getImage');

      // Frame 1: Round 1 Play (time = 2.0s)
      paintMultiRoundFrame(canvas, scene, 2.0, { rootDir: tempDir, assetCache: cache });
      expect(getImageSpy).toHaveBeenCalledWith(p1Path);
      expect(cache.size).toBe(1);

      // Frame 2: Round 1 Play next tick (time = 2.1s)
      paintMultiRoundFrame(canvas, scene, 2.1, { rootDir: tempDir, assetCache: cache });
      // Size remains 1 — no duplicate loading
      expect(cache.size).toBe(1);

      // Frame 3: Round 1 Reveal (time = 7.0s)
      paintMultiRoundFrame(canvas, scene, 7.0, { rootDir: tempDir, assetCache: cache });
      expect(cache.size).toBe(1);

      // Frame 4: Round 2 Play (time = 12.0s) — introduces prod2.png
      paintMultiRoundFrame(canvas, scene, 12.0, { rootDir: tempDir, assetCache: cache });
      expect(getImageSpy).toHaveBeenCalledWith(p2Path);
      expect(cache.size).toBe(2);

      // Frame 5: Round 2 next tick (time = 12.1s)
      paintMultiRoundFrame(canvas, scene, 12.1, { rootDir: tempDir, assetCache: cache });
      expect(cache.size).toBe(2);
    });

    it('works seamlessly when assetCache is omitted (fallback to disk load)', () => {
      createTestPng('fallback_prod.png', 64, 64);
      const challenge: MultiRoundChallenge = {
        gameId: 'g9_fallback',
        seed: 1,
        title: 'Fallback Test',
        seriesNumber: 1,
        finalCta: 'Bình luận ngay!',
        rounds: [
          {
            roundIndex: 1,
            type: 'confidence_builder',
            question: 'Đoán giá',
            products: [
              {
                productId: 'p_fallback',
                name: 'Fallback',
                image: 'fallback_prod.png',
                price: 10000,
                currency: 'VND',
                source: 's',
                updatedAt: '2026',
                category: 'c',
                brand: 'b',
                affiliate_link: 'l',
              },
            ],
            choices: [{ id: 'A', label: '10K', isCorrect: true }],
            correctAnswer: 'A',
            timerSeconds: 5.0,
            scoreVector: {
              difficulty: 0.1,
              visualClarity: 1,
              curiosity: 0.5,
              surprise: 0.5,
              perceptionConflict: 0.1,
              debate: 0.1,
              identity: 0.5,
              familiarity: 0.9,
              commerceRelevance: 0.8,
              revealImpact: 0.5,
            },
            revealText: 'Giá thật: 10K',
          },
        ],
      };

      const scene = new AllInOneScene(challenge);
      const canvas = new Canvas(1080, 1920);

      expect(() =>
        paintMultiRoundFrame(canvas, scene, 2.0, { rootDir: tempDir }),
      ).not.toThrow();
    });

    it('reuses cached assets in multi-product layouts (2, 3, and 4 products)', () => {
      const pA = createTestPng('prodA.png', 48, 48);
      const pB = createTestPng('prodB.png', 48, 48);
      const pC = createTestPng('prodC.png', 48, 48);
      const pD = createTestPng('prodD.png', 48, 48);

      const makeProd = (id: string, img: string) => ({
        productId: id,
        name: `Product ${id}`,
        image: img,
        price: 25000,
        currency: 'VND',
        source: 's',
        updatedAt: '2026',
        category: 'c',
        brand: 'b',
        affiliate_link: 'l',
      });

      // 4-product round (2x2 grid)
      const challenge: MultiRoundChallenge = {
        gameId: 'g2_multi_cache',
        seed: 99,
        title: 'Multi Product Cache',
        seriesNumber: 2,
        finalCta: 'Bình luận ngay!',
        rounds: [
          {
            roundIndex: 1,
            type: 'confidence_builder',
            question: 'Món nào đắt nhất?',
            products: [
              makeProd('pA', 'prodA.png'),
              makeProd('pB', 'prodB.png'),
              makeProd('pC', 'prodC.png'),
              makeProd('pD', 'prodD.png'),
            ],
            choices: [
              { id: 'A', label: 'A', isCorrect: true },
              { id: 'B', label: 'B', isCorrect: false },
            ],
            correctAnswer: 'A',
            timerSeconds: 5.0,
            scoreVector: {
              difficulty: 0.2,
              visualClarity: 1,
              curiosity: 0.5,
              surprise: 0.5,
              perceptionConflict: 0.1,
              debate: 0.1,
              identity: 0.5,
              familiarity: 0.9,
              commerceRelevance: 0.8,
              revealImpact: 0.5,
            },
            revealText: 'Món A đắt nhất',
          },
        ],
      };

      const scene = new AllInOneScene(challenge);
      const canvas = new Canvas(1080, 1920);

      // First render loads all 4
      paintMultiRoundFrame(canvas, scene, 2.0, { rootDir: tempDir, assetCache: cache });
      expect(cache.size).toBe(4);
      expect(cache.has(pA)).toBe(true);
      expect(cache.has(pB)).toBe(true);
      expect(cache.has(pC)).toBe(true);
      expect(cache.has(pD)).toBe(true);

      // Second render reuses all 4
      paintMultiRoundFrame(canvas, scene, 2.5, { rootDir: tempDir, assetCache: cache });
      expect(cache.size).toBe(4);
    });
  });

  describe('drawProductCard warning deduplication and assetCache integration', () => {
    it('deduplicates W_ASSET_PLACEHOLDER warnings per distinct product ID', () => {
      const canvas = new Canvas(1080, 1920);
      const warnings: any[] = [];
      const ctx: any = {
        rootDir: tempDir,
        tilt: false,
        diversification: { bgColor: '#161d2e', tilt: 0, bgm: 'test' },
        warnings,
        assetCache: cache,
      };

      const cardA = {
        productId: 'prod_a',
        name: 'Product A',
        priceLabel: '10K',
        image: 'missing_a.png',
        x: 100,
        y: 100,
        width: 300,
        height: 400,
      };

      const cardB = {
        productId: 'prod_b',
        name: 'Product B',
        priceLabel: '20K',
        image: 'missing_b.png',
        x: 450,
        y: 100,
        width: 300,
        height: 400,
      };

      // Draw card A first time -> emits warning for prod_a
      drawProductCard(canvas, cardA, ctx);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe('W_ASSET_PLACEHOLDER');
      expect(warnings[0].hint).toContain('prod_a');

      // Draw card B -> emits distinct warning for prod_b
      drawProductCard(canvas, cardB, ctx);
      expect(warnings.length).toBe(2);
      expect(warnings[1].code).toBe('W_ASSET_PLACEHOLDER');
      expect(warnings[1].hint).toContain('prod_b');

      // Draw card A second time (e.g. next frame) -> deduped, no 3rd warning
      drawProductCard(canvas, cardA, ctx);
      expect(warnings.length).toBe(2);

      // Draw card B second time -> deduped, still 2 warnings
      drawProductCard(canvas, cardB, ctx);
      expect(warnings.length).toBe(2);
    });

    it('uses assetCache to load and cache card image in drawProductCard', () => {
      const canvas = new Canvas(1080, 1920);
      const imgPath = createTestPng('card_prod.png', 40, 40);
      const warnings: any[] = [];
      const ctx: any = {
        rootDir: tempDir,
        tilt: false,
        diversification: { bgColor: '#161d2e', tilt: 0, bgm: 'test' },
        warnings,
        assetCache: cache,
      };

      const card = {
        productId: 'prod_cached',
        name: 'Cached Product',
        priceLabel: '50K',
        image: 'card_prod.png',
        x: 100,
        y: 100,
        width: 300,
        height: 400,
      };

      expect(cache.size).toBe(0);
      drawProductCard(canvas, card, ctx);
      expect(cache.size).toBe(1);
      expect(cache.has(imgPath)).toBe(true);
      expect(warnings.length).toBe(0);

      // Subsequent draw uses cache
      drawProductCard(canvas, card, ctx);
      expect(cache.size).toBe(1);
      expect(warnings.length).toBe(0);
    });
  });
});
