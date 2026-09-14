/**
 * Draws one renderer-neutral scene `Frame` onto a `Canvas`.
 *
 * The painter is the visual contract for Epic 3's frames: it reads the elements
 * each scene emits (`badge`, `text`, `product-cards`, `countdown`,
 * `price-reveal`, `digit-reveal`, `result-badge`, `comment-result`, …) and never
 * invents content. In particular it has no path that draws
 * `publishing.affiliate_link` — the link belongs in `caption.json`/comment
 * (AD-4), and `pixelScan` guards the encoded frames for regressions.
 */
import { Canvas, parseColor } from './canvas';
import { drawImageCover, isRenderableImage, loadPng } from './image';
import type { MultiRoundChallenge, ChallengeRound } from '../challenge/types';
import type { Timeline } from '../types/game';
import type {
  RenderCardView,
  RenderProductView,
  RenderFrame,
  RenderFrameElement,
  RenderGameView,
  RenderSceneDataView,
  RenderWarning,
} from './types';

export interface AllInOneSceneLike {
  readonly challenge: MultiRoundChallenge;
  getTimeline(): Timeline;
  getCurrentRound?(timeSeconds: number): {
    round: ChallengeRound;
    phase: 'play' | 'reveal';
    phaseTime: number;
  } | null;
}

export interface PaintContext {
  game: RenderGameView;
  /** Product rows backing the answer labels (productId → display name). */
  products?: RenderProductView[];
  sceneData?: RenderSceneDataView;
  diversification: { bgColor: string; tilt: number; bgm: string };
  variant: 'in_video' | 'comment';
  rootDir: string;
  tilt: boolean;
  warnings: RenderWarning[];
}

const INK = '#f8fafc';
const MUTED = 'rgba(248,250,252,0.68)';
const CARD_BG = '#161d2e';
const CARD_BORDER = 'rgba(248,250,252,0.16)';
const ACCENT = '#fbbf24';
const DANGER = '#fb7185';
const STAGE_WIDTH = 1080;
/**
 * Top of the reveal answer band. Mirrors `REVEAL_TEXT_BAND_TOP` in
 * `src/scene/scenes.ts` — the Scene System compacts the cards above this line
 * and the painter never draws the answer above it, so the two agree without
 * `render` importing `scene` (AD-1 forbids that edge).
 */
const REVEAL_TEXT_BAND_TOP = 1240;

function shade(color: string, factor: number): string {
  const { r, g, b } = parseColor(color);
  const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value * factor)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function element(frame: RenderFrame, kind: string): RenderFrameElement | undefined {
  return frame.elements.find((candidate) => candidate.kind === kind);
}

function textOf(frame: RenderFrame, kind: string, fallback = ''): string {
  const found = element(frame, kind);
  if (!found) return fallback;
  if (typeof found.text === 'string') return found.text;
  if (found.value !== undefined) return String(found.value);
  return fallback;
}

/**
 * Presentation labels for Engine answers: the Engine stores machine values
 * (`higher`, `p003`, `7`) because they are the contract for validation and
 * grading; a video shows the localised wording.
 */
const ANSWER_LABELS: Record<string, string> = {
  higher: 'CAO HƠN',
  lower: 'THẤP HƠN',
};

function answerLabel(answer: string, ctx: PaintContext): string {
  const mapped = ANSWER_LABELS[answer.toLowerCase()];
  if (mapped) return mapped;
  const product = ctx.products?.find((candidate) => candidate.productId === answer);
  if (product) return product.name;
  return answer;
}

function cardsOf(frame: RenderFrame, ctx: PaintContext): RenderCardView[] {
  const fromData = frame.data.cards;
  if (Array.isArray(fromData) && fromData.length > 0) return fromData as RenderCardView[];
  return ctx.sceneData?.cards ?? [];
}

function drawBadge(canvas: Canvas, label: string, accent: string, y = 190): void {
  const measured = canvas.text.layout(label, { size: 34, weight: 700, letterSpacing: 4 });
  const width = measured.textWidth + 96;
  const x = Math.round((STAGE_WIDTH - width) / 2);
  canvas.fillRoundRect(x, y, width, 84, 42, accent, 0.18);
  canvas.strokeRoundRect(x, y, width, 84, 42, accent, 3, 0.5);
  canvas.drawText(label, {
    x: Math.round((STAGE_WIDTH - measured.textWidth) / 2),
    y: y + Math.round((84 - 34 * 1.25) / 2),
    size: 34,
    weight: 700,
    letterSpacing: 4,
    color: accent,
  });
}

function drawProductCard(canvas: Canvas, card: RenderCardView, ctx: PaintContext): void {
  const tilt = ctx.tilt ? ctx.diversification.tilt : 0;
  const radius = 36;
  const corners = { x: card.x, y: card.y, width: card.width, height: card.height };
  // Tilted panels are drawn as polygons so the ±2° diversification is visible.
  canvas.fillTiltedRect(
    corners.x + 8,
    corners.y + 14,
    corners.width,
    corners.height,
    tilt,
    '#000000',
    0.35,
  );
  canvas.fillTiltedRect(corners.x, corners.y, corners.width, corners.height, tilt, CARD_BG, 1);

  if (tilt !== 0) {
    canvas.fillPolygon(
      (function polygon() {
        const points: Array<{ x: number; y: number }> = [];
        const radians = (tilt * Math.PI) / 180;
        const cx = corners.x + corners.width / 2;
        const cy = corners.y + corners.height / 2;
        const local = [
          { x: corners.x, y: corners.y },
          { x: corners.x + corners.width, y: corners.y },
          { x: corners.x + corners.width, y: corners.y + corners.height },
          { x: corners.x, y: corners.y + corners.height },
        ];
        for (const point of local) {
          points.push({
            x: cx + (point.x - cx) * Math.cos(radians) - (point.y - cy) * Math.sin(radians),
            y: cy + (point.x - cx) * Math.sin(radians) + (point.y - cy) * Math.cos(radians),
          });
        }
        return points;
      })(),
      card.highlight ? ACCENT : CARD_BORDER,
      4,
    );
  } else {
    canvas.strokeRoundRect(corners.x, corners.y, corners.width, corners.height, radius, card.highlight ? ACCENT : CARD_BORDER, 4, card.highlight ? 1 : 0.9);
  }

  const imageHeight = Math.round(card.height * 0.58);
  const imageBox = {
    x: card.x + 18,
    y: card.y + 18,
    width: card.width - 36,
    height: imageHeight,
  };
  const imagePath = card.image && card.image.length > 0 ? `${ctx.rootDir}/${card.image}`.replaceAll('//', '/') : undefined;
  const loaded = isRenderableImage(card.image, ctx.rootDir) ? loadPng(imagePath!) : null;
  if (loaded) {
    drawImageCover(canvas, loaded, imageBox, 24);
  } else {
    if (card.image && !ctx.warnings.some((warning) => warning.code === 'W_ASSET_PLACEHOLDER')) {
      ctx.warnings.push({
        code: 'W_ASSET_PLACEHOLDER',
        hint: `product image '${card.image}' is not a decodable PNG; cards are drawn with the deterministic placeholder`,
      });
    }
    canvas.fillRoundRect(
      imageBox.x,
      imageBox.y,
      imageBox.width,
      imageBox.height,
      24,
      shade(ctx.diversification.bgColor, 0.34),
      1,
    );
    canvas.drawText(card.productId.toUpperCase(), {
      x: imageBox.x + Math.round(imageBox.width / 2),
      y: imageBox.y + Math.round(imageBox.height / 2) - 16,
      size: 44,
      weight: 700,
      color: 'rgba(248,250,252,0.82)',
      align: 'center',
      maxWidth: imageBox.width - 24,
    });
  }

  // Card text is laid out proportionally and stacked by measurement: the reveal
  // may hand us a scaled-down card, and fixed offsets made the name and the
  // price land on top of each other once the card got shorter.
  const scale = Math.min(1, card.width / 400, card.height / 560);
  const nameSize = Math.max(20, Math.round(34 * scale));
  const priceSize = Math.max(24, Math.round(44 * scale));
  const nameY = card.y + imageHeight + Math.round(42 * scale);
  const nameBlock = canvas.drawText(card.name, {
    x: card.x + Math.round(card.width / 2),
    y: nameY,
    size: nameSize,
    weight: 600,
    color: INK,
    align: 'center',
    maxWidth: card.width - 40,
    lineHeight: 1.2,
  });
  canvas.drawText(card.priceLabel, {
    x: card.x + Math.round(card.width / 2),
    y: nameY + nameBlock.height + Math.round(18 * scale),
    size: priceSize,
    weight: 700,
    color: card.highlight ? ACCENT : INK,
    align: 'center',
    maxWidth: card.width - 24,
  });
}

