import type { GameDefinitionDSL } from '../challenge/types';

export const g7Definition: GameDefinitionDSL = {
  id: 'g7_grocery_basket',
  family: 'numeric_knapsack',
  name: 'Cầm Tiền Đi Siêu Thị',
  targetDuration: 40.0,
  inputs: {
    countPerRound: 3,
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      budget: 300000,
      deltaBudgetMin: 0.25,
      timerSeconds: 4.0,
      hookText: 'Cầm 300K mua 3 món này: ĐỦ hay THIẾU?',
    },
    {
      round: 2,
      type: 'tension_creator',
      budget: 500000,
      deltaBudgetMax: 0.03,
      timerSeconds: 5.0,
      microHook: 'Câu 2 hóa đơn số lẻ cực gắt!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      budget: 1000000,
      perceptionConflict: true,
      timerSeconds: 5.0,
      microHook: 'Câu 3: Nỗi đau ví tiền khi đi siêu thị là đây!',
    },
  ],
  presentation: {
    layout: 'all_in_one_basket_tray',
    actionButtons: ['ĐỦ TIỀN', 'CHÁY TÚI'],
  },
};
