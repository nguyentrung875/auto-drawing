import type { GameDefinitionDSL } from '../challenge/types';
import { gameDefinitionSchema } from '../challenge/types';

export const g5Definition: GameDefinitionDSL = {
  id: 'g5_one_away',
  family: 'numeric_digit',
  name: 'Đoán Chữ Số Bị Che',
  targetDuration: 38.0,
  inputs: {
    countPerRound: 1,
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      targetDifficulty: 0.2,
      hiddenIndex: 2,
      timerSeconds: 5.0,
      hookText: 'Chữ số bị che là số mấy? 5 giây đoán ngay!',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      hiddenIndex: 1,
      timerSeconds: 5.0,
      microHook: 'Câu 2 chữ số bị giấu ở vị trí hiểm hóc hơn!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      hiddenIndex: 0,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: 90% người đoán nhầm chữ số này!',
    },
  ],
  presentation: {
    layout: 'all_in_one_single_card',
    actionButtons: ['CHỮ SỐ A', 'CHỮ SỐ B'],
  },
};

gameDefinitionSchema.parse(g5Definition);
