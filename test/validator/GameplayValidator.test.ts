import { describe, it, expect } from 'vitest';
import { GameplayValidator, GameplayValidationError } from '../../src/validator/GameplayValidator';
import type { PresentationModel } from '../../src/core/presentation/types';

describe('GameplayValidator', () => {
  it('catches premature price exposure in question entities', () => {
    const presentation: PresentationModel<any> = {
      question: {
        mechanicId: 'GROCERY_BASKET',
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Đủ hay thiếu?',
        entities: [
          {
            productId: 'p001',
            name: 'Item 1',
            image: 'img.png',
            price: { kind: 'reference', value: 189000, label: '189.000₫', role: 'anchor_benchmark' }, // LEAK! Target item has price
          },
        ],
        choices: [{ id: 'A', label: 'ĐỦ' }],
      },
      reveal: { winningChoiceId: 'A', headlineBanner: 'ĐỦ', subDetailBanner: '', payload: {} },
      cta: { bannerText: 'CTA', subText: '', variant: 'single_round_challenge' },
    };

    expect(() => GameplayValidator.validate(presentation)).toThrow(GameplayValidationError);
    expect(() => GameplayValidator.validate(presentation)).toThrow(/E_LEAKAGE_PRICE_PREMATURE/);
  });

  it('catches technical product IDs leaking into reveal text', () => {
    const presentation: PresentationModel<any> = {
      question: {
        mechanicId: 'MOST_EXPENSIVE',
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Món nào đắt nhất?',
        entities: [{ productId: 'p015', name: 'Nồi chiên', image: 'img.png', price: { kind: 'hidden', label: '???' } }],
        choices: [{ id: 'A', label: 'A. Nồi chiên' }],
      },
      reveal: { winningChoiceId: 'A', headlineBanner: '🎯 ĐÁP ÁN: p015', subDetailBanner: '', payload: {} },
      cta: { bannerText: 'CTA', subText: '', variant: 'single_round_challenge' },
    };

    expect(() => GameplayValidator.validate(presentation)).toThrow(/E_LEAKAGE_RAW_PRODUCT_ID/);
  });

  it('catches single-round using multi-round scorecard CTA', () => {
    const presentation: PresentationModel<any> = {
      question: {
        mechanicId: 'HI_LO',
        roundIndex: 1,
        totalRounds: 1,
        questionHeadline: 'Cao hay thấp?',
        entities: [
          { productId: 'p001', name: 'A', image: 'a.png', price: { kind: 'reference', value: 100, label: '100', role: 'anchor_benchmark' } },
          { productId: 'p002', name: 'B', image: 'b.png', price: { kind: 'hidden', label: '???' } },
        ],
        choices: [{ id: 'A', label: 'CAO HƠN' }],
      },
      reveal: { winningChoiceId: 'A', headlineBanner: 'CAO HƠN', subDetailBanner: '', payload: {} },
      cta: { bannerText: 'BẢNG ĐIỂM', subText: 'Bạn đúng mấy câu?', variant: 'multi_round_scorecard' },
    };

    expect(() => GameplayValidator.validate(presentation)).toThrow(/E_CTA_ROUND_MISMATCH/);
  });
});
