import type {
  GameJson,
  GameMetadata,
  GameContent,
  Product,
  Mechanic,
  ResultVariant,
  SceneConfig,
  Timeline,
  SceneTiming,
  GameAudio,
  SfxCue,
  Gameplay,
  HiLoGameplay,
  MostExpensiveGameplay,
  OneAwayGameplay,
  OddOneOutGameplay,
  GuessThePriceGameplay,
  GroceryBasketGameplay,
  DealOrScamGameplay,
} from "@/types/game";
import { getProductById, getProductsByIds } from "./products-data";
import { createRng } from "./seedrandom";

// ── Price formatter ───────────────────────────────────────────────────────────

export function formatVND(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatVNDShort(price: number): string {
  if (price >= 1000000) {
    const m = price / 1000000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M₫`;
  }
  if (price >= 1000) {
    const k = price / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(0)}K₫`;
  }
  return `${price}₫`;
}

// ── ONE_AWAY: masked price display ────────────────────────────────────────────

export function maskPrice(price: number, hiddenIndex: number): string {
  const digits = String(price).replace(/\D/g, "");
  // Format with commas then mask
  const formatted = price.toLocaleString("vi-VN");
  let digitPos = 0;
  return formatted
    .split("")
    .map((ch) => {
      if (/\d/.test(ch)) {
        const isHidden = digitPos === hiddenIndex;
        digitPos++;
        return isHidden ? "?" : ch;
      }
      return ch;
    })
    .join("");
}

// ── Timeline builder ──────────────────────────────────────────────────────────

function buildSceneConfigs(mechanic: Mechanic, resultVariant: ResultVariant): SceneConfig[] {
  if (mechanic === "GUESS_THE_PRICE" || mechanic === "GROCERY_BASKET" || mechanic === "DEAL_OR_SCAM") {
    return [
      { type: "hook", duration: 3.0 },
      { type: "question", duration: 5.0 },
      { type: "countdown", duration: 3.0 },
      { type: "reveal", duration: 2.5 },
      { type: "product", duration: 6.0 },
      { type: "countdown", duration: 3.0 },
      { type: "reveal", duration: 2.5 },
      { type: "question", duration: 5.0 },
      { type: "countdown", duration: 3.0 },
      {
        type: "result",
        duration: 2.5,
        variant: resultVariant,
        answerVisible: resultVariant === "in_video",
      },
      { type: "cta", duration: 2.5 },
    ];
  }
  return [
    { type: "hook", duration: 2.0 },
    { type: "product", duration: 3.0 },
    { type: "question", duration: 3.0 },
    { type: "countdown", duration: 3.0 },
    { type: "reveal", duration: 2.0 },
    {
      type: "result",
      duration: 2.5,
      variant: resultVariant,
      answerVisible: resultVariant === "in_video",
    },
    { type: "cta", duration: 2.5 },
  ];
}

function buildTimeline(scenes: SceneConfig[]): Timeline {
  let cursor = 0;
  const sceneTimings: SceneTiming[] = scenes.map((s) => {
    const timing: SceneTiming = {
      type: s.type,
      startAt: cursor,
      endAt: cursor + s.duration,
      duration: s.duration,
    };
    cursor += s.duration;
    return timing;
  });
  return {
    totalDuration: cursor,
    sceneTimings,
  };
}

// ── SFX builder ───────────────────────────────────────────────────────────────

function buildSfx(timeline: Timeline): SfxCue[] {
  const sfx: SfxCue[] = [];
  const countdownTiming = timeline.sceneTimings.find((s) => s.type === "countdown");
  const revealTiming = timeline.sceneTimings.find((s) => s.type === "reveal");

  if (countdownTiming) {
    // Tick every 0.5s during countdown
    for (let t = 0; t < countdownTiming.duration; t += 0.5) {
      sfx.push({ type: "tick", at: parseFloat((countdownTiming.startAt + t).toFixed(2)) });
    }
    sfx.push({ type: "countdown", at: countdownTiming.startAt });
  }
  if (revealTiming) {
    sfx.push({ type: "reveal", at: revealTiming.startAt });
    sfx.push({ type: "correct", at: revealTiming.startAt + 0.5 });
  }
  // Transition at hook end
  sfx.push({ type: "transition", at: 1.8 });

  return sfx.sort((a, b) => a.at - b.at);
}

// ── Gameplay computers ────────────────────────────────────────────────────────

function computeHiLoGameplay(
  entities: Product[],
  rng: ReturnType<typeof createRng>
): HiLoGameplay {
  const [pA, pB] = entities;
  return {
    mechanic: "HI_LO",
    priceA: pA.price,
    priceB: pB.price,
    answer: pB.price > pA.price ? "higher" : "lower",
  };
}

function computeMostExpensiveGameplay(
  entities: Product[],
): MostExpensiveGameplay {
  const maxPrice = Math.max(...entities.map((e) => e.price));
  const winner = entities.find((e) => e.price === maxPrice)!;
  return {
    mechanic: "MOST_EXPENSIVE",
    productIds: entities.map((e) => e.productId),
    answer: winner.productId,
  };
}

function computeOneAwayGameplay(
  entity: Product,
  rng: ReturnType<typeof createRng>
): OneAwayGameplay {
  const priceStr = String(entity.price).replace(/\D/g, "");
  // Pick a non-zero, non-leading digit position
  const validIndices = priceStr
    .split("")
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => i > 0 && d !== "0")
    .map(({ i }) => i);
  const hiddenIndex = validIndices.length > 0
    ? rng.pick(validIndices)
    : rng.nextInt(1, priceStr.length - 1);
  const correctDigit = parseInt(priceStr[hiddenIndex], 10);
  const wrongDigit = correctDigit === 9 ? 8 : correctDigit + 1;
  const options: [number, number] = rng.next() > 0.5
    ? [correctDigit, wrongDigit]
    : [wrongDigit, correctDigit];

  return {
    mechanic: "ONE_AWAY",
    productId: entity.productId,
    price: entity.price,
    hiddenIndex,
    correctDigit,
    options,
  };
}

