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

/** Paint the static part of a scene frame (the animation keys redraw this). */
export function paintFrame(canvas: Canvas, frame: RenderFrame, ctx: PaintContext): void {
  const bg = ctx.diversification.bgColor;
  canvas.fillGradientV(0, 0, canvas.width, canvas.height, shade(bg, 0.22), '#05070d', 1);
  canvas.fill(0, 0, canvas.width, 10, bg, 0.9);

  switch (frame.scene) {
    case 'hook': {
      drawFrameBadge(canvas, frame, DANGER);
      canvas.drawText(textOf(frame, 'text', ctx.game.content.hook ?? ''), {
        x: Math.round(STAGE_WIDTH / 2),
        y: 780,
        size: 84,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: 900,
        lineHeight: 1.22,
      });
      break;
    }
    case 'product': {
      drawFrameBadge(canvas, frame, ACCENT);
      drawCards(canvas, frame, ctx);
      canvas.drawText('Giá tham khảo', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1560,
        size: 40,
        weight: 500,
        color: MUTED,
        align: 'center',
      });
      break;
    }
    case 'question': {
      drawFrameBadge(canvas, frame, ACCENT);
      canvas.drawText(textOf(frame, 'text', ctx.game.content.question ?? ''), {
        x: Math.round(STAGE_WIDTH / 2),
        y: 560,
        size: 66,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: 920,
        lineHeight: 1.2,
      });
      drawChoices(canvas, frame);
      break;
    }
    case 'countdown': {
      drawFrameBadge(canvas, frame, DANGER);
      // Whole-second display value; `value` keeps the precise remaining time.
      const countdown = element(frame, 'countdown');
      const value = String(countdown?.display ?? countdown?.value ?? '');
      canvas.drawText(value, {
        x: Math.round(STAGE_WIDTH / 2),
        y: 760,
        size: 300,
        weight: 700,
        color: ACCENT,
        align: 'center',
      });
      canvas.drawText('TRẢ LỜI NHANH!', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1360,
        size: 46,
        weight: 700,
        color: MUTED,
        align: 'center',
        letterSpacing: 6,
      });
      break;
    }
    case 'reveal': {
      drawFrameBadge(canvas, frame, '#34d399');
      const priceReveal = element(frame, 'price-reveal');
      const digitReveal = element(frame, 'digit-reveal');
      if (digitReveal) {
        canvas.drawText(String(digitReveal.maskedPrice ?? '?'), {
          x: Math.round(STAGE_WIDTH / 2),
          y: 700,
          size: 120,
          weight: 700,
          color: MUTED,
          align: 'center',
        });
        canvas.drawText('→', {
          x: Math.round(STAGE_WIDTH / 2),
          y: 900,
          size: 110,
          weight: 700,
          color: MUTED,
          align: 'center',
        });
        // The digit, then the completed price, then its caption — stacked with
        // measured gaps. `layoutScan` enforces that these never touch.
        canvas.drawText(String(digitReveal.revealedDigit ?? ''), {
          x: Math.round(STAGE_WIDTH / 2),
          y: 1040,
          size: 200,
          weight: 700,
          color: ACCENT,
          align: 'center',
        });
        // Close the loop: show the price with the digit substituted back in, so
        // the viewer reads the real number instead of reconstructing it.
        const resolved = String(digitReveal.resolvedPrice ?? '');
        if (resolved) {
          canvas.drawText(resolved, {
            x: Math.round(STAGE_WIDTH / 2),
            y: 1310,
            size: 96,
            weight: 700,
            color: INK,
            align: 'center',
            maxWidth: 940,
          });
          canvas.drawText('Giá đúng', {
            x: Math.round(STAGE_WIDTH / 2),
            y: 1450,
            size: 52,
            weight: 400,
            color: MUTED,
            align: 'center',
          });
        }
      } else {
        const cards = cardsOf(frame, ctx);
        if (cards.length > 0) drawCards(canvas, frame, ctx);
        const rawAnswer = String(priceReveal?.answer ?? '');
        const label = answerLabel(rawAnswer, ctx);
        // The answer caption owns the band below the cards. Start it under the
        // lowest card so a 3-card layout can never be overpainted, and measure
        // the block so the sub-caption stacks instead of colliding.
        const cardsBottom = cards.reduce(
          (lowest, card) => Math.max(lowest, card.y + card.height),
          0,
        );
        const answerY = Math.max(REVEAL_TEXT_BAND_TOP, cardsBottom + 40);
        const answerBlock = canvas.drawText(label, {
          x: Math.round(STAGE_WIDTH / 2),
          y: answerY,
          size: label.length > 14 ? 76 : 108,
          weight: 700,
          color: ACCENT,
          align: 'center',
          maxWidth: 940,
          lineHeight: 1.18,
        });
        canvas.drawText('Đáp án đúng', {
          x: Math.round(STAGE_WIDTH / 2),
          y: answerY + answerBlock.height + 28,
          size: 38,
          weight: 500,
          color: MUTED,
          align: 'center',
        });
      }
      break;
    }
    case 'result': {
      drawFrameBadge(canvas, frame, '#60a5fa');
      const comment = element(frame, 'comment-result');
      if (comment) {
        canvas.drawText(String(comment.text ?? 'Đáp án ở comment'), {
          x: Math.round(STAGE_WIDTH / 2),
          y: 840,
          size: 86,
          weight: 700,
          color: INK,
          align: 'center',
          maxWidth: 900,
          lineHeight: 1.25,
        });
        canvas.drawText('Bình luận đáp án của bạn!', {
          x: Math.round(STAGE_WIDTH / 2),
          y: 1120,
          size: 44,
          weight: 500,
          color: MUTED,
          align: 'center',
        });
      } else {
        canvas.drawText('ĐÁP ÁN', {
          x: Math.round(STAGE_WIDTH / 2),
          y: 760,
          size: 52,
          weight: 700,
          color: MUTED,
          align: 'center',
          letterSpacing: 8,
        });
        const resultAnswer = String(element(frame, 'result-badge')?.text ?? '').replace(/^Đáp án:\s*/i, '');
        canvas.drawText(answerLabel(resultAnswer, ctx), {
          x: Math.round(STAGE_WIDTH / 2),
          y: 880,
          size: 160,
          weight: 700,
          color: ACCENT,
          align: 'center',
          maxWidth: 940,
        });
      }
      break;
    }
    case 'cta': {
      drawFrameBadge(canvas, frame, '#34d399');
      const cta = textOf(frame, 'text', ctx.game.content.cta ?? '');
      canvas.drawText(cta.replace(/https?:\/\/\S+/gi, '').trim(), {
        x: Math.round(STAGE_WIDTH / 2),
        y: 740,
        size: 68,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: 900,
        lineHeight: 1.22,
      });
      canvas.fillRoundRect(190, 1120, 700, 132, 66, ACCENT, 0.95);
      canvas.drawText('LINK Ở COMMENT', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1120 + 34,
        size: 46,
        weight: 700,
        color: '#0b1120',
        align: 'center',
        letterSpacing: 3,
      });
      canvas.drawText('Follow để xem clip tiếp theo', {
        x: Math.round(STAGE_WIDTH / 2),
        y: 1340,
        size: 40,
        weight: 500,
        color: MUTED,
        align: 'center',
      });
      break;
    }
    default: {
      drawFrameBadge(canvas, frame, ACCENT);
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

/**
 * Ring arc used by the countdown pulse: outer arc forward + inner arc backward
 * so the polygon is a true annulus segment rather than a wedge.
 */
function ringArc(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  fraction: number,
): Array<{ x: number; y: number }> {
  const sweep = Math.max(0.02, Math.min(1, fraction)) * Math.PI * 2;
  const steps = Math.max(3, Math.ceil((sweep / (Math.PI * 2)) * 128));
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = -Math.PI / 2 + (sweep * i) / steps;
    points.push({ x: centerX + Math.cos(angle) * outerRadius, y: centerY + Math.sin(angle) * outerRadius });
  }
  for (let i = steps; i >= 0; i -= 1) {
    const angle = -Math.PI / 2 + (sweep * i) / steps;
    points.push({ x: centerX + Math.cos(angle) * innerRadius, y: centerY + Math.sin(angle) * innerRadius });
  }
  return points;
}

