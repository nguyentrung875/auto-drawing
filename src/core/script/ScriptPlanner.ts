import type { GameState } from '../state/types';
import type { ScriptPlan, ScriptEvent } from './types';

export class ScriptPlanner {
  static plan(state: GameState<any>, voiceId = 'vi_default'): ScriptPlan {
    const events: ScriptEvent[] = [
      {
        id: 'hook_1',
        type: 'HOOK',
        text: 'Thử thách 5 giây đoán giá!',
        timingOffsetSec: 0,
        maxDurationSec: 2.0,
      },
      {
        id: 'q_1',
        type: 'QUESTION',
        text: 'Đoán xem đáp án là gì?',
        timingOffsetSec: 2.0,
        maxDurationSec: 3.0,
      },
      {
        id: 'rev_1',
        type: 'REVEAL',
        text: 'Kết quả chính xác là!',
        timingOffsetSec: 8.0,
        maxDurationSec: 2.5,
      },
    ];

    return {
      roundIndex: state.roundIndex,
      events,
      voiceId,
    };
  }
}
