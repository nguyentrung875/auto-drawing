import type { MultiRoundChallenge, ChallengeRound } from '../challenge/types';
import type { Timeline, TimelineSlot } from '../types/game';

export class AllInOneScene {
  constructor(public readonly challenge: MultiRoundChallenge) {}

  getTimeline(): Timeline {
    const slots: TimelineSlot[] = [];
    let currentTime = 0;

    // 0s - 1.5s: Series Hook
    slots.push({
      type: 'hook',
      duration: 1.5,
      start: currentTime,
      end: currentTime + 1.5,
    });
    currentTime += 1.5;

    // 3 Rounds
    this.challenge.rounds.forEach((round, idx) => {
      // Play / Countdown period: timerSeconds + 2.5s
      const playDuration = round.timerSeconds + 2.5;
      slots.push({
        type: `round_${round.roundIndex}_play`,
        duration: playDuration,
        start: currentTime,
        end: currentTime + playDuration,
      });
      currentTime += playDuration;

      // Reveal period: 2.5s
      const revealDuration = 2.5;
      slots.push({
        type: `round_${round.roundIndex}_reveal`,
        duration: revealDuration,
        start: currentTime,
        end: currentTime + revealDuration,
      });
      currentTime += revealDuration;

      // Micro-hook transition between rounds (1.0s)
      if (idx < this.challenge.rounds.length - 1) {
        slots.push({
          type: `micro_hook_${idx + 1}`,
          duration: 1.0,
          start: currentTime,
          end: currentTime + 1.0,
        });
        currentTime += 1.0;
      }
    });

    // Scorecard & CTA (remaining duration up to 38s)
    const remaining = Math.max(3.0, 38.0 - currentTime);
    slots.push({
      type: 'scorecard',
      duration: remaining,
      start: currentTime,
      end: currentTime + remaining,
    });
    currentTime += remaining;

    return {
      slots,
      totalDuration: Math.round(currentTime),
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
          const roundIdx = parseInt(parts[1], 10);
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
