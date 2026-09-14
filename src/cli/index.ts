/**
 * `game` CLI — the headless entry point for Trung and Hermes.
 *
 *   game products list                    50 SKUs (Story 1.3 / 4.2)
 *   game plan ...                         validate + compute, no render
 *   game render ... [--preview]           one MP4 (Story 4.2) | HTML preview
 *   game batch --count 50 --mechanics ... 50-job hands-free batch (Story 4.3)
 *   game queue status                     queue depth + per-job status
 *   game logs [--gameId <id>]             job logs (render/encode timings)
 *   game config                           resolved render configuration
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ProductProvider } from '../product/ProductProvider';
import { writePreviewFile } from '../preview';
import type { SceneData } from '../scene';
import type { GameJson, Timeline } from '../types/game';
import { formatVnd } from '../utils/format';
import { runBatchCommand, parseBatchArgs } from './batch';
import { formatQueueStatus, formatLogs, parseInspectArgs, queueStatus, readLogs, renderConfigSummary } from './inspect';
import { parsePlanArgs, plan, runPlan } from './plan';
import { parseRenderArgs, runRenderCommand } from './render';

const HELP = `Universal AI Game Video Engine — CLI

Usage:
  game products list                       List all SKUs (productId, name, price VND, affiliate_link)
  game plan ...                            Validate + compute answer/timeline (no render)
  game render ...                          Render one MP4 1080×1920 + caption.json + logs
  game batch ...                           Batch render N videos (default 50), fail-forward
  game queue status                        Queue status (pending/running/done/failed)
  game logs [--gameId <id>]                Job logs with render/encode timings
  game config                              Resolved render config + worker pool size

render / batch flags:
  --mechanic hi_lo|most_expensive|one_away
  --products p001,p042                     Comma-separated SKU ids
  --seed 839271                            Deterministic seed (same seed → same answer)
  --result-variant in_video|comment        Where the answer appears
  --hidden-index 3                         ONE_AWAY: masked digit index
  --count 50                               batch: number of jobs
  --mechanics hi_lo,most_expensive,one_away
  --game path/to/game.json                 render: pre-authored Game JSON

examples:
  game render --mechanic hi_lo --products p001,p042 --seed 839271 --result-variant in_video
  game render --products p001 --mechanic one_away --seed 123 --preview
  game batch --count 50 --mechanics hi_lo,most_expensive,one_away --result-variant comment
  game logs --gameId hi_lo_839271
`;

export function listProducts(): void {
  const provider = new ProductProvider('products', { watch: false });
  console.log(['productId', 'name', 'price VND', 'affiliate_link'].join(' | '));
  for (const p of provider.getAll()) {
    console.log([p.productId, p.name, formatVnd(p.price), p.affiliate_link].join(' | '));
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

function printError(error: { code: string; field?: string; hint?: string }): void {
  console.error(JSON.stringify(error));
}

export async function runAsync(argv: string[]): Promise<number> {
  const [command, sub] = argv;
  if (command === 'products' && (sub === 'list' || sub === undefined)) {
    listProducts();
    return 0;
  }
  if (command === 'plan') {
    return runPlan(argv.slice(1));
  }
  if (command === 'render') {
    if (argv.includes('--preview')) return runPreview(argv.slice(1));
    const result = await runRenderCommand(parseRenderArgs(argv.slice(1)));
    if (result.error) printError(result.error);
    if (result.summary) console.log(result.summary);
    if (result.videoPath) {
      console.log(
        JSON.stringify({
          ok: true,
          jobId: result.jobId,
          video: result.videoPath,
          caption: result.captionPath,
          render_ms: result.renderMs,
          report: result.reportPath,
        }),
      );
    }
    return result.exitCode;
  }
  if (command === 'batch') {
    const result = await runBatchCommand(parseBatchArgs(argv.slice(1)));
    if (result.error) printError(result.error);
    if (result.summary) console.log(result.summary);
    if (result.result) {
      const { report } = result.result;
      console.log(
        JSON.stringify({
          ok: report.failed === 0,
          batch_id: report.batch_id,
          total: report.total,
          passed: report.passed,
          failed: report.failed,
          avg_render_ms: report.avg_render_ms,
          report: result.result.reportPath,
        }),
      );
    }
    return result.exitCode;
  }
  if (command === 'queue' && (sub === 'status' || sub === undefined)) {
    const status = queueStatus(parseInspectArgs(argv.slice(2)));
    console.log(argv.includes('--json') ? JSON.stringify(status, null, 2) : formatQueueStatus(status));
    return 0;
  }
  if (command === 'logs') {
    const logs = readLogs(parseInspectArgs(argv.slice(1)));
    console.log(argv.includes('--json') ? JSON.stringify(logs, null, 2) : formatLogs(logs));
    return 0;
  }
  if (command === 'config') {
    console.log(JSON.stringify(renderConfigSummary(), null, 2));
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

/**
 * Synchronous surface used by unit tests and embedded callers: the commands
 * that never touch the renderer (`products list`, `plan`, `--preview`, `--help`).
 * Async commands (`render`, `batch`, `queue status`, `logs`) go through
 * `runAsync` — the process entry point below.
 */
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
  if (command === 'render' || command === 'batch' || command === 'queue' || command === 'logs' || command === 'config') {
    console.error(
      JSON.stringify({
        code: 'E_ASYNC_COMMAND',
        hint: `'${command}' is asynchronous — use runAsync(argv) or the 'game' binary`,
      }),
    );
    return 1;
  }
  console.error(`unknown command: ${command ?? ''} ${sub ?? ''}`.trimEnd());
  console.error(HELP);
  return 1;
}

export { HELP };

// Run only when invoked directly (bin/game.js launches this file via tsx).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  runAsync(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(JSON.stringify({ code: 'E_UNKNOWN', hint: (error as Error).message }));
      process.exit(1);
    },
  );
}