/** Animated overlay: playback progress + countdown ring (per output frame). */
export function paintOverlay(
  canvas: Canvas,
  options: { time: number; totalDuration: number; frame: RenderFrame; sceneProgress: number },
): void {
  const { time, totalDuration, frame, sceneProgress } = options;
  if (frame.scene === 'countdown') {
    const remaining = 1 - Math.min(1, Math.max(0, sceneProgress));
    canvas.fillPolygon(ringArc(STAGE_WIDTH / 2, 910, 292, 258, remaining), ACCENT, 0.9);
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
): void {
  const deckY = 1220;
  const btnWidth = 430;
  const btnHeight = 110;
  const gap = 36;
  const totalW = btnWidth * choices.length + gap * (choices.length - 1);
  const startX = Math.round((STAGE_WIDTH - totalW) / 2);

  choices.forEach((choice, idx) => {
    const x = startX + idx * (btnWidth + gap);
    const isWinner = isRevealed && (choice.id === revealedCorrectId || choice.isCorrect);
    const borderColor = isWinner ? '#22c55e' : ACCENT;
    const bgColor = isWinner ? 'rgba(34,197,94,0.28)' : 'rgba(22,29,46,0.85)';

    canvas.fillRoundRect(x, deckY, btnWidth, btnHeight, 28, bgColor, 1);
    canvas.strokeRoundRect(x, deckY, btnWidth, btnHeight, 28, borderColor, isWinner ? 5 : 3, 0.9);

    const labelText = `[ ${choice.id} ]  ${choice.label}`;
    const measured = canvas.text.layout(labelText, { size: 38, weight: 800 });
    canvas.drawText(labelText, {
      x: Math.round(x + (btnWidth - measured.textWidth) / 2),
      y: deckY + Math.round((btnHeight - 38 * 1.2) / 2),
      color: INK,
      size: 38,
      weight: 800,
    });
  });
}

export function drawPillCountdown(canvas: Canvas, secondsRemaining: number, maxSeconds = 5): void {
  const barY = 1380;
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
  const timerLabel = `⏱️ Còn ${Math.ceil(secondsRemaining)}s...`;
  const m = canvas.text.layout(timerLabel, { size: 28, weight: 700 });
  canvas.drawText(timerLabel, {
    x: Math.round((STAGE_WIDTH - m.textWidth) / 2),
    y: barY + 40,
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

    // Product card at y=450 (700x700)
    const cardX = Math.round((STAGE_WIDTH - 700) / 2);
    const cardY = 450;
    const cardW = 700;
    const cardH = 700;

    canvas.fillRoundRect(cardX, cardY, cardW, cardH, 36, '#161d2e', 1);
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
    const imageH = 500;
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

    if (firstProduct?.name) {
      canvas.drawText(firstProduct.name, {
        x: Math.round(STAGE_WIDTH / 2),
        y: cardY + 545,
        size: 34,
        weight: 700,
        color: INK,
        align: 'center',
        maxWidth: cardW - 60,
        lineHeight: 1.2,
      });
    }

    // Choice deck at y=1220
    drawChoiceDeck(
      canvas,
      round.choices,
      phase === 'reveal',
      String(round.correctAnswer),
    );

    // If play phase: draw pill countdown bar with remaining seconds
    if (phase === 'play') {
      const secondsRemaining = Math.max(0, Math.min(round.timerSeconds, slot.end - timeSeconds));
      drawPillCountdown(canvas, secondsRemaining, round.timerSeconds);
    }

    // If reveal phase: highlight winning choice with green border and show reveal text / actual price
    if (phase === 'reveal') {
      const revealBannerY = 1370;
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


