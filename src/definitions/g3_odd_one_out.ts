import type { GameDefinitionDSL } from '../challenge/types';
import { gameDefinitionSchema } from '../challenge/types';

export const g3Definition: GameDefinitionDSL = {
  id: 'g3_odd_one_out',
  family: 'semantic_outlier',
  name: 'Tìm Kẻ Lạ Trong Bầy',
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
      hookText: 'Tìm KẺ LẠ trong 4 món này trong 5 giây!',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      timerSeconds: 5.0,
      microHook: 'Câu 2 điểm khác biệt tinh vi hơn nhiều!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: Nhìn cứ tưởng cùng loại nhưng...',
    },
  ],
  presentation: {
    layout: 'all_in_one_grid_4',
    actionButtons: ['A', 'B', 'C', 'D'],
  },
};

gameDefinitionSchema.parse(g3Definition);