function drawCards(canvas: Canvas, frame: RenderFrame, ctx: PaintContext): void {
  for (const card of cardsOf(frame, ctx)) drawProductCard(canvas, card, ctx);
}

function drawChoices(canvas: Canvas, frame: RenderFrame): void {
  const choices = frame.data.choices as Array<{ id: string; label: string }> | undefined;
  if (!choices || choices.length === 0) return;
  const pillWidth = 900;
  const pillHeight = 132;
  const gap = 36;
  const totalHeight = choices.length * pillHeight + (choices.length - 1) * gap;
  let y = 1180 - Math.round(totalHeight / 2) + 120;
  choices.forEach((choice, index) => {
    const x = Math.round((STAGE_WIDTH - pillWidth) / 2);
    canvas.fillRoundRect(x, y, pillWidth, pillHeight, 66, 'rgba(248,250,252,0.10)', 1);
    canvas.strokeRoundRect(x, y, pillWidth, pillHeight, 66, 'rgba(248,250,252,0.22)', 3);
    canvas.fillRoundRect(x + 22, y + 22, 88, 88, 44, ACCENT, 0.9);
    const letter = String.fromCharCode(65 + index);
    canvas.drawText(letter, {
      x: x + 22 + 44,
      y: y + 22 + 18,
      size: 46,
      weight: 700,
      color: '#0b1120',
      align: 'center',
    });
    canvas.drawText(choice.label, {
      x: x + 140,
      y: y + Math.round((pillHeight - 46 * 1.25) / 2),
      size: 46,
      weight: 600,
      color: INK,
      maxWidth: pillWidth - 180,
    });
    y += pillHeight + gap;
  });
}

function drawFrameBadge(canvas: Canvas, frame: RenderFrame, accent: string): void {
  const badge = element(frame, 'badge');
  if (!badge || typeof badge.text !== 'string') return;
  drawBadge(canvas, badge.text, accent);
}

function maskPriceValue(price: number, hiddenIndex: number): string {
  const digits = String(price).split('');
  if (hiddenIndex >= 0 && hiddenIndex < digits.length) {
    digits[hiddenIndex] = '?';
  }
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end).join(''));
  }
  return groups.join(',');
}

export function drawCyberpunkHUD(
  canvas: Canvas,
  options: {
    seed?: number;
    variant?: 'in_video' | 'comment';
    currentRound?: number;
    totalRounds?: number;
    isMultiRound?: boolean;
  },
): void {
  const y = 140;
  const h = 54;

  // 1. Episode badge (Left)
  const episodeNumber = ((options.seed ?? 42) % 99) + 1;
  const episodeLabel = `🔥 TẬP #${episodeNumber}`;
  const epMeasured = canvas.text.layout(episodeLabel, { size: 22, weight: 800 });
  const epW = epMeasured.textWidth + 36;
  const epX = 70;
  canvas.fillRoundRect(epX, y, epW, h, 27, '#0f172a', 0.95);
  canvas.strokeRoundRect(epX, y, epW, h, 27, 'rgba(251,191,36,0.4)', 2);
  canvas.drawText(episodeLabel, {
    x: epX + 18,
    y: y + Math.round((h - 22 * 1.25) / 2),
    size: 22,
    weight: 800,
    color: ACCENT,
  });

  // 2. Center badge (5 Giây / Round progress)
  const midW = 280;
  const midX = Math.round((STAGE_WIDTH - midW) / 2);
  canvas.fillRoundRect(midX, y, midW, h, 27, '#0f172a', 0.95);
  canvas.strokeRoundRect(midX, y, midW, h, 27, 'rgba(248,250,252,0.15)', 2);

  const midLabel = options.isMultiRound
    ? `CÂU ${options.currentRound ?? 1}/${options.totalRounds ?? 3}`
    : `5 GIÂY`;
  const midMeasured = canvas.text.layout(midLabel, { size: 22, weight: 800 });
  canvas.drawText(midLabel, {
    x: midX + 24,
    y: y + Math.round((h - 22 * 1.25) / 2),
    size: 22,
    weight: 800,
    color: INK,
  });

  const dotStartX = midX + 24 + midMeasured.textWidth + 24;
  for (let i = 0; i < 3; i += 1) {
    const dotX = dotStartX + i * 22;
    const dotColor = i === 0 ? ACCENT : 'rgba(248,250,252,0.3)';
    canvas.fillRoundRect(dotX, y + 21, 12, 12, 6, dotColor, 1);
  }

  // 3. Variant badge (Right)
  const variantLabel = options.variant === 'comment' ? '💬 Comment' : '📺 Video';
  const vMeasured = canvas.text.layout(variantLabel, { size: 22, weight: 700 });
  const vW = vMeasured.textWidth + 36;
  const vX = STAGE_WIDTH - 70 - vW;
  const isComment = options.variant === 'comment';
  canvas.fillRoundRect(vX, y, vW, h, 27, isComment ? 'rgba(76,29,149,0.85)' : 'rgba(15,23,42,0.95)', 1);
  canvas.strokeRoundRect(vX, y, vW, h, 27, isComment ? '#a855f7' : '#38bdf8', 2);
  canvas.drawText(variantLabel, {
    x: vX + 18,
    y: y + Math.round((h - 22 * 1.25) / 2),
    size: 22,
    weight: 700,
    color: isComment ? '#d8b4fe' : '#7dd3fc',
  });
}

export function drawCyberpunkQuestionBox(
  canvas: Canvas,
  question: string,
  startY = 224,
): { bottomY: number } {
  const boxX = 70;
  const boxW = 940;
  const boxH = 124;

  canvas.fillRoundRect(boxX, startY, boxW, boxH, 24, '#0f172a', 0.96);
  canvas.strokeRoundRect(boxX, startY, boxW, boxH, 24, 'rgba(251,191,36,0.7)', 3);

  const tag = 'THỬ THÁCH GIÁ ĐÚNG';
  const tagM = canvas.text.layout(tag, { size: 18, weight: 800, letterSpacing: 2 });
  canvas.drawText(tag, {
    x: Math.round((STAGE_WIDTH - tagM.textWidth) / 2),
    y: startY + 12,
    size: 18,
    weight: 800,
    letterSpacing: 2,
    color: ACCENT,
  });

  const isLong = question.length > 40;
  const qSize = isLong ? 26 : 30;
  const qY = isLong ? startY + 44 : startY + 48;

  canvas.drawText(question, {
    x: Math.round(STAGE_WIDTH / 2),
    y: qY,
    size: qSize,
    weight: 700,
    color: INK,
    align: 'center',
    maxWidth: boxW - 40,
    lineHeight: 1.15,
  });

  return { bottomY: startY + boxH };
}

