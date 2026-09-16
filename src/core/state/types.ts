export type MechanicId = string;

export interface GlobalDifficulty {
  priceProximity: number;   // 0.0 (xa) -> 1.0 (sát nút)
  familiarity: number;      // 0.0 (hiếm lạ) -> 1.0 (phổ thông)
  visualDeception: number;  // 0.0 (trực quan) -> 1.0 (xung đột nhận thức cực độ)
}

export interface DifficultyProfile {
  global: GlobalDifficulty;
  mechanicData?: Record<string, number | string>;
}

export interface RawEntity {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  brand?: string;
  category: string;
}

export interface ChoiceState {
  id: string;              // "A", "B", "C", "D"
  label: string;           // "higher", "scam", "bracket_1"
  value?: unknown;
}

export interface GameState<TRevealPayload = unknown> {
  gameId: string;
  mechanicId: MechanicId;
  seed: number;
  roundIndex: number;
  totalRounds: number;
  entities: RawEntity[];
  choices: ChoiceState[];
  answer: {
    winningChoiceId: string;
    revealPayload: TRevealPayload;
  };
  difficulty: DifficultyProfile;
  metadata: {
    createdAt: number;
    seriesNumber?: number;
  };
}
