// ── Core enums ─────────────────────────────────────────────────────────────

export type Mechanic =
  | "HI_LO"
  | "MOST_EXPENSIVE"
  | "ONE_AWAY"
  | "ODD_ONE_OUT"
  | "GUESS_THE_PRICE"
  | "GROCERY_BASKET"
  | "DEAL_OR_SCAM";
export type Interaction = "BOOLEAN" | "MULTIPLE_CHOICE" | "DIGIT";
export type ResultVariant = "in_video" | "comment";
export type JobStatus = "pending" | "running" | "done" | "failed";

export type SceneType =
  | "hook"
  | "product"
  | "question"
  | "countdown"
  | "reveal"
  | "result"
  | "cta";

export type SfxType =
  | "countdown"
  | "tick"
  | "reveal"
  | "correct"
  | "wrong"
  | "transition";

// ── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  productId: string;
  name: string;
  image: string; // assets/pXXX.webp or URL
  price: number; // VND int
  currency: "VND";
  source: string;
  updatedAt: string; // ISO 8601 UTC
  category: string;
  brand: string;
  affiliateLink: string;
}

// ── Game JSON structure ──────────────────────────────────────────────────────

export interface GameMetadata {
  gameId: string;
  mechanic: Mechanic;
  language: "vi-VN";
  difficulty: "easy" | "medium" | "hard";
  seed: number;
  resultVariant: ResultVariant;
}

export interface GameContent {
  title: string;
  hook: string;
  question: string;
  choices: string[];
  cta: string;
  caption: string;
  hashtags: string[];
  voiceScript: string;
}

export interface SceneConfig {
  type: SceneType;
  duration: number; // seconds
  variant?: ResultVariant;
  answerVisible?: boolean;
}

export interface SceneTiming {
  type: SceneType;
  startAt: number;
  endAt: number;
  duration: number;
}

export interface Timeline {
  totalDuration: number; // 15-21s
  sceneTimings: SceneTiming[];
}

export interface SfxCue {
  type: SfxType;
  at: number; // seconds
}

export interface GameAudio {
  voice: {
    script: string;
    wavPath: string;
    duration: number;
  };
  music: {
    track: string;
    volume: number;
  };
  sfx: SfxCue[];
}

export interface GamePublishing {
  caption: string;
  hashtags: string[];
  affiliateLink: string;
  outputPath: string;
}

// ── Gameplay per mechanic ────────────────────────────────────────────────────

export interface HiLoGameplay {
  mechanic: "HI_LO";
  priceA: number;
  priceB: number;
  answer: "higher" | "lower";
}

export interface MostExpensiveGameplay {
  mechanic: "MOST_EXPENSIVE";
  productIds: string[];
  answer: string; // productId with max price
}

export interface OneAwayGameplay {
  mechanic: "ONE_AWAY";
  productId: string;
  price: number;
  hiddenIndex: number;
  correctDigit: number;
  options: [number, number]; // [correct_digit, wrong_digit]
}

export interface OddOneOutGameplay {
  mechanic: "ODD_ONE_OUT";
  productIds: string[];
  answer: string;
  reason?: string;
}

export interface GuessThePriceGameplay {
  mechanic: "GUESS_THE_PRICE";
  productId: string;
  price: number;
  answer: string;
  choices: string[];
}

export interface GroceryBasketGameplay {
  mechanic: "GROCERY_BASKET";
  productIds: string[];
  budget: number;
  totalBill: number;
  answer: "under" | "over";
  choices: string[];
}

export interface DealOrScamGameplay {
  mechanic: "DEAL_OR_SCAM";
  productId: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  answer: "deal" | "scam";
  choices: string[];
}

export type Gameplay =
  | HiLoGameplay
  | MostExpensiveGameplay
  | OneAwayGameplay
  | OddOneOutGameplay
  | GuessThePriceGameplay
  | GroceryBasketGameplay
  | DealOrScamGameplay;

// ── Full Game JSON ────────────────────────────────────────────────────────────

export interface GameJson {
  metadata: GameMetadata;
  content: GameContent;
  entities: Product[];
  gameplay: Gameplay;
  scenes: SceneConfig[];
  timeline: Timeline;
  audio: GameAudio;
  publishing: GamePublishing;
}

// ── Job / Queue ───────────────────────────────────────────────────────────────

export interface QueueJob {
  jobId: string;
  gameId: string;
  mechanic: Mechanic;
  productIds: string[];
  seed: number;
  resultVariant: ResultVariant;
  status: JobStatus;
  retries: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Batch Report ──────────────────────────────────────────────────────────────

export interface BatchJobReport {
  jobId: string;
  gameId: string;
  status: JobStatus;
  mechanic: Mechanic;
  productIds: string[];
  renderMs?: number;
  errorMessage?: string;
}

export interface BatchReport {
  batchId: string;
  total: number;
  passed: number;
  failed: number;
  avgRenderMs: number;
  manualInterventions: number;
  jobs: BatchJobReport[];
  createdAt: string;
}

// ── Validation error ──────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;
  field?: string;
  hint?: string;
}

export interface AppError {
  code: string;
  field?: string;
  hint?: string;
  cause?: string;
}

// ── Log entry ─────────────────────────────────────────────────────────────────

export interface LogEntry {
  gameId: string;
  jobId?: string;
  seed: number;
  planningMs?: number;
  ttsMs?: number;
  renderMs?: number;
  encodeMs?: number;
  fileSize?: number;
  validatorErrors?: ValidationError[];
}
