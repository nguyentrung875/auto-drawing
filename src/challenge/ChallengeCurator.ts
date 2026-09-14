import type { Product } from '../product/schema';
import type { GameDefinitionDSL, MultiRoundChallenge, ChallengeRound, ChallengeChoice } from './types';
import { EligibilityFilter } from './filters/EligibilityFilter';
import { CandidateFilter } from './filters/CandidateFilter';
import { NumericEngine } from './engines/NumericEngine';
import { KnapsackEngine } from './engines/KnapsackEngine';
import { DecisionEngine } from './engines/DecisionEngine';
import { ViralScorer } from './scorers/ViralScorer';

export class ChallengeCurator {
  private readonly numericEngine = new NumericEngine();
  private readonly knapsackEngine = new KnapsackEngine();
  private readonly decisionEngine = new DecisionEngine();
  private readonly viralScorer = new ViralScorer();
  private readonly candidateFilter = new CandidateFilter();

  curate(dsl: GameDefinitionDSL, catalog: Product[], seed: number): MultiRoundChallenge {
    // Layer 1: Eligibility Filter
    const eligibility = new EligibilityFilter(dsl.inputs.requiredFields as Array<keyof Product>);
    const eligibleCatalog = eligibility.apply(catalog);
    const requiredTotalProducts = dsl.rounds.length * dsl.inputs.countPerRound;
    if (eligibleCatalog.length < requiredTotalProducts) {
      throw new Error(
        `Insufficient eligible products: ${eligibleCatalog.length} available, needed ${requiredTotalProducts}.`,
      );
    }

    const usedProductIds = new Set<string>();
    const rounds: ChallengeRound[] = [];

    // Prioritize WTF candidates for extreme perception conflict in round 3
    const wtfCandidates = eligibleCatalog.filter(
      (p) => (p.sizeCategory === 'tiny' && p.price > 1000000) || p.price > 2000000,
    );
    const standardCandidates = eligibleCatalog.filter((p) => !wtfCandidates.includes(p));

    dsl.rounds.forEach((roundSpec, idx) => {
      const count = dsl.inputs.countPerRound;
      const selectedProducts: Product[] = [];

      for (let i = 0; i < count; i += 1) {
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
        selectedProducts.push(selected);
      }

      // Layer 2: Candidate distinctness guard
      if (!this.candidateFilter.isDistinct(selectedProducts, new Set())) {
        throw new Error(`Round ${roundSpec.round} contains duplicate candidate products.`);
      }

      // Layer 3: Primitive Difficulty Engines & Choices Synthesis
      let choices: ChallengeChoice[] = [];
      let correctAnswer: string | number = '';
      let question = '';
      let revealText = '';

      if (dsl.family === 'numeric_knapsack' || dsl.id === 'g7_grocery_basket') {
        // G7: Grocery Basket
        const budget = roundSpec.budget ?? 300000;
        const evaluation = this.knapsackEngine.evaluateBasket(selectedProducts, budget);
        choices = [
          { id: 'under', label: 'ĐỦ TIỀN', isCorrect: evaluation.isUnderBudget, value: evaluation.total },
          { id: 'over', label: 'CHÁY TÚI', isCorrect: !evaluation.isUnderBudget, value: evaluation.total },
        ];
        correctAnswer = evaluation.isUnderBudget ? 'under' : 'over';
        question =
          roundSpec.hookText ??
          `Tổng 3 món này ĐỦ TIỀN hay CHÁY TÚI với ngân sách ${this.numericEngine.formatVND(budget)}?`;
        revealText = `Tổng bill: ${this.numericEngine.formatVND(evaluation.total)} (${evaluation.isUnderBudget ? 'ĐỦ TIỀN' : 'CHÁY TÚI'})`;
      } else if (dsl.family === 'commerce_decision' || dsl.id === 'g41_deal_or_scam') {
        // G41: Deal or Scam
        const [prod] = selectedProducts as [Product, ...Product[]];
        const evaluation = this.decisionEngine.evaluateOffer(prod, undefined, seed + idx * 100);
        const isDeal = evaluation.classification === 'deal';
        choices = [
          { id: 'deal', label: 'DEAL HỜI', isCorrect: isDeal, value: prod.price },
          { id: 'scam', label: 'BẪY SCAM', isCorrect: !isDeal, value: prod.price },
        ];
        correctAnswer = evaluation.classification;
        question =
          roundSpec.hookText ??
          `${prod.name} sale sốc -${evaluation.discountPercent}%: DEAL HỜI hay BẪY SCAM?`;
        revealText = `Đáp án: ${isDeal ? 'DEAL HỜI MÚC NGAY' : 'BẪY SALE ẢO / SCAM'} (-${evaluation.discountPercent}%)`;
      } else {
        // G9: Guess The Price (Default numeric single bracket)
        const [prod] = selectedProducts as [Product, ...Product[]];
        const ratio = roundSpec.bracketRatio ?? 2.0;
        const brackets = this.numericEngine.generatePriceBrackets(prod.price, ratio, seed + idx * 100);
        choices = [brackets.choiceA, brackets.choiceB];
        correctAnswer = brackets.correctChoice;
        question = roundSpec.hookText ?? `Giá của ${prod.name} là bao nhiêu?`;
        revealText = `Giá chính xác: ${this.numericEngine.formatVND(prod.price)}`;
      }

      // Layer 4: Multi-dimensional Viral Scoring (with RevealImpact)
      const scoreVector = this.viralScorer.computeScoreVector(
        selectedProducts,
        roundSpec.targetDifficulty ?? 0.5,
      );

      // Layer 5: Round Composition
      rounds.push({
        roundIndex: roundSpec.round,
        type: roundSpec.type as any,
        question,
        hookText: roundSpec.hookText,
        microHook: roundSpec.microHook,
        products: selectedProducts,
        choices,
        correctAnswer,
        timerSeconds: roundSpec.timerSeconds,
        scoreVector,
        revealText,
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
