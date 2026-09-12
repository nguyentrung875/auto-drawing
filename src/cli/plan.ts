/**
 * Epic 2 CLI — `game plan`.
 *
 * Runs the Epic 2 pipeline end-to-end without any rendering:
 *   ProductProvider → MechanicRegistry → Validator (2 layers) → GameEngine
 * and prints the resulting Game JSON + answer + timeline, or a machine-readable
 * `{code, field, hint}` error (exit 1) for Hermes.
 */
import { GameEngine, MechanicRegistry, isGameError } from '../game';
import { ProductProvider } from '../product/ProductProvider';
import { Validator, resolveAssetCheck } from '../validator';
import type { Mechanic, ResultVariant } from '../types/game';

export interface PlanArgs {
  mechanic: Mechanic;
  productIds: string[];
  seed: number;
  resultVariant: ResultVariant;
  hiddenIndex?: number;
  productsDir?: string;
}

export interface PlanFailure {
  ok: false;
  errors: Array<{ code: string; field?: string; hint?: string }>;
}

const MECHANIC_ALIASES: Record<string, Mechanic> = {
  hi_lo: 'HI_LO',
  most_expensive: 'MOST_EXPENSIVE',
  one_away: 'ONE_AWAY',
};

/** Parse `--flag value` pairs from a `game plan` or `game render` argv slice. */
export function parsePlanArgs(argv: string[]): PlanArgs {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, 'true');
    }
  }
  const raw = (flags.get('mechanic') ?? 'hi_lo').toLowerCase();
  const mechanic = MECHANIC_ALIASES[raw] ?? (raw.toUpperCase() as Mechanic);
  const hidden = flags.get('hidden-index');
  return {
    mechanic,
    productIds: (flags.get('products') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    seed: Number(flags.get('seed') ?? 839271),
    resultVariant: (flags.get('result-variant') ?? 'in_video') as ResultVariant,
    hiddenIndex: hidden === undefined ? undefined : Number(hidden),
    productsDir: flags.get('products-dir'),
  };
}

/** Execute the plan; returns the payload printed by the CLI. */
export function plan(args: PlanArgs): Record<string, unknown> | PlanFailure {
  const provider = new ProductProvider(args.productsDir ?? 'products', {
    watch: false,
  });
  const resolved = args.productIds.map((id) => provider.get(id));
  const missing = args.productIds.filter((id, i) => resolved[i] === null);
  if (missing.length > 0) {
    return {
      ok: false,
      errors: missing.map((id) => ({
        code: 'E_PRICE_SOURCE_INVALID',
        field: 'entities.productId',
        hint: `product '${id}' not found in ProductProvider`,
      })),
    };
  }
  const products = resolved.filter((p): p is NonNullable<typeof p> => p !== null);

  let game;
  let sceneData;
  try {
    ({ game, sceneData } = MechanicRegistry.get(args.mechanic).create({
      products,
      seed: args.seed,
      resultVariant: args.resultVariant,
      hiddenIndex: args.hiddenIndex,
    }));
  } catch (err) {
    if (isGameError(err)) return { ok: false, errors: [err.toJSON()] };
    throw err;
  }

  // Image assets are not committed to the repo, so a missing `assets/` folder
  // relaxes E_ASSET_MISSING — but it is reported as W_ASSETS_DIR_MISSING rather
  // than silently skipped, and `REQUIRE_ASSETS=1` restores the hard check.
  const assetCheck = resolveAssetCheck(process.cwd());
  const validation = Validator.validate(game, products, {
    assetExists: (p) => (assetCheck.enabled ? provider.hasAsset(p.productId) : true),
  });
  if (assetCheck.warning) validation.warnings.push(assetCheck.warning);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  try {
    const computed = GameEngine.compute(game, products, args.seed);
    return {
      ok: true,
      warnings: validation.warnings,
      validationMs: Number(validation.durationMs.toFixed(2)),
      answer: computed.answer,
      timeline: computed.timeline,
      revealType: computed.revealType,
      diversification: computed.diversification,
      game,
      sceneData,
    };
  } catch (err) {
    if (isGameError(err)) return { ok: false, errors: [err.toJSON()] };
    throw err;
  }
}

/** CLI adapter: prints JSON, returns the process exit code. */
export function runPlan(argv: string[]): number {
  const result = plan(parsePlanArgs(argv));
  if ((result as PlanFailure).ok === false) {
    const failure = result as PlanFailure;
    console.error(JSON.stringify(failure.errors[0] ?? { code: 'E_UNKNOWN' }));
    return 1;
  }
  console.log(JSON.stringify(result, null, 2));
  return 0;
}
