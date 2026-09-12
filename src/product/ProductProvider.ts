/**
 * Story 1.3 — ProductProvider.
 *
 * - 50 SKU files `products/pXXX.json` (one file per SKU) → in-memory cache.
 * - `get()` returns the product; a missing image asset is NOT a provider error
 *   (the Validator reports `E_ASSET_MISSING` later).
 * - Atomic writes: validate zod → write `pXXX.tmp.json` → `rename()` to
 *   `pXXX.json`. A kill mid-write leaves only a corrupt `.tmp`, never a broken
 *   product file.
 * - FS watch: edits to `pXXX.json` reload that SKU into the cache without a
 *   restart.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  watch,
  writeFileSync,
  type FSWatcher,
} from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { productSchema, type Product } from './schema';

export interface ProductProviderOptions {
  /** Enable filesystem watching (default true). */
  watch?: boolean;
  /** Debounce window for coalescing watch events, ms (default 50). */
  debounceMs?: number;
}

export class ProductProvider {
  readonly dir: string;
  /** Time (ms) the initial `loadAll()` took — must stay ≤200ms for 50 SKUs. */
  readonly loadMs: number;

  private readonly cache = new Map<string, Product>();
  private watcher: FSWatcher | undefined;
  private debounce: NodeJS.Timeout | undefined;
  private readonly debounceMs: number;
  private readonly pendingFiles = new Set<string>();

  constructor(dir: string, options: ProductProviderOptions = {}) {
    this.dir = dir;
    this.debounceMs = options.debounceMs ?? 50;
    const start = performance.now();
    this.loadAll();
    this.loadMs = performance.now() - start;
    if (options.watch !== false) this.startWatch();
  }

  /** (Re)load every `pXXX.json` (skipping `.tmp.json`) into the cache. */
  loadAll(): void {
    this.cache.clear();
    if (!existsSync(this.dir)) return;
    for (const file of readdirSync(this.dir)) {
      if (!file.endsWith('.json') || file.endsWith('.tmp.json')) continue;
      this.readIntoCache(file);
    }
  }

  /** Re-read a single product file; returns true on success. */
  reloadFile(fileName: string): boolean {
    return this.readIntoCache(fileName);
  }

  get(productId: string): Product | null {
    return this.cache.get(productId) ?? null;
  }

  getAll(): Product[] {
    return [...this.cache.values()].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    );
  }

  get size(): number {
    return this.cache.size;
  }

  /**
   * Whether the product's image asset exists on disk. Missing assets are the
   * Validator's concern (`E_ASSET_MISSING`), not the Provider's.
   */
  hasAsset(productId: string): boolean {
    const product = this.get(productId);
    if (!product) return false;
    // `image` is relative to the project root (e.g. "assets/p001.png");
    // products/ sits at the root, so root = dirname(productsDir).
    const assetPath = path.resolve(path.dirname(this.dir), product.image);
    return existsSync(assetPath);
  }

  /**
   * Atomically update a SKU: zod-validate first (throw on invalid — nothing is
   * written), write `pXXX.tmp.json`, then rename over `pXXX.json`.
   */
  updateProduct(productId: string, data: unknown): Product {
    const product = productSchema.parse(data);
    if (product.productId !== productId) {
      throw new Error(
        `productId mismatch: expected '${productId}', got '${product.productId}'`,
      );
    }
    const tmp = path.join(this.dir, `${productId}.tmp.json`);
    const final = path.join(this.dir, `${productId}.json`);
    writeFileSync(tmp, JSON.stringify(product, null, 2) + '\n');
    renameSync(tmp, final);
    this.cache.set(productId, product);
    return product;
  }

  close(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.pendingFiles.clear();
    this.watcher?.close();
    this.watcher = undefined;
  }

  private readIntoCache(fileName: string): boolean {
    const file = path.join(this.dir, fileName);
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      const product = productSchema.parse(data);
      this.cache.set(product.productId, product);
      return true;
    } catch (err) {
      console.warn(
        `[ProductProvider] skip ${fileName}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private startWatch(): void {
    if (!existsSync(this.dir)) return;
    this.watcher = watch(
      this.dir,
      { persistent: false },
      (_event, fileName) => {
        if (
          !fileName ||
          !fileName.endsWith('.json') ||
          fileName.endsWith('.tmp.json')
        ) {
          return;
        }
        this.pendingFiles.add(fileName);
        if (this.debounce) clearTimeout(this.debounce);
        this.debounce = setTimeout(() => {
          const files = [...this.pendingFiles];
          this.pendingFiles.clear();
          for (const f of files) this.readIntoCache(f);
        }, this.debounceMs);
      },
    );
  }
}
