import type { MechanicId } from '../state/types';

export type HiddenPrice = {
  kind: 'hidden';
  label: '???';
};

export type ReferencePrice = {
  kind: 'reference';
  value: number;
  label: string;
  role: 'anchor_benchmark' | 'original_price';
};

export type QuestionPrice = HiddenPrice | ReferencePrice;

export interface QuestionProductViewModel {
  productId: string;
  name: string;
  image: string;
  brand?: string;
  price: QuestionPrice;
  badgeTag?: string;
}

export interface QuestionChoiceViewModel {
  id: string;           // "A", "B", "C", "D"
  label: string;        // "CAO HƠN ⬆️", "100K - 150K"
}

export interface QuestionRenderModel {
  mechanicId: MechanicId;
  roundIndex: number;
  totalRounds: number;
  questionHeadline: string;
  entities: QuestionProductViewModel[];
  choices: QuestionChoiceViewModel[];
}

export interface RevealRenderModel<TPayload> {
  winningChoiceId: string;
  headlineBanner: string;
  subDetailBanner: string;
  payload: TPayload;
}

export interface PresentationModel<TPayload> {
  question: QuestionRenderModel;
  reveal: RevealRenderModel<TPayload>;
  cta: {
    bannerText: string;
    subText: string;
    variant: 'single_round_challenge' | 'multi_round_scorecard' | 'comment_debate';
  };
}
