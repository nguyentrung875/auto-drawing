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
import type {
  RenderCardView,
  RenderProductView,
  RenderFrame,
  RenderFrameElement,
  RenderGameView,
  RenderSceneDataView,
  RenderWarning,
} from './types';

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
