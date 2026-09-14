import type { VideoAnalyticsRecord, ViralScorerWeights } from './types';
import { DEFAULT_VIRAL_WEIGHTS } from './types';

export class WeightCalibrator {
  /**
   * Calibrates ViralScorer feature weights by measuring correlation between
   * challenge attributes and observed platform virality (Hold rate, Completion, Comments).
   */
  calibrate(
    records: VideoAnalyticsRecord[],
    priorWeights: ViralScorerWeights = DEFAULT_VIRAL_WEIGHTS,
    learningRate = 0.25,
  ): ViralScorerWeights {
    if (records.length < 2) {
      return { ...priorWeights };
    }

    // Compute composite engagement score for each record
    // Social Algorithm Triad: Hold Rate (40%) + Completion Rate (30%) + Comment Engagement (30%)
    const engagementScores = records.map((r) => {
      const normalizedComment = Math.min(1.0, r.commentRate * 10);
      const normalizedShare = Math.min(1.0, r.shareRatio * 15);
      return 0.4 * r.holdRate3s + 0.3 * r.completionRate + 0.15 * normalizedComment + 0.15 * normalizedShare;
    });

    const avgEngagement = engagementScores.reduce((a, b) => a + b, 0) / records.length;

    const featureKeys: Array<keyof ViralScorerWeights> = [
      'revealImpact',
      'perceptionConflict',
      'curiosity',
      'debate',
      'identity',
      'familiarity',
    ];

    const adjustedWeights: Record<keyof ViralScorerWeights, number> = { ...priorWeights };

    for (const key of featureKeys) {
      const featureValues = records.map((r) => r.scores?.[key] ?? 0.5);
      const avgFeature = featureValues.reduce((a, b) => a + b, 0) / records.length;

      // Covariance between feature and engagement
      let cov = 0;
      let varF = 0;
      let varE = 0;
      for (let i = 0; i < records.length; i += 1) {
        const df = (featureValues[i] ?? 0.5) - avgFeature;
        const de = (engagementScores[i] ?? 0.5) - avgEngagement;
        cov += df * de;
        varF += df * df;
        varE += de * de;
      }

      const std = Math.sqrt(varF * varE);
      const correlation = std > 0.0001 ? cov / std : 0;

      // Bayesian prior update: boost weight if positively correlated, lower if negatively correlated
      const prior = priorWeights[key];
      const multiplier = Math.max(0.5, Math.min(1.5, 1 + correlation * learningRate));
      adjustedWeights[key] = Math.max(0.05, prior * multiplier);
    }

    // Normalize weights so the sum is strictly 1.0
    const totalSum = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
    const normalized: ViralScorerWeights = {
      revealImpact: Math.round((adjustedWeights.revealImpact / totalSum) * 10000) / 10000,
      perceptionConflict: Math.round((adjustedWeights.perceptionConflict / totalSum) * 10000) / 10000,
      curiosity: Math.round((adjustedWeights.curiosity / totalSum) * 10000) / 10000,
      debate: Math.round((adjustedWeights.debate / totalSum) * 10000) / 10000,
      identity: Math.round((adjustedWeights.identity / totalSum) * 10000) / 10000,
      familiarity: Math.round((adjustedWeights.familiarity / totalSum) * 10000) / 10000,
    };

    // Correct precision rounding difference on the largest weight
    const currentSum = Object.values(normalized).reduce((a, b) => a + b, 0);
    const diff = 1.0 - currentSum;
    normalized.revealImpact = Math.round((normalized.revealImpact + diff) * 10000) / 10000;

    return normalized;
  }
}
