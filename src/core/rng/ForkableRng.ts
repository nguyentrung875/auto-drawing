import seedrandom from 'seedrandom';

export interface IForkableRng {
  next(): number;
  fork(namespace: string): IForkableRng;
  int(min: number, max: number): number;
  pick<T>(array: readonly T[]): T;
  shuffle<T>(array: readonly T[]): T[];
  boolean(probability?: number): boolean;
}

export class ForkableRng implements IForkableRng {
  private readonly rng: () => number;

  constructor(private readonly seedValue: string | number) {
    this.rng = seedrandom(String(seedValue));
  }

  next(): number {
    return this.rng();
  }

  fork(namespace: string): IForkableRng {
    return new ForkableRng(`${this.seedValue}::${namespace}`);
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    const index = Math.floor(this.next() * array.length);
    return array[index]!;
  }

  shuffle<T>(array: readonly T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!] as [T, T];
    }
    return copy;
  }

  boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }
}
