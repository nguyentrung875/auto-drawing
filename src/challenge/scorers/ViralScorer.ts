import seedrandom from 'seedrandom';
import type { Product } from '../../product/schema';
import type { ChallengeScoreVector } from '../types';

export type TwistType = 'type_a_size_disparity' | 'type_b_reverse_trap' | 'type_c_real_deal';

export class ViralScorer {
  computePerceptionConflict(products: Product[]): number {
    let maxConflict = 0.1;
    for (const p of products) {
      if (p.sizeCategory === 'tiny' && p.price > 1000000) {
        maxConflict = Math.max(maxConflict, 0.95);
      } else if (p.sizeCategory === 'bulky' && p.price < 100000) {
        maxConflict = Math.max(maxConflict, 0.9);
      } else if (p.perceivedValue === 'luxury' && p.price < 200000) {
        maxConflict = Math.max(maxConflict, 0.8);
      } else if (p.sizeCategory === 'small' && p.price > 500000) {
        maxConflict = Math.max(maxConflict, 0.75);
      }
    }
    return Math.min(1.0, maxConflict);
  }

  computeRevealImpact(perceptionConflict: number, surprise: number, debate: number): number {
    const base = Math.pow(perceptionConflict, 1.5) * surprise * Math.pow(debate, 0.8);
    const raw = base * 1.3;
    return Math.max(0.0, Math.min(1.0, Math.round(raw * 100) / 100));
  }

  computeScoreVector(products: Product[], targetDifficulty: number): ChallengeScoreVector {
    const perceptionConflict = this.computePerceptionConflict(products);
    const surprise = Math.min(1.0, Math.max(0.2, perceptionConflict * 0.9 + 0.1));
    const debate = Math.min(1.0, Math.max(0.3, perceptionConflict * 0.7 + 0.2));
    const curiosity = Math.min(1.0, Math.max(0.4, targetDifficulty * 0.5 + surprise * 0.5));
    const revealImpact = this.computeRevealImpact(perceptionConflict, surprise, debate);

    return {
      difficulty: Math.min(1.0, Math.max(0.0, targetDifficulty)),
      visualClarity: 0.95,
      curiosity,
      surprise,
      perceptionConflict,
      debate,
      identity: 0.85,
      familiarity: 0.8,
      commerceRelevance: 0.9,
      revealImpact,
    };
  }

  getTwistType(seed: number): TwistType {
    const rng = seedrandom(seed.toString());
    const val = rng();
    if (val < 0.7) return 'type_a_size_disparity';
    if (val < 0.9) return 'type_b_reverse_trap';
    return 'type_c_real_deal';
  }
}
