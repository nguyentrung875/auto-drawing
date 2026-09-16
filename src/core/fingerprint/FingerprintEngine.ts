import { createHash } from 'node:crypto';
import type { FingerprintInput, FingerprintBundle } from './types';

export function computeFingerprints(input: FingerprintInput): FingerprintBundle {
  const sortedProducts = [...input.productIds].sort().join('|');
  const sortedCategories = [...input.categories].sort().join('|');

  const exactRaw = `${input.mechanicId}::${sortedProducts}::${input.hookId}::${input.voiceId}::${input.themeId}::${input.answerId}`;
  const semanticRaw = `${input.mechanicId}::${sortedCategories}::${input.difficultyBand}::${input.revealStructure}::${input.themeId}`;

  const exact = createHash('sha256').update(exactRaw).digest('hex');
  const semantic = createHash('sha256').update(semanticRaw).digest('hex');

  return { exact, semantic, createdAt: Date.now() };
}
