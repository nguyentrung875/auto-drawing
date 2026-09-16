import type { PresentationModel } from '../core/presentation/types';

export class GameplayValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'GameplayValidationError';
  }
}

export class GameplayValidator {
  static validate(presentation: PresentationModel<any>): void {
    const { question, reveal, cta } = presentation;

    // 1. Information Leakage Audit: Target item price leak
    if (question.mechanicId === 'GROCERY_BASKET' || question.mechanicId === 'GUESS_THE_PRICE') {
      question.entities.forEach((e, idx) => {
        if (e.price.kind === 'reference') {
          throw new GameplayValidationError(
            'E_LEAKAGE_PRICE_PREMATURE',
            `Product ${idx} (${e.productId}) exposed reference price "${e.price.label}" during question phase in ${question.mechanicId}`,
          );
        }
      });
    }

    // 2. Information Leakage Audit: Technical SKU leakage
    const rawIdRegex = /\bp\d{3,}\b/i;
    if (rawIdRegex.test(reveal.headlineBanner)) {
      throw new GameplayValidationError(
        'E_LEAKAGE_RAW_PRODUCT_ID',
        `Reveal headline banner leaked raw product ID: "${reveal.headlineBanner}"`,
      );
    }
    question.choices.forEach((c) => {
      if (rawIdRegex.test(c.label)) {
        throw new GameplayValidationError(
          'E_LEAKAGE_RAW_PRODUCT_ID',
          `Choice label leaked raw product ID: "${c.label}"`,
        );
      }
    });

    // 3. CTA Round Mismatch
    if (question.totalRounds === 1 && cta.variant === 'multi_round_scorecard') {
      throw new GameplayValidationError(
        'E_CTA_ROUND_MISMATCH',
        'Single-round presentation cannot use multi_round_scorecard CTA',
      );
    }
  }
}
