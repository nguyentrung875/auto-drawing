import { describe, it, expect } from 'vitest';
import { normalizeMechanic, parseRenderArgs } from '../../src/cli/render';

describe('CLI Multi-Round Flags and Aliases', () => {
  it('normalizes g7, grocery, grocery_basket to GROCERY_BASKET', () => {
    expect(normalizeMechanic('g7')).toBe('GROCERY_BASKET');
    expect(normalizeMechanic('grocery')).toBe('GROCERY_BASKET');
    expect(normalizeMechanic('grocery_basket')).toBe('GROCERY_BASKET');
  });

  it('normalizes g41, deal, deal_or_scam to DEAL_OR_SCAM', () => {
    expect(normalizeMechanic('g41')).toBe('DEAL_OR_SCAM');
    expect(normalizeMechanic('deal')).toBe('DEAL_OR_SCAM');
    expect(normalizeMechanic('deal_or_scam')).toBe('DEAL_OR_SCAM');
  });

  it('parses --mechanic g7 and --mode multi flags correctly', () => {
    const args = parseRenderArgs(['--mechanic', 'g7', '--mode', 'multi', '--seed', '123456']);
    expect(args.mechanic).toBe('GROCERY_BASKET');
    expect(args.mode).toBe('multi');
    expect(args.seed).toBe(123456);
  });
});
