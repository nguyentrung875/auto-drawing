import type { GameDefinitionDSL } from '../challenge/types';

export const g41Definition: GameDefinitionDSL = {
  id: 'g41_deal_or_scam',
  family: 'commerce_decision',
  name: 'Kèo Thơm Hay Cú Lừa?',
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
      timerSeconds: 4.0,
      hookText: 'Giảm sốc 90%! Kèo thơm múc ngay hay cú lừa thế kỷ?',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.55,
      timerSeconds: 5.0,
      microHook: 'Câu 2 giảm giá nhìn cực kỳ uy tín nhưng...',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.85,
      minPerceptionConflict: 0.8,
      timerSeconds: 5.0,
      microHook: '⚠️ CÂU CUỐI: 99% THỢ SĂN DEAL BỊ LỪA ĐẸP MẮT!',
    },
  ],
  presentation: {
    layout: 'all_in_one_discount_deck',
    actionButtons: ['DEAL HỜI MÚC NGAY', 'BẪY SALE ẢO / SCAM'],
  },
};
