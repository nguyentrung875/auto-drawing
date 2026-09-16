import type { GameDefinitionDSL } from '../challenge/types';
import { gameDefinitionSchema } from '../challenge/types';

export const g2Definition: GameDefinitionDSL = {
  id: 'g2_most_expensive',
  family: 'multiple_choice_max',
  name: 'Món Nào Đắt Nhất?',
  targetDuration: 38.0,
  inputs: {
    countPerRound: 4,
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      targetDifficulty: 0.2,
      timerSeconds: 5.0,
      hookText: 'Trong 4 món này, món nào ĐẮT NHẤT? 5 giây bắt đầu!',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      timerSeconds: 5.0,
      microHook: 'Câu 2 mức giá giữa các món cực kỳ suýt soát!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: Món nhỏ hạt tiêu nhưng giá trên trời!',
    },
  ],
  presentation: {
    layout: 'all_in_one_grid_4',
    actionButtons: ['A', 'B', 'C', 'D'],
  },
};

gameDefinitionSchema.parse(g2Definition);
