import { describe, it, expect } from 'vitest';
import { AnalyticsIngestor } from '../../src/analytics/AnalyticsIngestor';
import { WeightCalibrator } from '../../src/analytics/WeightCalibrator';
import { DEFAULT_VIRAL_WEIGHTS } from '../../src/analytics/types';
import { ViralScorer } from '../../src/challenge/scorers/ViralScorer';

describe('Closed-Loop Analytics Feedback Subsystem', () => {
  const sampleCsv = `videoId,platform,holdRate3s,completionRate,round1Retention,round2Retention,round3Retention,commentRate,shareRatio,replayRatio,perceptionConflict,revealImpact
v001,tiktok,0.78,0.42,0.85,0.72,0.58,0.08,0.04,0.12,0.95,0.92
v002,tiktok,0.55,0.22,0.60,0.40,0.25,0.02,0.01,0.03,0.30,0.35
v003,youtube_shorts,0.82,0.48,0.88,0.76,0.62,0.11,0.05,0.15,0.98,0.95
v004,reels,0.62,0.28,0.70,0.50,0.32,0.03,0.01,0.05,0.40,0.42
`;

  it('AnalyticsIngestor ingests CSV records and extracts drop-off retention curves', () => {
    const ingestor = new AnalyticsIngestor();
    const records = ingestor.ingestCsv(sampleCsv);

    expect(records.length).toBe(4);
    expect(records[0].videoId).toBe('v001');
    expect(records[0].holdRate3s).toBe(0.78);
    expect(records[0].dropOffRounds).toEqual([0.85, 0.72, 0.58]);
    expect(records[0].scores?.revealImpact).toBe(0.92);

    const retention = ingestor.analyzeRetention(records);
    expect(retention.avgHoldRate3s).toBeCloseTo((0.78 + 0.55 + 0.82 + 0.62) / 4, 2);
    expect(retention.avgCompletionRate).toBeGreaterThan(0.2);
    expect(retention.dropOffAtRound1).toBeGreaterThan(0);
    expect(retention.dropOffAtRound2).toBeGreaterThan(0);
    expect(retention.dropOffAtRound3).toBeGreaterThan(0);
  });

  it('AnalyticsIngestor ingests JSON records gracefully', () => {
    const ingestor = new AnalyticsIngestor();
    const records = ingestor.ingestJson([
      {
        videoId: 'j01',
        platform: 'tiktok',
        holdRate3s: 0.75,
        completionRate: 0.40,
        dropOffRounds: [0.8, 0.65, 0.5],
        commentRate: 0.07,
        shareRatio: 0.03,
        replayRatio: 0.1,
        scores: { perceptionConflict: 0.9, revealImpact: 0.85 },
      },
    ]);

    expect(records.length).toBe(1);
    expect(records[0].videoId).toBe('j01');
    expect(records[0].holdRate3s).toBe(0.75);
  });

  it('WeightCalibrator adjusts ViralScorer weights based on empirical correlation', () => {
    const ingestor = new AnalyticsIngestor();
    const records = ingestor.ingestCsv(sampleCsv);

    const calibrator = new WeightCalibrator();
    const calibratedWeights = calibrator.calibrate(records, DEFAULT_VIRAL_WEIGHTS);

    // Sum of normalized weights must be strictly 1.0
    const sum = Object.values(calibratedWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);

    // Because perceptionConflict & revealImpact strongly correlated with commentRate (> 0.08 vs 0.02)
    // and completion rate in the dataset, their calibrated weights should increase or remain prominent.
    expect(calibratedWeights.revealImpact).toBeGreaterThanOrEqual(DEFAULT_VIRAL_WEIGHTS.revealImpact * 0.9);
    expect(calibratedWeights.perceptionConflict).toBeGreaterThan(0.15);
  });

  it('ViralScorer computes predictedViralScore using calibrated weights', () => {
    const scorer = new ViralScorer();
    const customWeights = {
      revealImpact: 0.35,
      perceptionConflict: 0.25,
      curiosity: 0.15,
      debate: 0.10,
      identity: 0.10,
      familiarity: 0.05,
    };

    const vector = {
      difficulty: 0.5,
      visualClarity: 0.95,
      curiosity: 0.8,
      surprise: 0.85,
      perceptionConflict: 0.9,
      debate: 0.75,
      identity: 0.85,
      familiarity: 0.8,
      commerceRelevance: 0.9,
      revealImpact: 0.92,
    };

    const defaultScore = scorer.computePredictedViralScore(vector);
    const calibratedScore = scorer.computePredictedViralScore(vector, customWeights);

    expect(defaultScore).toBeGreaterThan(0.7);
    expect(defaultScore).toBeLessThanOrEqual(1.0);
    expect(calibratedScore).toBeGreaterThan(0.7);
    expect(calibratedScore).toBeLessThanOrEqual(1.0);
  });
});
