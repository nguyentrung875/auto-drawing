import type { Product } from '../../product/schema';

export class CandidateFilter {
  isDistinct(candidates: Product[], usedProductIds: Set<string>): boolean {
    const seen = new Set<string>();
    for (const p of candidates) {
      if (seen.has(p.productId) || usedProductIds.has(p.productId)) {
        return false;
      }
      seen.add(p.productId);
    }
    return true;
  }
}
