import seedrandom from 'seedrandom';
import type { ChallengeChoice } from '../types';

export interface PriceBracketResult {
  choiceA: ChallengeChoice;
  choiceB: ChallengeChoice;
  correctChoice: 'A' | 'B';
}

export class NumericEngine {
  formatVND(price: number): string {
    if (price >= 1000000) {
      const tr = price / 1000000;
      return `${tr % 1 === 0 ? tr : tr.toFixed(1)} TRIỆU`;
    }
    const k = Math.round(price / 1000);
    return `${k}K`;
  }

  generatePriceBrackets(actualPrice: number, bracketRatio: number, seed: number): PriceBracketResult {
    const rng = seedrandom(seed.toString());
    const higher = rng() > 0.5;
    const fakePrice = higher ? Math.round(actualPrice * bracketRatio) : Math.round(actualPrice / bracketRatio);

    const actualLabel = this.formatVND(actualPrice);
    const fakeLabel = this.formatVND(fakePrice);

    const correctIsA = rng() > 0.5;
    return {
      choiceA: {
        id: 'A',
        label: correctIsA ? actualLabel : fakeLabel,
        isCorrect: correctIsA,
        value: correctIsA ? actualPrice : fakePrice,
      },
      choiceB: {
        id: 'B',
        label: correctIsA ? fakeLabel : actualLabel,
        isCorrect: !correctIsA,
        value: correctIsA ? fakePrice : actualPrice,
      },
      correctChoice: correctIsA ? 'A' : 'B',
    };
  }
}