export function getChoicesForRenderGame(
  game: RenderGameView,
  ctx?: PaintContext,
  frame?: RenderFrame,
): {
  choices: Array<{ id: string; label: string; isCorrect: boolean }>;
  revealAnswerText: string;
  correctChoiceId?: string;
  benchmarkLabel?: string;
  maskedPrice?: string;
  resolvedPrice?: string;
  discountTag?: string;
  originalPriceLabel?: string;
  salePriceLabel?: string;
  budgetLabel?: string;
} {
  const m = String(game.metadata.mechanic).toUpperCase();
  const gp = (game.gameplay ?? {}) as Record<string, unknown>;
  const rawEntities = game.entities ?? [];
  const cards = frame && ctx ? cardsOf(frame, ctx) : ctx?.sceneData?.cards ?? [];
  const entities = rawEntities.map((e) => {
    const prod =
      ctx?.products?.find((p) => p.productId === e.productId) ??
      cards.find((c) => c.productId === e.productId);
    const priceVal =
      typeof (prod as any)?.price === 'number'
        ? (prod as any).price
        : (prod as any)?.priceLabel
        ? Number(String((prod as any).priceLabel).replace(/\D/g, ''))
        : 0;
    return {
      productId: e.productId,
      name: prod?.name ?? e.productId,
      price: priceVal,
      brand: (prod as any)?.brand,
      image: prod?.image,
    };
  });
  const first = entities[0];

  if (m === 'HI_LO') {
    const isHigher = String(gp.answer ?? '').toLowerCase() === 'higher';
    const priceA = Number(gp.priceA ?? first?.price ?? 0);
    const priceB = Number(gp.priceB ?? entities[1]?.price ?? 0);
    const correctChoiceId = isHigher ? 'A' : 'B';
    return {
      choices: [
        { id: 'A', label: 'CAO HƠN ⬆️', isCorrect: isHigher },
        { id: 'B', label: 'THẤP HƠN ⬇️', isCorrect: !isHigher },
      ],
      revealAnswerText: isHigher
        ? `CAO HƠN! Giá thật: ${priceB > 0 ? priceB.toLocaleString('vi-VN') + 'đ' : ''}`
        : `THẤP HƠN! Giá thật: ${priceB > 0 ? priceB.toLocaleString('vi-VN') + 'đ' : ''}`,
      correctChoiceId,
      benchmarkLabel: priceA > 0 ? `Mốc so sánh: ${priceA.toLocaleString('vi-VN')}đ` : undefined,
    };
  }

  if (m === 'DEAL_OR_SCAM') {
    const isDeal = String(gp.answer ?? '').toLowerCase() === 'deal';
    const originalPrice = Number(gp.originalPrice ?? (first?.price ? first.price * 2 : 500000));
    const salePrice = Number(gp.salePrice ?? first?.price ?? 150000);
    const discount = Number(gp.discountPercent ?? 85);
    const correctChoiceId = isDeal ? 'A' : 'B';
    return {
      choices: [
        { id: 'A', label: 'DEAL HỜI 🔥', isCorrect: isDeal },
        { id: 'B', label: 'BẪY SCAM ⚠️', isCorrect: !isDeal },
      ],
      revealAnswerText: isDeal ? 'DEAL HỜI! Sale chính hãng uy tín!' : 'BẪY SCAM! Shop ảo clone hàng!',
      correctChoiceId,
      discountTag: `🔥 SALE -${discount}%`,
      originalPriceLabel: `Giá gốc: ${originalPrice.toLocaleString('vi-VN')}đ`,
      salePriceLabel: `Giá sale: ${salePrice.toLocaleString('vi-VN')}đ`,
    };
  }

  if (m === 'GROCERY_BASKET') {
    const isUnder = String(gp.answer ?? '').toLowerCase() === 'under';
    const budget = Number(gp.budget ?? 300000);
    const totalBill = Number(gp.totalBill ?? 0);
    const correctChoiceId = isUnder ? 'A' : 'B';
    return {
      choices: [
        { id: 'A', label: 'ĐỦ TIỀN 🛍️', isCorrect: isUnder },
        { id: 'B', label: 'CHÁY TÚI 💸', isCorrect: !isUnder },
      ],
      revealAnswerText: isUnder
        ? `ĐỦ TIỀN! Hoá đơn: ${totalBill > 0 ? totalBill.toLocaleString('vi-VN') + 'đ' : 'vừa ngân sách'}`
        : 'CHÁY TÚI! Vượt ngân sách!',
      correctChoiceId,
      budgetLabel: `Ngân sách: ${budget.toLocaleString('vi-VN')}đ`,
    };
  }

  if (m === 'ONE_AWAY') {
    const digitReveal = frame ? element(frame, 'digit-reveal') : undefined;
    const correctDigit = Number(digitReveal?.revealedDigit ?? gp.correctDigit ?? 3);
    const options = (gp.options as number[]) ?? [correctDigit, (correctDigit + 1) % 10];
    const price = Number(first?.price ?? 189000);
    const hiddenIndex = Number(gp.hiddenIndex ?? 2);
    const masked = String(digitReveal?.maskedPrice ?? maskPriceValue(price, hiddenIndex));
    const resolved = String(digitReveal?.resolvedPrice ?? `${price.toLocaleString('vi-VN')}đ`);
    const choices = options.map((opt, i) => {
      const id = String.fromCharCode(65 + i);
      const isCorrect = Number(opt) === correctDigit;
      return { id, label: `Số ${opt}`, isCorrect };
    });
    const winnerChoice = choices.find((c) => c.isCorrect)?.id ?? 'A';
    return {
      choices,
      revealAnswerText: `Chữ số đúng: ${correctDigit}! Giá: ${resolved}`,
      correctChoiceId: winnerChoice,
      maskedPrice: masked,
      resolvedPrice: resolved,
    };
  }

  if (m === 'MOST_EXPENSIVE') {
    const answer = String(gp.answer ?? '');
    const choices = entities.slice(0, 4).map((e, i) => {
      const id = String.fromCharCode(65 + i);
      const isCorrect = e.productId === answer;
      const shortName = e.name.length > 12 ? `${e.name.slice(0, 11)}…` : e.name;
      return { id, label: shortName, isCorrect };
    });
    const winnerChoice = choices.find((c) => c.isCorrect)?.id ?? 'A';
    const winner = entities.find((e) => e.productId === answer);
    return {
      choices,
      revealAnswerText: `Đắt nhất: ${winner?.name ?? answer} (${(winner?.price ?? 0).toLocaleString('vi-VN')}đ)`,
      correctChoiceId: winnerChoice,
    };
  }

  if (m === 'ODD_ONE_OUT') {
    const answer = String(gp.answer ?? '');
    const choices = entities.slice(0, 4).map((e, i) => {
      const id = String.fromCharCode(65 + i);
      const isCorrect = e.productId === answer;
      const shortName = e.name.length > 12 ? `${e.name.slice(0, 11)}…` : e.name;
      return { id, label: shortName, isCorrect };
    });
    const winnerChoice = choices.find((c) => c.isCorrect)?.id ?? 'A';
    const odd = entities.find((e) => e.productId === answer);
    return {
      choices,
      revealAnswerText: `Khác biệt: ${odd?.name ?? answer}`,
      correctChoiceId: winnerChoice,
    };
  }

  if (m === 'GUESS_THE_PRICE') {
    const rawChoices = ((gp.choices as unknown[]) ?? (game.content.choices as unknown[])) ?? [];
    const answer = String(gp.answer ?? 'A');
    const choices =
      rawChoices.length > 0
        ? rawChoices.map((c, i) => {
            const id = typeof c === 'object' && c && 'id' in c ? String((c as any).id) : String.fromCharCode(65 + i);
            const label = typeof c === 'object' && c && 'label' in c ? String((c as any).label) : String(c);
            const isCorrect = answer === id || answer === label;
            return { id, label, isCorrect };
          })
        : [
            { id: 'A', label: 'Khoảng A', isCorrect: true },
            { id: 'B', label: 'Khoảng B', isCorrect: false },
          ];
    const winnerChoice = choices.find((c) => c.isCorrect)?.id ?? 'A';
    return {
      choices,
      revealAnswerText: `Đáp án [${answer}]! Giá thật: ${(first?.price ?? 0).toLocaleString('vi-VN')}đ`,
      correctChoiceId: winnerChoice,
    };
  }

  // Fallback
  return {
    choices: [
      { id: 'A', label: 'Lựa chọn A', isCorrect: true },
      { id: 'B', label: 'Lựa chọn B', isCorrect: false },
    ],
    revealAnswerText: 'Đáp án chính xác là A!',
    correctChoiceId: 'A',
  };
}

