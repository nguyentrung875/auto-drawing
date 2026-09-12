import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ProductProvider } from '../../src/product/ProductProvider';
import type { Product } from '../../src/product/schema';

function makeProduct(productId: string, price = 100000): Product {
  return {
    productId,
    name: `Sản phẩm ${productId}`,
    image: `assets/${productId}.png`,
    price,
    currency: 'VND',
    source: 'mock',
    updatedAt: '2026-09-11T00:00:00Z',
    category: 'test',
    brand: 'TestBrand',
    affiliate_link: `https://shopee.vn/${productId}?aff=123`,
  };
}

function makeTempProductsDir(files: Product[]): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'product-provider-'));
  for (const p of files) {
    writeFileSync(path.join(dir, `${p.productId}.json`), JSON.stringify(p, null, 2));
  }
  return dir;
}

describe('ProductProvider (Story 1.3)', () => {
  it('loads the committed 50-SKU catalog within 200ms and resolves p001', () => {
    const provider = new ProductProvider('products', { watch: false });
    expect(provider.size).toBe(50);
    expect(provider.loadMs).toBeLessThan(200);
    const p001 = provider.get('p001');
    expect(p001).not.toBeNull();
    expect(p001!.price).toBe(189000);
    expect(p001!.affiliate_link).toBeTruthy();
    provider.close();
  });

  it('returns a product even when its image asset is missing (not a provider error)', () => {
    // A missing asset is a Validator concern (E_ASSET_MISSING), never a
    // Provider error: `get()` still resolves and `hasAsset()` answers false
    // without throwing. Uses a temp SKU so the result does not depend on
    // whether `assets/` has been generated in this checkout.
    const dir = makeTempProductsDir([makeProduct('p001')]);
    const provider = new ProductProvider(dir, { watch: false });
    try {
      const p001 = provider.get('p001');
      expect(p001).not.toBeNull();
      expect(provider.hasAsset('p001')).toBe(false);
    } finally {
      provider.close();
    }
  });

  it('get() returns null for unknown ids', () => {
    const provider = new ProductProvider('products', { watch: false });
    expect(provider.get('p999')).toBeNull();
    provider.close();
  });

  it('reports hasAsset=true when the asset file exists', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'product-asset-'));
    try {
      const productsDir = path.join(tmp, 'products');
      mkdirSync(productsDir, { recursive: true });
      const assetsDir = path.join(tmp, 'assets');
      mkdirSync(assetsDir, { recursive: true });
      writeFileSync(path.join(productsDir, 'p001.json'), JSON.stringify(makeProduct('p001')));
      writeFileSync(path.join(assetsDir, 'p001.png'), 'fake-image');

      const provider = new ProductProvider(productsDir, { watch: false });
      expect(provider.hasAsset('p001')).toBe(true);
      provider.close();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('updates a SKU atomically (tmp → rename) and validates via zod first', () => {
    const dir = makeTempProductsDir([makeProduct('p001', 100000)]);
    const provider = new ProductProvider(dir, { watch: false });
    try {
      const updated = provider.updateProduct('p001', makeProduct('p001', 150000));
      expect(updated.price).toBe(150000);
      expect(provider.get('p001')!.price).toBe(150000);
      // No leftover tmp file
      expect(existsSync(path.join(dir, 'p001.tmp.json'))).toBe(false);
      // File on disk persisted
      const onDisk = JSON.parse(readFileSync(path.join(dir, 'p001.json'), 'utf8'));
      expect(onDisk.price).toBe(150000);
    } finally {
      provider.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses an invalid update (zod) without touching the file', () => {
    const dir = makeTempProductsDir([makeProduct('p001', 100000)]);
    const provider = new ProductProvider(dir, { watch: false });
    try {
      const invalid = { ...makeProduct('p001', 100000), price: -5 };
      expect(() => provider.updateProduct('p001', invalid)).toThrowError(ZodError);
      expect(provider.get('p001')!.price).toBe(100000);
    } finally {
      provider.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reloads a SKU from disk when the file changes (FS watch)', async () => {
    const dir = makeTempProductsDir([makeProduct('p001', 100000)]);
    const provider = new ProductProvider(dir, { watch: true, debounceMs: 20 });
    try {
      expect(provider.get('p001')!.price).toBe(100000);
      writeFileSync(path.join(dir, 'p001.json'), JSON.stringify(makeProduct('p001', 222000)));
      await expect
        .poll(() => provider.get('p001')!.price, { timeout: 3000, interval: 50 })
        .toBe(222000);
    } finally {
      provider.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reloads multiple SKUs edited in quick succession (watch coalescing)', async () => {
    const dir = makeTempProductsDir([
      makeProduct('p001', 100000),
      makeProduct('p002', 200000),
    ]);
    const provider = new ProductProvider(dir, { watch: true, debounceMs: 20 });
    try {
      writeFileSync(path.join(dir, 'p001.json'), JSON.stringify(makeProduct('p001', 111000)));
      writeFileSync(path.join(dir, 'p002.json'), JSON.stringify(makeProduct('p002', 222000)));
      await expect
        .poll(() => provider.get('p001')!.price, { timeout: 3000, interval: 50 })
        .toBe(111000);
      await expect
        .poll(() => provider.get('p002')!.price, { timeout: 3000, interval: 50 })
        .toBe(222000);
    } finally {
      provider.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
