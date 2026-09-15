import type {
  ScriptQualityScore,
  VoiceCandidate,
  VoiceMetadata,
} from './types';
import type { VoiceHistoryStore } from './voiceHistoryStore';
import { type MechanicVoiceRule, VOICE_RULEBOOK } from './voiceRulebook';

export interface SelectVoiceOptions {
  mechanic: string;
  seed: number;
  history?: VoiceHistoryStore;
  customCandidates?: VoiceCandidate[];
}

function mulberry32(seed: number): () => number {
  let s = (seed === 0 ? 1 : seed) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function calculateScriptQualityScore(
  candidate: VoiceCandidate,
  rule: MechanicVoiceRule,
  history?: VoiceHistoryStore,
): ScriptQualityScore {
  // 1. Anti-spoiler hard gate
  const antiSpoilerPassed = rule.staticForbiddenPatterns.every(
    (pattern) => !pattern.test(candidate.script),
  );

  // 2. Mechanic Fit (0..25)
  const mechanicFit = rule.allowedIntents.includes(candidate.intent) ? 25 : 5;

  // 3. Naturalness (0..20)
  const endsWithPunctuation = /[?!]$/.test(candidate.script.trim());
  const naturalness = endsWithPunctuation ? 20 : 14;

  // 4. Brevity (0..15)
  const words = candidate.script.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  let brevity = 15;
  if (wordCount >= 4 && wordCount <= 6) {
    brevity = 15;
  } else if (wordCount === 3 || wordCount === 7 || wordCount === 8) {
    brevity = 12;
  } else if (wordCount === 9 || wordCount === 10) {
    brevity = 8;
  } else {
    brevity = 2;
  }

  // 5. Challenge Strength (0..15)
  let challengeStrength = 10;
  if (candidate.intent === 'CHALLENGE' || candidate.intent === 'URGENCY') {
    challengeStrength = 15;
  } else if (candidate.intent === 'DECISION') {
    challengeStrength = 13;
  } else if (candidate.intent === 'CURIOSITY') {
    challengeStrength = 11;
  }

  // 6. Novelty vs History (0..15)
  const penalty = history
    ? history.calculatePenalty(
        rule.mechanic,
        candidate.id,
        candidate.script,
        candidate.intent,
      )
    : 0;
  const novelty = Math.max(0, 15 - Math.round(penalty * 0.15));

  // 7. Comment Potential (0..10)
  const commentPotential =
    candidate.script.includes('?') &&
    (candidate.intent === 'CHALLENGE' || candidate.intent === 'DECISION')
      ? 10
      : 7;

  const rawTotal =
    mechanicFit +
    naturalness +
    brevity +
    challengeStrength +
    novelty +
    commentPotential -
    penalty;

  const total = antiSpoilerPassed ? Math.max(0, Math.min(100, rawTotal)) : 0;

  return {
    mechanicFit,
    naturalness,
    brevity,
    challengeStrength,
    novelty,
    commentPotential,
    total,
    antiSpoilerPassed,
  };
}

export function selectVoiceScript(options: SelectVoiceOptions): VoiceMetadata {
  const rule = VOICE_RULEBOOK[options.mechanic];
  if (!rule) {
    throw new Error(`Unknown mechanic: ${options.mechanic}`);
  }

  const rawPool =
    options.customCandidates && options.customCandidates.length > 0
      ? options.customCandidates
      : rule.offlinePool;

  // Filter out any candidates that violate static anti-spoiler patterns
  const validPool = rawPool.filter((candidate) =>
    rule.staticForbiddenPatterns.every((pattern) => !pattern.test(candidate.script)),
  );

  const poolToUse = validPool.length > 0 ? validPool : rawPool;
  const rng = mulberry32(options.seed);

  // Score each candidate
  const scored = poolToUse.map((candidate) => ({
    candidate,
    score: calculateScriptQualityScore(candidate, rule, options.history),
  }));

  // Sort by total score descending
  scored.sort((a, b) => b.score.total - a.score.total);

  // Group top-scoring candidates (within 5 points of maximum)
  const topScore = scored[0]?.score.total ?? 0;
  const candidatesWithinBand = scored.filter(
    (item) => item.score.total >= topScore - 5,
  );

  // Seeded pick among top candidates
  const index = Math.floor(rng() * candidatesWithinBand.length);
  const picked = candidatesWithinBand[index]?.candidate ?? poolToUse[0]!;

  if (options.history) {
    options.history.record({
      mechanic: options.mechanic,
      templateId: picked.id,
      script: picked.script,
      intent: picked.intent,
      timestamp: Date.now(),
    });
  }

  return {
    script: picked.script,
    intent: picked.intent,
    templateId: picked.id,
    visualDependency: rule.visualDependency,
  };
}