export function drawCyberpunkShowcase(
  canvas: Canvas,
  ctx: PaintContext,
  isReveal: boolean,
  meta: ReturnType<typeof getChoicesForRenderGame>,
  frame?: RenderFrame,
  startY = 360,
): { bottomY: number } {
  const m = String(ctx.game.metadata.mechanic).toUpperCase();
  const rawEntities = ctx.game.entities ?? [];
  const cards = frame ? cardsOf(frame, ctx) : ctx.sceneData?.cards ?? [];
  const entities = rawEntities.map((e) => {
    const prod =
      ctx.products?.find((p) => p.productId === e.productId) ??
      cards.find((c) => c.productId === e.productId);
    const priceVal =
      typeof (prod as any)?.price === 'number'
        ? (prod as any).price
        : (prod as any)?.priceLabel
        ? Number(String((prod as any).priceLabel).replace(/\D/g, ''))
        : 0;
    return {
      productId: e.productId,
      name: prod?.name ?? e.productId,
      price: priceVal,
      brand: (prod as any)?.brand,
      image: prod?.image,
    };
  });
  const first = entities[0];

  // 1. GROCERY_BASKET: 3 products side-by-side
  if (m === 'GROCERY_BASKET') {
    const boxW = 940;
    const boxH = 760;
    const boxX = 70;
    canvas.fillRoundRect(boxX, startY, boxW, boxH, 32, '#0f172a', 1);
    canvas.strokeRoundRect(boxX, startY, boxW, boxH, 32, isReveal ? 'rgba(34,197,94,0.45)' : CARD_BORDER, 3);

    canvas.drawText('🛒 COMBO 3 MÓN ĐI CHỢ', {
      x: Math.round(STAGE_WIDTH / 2),
      y: startY + 24,
      size: 26,
      weight: 800,
      color: ACCENT,
      align: 'center',
    });

    const items = entities.slice(0, 3);
    const itemW = 270;
    const itemH = 480;
    const gap = 25;
    const itemsStartX = boxX + Math.round((boxW - (items.length * itemW + (items.length - 1) * gap)) / 2);

    items.forEach((item, idx) => {
      const itemX = itemsStartX + idx * (itemW + gap);
      const itemY = startY + 70;
      canvas.fillRoundRect(itemX, itemY, itemW, itemH, 20, '#1e293b', 1);
      canvas.strokeRoundRect(itemX, itemY, itemW, itemH, 20, 'rgba(248,250,252,0.12)', 2);

      const imageBox = { x: itemX + 12, y: itemY + 12, width: itemW - 24, height: 280 };
      const imagePath = item.image ? `${ctx.rootDir}/${item.image}`.replaceAll('//', '/') : undefined;
      const loaded = item.image && isRenderableImage(item.image, ctx.rootDir) ? loadPng(imagePath!) : null;
      if (loaded) {
        drawImageCover(canvas, loaded, imageBox, 16);
      } else {
        canvas.fillRoundRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height, 16, '#0f172a', 1);
        canvas.drawText(item.productId.toUpperCase(), {
          x: imageBox.x + Math.round(imageBox.width / 2),
          y: imageBox.y + Math.round(imageBox.height / 2) - 14,
          size: 26,
          weight: 700,
          color: 'rgba(248,250,252,0.7)',
          align: 'center',
        });
      }

      canvas.drawText(item.name, {
        x: itemX + Math.round(itemW / 2),
        y: itemY + 310,
        size: 20,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: itemW - 20,
        lineHeight: 1.15,
      });

      canvas.drawText(`${item.price.toLocaleString('vi-VN')}đ`, {
        x: itemX + Math.round(itemW / 2),
        y: itemY + 390,
        size: 24,
        weight: 800,
        color: ACCENT,
        align: 'center',
      });
    });

    if (meta.budgetLabel) {
      const bW = 540;
      const bH = 64;
      const bX = Math.round((STAGE_WIDTH - bW) / 2);
      const bY = startY + 630;
      canvas.fillRoundRect(bX, bY, bW, bH, 20, 'rgba(15,23,42,0.9)', 1);
      canvas.strokeRoundRect(bX, bY, bW, bH, 20, 'rgba(251,191,36,0.5)', 2);
      canvas.drawText(meta.budgetLabel, {
        x: Math.round(STAGE_WIDTH / 2),
        y: bY + Math.round((bH - 28 * 1.25) / 2),
        size: 28,
        weight: 800,
        color: ACCENT,
        align: 'center',
      });
    }

    return { bottomY: startY + boxH };
  }

  // 2. Multi-product 2x2 grid (MOST_EXPENSIVE, ODD_ONE_OUT when >= 3 cards)
  if ((m === 'MOST_EXPENSIVE' || m === 'ODD_ONE_OUT') && entities.length >= 3) {
    const boxW = 940;
    const boxH = 760;
    const boxX = 70;
    canvas.fillRoundRect(boxX, startY, boxW, boxH, 32, '#0f172a', 1);
    canvas.strokeRoundRect(boxX, startY, boxW, boxH, 32, isReveal ? 'rgba(34,197,94,0.45)' : CARD_BORDER, 3);

    const cardW = 430;
    const cardH = 330;
    const gapX = 24;
    const gapY = 24;
    const gridStartX = boxX + Math.round((boxW - (2 * cardW + gapX)) / 2);
    const gridStartY = startY + 36;

    entities.slice(0, 4).forEach((entity, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cX = gridStartX + col * (cardW + gapX);
      const cY = gridStartY + row * (cardH + gapY);

      const isWinner = isReveal && entity.productId === ctx.game.gameplay?.answer;
      canvas.fillRoundRect(cX, cY, cardW, cardH, 20, '#1e293b', 1);
      canvas.strokeRoundRect(
        cX,
        cY,
        cardW,
        cardH,
        20,
        isWinner ? '#22c55e' : 'rgba(248,250,252,0.14)',
        isWinner ? 4 : 2,
      );

      const imageBox = { x: cX + 12, y: cY + 12, width: cardW - 24, height: 180 };
      const imagePath = entity.image ? `${ctx.rootDir}/${entity.image}`.replaceAll('//', '/') : undefined;
      const loaded = entity.image && isRenderableImage(entity.image, ctx.rootDir) ? loadPng(imagePath!) : null;
      if (loaded) {
        drawImageCover(canvas, loaded, imageBox, 16);
      } else {
        canvas.fillRoundRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height, 16, '#0f172a', 1);
        canvas.drawText(entity.productId.toUpperCase(), {
          x: imageBox.x + Math.round(imageBox.width / 2),
          y: imageBox.y + Math.round(imageBox.height / 2) - 12,
          size: 24,
          weight: 700,
          color: 'rgba(248,250,252,0.7)',
          align: 'center',
        });
      }

      // Option label [A], [B] badge
      const letter = String.fromCharCode(65 + idx);
      canvas.fillRoundRect(cX + 18, cY + 18, 48, 36, 10, 'rgba(15,23,42,0.85)', 1);
      canvas.drawText(letter, {
        x: cX + 18 + 24,
        y: cY + 18 + 8,
        size: 20,
        weight: 800,
        color: isWinner ? '#4ade80' : ACCENT,
        align: 'center',
      });

      canvas.drawText(entity.name, {
        x: cX + Math.round(cardW / 2),
        y: cY + 204,
        size: 20,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: cardW - 30,
        lineHeight: 1.15,
      });

      const priceText = isReveal ? `${entity.price.toLocaleString('vi-VN')}đ` : 'Giá: ???';
      canvas.drawText(priceText, {
        x: cX + Math.round(cardW / 2),
        y: cY + 256,
        size: 24,
        weight: 800,
        color: isWinner ? '#4ade80' : ACCENT,
        align: 'center',
      });
    });

    return { bottomY: startY + boxH };
  }

  // 3. Single Hero product showcase (Default: HI_LO, ONE_AWAY, DEAL_OR_SCAM, GUESS_THE_PRICE)
  const cardW = 720;
  const cardH = 760;
  const cardX = Math.round((STAGE_WIDTH - cardW) / 2);
  const cardY = startY;

  canvas.fillRoundRect(cardX, cardY, cardW, cardH, 36, '#0f172a', 1);
  canvas.strokeRoundRect(
    cardX,
    cardY,
    cardW,
    cardH,
    36,
    isReveal ? 'rgba(34,197,94,0.5)' : CARD_BORDER,
    4,
  );

  const pad = 24;
  const imageW = cardW - pad * 2;
  const imageH = 470;
  const imageX = cardX + pad;
  const imageY = cardY + pad;

  const imagePath = first?.image ? `${ctx.rootDir}/${first.image}`.replaceAll('//', '/') : undefined;
  const loaded = first?.image && isRenderableImage(first.image, ctx.rootDir) ? loadPng(imagePath!) : null;

  if (loaded) {
    drawImageCover(canvas, loaded, { x: imageX, y: imageY, width: imageW, height: imageH }, 24);
  } else {
    canvas.fillRoundRect(imageX, imageY, imageW, imageH, 24, '#1e293b', 1);
    const placeholderText = (first?.productId || 'SAN PHAM').toUpperCase();
    canvas.drawText(placeholderText, {
      x: imageX + Math.round(imageW / 2),
      y: imageY + Math.round(imageH / 2) - 20,
      size: 40,
      weight: 700,
      color: 'rgba(248,250,252,0.6)',
      align: 'center',
      maxWidth: imageW - 40,
    });
  }

  // Brand badge
  if (first?.brand) {
    const badgeW = 200;
    const badgeH = 40;
    canvas.fillRoundRect(imageX + 16, imageY + 16, badgeW, badgeH, 12, 'rgba(15,23,42,0.85)', 1);
    canvas.drawText(first.brand.toUpperCase(), {
      x: imageX + 16 + Math.round(badgeW / 2),
      y: imageY + 16 + Math.round((badgeH - 20 * 1.25) / 2),
      size: 20,
      weight: 800,
      color: ACCENT,
      align: 'center',
      maxWidth: badgeW - 16,
    });
  }

  // Sale discount tag for DEAL_OR_SCAM
  if (meta.discountTag) {
    const sW = 180;
    const sH = 40;
    const sX = imageX + imageW - sW - 16;
    canvas.fillRoundRect(sX, imageY + 16, sW, sH, 12, 'rgba(225,29,72,0.92)', 1);
    canvas.drawText(meta.discountTag, {
      x: sX + Math.round(sW / 2),
      y: imageY + 16 + Math.round((sH - 20 * 1.25) / 2),
      size: 20,
      weight: 800,
      color: INK,
      align: 'center',
    });
  }

  // Product name
  if (first?.name) {
    canvas.drawText(first.name, {
      x: Math.round(STAGE_WIDTH / 2),
      y: cardY + 525,
      size: 32,
      weight: 700,
      color: INK,
      align: 'center',
      maxWidth: cardW - 50,
      lineHeight: 1.18,
    });
  }

  // Price & Comparison row
  if (m === 'ONE_AWAY') {
    const displayPrice = isReveal
      ? `Giá thật: ${meta.resolvedPrice ?? ''}`
      : `Giá: ${meta.maskedPrice ?? ''}`;
    canvas.drawText(displayPrice, {
      x: Math.round(STAGE_WIDTH / 2),
      y: cardY + 610,
      size: 40,
      weight: 800,
      color: isReveal ? '#4ade80' : ACCENT,
      align: 'center',
      maxWidth: cardW - 40,
    });
  } else if (m === 'DEAL_OR_SCAM') {
    if (meta.salePriceLabel) {
      canvas.drawText(meta.salePriceLabel, {
        x: Math.round(STAGE_WIDTH / 2),
        y: cardY + 595,
        size: 38,
        weight: 800,
        color: ACCENT,
        align: 'center',
      });
    }
    if (meta.originalPriceLabel) {
      canvas.drawText(meta.originalPriceLabel, {
        x: Math.round(STAGE_WIDTH / 2),
        y: cardY + 655,
        size: 24,
        weight: 600,
        color: MUTED,
        align: 'center',
      });
    }
  } else if (meta.benchmarkLabel) {
    canvas.drawText(meta.benchmarkLabel, {
      x: Math.round(STAGE_WIDTH / 2),
      y: cardY + 615,
      size: 34,
      weight: 800,
      color: ACCENT,
      align: 'center',
      maxWidth: cardW - 40,
    });
  } else if (first?.price) {
    const priceText = isReveal
      ? `Giá thật: ${first.price.toLocaleString('vi-VN')}đ`
      : 'Giá: ???';
    canvas.drawText(priceText, {
      x: Math.round(STAGE_WIDTH / 2),
      y: cardY + 615,
      size: 36,
      weight: 800,
      color: isReveal ? '#4ade80' : ACCENT,
      align: 'center',
      maxWidth: cardW - 40,
    });
  }

  return { bottomY: cardY + cardH };
}

