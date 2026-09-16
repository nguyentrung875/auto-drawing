import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeFingerprints } from '../../../src/core/fingerprint/FingerprintEngine';
import { FileFingerprintStore } from '../../../src/core/fingerprint/FingerprintStore';

describe('Fingerprint System', () => {
  const filePath = join(tmpdir(), `fp_test_${Date.now()}.json`);

  it('computes distinct exact and semantic fingerprints', () => {
    const bundle1 = computeFingerprints({
      mechanicId: 'HI_LO',
      productIds: ['p001', 'p002'],
      categories: ['electronics', 'appliances'],
      hookId: 'hook_1',
      voiceId: 'voice_1',
      themeId: 'tv_game_show',
      answerId: 'higher',
      difficultyBand: 'easy',
      revealStructure: 'price_split',
    });

    const bundle2 = computeFingerprints({
      mechanicId: 'HI_LO',
      productIds: ['p001', 'p002'],
      categories: ['electronics', 'appliances'],
      hookId: 'hook_2', // Changed hook
      voiceId: 'voice_2', // Changed voice
      themeId: 'tv_game_show',
      answerId: 'higher',
      difficultyBand: 'easy',
      revealStructure: 'price_split',
    });

    // Exact fingerprint differs
    expect(bundle1.exact).not.toBe(bundle2.exact);
    // Semantic fingerprint matches because core game structure and categories are identical
    expect(bundle1.semantic).toBe(bundle2.semantic);
  });

  it('persists and checks collision in FileFingerprintStore', () => {
    const store = new FileFingerprintStore(filePath);
    const fp = computeFingerprints({
      mechanicId: 'G9',
      productIds: ['p010'],
      categories: ['food'],
      hookId: 'h1',
      voiceId: 'v1',
      themeId: 'shopping',
      answerId: 'A',
      difficultyBand: 'med',
      revealStructure: 'bracket',
    });

    expect(store.hasExact(fp.exact)).toBe(false);
    store.record(fp);
    expect(store.hasExact(fp.exact)).toBe(true);
    expect(store.hasSemantic(fp.semantic)).toBe(true);

    // Re-instantiate from file
    const store2 = new FileFingerprintStore(filePath);
    expect(store2.hasExact(fp.exact)).toBe(true);
  });
});