function computeOddOneOutGameplay(
  entities: Product[],
  rng: ReturnType<typeof createRng>
): OddOneOutGameplay {
  const categories = entities.map((e) => e.category);
  const counts = new Map<string, number>();
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const outlierCategory = [...counts.entries()].find(([, count]) => count === 1)?.[0];
  let answerProduct = outlierCategory
    ? entities.find((e) => e.category === outlierCategory)
    : entities[rng.nextInt(0, entities.length - 1)];
  if (!answerProduct) answerProduct = entities[0];

  return {
    mechanic: "ODD_ONE_OUT",
    productIds: entities.map((e) => e.productId),
    answer: answerProduct.productId,
    reason: `Khác biệt với các sản phẩm còn lại!`,
  };
}

function computeGuessThePriceGameplay(
  entity: Product,
  rng: ReturnType<typeof createRng>
): GuessThePriceGameplay {
  const isA = rng.next() > 0.5;
  const ratio = 2.5;
  const lowerBracket = `${formatVNDShort(Math.round(entity.price / ratio))} - ${formatVNDShort(entity.price)}`;
  const upperBracket = `${formatVNDShort(entity.price)} - ${formatVNDShort(Math.round(entity.price * ratio))}`;
  const choiceA = isA ? lowerBracket : upperBracket;
  const choiceB = isA ? upperBracket : lowerBracket;
  return {
    mechanic: "GUESS_THE_PRICE",
    productId: entity.productId,
    price: entity.price,
    answer: isA ? "A" : "B",
    choices: [`[A] ${choiceA}`, `[B] ${choiceB}`],
  };
}

function computeGroceryBasketGameplay(
  entities: Product[],
  budget = 300000
): GroceryBasketGameplay {
  const totalBill = entities.reduce((sum, e) => sum + e.price, 0);
  const answer = totalBill <= budget ? "under" : "over";
  return {
    mechanic: "GROCERY_BASKET",
    productIds: entities.map((e) => e.productId),
    budget,
    totalBill,
    answer,
    choices: ["ĐỦ TIỀN (DƯỚI BUDGET)", "CHÁY TÚI (TRÊN BUDGET)"],
  };
}

function computeDealOrScamGameplay(
  entity: Product,
  rng: ReturnType<typeof createRng>
): DealOrScamGameplay {
  const isDeal = rng.next() > 0.5;
  const discountPercent = isDeal ? rng.nextInt(15, 40) : rng.nextInt(80, 95);
  const originalPrice = Math.max(
    entity.price + 10000,
    Math.round(entity.price / (1 - discountPercent / 100) / 1000) * 1000
  );
  const answer = isDeal ? "deal" : "scam";
  return {
    mechanic: "DEAL_OR_SCAM",
    productId: entity.productId,
    originalPrice,
    salePrice: entity.price,
    discountPercent,
    answer,
    choices: ["DEAL HỜI MÚC NGAY", "BẪY SALE ẢO / SCAM"],
  };
}

