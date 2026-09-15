import type {
  MechanicVoiceRule,
  VisualDependency,
  VoiceCandidate,
  VoiceIntent,
  VoiceTimingConfig,
} from './types';

export interface MechanicVoiceRule {
  mechanic: string;
  allowedIntents: VoiceIntent[];
  intentDistribution: Record<VoiceIntent, number>;
  timing: VoiceTimingConfig;
  visualDependency: VisualDependency;
  staticForbiddenPatterns: RegExp[];
  offlinePool: VoiceCandidate[];
}

export const VOICE_RULEBOOK: Record<string, MechanicVoiceRule> = {
  MOST_EXPENSIVE: {
    mechanic: 'MOST_EXPENSIVE',
    allowedIntents: ['CHALLENGE', 'CURIOSITY', 'URGENCY'],
    intentDistribution: {
      CHALLENGE: 0.7,
      CURIOSITY: 0.2,
      URGENCY: 0.1,
      DECISION: 0.0,
    },
    timing: {
      defaultGapMs: 100,
      minGapMs: 80,
      maxGapMs: 140,
      maxDurationSec: 2.2,
    },
    visualDependency: 'MEDIUM',
    staticForbiddenPatterns: [
      /(đắt nhất là|kết quả là|giá tiền|triệu|nghìn đồng)/i,
    ],
    offlinePool: [
      { id: 'ME_CHALLENGE_01', intent: 'CHALLENGE', script: 'Món nào đắt nhất?' },
      { id: 'ME_CHALLENGE_02', intent: 'CHALLENGE', script: 'Đoán xem món nào đắt nhất?' },
      { id: 'ME_CHALLENGE_03', intent: 'CHALLENGE', script: 'Bạn chọn món nào đắt nhất?' },
      { id: 'ME_CURIOSITY_01', intent: 'CURIOSITY', script: 'Nhìn kỹ kẻo nhầm nhé!' },
      { id: 'ME_URGENCY_01', intent: 'URGENCY', script: 'Chốt đáp án nhanh!' },
    ],
  },

  HI_LO: {
    mechanic: 'HI_LO',
    allowedIntents: ['CHALLENGE', 'DECISION', 'URGENCY'],
    intentDistribution: {
      CHALLENGE: 0.7,
      DECISION: 0.2,
      URGENCY: 0.1,
      CURIOSITY: 0.0,
    },
    timing: {
      defaultGapMs: 90,
      minGapMs: 70,
      maxGapMs: 120,
      maxDurationSec: 1.8,
    },
    visualDependency: 'HIGH',
    staticForbiddenPatterns: [
      /(kết quả là|chắc chắn cao|chắc chắn thấp|\d{3})/i,
    ],
    offlinePool: [
      { id: 'HL_CHALLENGE_01', intent: 'CHALLENGE', script: 'Cao hơn hay thấp hơn?' },
      { id: 'HL_CHALLENGE_02', intent: 'CHALLENGE', script: 'Cao hay thấp?' },
      { id: 'HL_DECISION_01', intent: 'DECISION', script: 'Bạn đoán cao hay thấp?' },
      { id: 'HL_DECISION_02', intent: 'DECISION', script: 'Chọn cao hay thấp nào?' },
      { id: 'HL_URGENCY_01', intent: 'URGENCY', script: 'Cao hay thấp, chọn nhanh!' },
    ],
  },

  ONE_AWAY: {
    mechanic: 'ONE_AWAY',
    allowedIntents: ['CHALLENGE', 'CURIOSITY', 'URGENCY'],
    intentDistribution: {
      CHALLENGE: 0.7,
      CURIOSITY: 0.2,
      URGENCY: 0.1,
      DECISION: 0.0,
    },
    timing: {
      defaultGapMs: 100,
      minGapMs: 80,
      maxGapMs: 130,
      maxDurationSec: 2.0,
    },
    visualDependency: 'HIGH',
    staticForbiddenPatterns: [
      /(số \d là đúng|đáp án là)/i,
    ],
    offlinePool: [
      { id: 'OA_CHALLENGE_01', intent: 'CHALLENGE', script: 'Số nào bị che?' },
      { id: 'OA_CHALLENGE_02', intent: 'CHALLENGE', script: 'Chữ số bị che là mấy?' },
      { id: 'OA_CHALLENGE_03', intent: 'CHALLENGE', script: 'Đoán xem là số mấy?' },
      { id: 'OA_CURIOSITY_01', intent: 'CURIOSITY', script: 'Có một số rất dễ nhầm!' },
      { id: 'OA_URGENCY_01', intent: 'URGENCY', script: 'Chốt số mấy nào!' },
    ],
  },

  ODD_ONE_OUT: {
    mechanic: 'ODD_ONE_OUT',
    allowedIntents: ['CHALLENGE', 'CURIOSITY', 'URGENCY'],
    intentDistribution: {
      CHALLENGE: 0.6,
      CURIOSITY: 0.3,
      URGENCY: 0.1,
      DECISION: 0.0,
    },
    timing: {
      defaultGapMs: 110,
      minGapMs: 90,
      maxGapMs: 150,
      maxDurationSec: 2.0,
    },
    visualDependency: 'HIGH',
    staticForbiddenPatterns: [
      /(món khác là|đáp án|loại bỏ)/i,
    ],
    offlinePool: [
      { id: 'OO_CHALLENGE_01', intent: 'CHALLENGE', script: 'Món nào khác biệt?' },
      { id: 'OO_CHALLENGE_02', intent: 'CHALLENGE', script: 'Đâu là món lạc loài?' },
      { id: 'OO_CURIOSITY_01', intent: 'CURIOSITY', script: 'Tìm ra món khác loài chưa?' },
      { id: 'OO_URGENCY_01', intent: 'URGENCY', script: 'Nhanh, món nào khác biệt?' },
    ],
  },

  GUESS_THE_PRICE: {
    mechanic: 'GUESS_THE_PRICE',
    allowedIntents: ['CHALLENGE', 'DECISION', 'URGENCY'],
    intentDistribution: {
      CHALLENGE: 0.7,
      DECISION: 0.2,
      URGENCY: 0.1,
      CURIOSITY: 0.0,
    },
    timing: {
      defaultGapMs: 100,
      minGapMs: 80,
      maxGapMs: 130,
      maxDurationSec: 2.0,
    },
    visualDependency: 'HIGH',
    staticForbiddenPatterns: [
      /(trên mức quy định là|dưới mức quy định là|đáp án là|kết quả là|chính xác là)/i,
    ],
    offlinePool: [
      { id: 'GP_CHALLENGE_01', intent: 'CHALLENGE', script: 'Trên hay dưới mức giá này?' },
      { id: 'GP_DECISION_01', intent: 'DECISION', script: 'Bạn chọn khoảng giá nào?' },
      { id: 'GP_URGENCY_01', intent: 'URGENCY', script: 'Trên hay dưới, chốt nhanh!' },
      { id: 'GP_CHALLENGE_02', intent: 'CHALLENGE', script: 'Đoán xem trên hay dưới?' },
    ],
  },

  GROCERY_BASKET: {
    mechanic: 'GROCERY_BASKET',
    allowedIntents: ['CHALLENGE', 'DECISION', 'URGENCY'],
    intentDistribution: {
      CHALLENGE: 0.7,
      DECISION: 0.2,
      URGENCY: 0.1,
      CURIOSITY: 0.0,
    },
    timing: {
      defaultGapMs: 100,
      minGapMs: 80,
      maxGapMs: 130,
      maxDurationSec: 2.0,
    },
    visualDependency: 'HIGH',
    staticForbiddenPatterns: [
      /(tổng cộng là|cháy túi rồi|thừa tiền)/i,
    ],
    offlinePool: [
      { id: 'GB_CHALLENGE_01', intent: 'CHALLENGE', script: 'Ngân sách này đủ mua không?' },
      { id: 'GB_CHALLENGE_02', intent: 'CHALLENGE', script: 'Liệu có đủ tiền mua?' },
      { id: 'GB_DECISION_01', intent: 'DECISION', script: 'Đủ tiền hay cháy túi?' },
      { id: 'GB_URGENCY_01', intent: 'URGENCY', script: 'Đủ hay thiếu, chốt đi!' },
    ],
  },

  DEAL_OR_SCAM: {
    mechanic: 'DEAL_OR_SCAM',
    allowedIntents: ['CHALLENGE', 'DECISION', 'CURIOSITY'],
    intentDistribution: {
      CHALLENGE: 0.65,
      DECISION: 0.2,
      CURIOSITY: 0.15,
      URGENCY: 0.0,
    },
    timing: {
      defaultGapMs: 120,
      minGapMs: 90,
      maxGapMs: 160,
      maxDurationSec: 2.2,
    },
    visualDependency: 'MEDIUM',
    staticForbiddenPatterns: [
      /(chắc chắn là scam|deal hời múc đi|lừa đảo đấy)/i,
    ],
    offlinePool: [
      { id: 'DS_CHALLENGE_01', intent: 'CHALLENGE', script: 'Kèo thơm hay cú lừa?' },
      { id: 'DS_CHALLENGE_02', intent: 'CHALLENGE', script: 'Deal hời hay bẫy giá ảo?' },
      { id: 'DS_CURIOSITY_01', intent: 'CURIOSITY', script: 'Coi chừng bị lừa đấy!' },
      { id: 'DS_DECISION_01', intent: 'DECISION', script: 'Múc ngay hay né gấp?' },
    ],
  },
};
