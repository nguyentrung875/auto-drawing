export interface HiLoReveal {
  kind: 'HI_LO';
  priceA: number;
  priceB: number;
  comparison: 'higher' | 'lower';
}

export interface MostExpensiveReveal {
  kind: 'MOST_EXPENSIVE';
  prices: Array<{ productId: string; name: string; price: number }>;
  highestProductId: string;
}

export interface OneAwayReveal {
  kind: 'ONE_AWAY';
  fullPrice: number;
  revealedDigit: number;
  hiddenDigitIndex: number;
}

export interface OddOneOutReveal {
  kind: 'ODD_ONE_OUT';
  oddProductId: string;
  reason: 'category' | 'brand' | 'price_outlier';
  subType?: 'CATEGORY_OUTLIER' | 'PRICE_OUTLIER';
  explanation: string;
}

export interface GuessThePriceReveal {
  kind: 'GUESS_THE_PRICE';
  actualPrice: number;
  correctBracketLabel: string;
}

export interface GroceryBasketReveal {
  kind: 'GROCERY_BASKET';
  budget: number;
  totalBill: number;
  isUnderBudget: boolean;
  itemPrices: Array<{ productId: string; name: string; price: number }>;
}

export interface DealOrScamReveal {
  kind: 'DEAL_OR_SCAM';
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  verdict: 'deal' | 'scam';
  explanation: string;
}

export type AnyRevealPayload =
  | HiLoReveal
  | MostExpensiveReveal
  | OneAwayReveal
  | OddOneOutReveal
  | GuessThePriceReveal
  | GroceryBasketReveal
  | DealOrScamReveal;
