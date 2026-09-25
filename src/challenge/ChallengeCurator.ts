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
    const roundTimer = options?.timerSeconds !== undefined ? Math.max(1.0, options.timerSeconds) : undefined;

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
      spec.timerSeconds = roundTimer !== undefined ? roundTimer : Math.max(1.0, spec.timerSeconds ?? 5.0);
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
      } else if (dsl.family === 'numeric_comparison' || dsl.id === 'g1_hi_lo') {
        // G1: Hi-Lo
        const [prodA, prodB] = selectedProducts as [Product, Product];
        const isHigher = prodB.price > prodA.price;
        choices = [
          { id: 'higher', label: 'CAO HƠN', isCorrect: isHigher, value: prodB.price },
          { id: 'lower', label: 'THẤP HƠN', isCorrect: !isHigher, value: prodB.price },
        ];
        correctAnswer = isHigher ? 'higher' : 'lower';
        question =
          roundSpec.hookText ??
          `${prodB.name} CAO HƠN hay THẤP HƠN ${prodA.name} (${this.numericEngine.formatVND(prodA.price)})?`;
        revealText = `${prodB.name} giá ${this.numericEngine.formatVND(prodB.price)} (${isHigher ? 'CAO HƠN' : 'THẤP HƠN'} ${this.numericEngine.formatVND(prodA.price)})`;
      } else if (dsl.family === 'multiple_choice_max' || dsl.id === 'g2_most_expensive') {
        // G2: Most Expensive
        let maxProd = selectedProducts[0]!;
        for (const p of selectedProducts) {
          if (p.price > maxProd.price) maxProd = p;
        }
        const letters = ['A', 'B', 'C', 'D'];
        choices = selectedProducts.map((p, i) => ({
          id: letters[i] ?? String(i + 1),
          label: `${letters[i] ?? i + 1}. ${p.name}`,
          isCorrect: p.productId === maxProd.productId,
          value: p.price,
        }));
        const winningChoice = choices.find((c) => c.isCorrect);
        correctAnswer = winningChoice?.id ?? 'A';
        question =
          roundSpec.hookText ??
          `Trong ${selectedProducts.length} món này, món nào ĐẮT NHẤT?`;
        revealText = `${maxProd.name} đắt nhất với giá ${this.numericEngine.formatVND(maxProd.price)}!`;
      } else if (dsl.family === 'numeric_digit' || dsl.id === 'g5_one_away') {
        // G5: One Away
        const [prod] = selectedProducts as [Product, ...Product[]];
        const priceStr = String(prod.price);
        const hiddenIndex =
          roundSpec.hiddenIndex !== undefined
            ? Math.min(priceStr.length - 1, roundSpec.hiddenIndex)
            : Math.min(priceStr.length - 1, Math.max(0, (seed + idx) % priceStr.length));
        const correctDigit = Number(priceStr[hiddenIndex]);
        const decoyDigit = correctDigit === 9 ? 8 : correctDigit + 1;
        const options = (seed + idx) % 2 === 0 ? [correctDigit, decoyDigit] : [decoyDigit, correctDigit];
        choices = options.map((d) => ({
          id: String(d),
          label: `Số ${d}`,
          isCorrect: d === correctDigit,
          value: d,
        }));
        correctAnswer = String(correctDigit);
        const maskedPrice = priceStr
          .split('')
          .map((c, i) => (i === hiddenIndex ? '?' : c))
          .join('')
          .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        question =
          roundSpec.hookText ??
          `Chữ số bị che trong giá ${maskedPrice}₫ là số mấy?`;
        revealText = `Giá chính xác là ${this.numericEngine.formatVND(prod.price)} (Số ${correctDigit})!`;
      } else if (dsl.family === 'semantic_outlier' || dsl.id === 'g3_odd_one_out') {
        // G3: Odd One Out
        // 1. By Category (3 in one category, 1 in another)
        const categoryCounts = new Map<string, Product[]>();
        for (const p of selectedProducts) {
          const list = categoryCounts.get(p.category) ?? [];
          list.push(p);
          categoryCounts.set(p.category, list);
        }
        let oddProduct: Product | undefined;
        let oddReason = '';
        for (const [, list] of categoryCounts.entries()) {
          if (list.length === 1 && categoryCounts.size === 2) {
            oddProduct = list[0];
            oddReason = `khác danh mục: ${oddProduct?.category}`;
            break;
          }
        }
        // 2. By Brand (3 in one brand, 1 in another)
        if (!oddProduct) {
          const brandCounts = new Map<string, Product[]>();
          for (const p of selectedProducts) {
            const list = brandCounts.get(p.brand) ?? [];
            list.push(p);
            brandCounts.set(p.brand, list);
          }
          for (const [, list] of brandCounts.entries()) {
            if (list.length === 1 && brandCounts.size === 2) {
              oddProduct = list[0];
              oddReason = `khác thương hiệu: ${oddProduct?.brand}`;
              break;
            }
          }
        }
        // 3. Fallback: Price outlier
        if (!oddProduct) {
          const sorted = [...selectedProducts].sort((a, b) => a.price - b.price);
          const deltaLow = (sorted[1]?.price ?? 0) - (sorted[0]?.price ?? 0);
          const deltaHigh = (sorted[3]?.price ?? 0) - (sorted[2]?.price ?? 0);
          oddProduct = deltaHigh > deltaLow ? (sorted[3] ?? sorted[0]!) : sorted[0]!;
          oddReason = `khác phân khúc giá: ${this.numericEngine.formatVND(oddProduct.price)}`;
        }
        const letters = ['A', 'B', 'C', 'D'];
        choices = selectedProducts.map((p, i) => ({
          id: letters[i] ?? String(i + 1),
          label: `${letters[i] ?? i + 1}. ${p.name}`,
          isCorrect: p.productId === oddProduct.productId,
          value: p.price,
        }));
        const winChoice = choices.find((c) => c.isCorrect);
        correctAnswer = winChoice?.id ?? 'A';
        question =
          roundSpec.hookText ??
          `Món nào là "KẺ LẠ" trong ${selectedProducts.length} món này?`;
        revealText = `${oddProduct.name} là kẻ lạ (${oddReason})!`;
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
        mechanic: dsl.id.replace(/^g\d+_/, ''),
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