// ── Content templates ─────────────────────────────────────────────────────────

function buildContent(
  mechanic: Mechanic,
  entities: Product[],
  gameplay: Gameplay,
  rng: ReturnType<typeof createRng>
): GameContent {
  const hooks: Record<Mechanic, string[]> = {
    HI_LO: [
      `🔥 Bạn có dám đoán không?`,
      `💸 Ai biết giá thật sự?`,
      `🤔 Thách thức độ nhạy giá của bạn!`,
      `🎯 Đoán đúng = bạn đỉnh quá!`,
    ],
    MOST_EXPENSIVE: [
      `💎 Cái nào đắt nhất? Bạn biết không?`,
      `🤑 Loại nào ngốn tiền nhất nào?`,
      `🎯 Thử thách kiến thức giá của bạn!`,
      `💸 Ai mà biết cái này đắt vậy?`,
    ],
    ONE_AWAY: [
      `🔢 Bạn có đoán được con số bí ẩn không?`,
      `🎯 Một chữ số thôi — đoán thử đi!`,
      `🤔 Giá thật sự là bao nhiêu?`,
      `💡 Điền vào chỗ trống và thắng!`,
    ],
    ODD_ONE_OUT: [
      `🔍 Tìm kẻ lạ trong bầy! Bạn có tinh mắt không?`,
      `🎯 Có một món đồ khác biệt hoàn toàn!`,
      `🤔 Sản phẩm nào không cùng hội cùng thuyền?`,
      `⚡ 5 giây để tìm ra kẻ lạc loài!`,
    ],
    GUESS_THE_PRICE: [
      `🎯 5 Giây Đoán Giá! Đoán trúng nhận deal hời!`,
      `💸 29K hay 299K? Đoán trúng ngay trong 3 giây!`,
      `🤔 Bạn có biết giá thật của sản phẩm này?`,
      `⚡ Thử thách độ nhạy giá: Liệu bạn đoán đúng?`,
    ],
    GROCERY_BASKET: [
      `🛒 Cầm 300K đi siêu thị mua 3 món này: ĐỦ hay THIẾU?`,
      `💸 3 món này liệu có vượt ngân sách không?`,
      `🛍️ Thử thách đi chợ: Cháy túi hay còn dư tiền?`,
      `🎯 Đố bạn cộng nhẩm tiền 3 món siêu thị này!`,
    ],
    DEAL_OR_SCAM: [
      `🏷️ Giảm giá 90%! Kèo thơm múc ngay hay cú lừa thế kỷ?`,
      `🕵️ Giảm giá sốc thế này: Deal hời hay bẫy ảo?`,
      `⚠️ Cảnh báo sale ảo! Bạn có phân biệt được không?`,
      `💥 Giá rẻ bất ngờ: Múc liền hay cẩn thận scam?`,
    ],
  };

  const questions: Record<Mechanic, string> = {
    HI_LO: `Sản phẩm B CAO HƠN hay THẤP HƠN Sản phẩm A?`,
    MOST_EXPENSIVE: `Sản phẩm nào ĐẮT NHẤT trong số này?`,
    ONE_AWAY: `Điền chữ số còn thiếu vào giá sản phẩm này!`,
    ODD_ONE_OUT: `Tìm sản phẩm KHÁC BIỆT nhất trong 4 món sau!`,
    GUESS_THE_PRICE: `Giá của sản phẩm này nằm trong khoảng nào?`,
    GROCERY_BASKET: `Tổng bill 3 món này ĐỦ TIỀN hay CHÁY TÚI với ngân sách 300.000₫?`,
    DEAL_OR_SCAM: `Sản phẩm này giảm sốc: KÈO THƠM MÚC NGAY hay BẪY SALE ẢO?`,
  };

  const ctas = [
    `💬 Comment đáp án của bạn bên dưới!`,
    `🔔 Follow để không bỏ lỡ deal hot!`,
    `❤️ Like nếu bạn đoán đúng!`,
    `📌 Save để mua ngay hôm nay!`,
  ];

  const hashtags = [
    "#đoángiá",
    "#tiktokviral",
    "#dealhot",
    "#mua_sắm",
    "#affiliate",
    "#game_giá",
    `#${entities[0].category.replace(/\s/g, "_")}`,
    `#${entities[0].brand.replace(/\s/g, "_")}`,
  ];

  const voiceScripts: Record<Mechanic, string> = {
    HI_LO: `Sản phẩm B ${(gameplay as HiLoGameplay).answer === "higher" ? "cao hơn" : "thấp hơn"} sản phẩm A! Đáp án là ${formatVNDShort((gameplay as HiLoGameplay).priceB)}!`,
    MOST_EXPENSIVE: `Đáp án là ${entities.find((e) => e.productId === (gameplay as MostExpensiveGameplay).answer)?.name}!`,
    ONE_AWAY: `Chữ số bí ẩn là ${(gameplay as OneAwayGameplay).correctDigit}!`,
    ODD_ONE_OUT: `Kẻ lạ trong bầy chính là ${entities.find((e) => e.productId === (gameplay as OddOneOutGameplay).answer)?.name}!`,
    GUESS_THE_PRICE: `Giá sản phẩm này là bao nhiêu? ${(gameplay as GuessThePriceGameplay).choices?.join(" hay ") ?? ""}? Đáp án là ${(gameplay as GuessThePriceGameplay).answer}!`,
    GROCERY_BASKET: `Tổng bill 3 món này là ${formatVND((gameplay as GroceryBasketGameplay).totalBill || 0)}, ngân sách ${formatVND((gameplay as GroceryBasketGameplay).budget || 300000)}. Đáp án là ${(gameplay as GroceryBasketGameplay).answer === "under" ? "ĐỦ TIỀN" : "CHÁY TÚI"}!`,
    DEAL_OR_SCAM: `Giá gốc ${formatVND((gameplay as DealOrScamGameplay).originalPrice || 0)}, sale còn ${formatVND((gameplay as DealOrScamGameplay).salePrice || 0)}. Đáp án là ${(gameplay as DealOrScamGameplay).answer === "deal" ? "DEAL HỜI" : "CÚ LỪA SCAM"}!`,
  };

  let resolvedChoices: string[] = [];
  if (mechanic === "HI_LO") {
    resolvedChoices = ["CAO HƠN ⬆️", "THẤP HƠN ⬇️"];
  } else if (mechanic === "GUESS_THE_PRICE") {
    resolvedChoices = (gameplay as GuessThePriceGameplay).choices || [];
  } else if (mechanic === "GROCERY_BASKET") {
    resolvedChoices = (gameplay as GroceryBasketGameplay).choices || [];
  } else if (mechanic === "DEAL_OR_SCAM") {
    resolvedChoices = (gameplay as DealOrScamGameplay).choices || [];
  }

  return {
    title: `Quiz Giá — ${entities[0].name}`,
    hook: rng.pick(hooks[mechanic]),
    question: questions[mechanic],
    choices: resolvedChoices,
    cta: rng.pick(ctas),
    caption: `${rng.pick(hooks[mechanic])} ${questions[mechanic]}\n${rng.pick(ctas)}`,
    hashtags,
    voiceScript: voiceScripts[mechanic],
  };
}

