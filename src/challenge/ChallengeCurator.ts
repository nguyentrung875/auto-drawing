import type { Product } from '../product/schema';
import type { GameDefinitionDSL, MultiRoundChallenge, ChallengeRound, ChallengeChoice, CurateOptions } from './types';
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

  curate(
    dsl: GameDefinitionDSL,
    catalog: Product[],
    seed: number,
    options?: CurateOptions,
  ): MultiRoundChallenge {
    // Dynamic Round Count & Timer Customization
    const targetRoundCount = options?.totalRounds ? Math.max(1, options.totalRounds) : dsl.rounds.length;
    const roundTimer = options?.timerSeconds !== undefined ? Math.max(5.0, options.timerSeconds) : undefined;

    let effectiveRoundSpecs = dsl.rounds.map((r) => ({ ...r }));
    if (targetRoundCount !== dsl.rounds.length) {
      if (targetRoundCount === 1) {
        effectiveRoundSpecs = [{ ...dsl.rounds[0]!, round: 1 }];
      } else if (targetRoundCount === 2) {
        effectiveRoundSpecs = [
          { ...dsl.rounds[0]!, round: 1 },
          { ...(dsl.rounds[dsl.rounds.length - 1] ?? dsl.rounds[0]!), round: 2, type: 'wtf_reveal' as const },
        ];
      } else if (targetRoundCount <= dsl.rounds.length) {
        const middleCount = targetRoundCount - 2;
        effectiveRoundSpecs = [
          { ...dsl.rounds[0]!, round: 1 },
          ...dsl.rounds.slice(1, 1 + middleCount).map((r, i) => ({ ...r, round: i + 2 })),
          { ...(dsl.rounds[dsl.rounds.length - 1] ?? dsl.rounds[0]!), round: targetRoundCount, type: 'wtf_reveal' as const },
        ];
      } else {
        const specs = [];
        specs.push({ ...dsl.rounds[0]!, round: 1 });
        const middleTemplate = dsl.rounds.find((r) => r.type === 'tension_creator') ?? dsl.rounds[1] ?? dsl.rounds[0]!;
        for (let r = 2; r < targetRoundCount; r++) {
          specs.push({
            ...middleTemplate,
            round: r,
            type: 'tension_creator' as const,
            targetDifficulty: Number((0.3 + (r / targetRoundCount) * 0.4).toFixed(2)),
          });
        }
        const lastTemplate = dsl.rounds[dsl.rounds.length - 1] ?? dsl.rounds[0]!;
        specs.push({
          ...lastTemplate,
          round: targetRoundCount,
          type: 'wtf_reveal' as const,
        });
        effectiveRoundSpecs = specs;
      }
    }

    for (const spec of effectiveRoundSpecs) {
      spec.timerSeconds = roundTimer !== undefined ? roundTimer : Math.max(5.0, spec.timerSeconds ?? 5.0);
    }

    // Layer 1: Eligibility Filter
    const eligibility = new EligibilityFilter(dsl.inputs.requiredFields as Array<keyof Product>);
    const eligibleCatalog = eligibility.apply(catalog);
    const requiredTotalProducts = effectiveRoundSpecs.length * dsl.inputs.countPerRound;
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

    effectiveRoundSpecs.forEach((roundSpec, idx) => {
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
      finalCta: `Ai đúng ${rounds.length}/${rounds.length} giơ tay! Săn deal tại giỏ hàng bên dưới!`,
    };
  }
}
