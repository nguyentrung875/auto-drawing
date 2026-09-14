import type { Product } from '../product/schema';
import type { GameDefinitionDSL, MultiRoundChallenge, ChallengeRound } from './types';
import { EligibilityFilter } from './filters/EligibilityFilter';
import { NumericEngine } from './engines/NumericEngine';
import { ViralScorer } from './scorers/ViralScorer';

export class ChallengeCurator {
  private readonly numericEngine = new NumericEngine();
  private readonly viralScorer = new ViralScorer();

  curate(dsl: GameDefinitionDSL, catalog: Product[], seed: number): MultiRoundChallenge {
    const eligibility = new EligibilityFilter(dsl.inputs.requiredFields as Array<keyof Product>);
    const eligibleCatalog = eligibility.apply(catalog);
    if (eligibleCatalog.length < dsl.rounds.length * dsl.inputs.countPerRound) {
      throw new Error(`Insufficient eligible products: ${eligibleCatalog.length} available.`);
    }

    const usedProductIds = new Set<string>();
    const rounds: ChallengeRound[] = [];

    // Sort catalog items for cognitive roles (e.g. wtf items at the end)
    const wtfCandidates = eligibleCatalog.filter(
      (p) => (p.sizeCategory === 'tiny' && p.price > 1000000) || p.price > 2000000,
    );
    const standardCandidates = eligibleCatalog.filter((p) => !wtfCandidates.includes(p));

    dsl.rounds.forEach((roundSpec, idx) => {
      let selected: Product;
      if (roundSpec.type === 'wtf_reveal' && wtfCandidates.length > 0) {
        selected =
          wtfCandidates.find((p) => !usedProductIds.has(p.productId)) ??
          standardCandidates.find((p) => !usedProductIds.has(p.productId)) ??
          eligibleCatalog.find((p) => !usedProductIds.has(p.productId))!;
      } else {
        selected =
          standardCandidates.find((p) => !usedProductIds.has(p.productId)) ??
          eligibleCatalog.find((p) => !usedProductIds.has(p.productId))!;
      }
      usedProductIds.add(selected.productId);

      const ratio = roundSpec.bracketRatio ?? 2.0;
      const brackets = this.numericEngine.generatePriceBrackets(selected.price, ratio, seed + idx * 100);
      const scoreVector = this.viralScorer.computeScoreVector([selected], roundSpec.targetDifficulty ?? 0.5);

      rounds.push({
        roundIndex: roundSpec.round,
        type: roundSpec.type as any,
        question: `Giá sản phẩm này là bao nhiêu?`,
        hookText: roundSpec.hookText,
        microHook: roundSpec.microHook,
        products: [selected],
        choices: [brackets.choiceA, brackets.choiceB],
        correctAnswer: brackets.correctChoice,
        timerSeconds: roundSpec.timerSeconds,
        scoreVector,
        revealText: `Giá chính xác: ${this.numericEngine.formatVND(selected.price)}`,
      });
    });

    return {
      gameId: dsl.id,
      seed,
      title: dsl.name,
      seriesNumber: Math.floor((seed % 100) + 1),
      rounds,
      finalCta: 'Ai đúng 3/3 giơ tay! Săn deal tại giỏ hàng bên dưới!',
    };
  }
}