// ── Main Game Engine ──────────────────────────────────────────────────────────

export interface BuildGameOptions {
  mechanic: Mechanic;
  productIds: string[];
  seed: number;
  resultVariant?: ResultVariant;
  gameId?: string;
}

export function buildGame(options: BuildGameOptions): {
  game: GameJson;
  warnings: string[];
} {
  const {
    mechanic,
    productIds,
    seed,
    resultVariant = "in_video",
    gameId,
  } = options;

  const rng = createRng(seed);
  const warnings: string[] = [];

  // Resolve entities from ProductProvider
  const entities = getProductsByIds(productIds);
  for (const pid of productIds) {
    const found = getProductById(pid);
    if (!found) {
      throw new Error(`E_PRICE_SOURCE_INVALID: Product ${pid} not found in ProductProvider`);
    }
  }

  // Validate affiliate links
  for (const entity of entities) {
    if (!entity.affiliateLink) {
      warnings.push(`W_AFFILIATE_MISSING: Product ${entity.productId} has no affiliate_link`);
    }
  }

  // Compute gameplay (deterministic from seed)
  let gameplay: Gameplay;
  if (mechanic === "HI_LO") {
    if (entities.length < 2) throw new Error("HI_LO requires 2 products");
    const delta = Math.abs(entities[1].price - entities[0].price) / entities[0].price;
    if (delta < 0.05) throw new Error(`E_HILO_EQUAL_PRICE: delta ${(delta * 100).toFixed(1)}% < 5%`);
    gameplay = computeHiLoGameplay(entities, rng);
  } else if (mechanic === "MOST_EXPENSIVE") {
    if (entities.length < 3 || entities.length > 4) {
      throw new Error("MOST_EXPENSIVE requires 3-4 products");
    }
    gameplay = computeMostExpensiveGameplay(entities);
  } else if (mechanic === "ODD_ONE_OUT") {
    if (entities.length !== 4) {
      throw new Error("ODD_ONE_OUT requires 4 products");
    }
    gameplay = computeOddOneOutGameplay(entities, rng);
  } else if (mechanic === "GUESS_THE_PRICE") {
    if (entities.length < 1) throw new Error("GUESS_THE_PRICE requires 1 product");
    gameplay = computeGuessThePriceGameplay(entities[0], rng);
  } else if (mechanic === "GROCERY_BASKET") {
    if (entities.length !== 3) throw new Error("GROCERY_BASKET requires exactly 3 products");
    gameplay = computeGroceryBasketGameplay(entities);
  } else if (mechanic === "DEAL_OR_SCAM") {
    if (entities.length < 1) throw new Error("DEAL_OR_SCAM requires 1 product");
    gameplay = computeDealOrScamGameplay(entities[0], rng);
  } else {
    if (entities.length < 1) throw new Error("ONE_AWAY requires 1 product");
    gameplay = computeOneAwayGameplay(entities[0], rng);
  }

  // Build scene configs
  const scenes = buildSceneConfigs(mechanic, resultVariant);
  const timeline = buildTimeline(scenes);
  const sfx = buildSfx(timeline);

  // Build content (LLM-simulated, no prices)
  const content = buildContent(mechanic, entities, gameplay, rng);

  // Build audio
  const revealTiming = timeline.sceneTimings.find((s) => s.type === "reveal")!;
  const audio: GameAudio = {
    voice: {
      script: content.voiceScript,
      wavPath: `temp/${gameId || "game"}/voice.wav`,
      duration: 2.0,
    },
    music: {
      track: "tension_01",
      volume: 0.18,
    },
    sfx,
  };

  // Build metadata
  const finalGameId =
    gameId || `game_${mechanic.toLowerCase()}_${seed}_${Date.now()}`;
  const metadata: GameMetadata = {
    gameId: finalGameId,
    mechanic,
    language: "vi-VN",
    difficulty: "medium",
    seed,
    resultVariant,
  };

  // Build publishing
  const publishing = {
    caption: content.caption,
    hashtags: content.hashtags,
    affiliateLink: entities[0]?.affiliateLink || "",
    outputPath: `export/${finalGameId}_${seed}.mp4`,
  };

  const game: GameJson = {
    metadata,
    content,
    entities,
    gameplay,
    scenes,
    timeline,
    audio,
    publishing,
  };

  return { game, warnings };
}

// ── Diversification: seed-based color/tilt variants ───────────────────────────

export interface GameTheme {
  bgColor: string;
  accentColor: string;
  tiltDeg: number;
  fontVariant: string;
}

const BG_COLORS = [
  "#FFFBF0", "#F0F4FF", "#F0FFF4", "#FFF0F0", "#F5F0FF",
  "#FFFFF0", "#F0FFFF", "#FFF5F0", "#F0F0FF", "#FFFFE0",
];
const ACCENT_COLORS = [
  "#E53E3E", "#3182CE", "#38A169", "#D69E2E", "#805AD5",
  "#DD6B20", "#319795", "#C53030", "#2B6CB0", "#276749",
];
const FONT_VARIANTS = ["bold", "rounded", "compact"];

export function getGameTheme(seed: number): GameTheme {
  const rng = createRng(seed + 9999); // offset to avoid same sequence as gameplay
  return {
    bgColor: rng.pick(BG_COLORS),
    accentColor: rng.pick(ACCENT_COLORS),
    tiltDeg: parseFloat(rng.float(-2, 2).toFixed(2)),
    fontVariant: rng.pick(FONT_VARIANTS),
  };
}
