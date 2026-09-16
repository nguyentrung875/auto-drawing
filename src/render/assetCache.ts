import path from 'node:path';
import type { PngImage } from './png';
import { loadPng } from './image';

export type Image = PngImage;

/**
 * Cache for decoded PNG images during frame rendering.
 *
 * Prevents redundant filesystem I/O and PNG decompression across video frames.
 */
export class RenderAssetCache {
  private cache = new Map<string, Image>();

  public get size(): number {
    return this.cache.size;
  }

  /**
   * Retrieves an image from the cache or loads it from disk if not yet cached.
   * Nonexistent files, corrupt files, or non-PNG files return null without throwing.
   */
  public getImage(imagePath: string, rootDir?: string): Image | null {
    if (!imagePath) return null;

    const fullPath =
      rootDir && !path.isAbsolute(imagePath)
        ? path.resolve(rootDir, imagePath)
        : path.resolve(imagePath);

    const cached = this.cache.get(fullPath);
    if (cached) {
      return cached;
    }

    if (!/\.png$/i.test(fullPath)) {
      return null;
    }

    const loaded = loadPng(fullPath);
    if (loaded) {
      this.cache.set(fullPath, loaded);
      return loaded;
    }

    return null;
  }

  public has(imagePath: string, rootDir?: string): boolean {
    if (!imagePath) return false;
    const fullPath =
      rootDir && !path.isAbsolute(imagePath)
        ? path.resolve(rootDir, imagePath)
        : path.resolve(imagePath);
    return this.cache.has(fullPath);
  }

  public clear(): void {
    this.cache.clear();
  }
}