export function drawCyberpunkRevealBanner(
  canvas: Canvas,
  revealText: string,
  startY = 1345,
): { bottomY: number } {
  const bannerW = 900;
  const bannerH = 96;
  const bannerX = Math.round((STAGE_WIDTH - bannerW) / 2);

  canvas.fillRoundRect(bannerX, startY, bannerW, bannerH, 24, 'rgba(34,197,94,0.18)', 1);
  canvas.strokeRoundRect(bannerX, startY, bannerW, bannerH, 24, '#22c55e', 3);

  canvas.drawText(`🎉 ${revealText}`, {
    x: Math.round(STAGE_WIDTH / 2),
    y: startY + Math.round((bannerH - 32 * 1.25) / 2),
    size: 32,
    weight: 800,
    color: '#22c55e',
    align: 'center',
    maxWidth: bannerW - 40,
  });

  return { bottomY: startY + bannerH };
}

/** Paint the static part of a scene frame (the animation keys redraw this). */
export function paintFrame(canvas: Canvas, frame: RenderFrame, ctx: PaintContext): void {
  // Cyberpunk Dark Background
  canvas.fillGradientV(0, 0, canvas.width, canvas.height, '#0b0f19', '#020617', 1);
  canvas.fill(0, 0, canvas.width, 10, ACCENT, 0.9);

  switch (frame.scene) {
    case 'hook': {
      drawCyberpunkHUD(canvas, { seed: ctx.game.metadata.seed, variant: ctx.variant });
      drawBadge(canvas, '🔥 THỬ THÁCH 5 GIÂY', DANGER, 360);

      const hookText = textOf(frame, 'text', ctx.game.content.hook ?? ctx.game.content.title ?? '');
      canvas.drawText(hookText, {
        x: Math.round(STAGE_WIDTH / 2),
        y: 680,
        size: 68,
        weight: 800,
        color: INK,
        align: 'center',
        maxWidth: 920,
        lineHeight: 1.25,
      });

      if (ctx.game.content.title && ctx.game.content.title !== hookText) {
        canvas.drawText(ctx.game.content.title, {
          x: Math.round(STAGE_WIDTH / 2),
          y: 540,
          size: 46,
          weight: 700,
          color: ACCENT,
          align: 'center',
          maxWidth: 900,
        });
      }

      canvas.drawText('CHỈ 5 GIÂY ĐỂ ĐOÁN!', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1040,
        size: 36,
        weight: 800,
        color: MUTED,
        align: 'center',
        letterSpacing: 4,
      });
      break;
    }

    case 'product':
    case 'question':
    case 'countdown': {
      const meta = getChoicesForRenderGame(ctx.game, ctx, frame);
      drawCyberpunkHUD(canvas, { seed: ctx.game.metadata.seed, variant: ctx.variant });
      drawCyberpunkQuestionBox(canvas, ctx.game.content.question ?? 'Đoán giá sản phẩm', 224);
      drawCyberpunkShowcase(canvas, ctx, false, meta, frame, 360);
      drawChoiceDeck(canvas, meta.choices, false, undefined, 1160);

      const countdownElem = element(frame, 'countdown');
      let remaining = 3.0;
      if (frame.data.remaining !== undefined) {
        remaining = Number(frame.data.remaining);
      } else if (countdownElem?.value !== undefined) {
        remaining = Number(countdownElem.value);
      }
      drawPillCountdown(canvas, remaining, 3.0, 1350);
      break;
    }

    case 'reveal':
    case 'result': {
      const meta = getChoicesForRenderGame(ctx.game, ctx, frame);
      drawCyberpunkHUD(canvas, { seed: ctx.game.metadata.seed, variant: ctx.variant });
      drawCyberpunkQuestionBox(canvas, ctx.game.content.question ?? 'Đoán giá sản phẩm', 224);
      drawCyberpunkShowcase(canvas, ctx, true, meta, frame, 360);
      drawChoiceDeck(canvas, meta.choices, true, meta.correctChoiceId, 1160);
      drawCyberpunkRevealBanner(canvas, meta.revealAnswerText, 1345);

      canvas.drawText('Bình luận đáp án của bạn! 👇', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1480,
        size: 30,
        weight: 600,
        color: MUTED,
        align: 'center',
      });
      break;
    }

    case 'cta': {
      drawCyberpunkHUD(canvas, { seed: ctx.game.metadata.seed, variant: ctx.variant });

      canvas.drawText('⭐ ⭐ ⭐', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 560,
        size: 72,
        weight: 700,
        color: ACCENT,
        align: 'center',
      });

      canvas.drawText('BẠN ĐÚNG MẤY CÂU?', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 700,
        size: 64,
        weight: 800,
        color: INK,
        align: 'center',
        maxWidth: 920,
      });

      const cta = textOf(frame, 'text', ctx.game.content.cta ?? 'Follow để xem clip tiếp theo!');
      const ctaBoxW = 900;
      const ctaBoxH = 130;
      const ctaBoxX = Math.round((STAGE_WIDTH - ctaBoxW) / 2);
      const ctaBoxY = 920;

      canvas.fillRoundRect(ctaBoxX, ctaBoxY, ctaBoxW, ctaBoxH, 40, ACCENT, 0.95);
      canvas.drawText(cta.replace(/https?:\/\/\S+/gi, '').trim() || 'Follow để xem clip tiếp theo!', {
        x: Math.round(STAGE_WIDTH / 2),
        y: ctaBoxY + Math.round((ctaBoxH - 40 * 1.25) / 2),
        size: 40,
        weight: 800,
        color: '#0b1120',
        align: 'center',
        maxWidth: ctaBoxW - 60,
      });

      canvas.drawText('Bình luận ngay phía dưới! 👇', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1140,
        size: 38,
        weight: 600,
        color: MUTED,
        align: 'center',
      });
      break;
    }

    default: {
      drawCyberpunkHUD(canvas, { seed: ctx.game.metadata.seed, variant: ctx.variant });
      canvas.drawText(textOf(frame, 'text', frame.scene), {
        x: Math.round(STAGE_WIDTH / 2),
        y: 820,
        size: 64,
        weight: 600,
        color: INK,
        align: 'center',
      });
      break;
    }
  }
}

