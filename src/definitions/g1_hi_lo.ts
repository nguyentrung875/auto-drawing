import type { GameDefinitionDSL } from '../challenge/types';
import { gameDefinitionSchema } from '../challenge/types';

export const g1Definition: GameDefinitionDSL = {
  id: 'g1_hi_lo',
  family: 'numeric_comparison',
  name: 'Đoán Giá Cao Hơn Hay Thấp Hơn',
  targetDuration: 38.0,
  inputs: {
    countPerRound: 2,
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      targetDifficulty: 0.2,
      timerSeconds: 5.0,
      hookText: 'Món B CAO HƠN hay THẤP HƠN món A? Đoán ngay trong 5 giây!',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      timerSeconds: 5.0,
      microHook: 'Câu 2 khoảng cách giá bắt đầu sít sao rồi đây!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: Nhìn tưởng rẻ mà đắt không tưởng!',
    },
  ],
  presentation: {
    layout: 'all_in_one_comparison',
    actionButtons: ['CAO HƠN', 'THẤP HƠN'],
  },
};

gameDefinitionSchema.parse(g1Definition);
