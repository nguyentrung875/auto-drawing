import type { MultiRoundChallenge, ChallengeRound } from '../challenge/types';
import type { Timeline, TimelineSlot } from '../types/game';

export class AllInOneScene {
  constructor(public readonly challenge: MultiRoundChallenge) {}

  getTimeline(): Timeline {
    const slots: TimelineSlot[] = [];
    let currentTime = 0;

    // 0s - 1.0s: Series Hook (Quick 1s intro)
    const hookDuration = 1.0;
    slots.push({
      type: 'hook',
      duration: hookDuration,
      start: currentTime,
      end: currentTime + hookDuration,
    });
    currentTime += hookDuration;

    // N Rounds with Instant Countdown
    const revealDuration = 2.0;
    const microHookDuration = 0.5;

    this.challenge.rounds.forEach((round, idx) => {
      // Play / Instant Countdown period: exactly round.timerSeconds (minimum 5.0s, no 2.5s lag)
      const playDuration = Math.max(5.0, round.timerSeconds);
      slots.push({
        type: `round_${round.roundIndex}_play`,
        duration: playDuration,
        start: currentTime,
        end: currentTime + playDuration,
      });
      currentTime += playDuration;

      // Reveal period: 2.0s
      slots.push({
        type: `round_${round.roundIndex}_reveal`,
        duration: revealDuration,
        start: currentTime,
        end: currentTime + revealDuration,
      });
      currentTime += revealDuration;

      // Micro-hook transition between rounds (0.5s)
      if (idx < this.challenge.rounds.length - 1) {
        slots.push({
          type: `micro_hook_${idx + 1}`,
          duration: microHookDuration,
          start: currentTime,
          end: currentTime + microHookDuration,
        });
        currentTime += microHookDuration;
      }
    });

    // Scorecard & CTA (1.5s)
    const scorecardDuration = 1.5;
    slots.push({
      type: 'scorecard',
      duration: scorecardDuration,
      start: currentTime,
      end: currentTime + scorecardDuration,
    });
    currentTime += scorecardDuration;

    return {
      slots,
      totalDuration: Number(currentTime.toFixed(2)),
    };
  }

  getCurrentRound(timeSeconds: number): {
    round: ChallengeRound;
    phase: 'play' | 'reveal';
    phaseTime: number;
  } | null {
    const timeline = this.getTimeline();
    for (const slot of timeline.slots) {
      if (timeSeconds >= slot.start && timeSeconds < slot.end) {
        if (slot.type.startsWith('round_')) {
          const parts = slot.type.split('_');
          const roundIdx = parseInt(parts[1]!, 10);
          const phase = parts[2] as 'play' | 'reveal';
          const round = this.challenge.rounds.find((r) => r.roundIndex === roundIdx);
          if (round) {
            return { round, phase, phaseTime: timeSeconds - slot.start };
          }
        }
      }
    }
    return null;
  }
}