/** Animated overlay: playback progress + countdown pill timer (per output frame). */
export function paintOverlay(
  canvas: Canvas,
  options: { time: number; totalDuration: number; frame: RenderFrame; sceneProgress: number },
): void {
  const { time, totalDuration, frame, sceneProgress } = options;
  if (frame.scene === 'countdown') {
    const remainingRatio = 1 - Math.min(1, Math.max(0, sceneProgress));
    const secondsRemaining = Math.max(0, 3.0 * remainingRatio);
    drawPillCountdown(canvas, secondsRemaining, 3.0, 1350);
  }

  const barX = 72;
  const barWidth = canvas.width - 144;
  const barY = canvas.height - 96;
  canvas.fillRoundRect(barX, barY, barWidth, 14, 7, 'rgba(248,250,252,0.18)', 1);
  const progress = Math.max(0, Math.min(1, totalDuration > 0 ? time / totalDuration : 0));
  canvas.fillRoundRect(barX, barY, Math.max(14, Math.round(barWidth * progress)), 14, 7, ACCENT, 1);
}

/**
 * All-in-One Canvas HUD Elements (Sprint 1)
 */
export function drawSeriesHUD(
  canvas: Canvas,
  seriesNumber: number,
  currentRound: number,
  totalRounds = 3,
): void {
  // 1. Series Badge
  const badgeLabel = `🔥 5 GIÂY ĐOÁN GIÁ · TẬP #${seriesNumber}`;
  drawBadge(canvas, badgeLabel, ACCENT, 170);

  // 2. Round Progress Dots
  const dotY = 270;
  const dotSpacing = 80;
  const startX = Math.round((STAGE_WIDTH - (totalRounds - 1) * dotSpacing) / 2);
  for (let i = 0; i < totalRounds; i += 1) {
    const x = startX + i * dotSpacing;
    const isCompleted = i + 1 < currentRound;
    const isCurrent = i + 1 === currentRound;
    const color = isCurrent ? ACCENT : isCompleted ? '#22c55e' : 'rgba(248,250,252,0.3)';
    const r = isCurrent ? 12 : 9;
    canvas.fillRoundRect(x - r, dotY - r, r * 2, r * 2, r, color, 1);
    if (i < totalRounds - 1) {
      canvas.fillRoundRect(x + 12, dotY - 2, dotSpacing - 24, 4, 2, 'rgba(248,250,252,0.2)', 1);
    }
  }
}

