import { describe, it, expect } from 'vitest';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { g7Definition } from '../../src/definitions/g7_grocery_basket';
import { g41Definition } from '../../src/definitions/g41_deal_or_scam';
import type { Mechanic as EngineMechanic } from '../../src/types/game';
import type { Mechanic as StudioMechanic } from '../../studio/src/types/game';

describe('Web Studio DSL Registry', () => {
  it('provides game definitions for G9, G7, and G41', () => {
    expect(g9Definition.id).toBe('g9_guess_the_price');
    expect(g7Definition.id).toBe('g7_grocery_basket');
    expect(g41Definition.id).toBe('g41_deal_or_scam');
  });

  it('validates G9 Guess The Price definition structure', () => {
    expect(g9Definition.family).toBe('numeric_single_bracket');
    expect(g9Definition.targetDuration).toBe(38.0);
    expect(g9Definition.inputs.countPerRound).toBe(1);
    expect(g9Definition.rounds.length).toBe(3);
    expect(g9Definition.rounds[0].type).toBe('confidence_builder');
    expect(g9Definition.rounds[1].type).toBe('tension_creator');
    expect(g9Definition.rounds[2].type).toBe('wtf_reveal');
    expect(g9Definition.presentation.layout).toBe('all_in_one_single_card');
    expect(g9Definition.presentation.actionButtons).toEqual(['KHOẢNG GIÁ A', 'KHOẢNG GIÁ B']);
  });

  it('validates G7 Grocery Basket definition structure', () => {
    expect(g7Definition.family).toBe('numeric_knapsack');
    expect(g7Definition.targetDuration).toBe(40.0);
    expect(g7Definition.inputs.countPerRound).toBe(3);
    expect(g7Definition.rounds.length).toBe(3);
    expect(g7Definition.rounds[0].budget).toBe(300000);
    expect(g7Definition.presentation.layout).toBe('all_in_one_basket_tray');
    expect(g7Definition.presentation.actionButtons).toEqual(['ĐỦ TIỀN', 'CHÁY TÚI']);
  });

  it('validates G41 Deal or Scam definition structure', () => {
    expect(g41Definition.family).toBe('commerce_decision');
    expect(g41Definition.targetDuration).toBe(38.0);
    expect(g41Definition.inputs.countPerRound).toBe(1);
    expect(g41Definition.rounds.length).toBe(3);
    expect(g41Definition.presentation.layout).toBe('all_in_one_discount_deck');
    expect(g41Definition.presentation.actionButtons).toEqual(['DEAL HỜI MÚC NGAY', 'BẪY SALE ẢO / SCAM']);
  });

  it('supports flagship mechanics in Mechanic union type', () => {
    const flagships: EngineMechanic[] = ['GUESS_THE_PRICE', 'GROCERY_BASKET', 'DEAL_OR_SCAM'];
    const studioFlagships: StudioMechanic[] = ['GUESS_THE_PRICE', 'GROCERY_BASKET', 'DEAL_OR_SCAM'];
    expect(flagships).toEqual(['GUESS_THE_PRICE', 'GROCERY_BASKET', 'DEAL_OR_SCAM']);
    expect(studioFlagships).toEqual(['GUESS_THE_PRICE', 'GROCERY_BASKET', 'DEAL_OR_SCAM']);
  });
});
