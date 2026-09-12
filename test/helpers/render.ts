/**
 * Shared fixtures for the Epic 4 suites: a fully valid render input (Epic 3
 * output) plus thin wrappers over ffmpeg/ffprobe so render tests self-skip when
 * the binary is unavailable.
 */
import { existsSync } from 'node:fs';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { GameEngine, MechanicRegistry } from '../../src/game';
import { ProductProvider } from '../../src/product/ProductProvider';
import { SceneSystem } from '../../src/scene';
import type { Mechanic, ResultVariant } from '../../src/types/game';
import {
  ffmpegAvailable,
  probeVideo,
  scanForAffiliateBurn,
  type ProbeResult,
  type RenderInput,
} from '../../src/render';

export function muxerAvailable(): boolean {
  return ffmpegAvailable();
}

export function probeVideoInfo(filePath: string): Promise<ProbeResult | null> {
  return probeVideo(filePath);
}

export function scanForBurn(videoPath: string, affiliateLink: string) {
  return scanForAffiliateBurn({ videoPath, affiliateLink });
}

export interface FixtureOptions {
  mechanic?: Mechanic;
  productIds?: string[];
  seed?: number;
  resultVariant?: ResultVariant;
  rootDir: string;
  jobId?: string;
  exportDir?: string;
  tempDir?: string;
  productsDir?: string;
  ttsMs?: number;
}

/** Build a `RenderInput` from the real Epic 2/3 pipeline (no rendering). */
export async function renderFixture(options: FixtureOptions): Promise<RenderInput> {
  const {
    mechanic = 'HI_LO',
    seed = 839271,
    resultVariant = 'in_video',
    rootDir,
  } = options;
  const productsDir = options.productsDir ?? 'products';
  const ids =
    options.productIds ??
    (mechanic === 'HI_LO' ? ['p001', 'p002'] : mechanic === 'ONE_AWAY' ? ['p001'] : ['p001', 'p002', 'p003']);
  const provider = new ProductProvider(productsDir, { watch: false });
  const products = ids
    .map((id) => provider.get(id))
    .filter((product): product is NonNullable<typeof product> => product !== null);
  if (products.length !== ids.length) {
    throw new Error(`renderFixture: unknown product ids ${ids.join(',')}`);
  }

  const { game, sceneData } = MechanicRegistry.get(mechanic).create({ products, seed, resultVariant });
  const computed = GameEngine.compute(game, products, seed);
  const audio = await AudioEngine.synthesize(game, computed.timeline);
  const scene = SceneSystem.render(game, {
    products,
    computed,
    timeline: computed.timeline,
    sceneData,
    variant: resultVariant,
  });

  return {
    game,
    timeline: scene.timeline,
    audio,
    frames: scene.frames,
    variant: resultVariant,
    sceneData,
    products: products.map((product) => ({
      productId: product.productId,
      name: product.name,
      image: product.image,
      price: product.price,
    })),
    diversification: computed.diversification,
    jobId: options.jobId ?? `job_${mechanic.toLowerCase()}_${seed}`,
    seed,
    rootDir,
    exportDir: options.exportDir ?? `${rootDir}/export`,
    tempDir: options.tempDir ?? `${rootDir}/temp`,
    ttsMs: options.ttsMs ?? 12,
  };
}

export function productIdsFor(mechanic: Mechanic, count = 50): string[] {
  const all = Array.from({ length: count }, (_, index) => `p${String(index + 1).padStart(3, '0')}`);
  if (mechanic === 'HI_LO') return all.slice(0, 2);
  if (mechanic === 'ONE_AWAY') return all.slice(0, 1);
  return all.slice(0, 4);
}

export function hasAssetsDir(rootDir: string): boolean {
  return existsSync(`${rootDir}/assets`);
}
