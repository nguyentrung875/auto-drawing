export interface FingerprintInput {
  mechanicId: string;
  productIds: string[];
  categories: string[];
  hookId: string;
  voiceId: string;
  themeId: string;
  answerId: string;
  difficultyBand: string;
  revealStructure: string;
}

export interface FingerprintBundle {
  exact: string;
  semantic: string;
  createdAt: number;
}
