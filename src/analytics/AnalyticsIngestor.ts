import type { VideoAnalyticsRecord, RetentionCurveAnalysis, PlatformType } from './types';
import { videoAnalyticsRecordSchema } from './types';

export class AnalyticsIngestor {
  /**
   * Ingests an array of raw JSON objects and validates them into VideoAnalyticsRecords.
   */
  ingestJson(data: unknown[]): VideoAnalyticsRecord[] {
    return data.map((item) => videoAnalyticsRecordSchema.parse(item));
  }

  /**
   * Ingests CSV content commonly exported from TikTok Creator Studio, YouTube Studio, etc.
   * Expected headers (case-insensitive):
   * videoId, platform, holdRate3s, completionRate, round1Retention, round2Retention, round3Retention, commentRate, shareRatio, replayRatio, perceptionConflict, revealImpact
   */
  ingestCsv(csvContent: string): VideoAnalyticsRecord[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return [];
    }

    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

    const records: VideoAnalyticsRecord[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim());
      if (values.length < headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });

      const videoId = row['videoid'] || row['id'] || `v_${i}`;
      let platformRaw = (row['platform'] || 'tiktok').toLowerCase();
      if (platformRaw === 'shorts' || platformRaw === 'youtube') platformRaw = 'youtube_shorts';
      if (platformRaw === 'facebook' || platformRaw === 'fb') platformRaw = 'reels';
      const platform: PlatformType =
        platformRaw === 'youtube_shorts' || platformRaw === 'reels' ? platformRaw : 'tiktok';

      const holdRate3s = parseFloat(row['holdrate3s'] || row['hold_rate'] || '0.5');
      const completionRate = parseFloat(row['completionrate'] || row['completion_rate'] || '0.3');
      const r1 = parseFloat(row['round1retention'] || row['r1'] || '0.7');
      const r2 = parseFloat(row['round2retention'] || row['r2'] || '0.5');
      const r3 = parseFloat(row['round3retention'] || row['r3'] || '0.35');
      const commentRate = parseFloat(row['commentrate'] || row['comment_rate'] || '0.03');
      const shareRatio = parseFloat(row['shareratio'] || row['share_ratio'] || '0.01');
      const replayRatio = parseFloat(row['replayratio'] || row['replay_ratio'] || '0.05');

      const pConflict = row['perceptionconflict'] ? parseFloat(row['perceptionconflict']) : undefined;
      const revImpact = row['revealimpact'] ? parseFloat(row['revealimpact']) : undefined;
      const curiosity = row['curiosity'] ? parseFloat(row['curiosity']) : undefined;
      const debate = row['debate'] ? parseFloat(row['debate']) : undefined;
      const identity = row['identity'] ? parseFloat(row['identity']) : undefined;
      const familiarity = row['familiarity'] ? parseFloat(row['familiarity']) : undefined;

      const record: VideoAnalyticsRecord = {
        videoId,
        platform,
        holdRate3s,
        completionRate,
        dropOffRounds: [r1, r2, r3],
        commentRate,
        shareRatio,
        replayRatio,
        scores: {
          perceptionConflict: pConflict,
          revealImpact: revImpact,
          curiosity,
          debate,
          identity,
          familiarity,
        },
      };

      records.push(videoAnalyticsRecordSchema.parse(record));
    }

    return records;
  }

  /**
   * Analyzes retention drop-off curve across Rounds 1, 2, and 3.
   */
  analyzeRetention(records: VideoAnalyticsRecord[]): RetentionCurveAnalysis {
    if (records.length === 0) {
      return {
        avgHoldRate3s: 0,
        avgCompletionRate: 0,
        avgCommentRate: 0,
        dropOffAtRound1: 0,
        dropOffAtRound2: 0,
        dropOffAtRound3: 0,
        biggestDropOffRound: 1,
      };
    }

    const n = records.length;
    const avgHoldRate3s = records.reduce((s, r) => s + r.holdRate3s, 0) / n;
    const avgCompletionRate = records.reduce((s, r) => s + r.completionRate, 0) / n;
    const avgCommentRate = records.reduce((s, r) => s + r.commentRate, 0) / n;

    // Drop-off from initial (1.0) to Round 1, R1 to R2, R2 to R3
    const avgR1 = records.reduce((s, r) => s + r.dropOffRounds[0], 0) / n;
    const avgR2 = records.reduce((s, r) => s + r.dropOffRounds[1], 0) / n;
    const avgR3 = records.reduce((s, r) => s + r.dropOffRounds[2], 0) / n;

    const dropOffAtRound1 = Math.max(0, 1.0 - avgR1);
    const dropOffAtRound2 = Math.max(0, avgR1 - avgR2);
    const dropOffAtRound3 = Math.max(0, avgR2 - avgR3);

    let biggestDropOffRound: 1 | 2 | 3 = 1;
    if (dropOffAtRound2 > dropOffAtRound1 && dropOffAtRound2 > dropOffAtRound3) {
      biggestDropOffRound = 2;
    } else if (dropOffAtRound3 > dropOffAtRound1 && dropOffAtRound3 > dropOffAtRound2) {
      biggestDropOffRound = 3;
    }

    return {
      avgHoldRate3s,
      avgCompletionRate,
      avgCommentRate,
      dropOffAtRound1,
      dropOffAtRound2,
      dropOffAtRound3,
      biggestDropOffRound,
    };
  }
}
