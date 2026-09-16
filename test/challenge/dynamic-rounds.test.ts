import { describe, it, expect } from 'vitest';
import { ChallengeCurator } from '../../src/challenge/ChallengeCurator';
import { g9Definition } from '../../src/definitions/g9_guess_the_price';
import { ProductProvider } from '../../src/product/ProductProvider';

describe('Dynamic N-Rounds in ChallengeCurator', () => {
  const provider = new ProductProvider('products', { watch: false });
  const products = provider.getAll();
  const curator = new ChallengeCurator();

  it('supports 2 rounds with custom 6s timer', () => {
    const challenge = curator.curate(g9Definition, products, 42, {
      totalRounds: 2,
      timerSeconds: 6.0,
    });
    expect(challenge.rounds.length).toBe(2);
    expect(challenge.rounds[0]?.timerSeconds).toBe(6.0);
    expect(challenge.rounds[1]?.timerSeconds).toBe(6.0);
    expect(challenge.finalCta).toContain('2/2');
  });

  it('enforces minimum 5s timer constraint', () => {
    const challenge = curator.curate(g9Definition, products, 42, {
      totalRounds: 4,
      timerSeconds: 3.0, // should clamp to 5.0
    });
    expect(challenge.rounds.length).toBe(4);
    expect(challenge.rounds[0]?.timerSeconds).toBe(5.0);
    expect(challenge.rounds[3]?.timerSeconds).toBe(5.0);
    expect(challenge.finalCta).toContain('4/4');
  });

  it('supports 5 rounds', () => {
    const challenge = curator.curate(g9Definition, products, 42, {
      totalRounds: 5,
      timerSeconds: 5.0,
    });
    expect(challenge.rounds.length).toBe(5);
    expect(challenge.rounds[4]?.type).toBe('wtf_reveal');
  });
});
