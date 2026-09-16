import type { DiversityPolicy } from '../policy/types';
import { DEFAULT_DIVERSITY_POLICY } from '../policy';

export class DiversityManager {
  private readonly tupleHistory: string[] = [];
  private readonly heroHistory: string[] = [];
  private readonly answerHistory: string[] = [];

  constructor(private readonly policy: DiversityPolicy = DEFAULT_DIVERSITY_POLICY) {}

  canAcceptProductTuple(productIds: string[]): boolean {
    const key = [...productIds].sort().join('|');
    const recent = this.tupleHistory.slice(-this.policy.cooldownProductTuple);
    return !recent.includes(key);
  }

  canAcceptHeroSku(sku: string): boolean {
    const recent = this.heroHistory.slice(-this.policy.cooldownHeroSku);
    return !recent.includes(sku);
  }

  canAcceptAnswer(answerId: string): boolean {
    const max = this.policy.maxConsecutiveSameAnswer;
    if (this.answerHistory.length < max) return true;
    const tail = this.answerHistory.slice(-max);
    return !tail.every((a) => a === answerId);
  }

  recordTuple(productIds: string[]): void {
    this.tupleHistory.push([...productIds].sort().join('|'));
  }

  recordHero(sku: string): void {
    this.heroHistory.push(sku);
  }

  recordAnswer(answerId: string): void {
    this.answerHistory.push(answerId);
  }
}
