import { describe, it, expect } from 'vitest';
import type { QuestionRenderModel, QuestionPrice } from '../../../src/core/presentation/types';
import type { HiLoReveal, AnyRevealPayload } from '../../../src/core/presentation/reveals';

describe('Presentation Model Typing', () => {
  it('enforces type-safe QuestionPrice without arbitrary numbers', () => {
    const hidden: QuestionPrice = { kind: 'hidden', label: '???' };
    const reference: QuestionPrice = {
      kind: 'reference',
      value: 189000,
      label: '189.000₫',
      role: 'anchor_benchmark',
    };

    expect(hidden.kind).toBe('hidden');
    expect(reference.kind).toBe('reference');
  });

  it('compiles discriminated reveal payload correctly', () => {
    const reveal: AnyRevealPayload = {
      kind: 'HI_LO',
      priceA: 189000,
      priceB: 249000,
      comparison: 'higher',
    };
    expect(reveal.kind).toBe('HI_LO');
  });
});
