import type { GameDefinitionDSL } from '../challenge/types';

export const g9Definition: GameDefinitionDSL = {
  id: 'g9_guess_the_price',
  family: 'numeric_single_bracket',
  name: '5 Giây Đoán Giá Sản Phẩm',
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
      bracketRatio: 5.0,
      timerSeconds: 4.0,
      hookText: '29K hay 299K? Đoán trúng ngay trong 3 giây!',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      bracketRatio: 2.2,
      timerSeconds: 5.0,
      microHook: 'Câu 2 bắt đầu xoắn não rồi đây!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: 95% NGƯỜI ĐOÁN SAI BÉT!',
    },
  ],
  presentation: {
    layout: 'all_in_one_single_card',
    actionButtons: ['KHOẢNG GIÁ A', 'KHOẢNG GIÁ B'],
  },
};
