/**
 * Story 2.2 — Seeded PRNG (AR-10).
 *
 * Every random decision in the engine (diversification colour, tilt, BGM pick,
 * option ordering) MUST go through this module. The global random generator is
 * banned by eslint (`no-restricted-properties`) inside `src/`.
 */
import seedrandom from 'seedrandom';

export type Rng = () => number;

/** Create a deterministic PRNG for `seed` (optionally namespaced by `stream`). */
export function createRng(seed: number, stream = ''): Rng {
  return seedrandom(`${seed}:${stream}`);
}

/** Deterministically pick one element of `items`. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[Math.floor(rng() * items.length)] as T;
}

/** Deterministic Fisher–Yates shuffle (does not mutate `items`). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
