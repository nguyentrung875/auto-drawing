/**
 * `game` CLI — Epic 1 exposes `game products list` (Story 1.3).
 * Epic 4 adds `game render` / `game batch` / `game queue status` / `game logs`.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ProductProvider } from '../product/ProductProvider';
import { formatVnd } from '../utils/format';

const HELP = `Universal AI Game Video Engine — CLI

Usage:
  game products list        List all SKUs (productId, name, price VND, affiliate_link)
  game --help               Show this help

Coming in Epic 4:
  game render ...           Render a single video
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

export function run(argv: string[]): number {
  const [command, sub] = argv;
  if (command === 'products' && (sub === 'list' || sub === undefined)) {
    listProducts();
    return 0;
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
