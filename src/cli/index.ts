/**
 * `game` CLI — Epic 1 exposes `game products list` (Story 1.3).
 * Epic 4 adds `game render` / `game batch` / `game queue status` / `game logs`.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ProductProvider } from '../product/ProductProvider';
import { writePreviewFile } from '../preview';
import type { SceneData } from '../scene';
import type { GameJson, Timeline } from '../types/game';
import { formatVnd } from '../utils/format';
import { parsePlanArgs, plan, runPlan } from './plan';

const HELP = `Universal AI Game Video Engine — CLI

Usage:
  game products list        List all SKUs (productId, name, price VND, affiliate_link)
  game plan ...             Validate + compute answer/timeline (no render)
  game render ... --preview Generate output/preview_<mechanic>.html
                            --mechanic hi_lo|most_expensive|one_away
                            --products p001,p042 --seed 839271
                            --result-variant in_video|comment [--hidden-index 3]

Coming in Epic 4:
  game render ...           Render a single MP4
  game batch ...            Batch-render 50 videos
  game queue status         Queue status
  game logs --gameId <id>   Job logs
`;

export function listProducts(): void {
  const provider = new ProductProvider('products', { watch: false });
  const header = ['productId', 'name', 'price', 'affiliate_link'].join('\t');
  console.log(header);
  for (const p of provider.getAll()) {
    console.log(
      [p.productId, p.name, formatVnd(p.price), p.affiliate_link].join('\t'),
    );
  }
}

export function runPreview(argv: string[]): number {
  const args = parsePlanArgs(argv);
  const result = plan(args);
  if ((result as { ok?: boolean }).ok === false) {
    const failure = result as { errors: Array<{ code: string; field?: string; hint?: string }> };
    console.error(JSON.stringify(failure.errors[0] ?? { code: 'E_UNKNOWN' }));
    return 1;
  }
  const payload = result as Record<string, unknown>;
  const game = payload.game as GameJson;
  const provider = new ProductProvider(args.productsDir ?? 'products', { watch: false });
  const products = args.productIds
    .map((productId) => provider.get(productId))
    .filter((product): product is NonNullable<typeof product> => product !== null);
  const outputPath = writePreviewFile(game, products, {
    computed: {
      gameId: game.metadata.gameId,
      mechanic: game.metadata.mechanic,
      seed: args.seed,
      answer: payload.answer as string | number,
      detail: {},
      timeline: payload.timeline as Timeline,
      revealType: payload.revealType as 'PriceReveal' | 'DigitReveal',
      diversification: payload.diversification as {
        bgColor: string;
        tilt: number;
        bgm: string;
      },
    },
    sceneData: payload.sceneData as SceneData,
  });
  console.log(JSON.stringify({ ok: true, previewPath: outputPath }));
  return 0;
}

export function run(argv: string[]): number {
  const [command, sub] = argv;
  if (command === 'products' && (sub === 'list' || sub === undefined)) {
    listProducts();
    return 0;
  }
  if (command === 'plan') {
    return runPlan(argv.slice(1));
  }
  if (command === 'render' && argv.includes('--preview')) {
    return runPreview(argv.slice(1));
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return 0;
  }
  console.error(`unknown command: ${command ?? ''} ${sub ?? ''}`.trimEnd());
  console.error(HELP);
  return 1;
}

// Run only when invoked directly (bin/game.js launches this file via tsx).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