export function drawChoiceDeck(
  canvas: Canvas,
  choices: Array<{ id: string; label: string; isCorrect?: boolean }>,
  isRevealed: boolean,
  revealedCorrectId?: string,
  startY = 1200,
): { bottomY: number } {
  const isGrid = choices.length > 2;
  const btnWidth = 440;
  const gap = 24;
  const btnHeight = isGrid ? 85 : 110;

  if (!isGrid) {
    const totalW = btnWidth * choices.length + gap * (choices.length - 1);
    const startX = Math.round((STAGE_WIDTH - totalW) / 2);

    choices.forEach((choice, idx) => {
      const x = startX + idx * (btnWidth + gap);
      const isWinner = isRevealed && (choice.id === revealedCorrectId || choice.isCorrect);
      const borderColor = isWinner ? '#22c55e' : isRevealed ? 'rgba(248,250,252,0.15)' : ACCENT;
      const bgColor = isWinner ? 'rgba(34,197,94,0.32)' : isRevealed ? 'rgba(15,23,42,0.5)' : '#0f172a';

      canvas.fillRoundRect(x, startY, btnWidth, btnHeight, 28, bgColor, 1);
      canvas.strokeRoundRect(x, startY, btnWidth, btnHeight, 28, borderColor, isWinner ? 5 : 3, 0.95);

      const labelText = `[ ${choice.id} ]  ${choice.label}`;
      const measured = canvas.text.layout(labelText, { size: 36, weight: 800 });
      canvas.drawText(labelText, {
        x: Math.round(x + (btnWidth - measured.textWidth) / 2),
        y: startY + Math.round((btnHeight - 36 * 1.2) / 2),
        color: isWinner ? '#4ade80' : isRevealed ? 'rgba(248,250,252,0.45)' : INK,
        size: 36,
        weight: 800,
      });
    });

    return { bottomY: startY + btnHeight };
  } else {
    // 2x2 grid for 4 choices
    const cols = 2;
    const totalW = btnWidth * cols + gap * (cols - 1);
    const startX = Math.round((STAGE_WIDTH - totalW) / 2);

    choices.forEach((choice, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (btnWidth + gap);
      const y = startY + row * (btnHeight + gap);

      const isWinner = isRevealed && (choice.id === revealedCorrectId || choice.isCorrect);
      const borderColor = isWinner ? '#22c55e' : isRevealed ? 'rgba(248,250,252,0.15)' : ACCENT;
      const bgColor = isWinner ? 'rgba(34,197,94,0.32)' : isRevealed ? 'rgba(15,23,42,0.5)' : '#0f172a';

      canvas.fillRoundRect(x, y, btnWidth, btnHeight, 20, bgColor, 1);
      canvas.strokeRoundRect(x, y, btnWidth, btnHeight, 20, borderColor, isWinner ? 4 : 2, 0.95);

      const labelText = `[ ${choice.id} ]  ${choice.label}`;
      const measured = canvas.text.layout(labelText, { size: 30, weight: 800 });
      canvas.drawText(labelText, {
        x: Math.round(x + (btnWidth - measured.textWidth) / 2),
        y: y + Math.round((btnHeight - 30 * 1.2) / 2),
        color: isWinner ? '#4ade80' : isRevealed ? 'rgba(248,250,252,0.45)' : INK,
        size: 30,
        weight: 800,
      });
    });

    const totalRows = Math.ceil(choices.length / cols);
    return { bottomY: startY + totalRows * btnHeight + (totalRows - 1) * gap };
  }
}

export function drawPillCountdown(
  canvas: Canvas,
  secondsRemaining: number,
  maxSeconds = 5,
  barY = 1350,
): void {
  const barW = 900;
  const barH = 26;
  const x = Math.round((STAGE_WIDTH - barW) / 2);

  // Background
  canvas.fillRoundRect(x, barY, barW, barH, 13, 'rgba(248,250,252,0.18)', 1);

  // Progress ratio
  const ratio = Math.max(0, Math.min(1, secondsRemaining / maxSeconds));
  const currentW = Math.max(barH, Math.round(barW * ratio));

  // Dynamic color shift: Green (>50%) -> Yellow (20-50%) -> Red (<20%)
  let color = '#22c55e';
  if (ratio < 0.25) {
    color = '#ef4444';
  } else if (ratio < 0.55) {
    color = '#eab308';
  }

  canvas.fillRoundRect(x, barY, currentW, barH, 13, color, 1);

  // Timer label
  const timerLabel = `⏱️ Còn ${secondsRemaining.toFixed(1)}s...`;
  const m = canvas.text.layout(timerLabel, { size: 28, weight: 700 });
  canvas.drawText(timerLabel, {
    x: Math.round((STAGE_WIDTH - m.textWidth) / 2),
    y: barY + 38,
    color: MUTED,
    size: 28,
    weight: 700,
  });
}

/**
 * Renders a frame for a continuous Multi-Round challenge timeline (Sprint 2).
 * Handles hook, round play, reveal, micro-hooks, and scorecard phases.
 */
