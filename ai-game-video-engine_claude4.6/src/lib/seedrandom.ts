import seedrandom from "seedrandom";

// Seeded PRNG wrapper — bans Math.random() for reproducibility
export function createRng(seed: number) {
  const rng = seedrandom(String(seed));
  return {
    next(): number {
      return rng();
    },
    nextInt(min: number, max: number): number {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(rng() * arr.length)];
    },
    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    float(min: number, max: number): number {
      return rng() * (max - min) + min;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;