export function paintMultiRoundFrame(
  canvas: Canvas,
  scene: AllInOneSceneLike,
  timeSeconds: number,
  options?: { rootDir?: string },
): void {
  // 1. Clears background with gradient
  canvas.fillGradientV(0, 0, canvas.width, canvas.height, '#0b0f19', '#020617', 1);
  canvas.fill(0, 0, canvas.width, 10, ACCENT, 0.9);

  // 2. Finds active slot in scene.getTimeline()
  const timeline = scene.getTimeline();
  const slot =
    timeline.slots.find((s) => timeSeconds >= s.start && timeSeconds < s.end) ??
    timeline.slots.find((s) => timeSeconds >= s.start && timeSeconds <= s.end) ??
    timeline.slots[timeline.slots.length - 1];

  if (!slot) return;

  // 3. Hook phase (0s - 1.5s)
  if (slot.type === 'hook') {
    drawSeriesHUD(canvas, scene.challenge.seriesNumber, 1, scene.challenge.rounds.length);
    drawBadge(canvas, '🔥 THỬ THÁCH 5 GIÂY', DANGER, 380);

    const hookQuestion =
      scene.challenge.rounds[0]?.hookText ??
      scene.challenge.rounds[0]?.question ??
      scene.challenge.title;

    canvas.drawText(hookQuestion, {
      x: Math.round(STAGE_WIDTH / 2),
      y: 720,
      size: 72,
      weight: 800,
      color: INK,
      align: 'center',
      maxWidth: 920,
      lineHeight: 1.25,
    });

    if (scene.challenge.title && scene.challenge.title !== hookQuestion) {
      canvas.drawText(scene.challenge.title, {
        x: Math.round(STAGE_WIDTH / 2),
        y: 580,
        size: 52,
        weight: 700,
        color: ACCENT,
        align: 'center',
        maxWidth: 900,
      });
    }
    return;
  }

  // 4. Round play / reveal phases
  if (slot.type.startsWith('round_')) {
    const parts = slot.type.split('_');
    const roundIdx = parseInt(parts[1] ?? '1', 10);
    const phase = (parts[2] ?? 'play') as 'play' | 'reveal';
    const round =
      scene.challenge.rounds.find((r) => r.roundIndex === roundIdx) ??
      scene.challenge.rounds[0];

    if (!round) return;

    // Round header dots and series badge
    drawSeriesHUD(canvas, scene.challenge.seriesNumber, round.roundIndex, scene.challenge.rounds.length);

    // Question box at y=320
    const boxY = 320;
    const boxWidth = 940;
    const boxHeight = 96;
    const boxX = Math.round((STAGE_WIDTH - boxWidth) / 2);

    canvas.fillRoundRect(boxX, boxY, boxWidth, boxHeight, 24, '#161d2e', 0.95);
    canvas.strokeRoundRect(boxX, boxY, boxWidth, boxHeight, 24, 'rgba(251,191,36,0.3)', 2);

    canvas.drawText(round.question, {
      x: Math.round(STAGE_WIDTH / 2),
      y: boxY + Math.round((boxHeight - 34 * 1.25) / 2),
      size: 34,
      weight: 700,
      color: INK,
      align: 'center',
      maxWidth: boxWidth - 40,
    });

    // Product card at y=440 (720x720)
    const cardX = Math.round((STAGE_WIDTH - 720) / 2);
    const cardY = 440;
    const cardW = 720;
    const cardH = 720;

    canvas.fillRoundRect(cardX, cardY, cardW, cardH, 36, '#0f172a', 1);
    canvas.strokeRoundRect(
      cardX,
      cardY,
      cardW,
      cardH,
      36,
      phase === 'reveal' ? 'rgba(34,197,94,0.4)' : CARD_BORDER,
      4,
    );

    const firstProduct = round.products[0];
    const pad = 24;
    const imageW = cardW - pad * 2;
    const imageH = 480;
    const imageX = cardX + pad;
    const imageY = cardY + pad;

    const rootDir = options?.rootDir ?? process.cwd();
    const imagePath = firstProduct?.image
      ? `${rootDir}/${firstProduct.image}`.replaceAll('//', '/')
      : undefined;
    const loaded =
      imagePath && isRenderableImage(firstProduct?.image, rootDir)
        ? loadPng(imagePath)
        : null;

    if (loaded) {
      drawImageCover(canvas, loaded, { x: imageX, y: imageY, width: imageW, height: imageH }, 24);
    } else {
      canvas.fillRoundRect(imageX, imageY, imageW, imageH, 24, '#1e293b', 1);
      const placeholderText = (firstProduct?.productId || 'SAN PHAM').toUpperCase();
      canvas.drawText(placeholderText, {
        x: imageX + Math.round(imageW / 2),
        y: imageY + Math.round(imageH / 2) - 20,
        size: 40,
        weight: 700,
        color: 'rgba(248,250,252,0.6)',
        align: 'center',
        maxWidth: imageW - 40,
      });
    }

    // Brand / Official badge on product image if brand exists
    if (firstProduct?.brand) {
      const badgeW = 220;
      const badgeH = 44;
      canvas.fillRoundRect(imageX + 16, imageY + 16, badgeW, badgeH, 12, 'rgba(15,23,42,0.85)', 1);
      canvas.drawText(firstProduct.brand.toUpperCase(), {
        x: imageX + 16 + Math.round(badgeW / 2),
        y: imageY + 16 + Math.round((badgeH - 22 * 1.2) / 2),
        size: 22,
        weight: 800,
        color: ACCENT,
        align: 'center',
        maxWidth: badgeW - 20,
      });
    }

    if (firstProduct?.name) {
      canvas.drawText(firstProduct.name, {
        x: Math.round(STAGE_WIDTH / 2),
        y: cardY + 530,
        size: 34,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: cardW - 60,
        lineHeight: 1.2,
      });
    }

    // Benchmark Price / Deal Tag
    const benchmarkLabel = firstProduct?.price
      ? `Mốc so sánh: ${firstProduct.price.toLocaleString('vi-VN')}đ`
      : undefined;
    if (benchmarkLabel) {
      canvas.drawText(benchmarkLabel, {
        x: Math.round(STAGE_WIDTH / 2),
        y: cardY + 630,
        size: 32,
        weight: 800,
        color: ACCENT,
        align: 'center',
        maxWidth: cardW - 60,
      });
    }

    // Choice deck starting at y=1200
    const deckResult = drawChoiceDeck(
      canvas,
      round.choices,
      phase === 'reveal',
      String(round.correctAnswer),
      1200,
    );

    const countdownY = deckResult.bottomY + 30;

    // If play phase: draw pill countdown bar with remaining seconds
    if (phase === 'play') {
      const secondsRemaining = Math.max(0, Math.min(round.timerSeconds, slot.end - timeSeconds));
      drawPillCountdown(canvas, secondsRemaining, round.timerSeconds, countdownY);
    }

    // If reveal phase: highlight winning choice with green border and show reveal text / actual price
    if (phase === 'reveal') {
      const revealBannerY = countdownY;
      const revealBannerW = 900;
      const revealBannerH = 100;
      const revealX = Math.round((STAGE_WIDTH - revealBannerW) / 2);

      canvas.fillRoundRect(revealX, revealBannerY, revealBannerW, revealBannerH, 24, 'rgba(34,197,94,0.18)', 1);
      canvas.strokeRoundRect(revealX, revealBannerY, revealBannerW, revealBannerH, 24, '#22c55e', 3);

      const revealText =
        round.revealText ||
        (firstProduct?.price
          ? `Giá chính xác: ${firstProduct.price.toLocaleString('vi-VN')}đ`
          : `Đáp án: ${round.correctAnswer}`);

      canvas.drawText(`🎉 ${revealText}`, {
        x: Math.round(STAGE_WIDTH / 2),
        y: revealBannerY + Math.round((revealBannerH - 38 * 1.25) / 2),
        size: 38,
        weight: 800,
        color: '#22c55e',
        align: 'center',
        maxWidth: revealBannerW - 40,
      });
    }
    return;
  }

  // 5. Micro-hook transition banner
  if (slot.type.startsWith('micro_hook_')) {
    const hookIndex = parseInt(slot.type.replace('micro_hook_', ''), 10);
    const nextRoundIndex = hookIndex + 1;
    const upcomingRound =
      scene.challenge.rounds.find((r) => r.roundIndex === nextRoundIndex) ??
      scene.challenge.rounds[hookIndex];

    drawSeriesHUD(canvas, scene.challenge.seriesNumber, nextRoundIndex, scene.challenge.rounds.length);

    const bannerW = 960;
    const bannerH = 320;
    const bannerX = Math.round((STAGE_WIDTH - bannerW) / 2);
    const bannerY = 800;

    canvas.fillRoundRect(bannerX, bannerY, bannerW, bannerH, 32, 'rgba(239,68,68,0.22)', 1);
    canvas.strokeRoundRect(bannerX, bannerY, bannerW, bannerH, 32, DANGER, 4);

    drawBadge(canvas, '⚡ BẺ LÁI BẤT NGỜ', DANGER, bannerY + 36);

    const microHookText =
      upcomingRound?.microHook ?? `Câu ${nextRoundIndex} bắt đầu xoắn não rồi đây!`;
    canvas.drawText(microHookText, {
      x: Math.round(STAGE_WIDTH / 2),
      y: bannerY + 150,
      size: 54,
      weight: 800,
      color: INK,
      align: 'center',
      maxWidth: bannerW - 60,
      lineHeight: 1.25,
    });
    return;
  }

  // 6. Scorecard & CTA
  if (slot.type === 'scorecard') {
    drawSeriesHUD(
      canvas,
      scene.challenge.seriesNumber,
      scene.challenge.rounds.length + 1,
      scene.challenge.rounds.length,
    );

    // 3 stars (⭐⭐⭐)
    canvas.drawText('⭐ ⭐ ⭐', {
      x: Math.round(STAGE_WIDTH / 2),
      y: 600,
      size: 72,
      weight: 700,
      color: ACCENT,
      align: 'center',
    });

    // "BẠN ĐÚNG MẤY CÂU?"
    canvas.drawText('BẠN ĐÚNG MẤY CÂU?', {
      x: Math.round(STAGE_WIDTH / 2),
      y: 740,
      size: 64,
      weight: 800,
      color: INK,
      align: 'center',
      maxWidth: 920,
    });

    // CTA Box: "Ai đúng 3/3 giơ tay!"
    const cta = scene.challenge.finalCta || 'Ai đúng 3/3 giơ tay!';
    const ctaBoxW = 900;
    const ctaBoxH = 140;
    const ctaBoxX = Math.round((STAGE_WIDTH - ctaBoxW) / 2);
    const ctaBoxY = 1000;

    canvas.fillRoundRect(ctaBoxX, ctaBoxY, ctaBoxW, ctaBoxH, 40, ACCENT, 0.95);
    canvas.drawText(cta, {
      x: Math.round(STAGE_WIDTH / 2),
      y: ctaBoxY + Math.round((ctaBoxH - 42 * 1.25) / 2),
      size: 42,
      weight: 800,
      color: '#0b1120',
      align: 'center',
      maxWidth: ctaBoxW - 60,
    });

    // Subtitle
    canvas.drawText('Bình luận ngay phía dưới! 👇', {
      x: Math.round(STAGE_WIDTH / 2),
      y: 1220,
      size: 38,
      weight: 600,
      color: MUTED,
      align: 'center',
    });
  }
}


