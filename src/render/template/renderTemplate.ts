/**
 * Deterministic 1080×1920 HTML/CSS Render Template for Headless Browser Capture.
 *
 * Produces a self-contained, high-fidelity visual template with modern styling
 * (Inter typography, gradients, shadows, 3D card flips, countdown rings)
 * driven deterministically via `window.__SEEK_FRAME__(frameIndex, timeSec)`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RenderInput } from '../types';
import type { SceneCard } from '../../scene/types';

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolveImageBase64(imagePath: string | undefined, rootDir: string): string | null {
  if (!imagePath) return null;
  const candidates = [
    path.isAbsolute(imagePath) ? imagePath : path.join(/*turbopackIgnore: true*/ rootDir, imagePath),
    path.join(/*turbopackIgnore: true*/ rootDir, 'assets', path.basename(imagePath)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const ext = path.extname(candidate).toLowerCase().replace('.', '') || 'png';
        const buffer = readFileSync(candidate);
        return `data:image/${ext};base64,${buffer.toString('base64')}`;
      } catch {
        // Fallback to placeholder
      }
    }
  }
  return null;
}

export function generateRenderHtml(input: RenderInput): string {
  const { game, timeline, sceneData, products, diversification, rootDir } = input;
  const mechanic = game.metadata.mechanic;
  const bgColor = diversification?.bgColor ?? '#0f172a';
  const isOneAway = mechanic === 'ONE_AWAY';
  const isMostExpensive = mechanic === 'MOST_EXPENSIVE';
  const isHiLo = mechanic === 'HI_LO';

  // Resolve products list with fallback to game.entities
  const resolvedProducts = (products && products.length > 0)
    ? products
    : (game.entities ?? []).map((e) => ({
        productId: e.productId,
        name: e.name ?? '',
        price: e.price ?? 0,
        image: e.image ?? `assets/${e.productId}.png`,
        brand: e.brand,
      }));

  // Resolve base64 for all products to guarantee immediate zero-latency rendering
  const productImages = resolvedProducts.map((p) => resolveImageBase64(p.image, rootDir ?? process.cwd()));

  const rawCards = (sceneData?.cards ?? []) as SceneCard[];
  const cards: SceneCard[] = rawCards.length > 0
    ? rawCards
    : (game.entities ?? []).map((e, idx) => ({
        productId: e.productId,
        name: e.name ?? '',
        image: e.image ?? `assets/${e.productId}.png`,
        priceLabel: isHiLo && idx === 1 ? '❓ GIÁ BÍ MẬT ❓' : formatVnd(e.price ?? 0),
        revealPriceLabel: formatVnd(e.price ?? 0),
        x: 0,
        y: 0,
        width: 380,
        height: 480,
      }));

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080, height=1920, initial-scale=1">
<title>${game.metadata.gameId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body, html {
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: ${bgColor};
    color: #ffffff;
    user-select: none;
  }

  /* 1080x1920 Stage */
  #stage {
    position: relative;
    width: 1080px;
    height: 1920px;
    background: radial-gradient(circle at 50% 25%, #1e293b 0%, #090d16 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 30px;
    padding: 80px 50px 440px 50px; /* Bottom 440px reserved clean for TikTok overlay & pixel-scan */
    overflow: hidden;
  }

  /* Ambient glowing background orbs */
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    pointer-events: none;
    opacity: 0.35;
  }
  .orb-1 { width: 600px; height: 600px; background: #6366f1; top: -100px; left: -100px; }
  .orb-2 { width: 500px; height: 500px; background: #ec4899; bottom: 100px; right: -80px; }

  /* Top Bar */
  .top-bar {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
  }
  .badge-mechanic {
    background: rgba(99, 102, 241, 0.2);
    border: 2px solid rgba(129, 140, 248, 0.5);
    color: #c7d2fe;
    padding: 12px 28px;
    border-radius: 9999px;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .timer-pill {
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.15);
    padding: 12px 24px;
    border-radius: 9999px;
    font-size: 22px;
    font-weight: 700;
    color: #94a3b8;
  }

  /* Question Header */
  .header-zone {
    text-align: center;
    max-width: 960px;
    z-index: 10;
    margin-top: 20px;
  }
  .hook-title {
    font-size: 38px;
    font-weight: 800;
    color: #fbbf24;
    text-shadow: 0 4px 18px rgba(251, 191, 36, 0.3);
    margin-bottom: 12px;
  }
  .question-box {
    background: rgba(255, 255, 255, 0.07);
    border: 3px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(20px);
    border-radius: 32px;
    padding: 24px 36px;
    font-size: 40px;
    font-weight: 900;
    line-height: 1.25;
    color: #ffffff;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }

  /* Center Stage: Cards Area */
  .center-stage {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 36px;
    z-index: 10;
    perspective: 1200px;
    margin: 40px 0;
  }

  /* Product Cards */
  .card {
    background: rgba(30, 41, 59, 0.75);
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-radius: 36px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(16px);
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .card-hilo { width: 450px; min-height: 640px; }
  .card-3col { width: 300px; min-height: 520px; padding: 20px; }
  .card-oneaway { width: 560px; min-height: 680px; }

  .card-img-wrap {
    width: 100%;
    aspect-ratio: 1/1;
    background: #ffffff;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-bottom: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }
  .card-img {
    width: 90%;
    height: 90%;
    object-fit: contain;
  }
  .card-img-placeholder {
    font-size: 80px;
    color: #475569;
  }
  .card-name {
    font-size: 26px;
    font-weight: 700;
    text-align: center;
    color: #e2e8f0;
    margin-bottom: 16px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-price-pill {
    background: rgba(16, 185, 129, 0.15);
    border: 2px solid rgba(16, 185, 129, 0.5);
    color: #34d399;
    padding: 14px 28px;
    border-radius: 20px;
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 0.02em;
  }
  .card-price-secret {
    background: rgba(245, 158, 11, 0.15);
    border: 2px solid rgba(245, 158, 11, 0.5);
    color: #fbbf24;
    padding: 14px 36px;
    border-radius: 20px;
    font-size: 38px;
    font-weight: 900;
  }

  /* One Away Special Card */
  .one-away-masked {
    display: flex;
    gap: 8px;
    font-size: 56px;
    font-weight: 900;
    color: #f1f5f9;
  }
  .masked-digit {
    background: #8b5cf6;
    color: #ffffff;
    padding: 4px 16px;
    border-radius: 12px;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
  }

  /* Countdown Overlay in Center */
  .countdown-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 320px;
    height: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 50;
    pointer-events: none;
    opacity: 0;
  }
  .countdown-ring {
    position: absolute;
    width: 300px;
    height: 300px;
    transform: rotate(-90deg);
  }
  .countdown-ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 16;
  }
  .countdown-ring-fill {
    fill: none;
    stroke: #ef4444;
    stroke-width: 16;
    stroke-linecap: round;
    stroke-dasharray: 880;
    stroke-dashoffset: 0;
  }
  .countdown-number {
    font-size: 140px;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 8px 30px rgba(239, 68, 68, 0.7);
  }

  /* Result Overlay Banner */
  .result-banner {
    position: absolute;
    top: 1240px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #059669, #10b981);
    border: 4px solid #34d399;
    padding: 24px 60px;
    border-radius: 36px;
    font-size: 44px;
    font-weight: 900;
    color: #ffffff;
    text-align: center;
    box-shadow: 0 20px 60px rgba(16, 185, 129, 0.6);
    z-index: 60;
    opacity: 0;
  }

  /* Bottom Zone / CTA placed in safe zone above y=1500 */
  .bottom-zone {
    width: 100%;
    text-align: center;
    z-index: 10;
    margin-top: 20px;
  }
  .cta-banner {
    background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
    padding: 20px 44px;
    border-radius: 9999px;
    font-size: 30px;
    font-weight: 900;
    color: #ffffff;
    box-shadow: 0 16px 40px rgba(99, 102, 241, 0.4);
    display: inline-block;
  }

  /* Progress bar */
  .progress-line {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 12px;
    background: linear-gradient(90deg, #6366f1, #ec4899);
    width: 0%;
    z-index: 100;
  }
</style>
</head>
<body>

<div id="stage">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>

  <!-- Top Bar -->
  <div class="top-bar">
    <div class="badge-mechanic">${mechanic} · QUIZ</div>
    <div class="timer-pill" id="timer-label">0.0s / 18.0s</div>
  </div>

  <!-- Question Header -->
  <div class="header-zone">
    <div class="hook-title" id="hook-title">${game.content.hook}</div>
    <div class="question-box" id="question-text">${game.content.question}</div>
  </div>

  <!-- Center Stage: Product Cards -->
  <div class="center-stage" id="center-stage">
    ${cards.map((card, idx) => {
      const imgData = productImages[idx];
      const imgHtml = imgData
        ? `<img src="${imgData}" class="card-img" alt="${card.name}">`
        : `<div class="card-img-placeholder">📦</div>`;
      const cardClass = isOneAway ? 'card card-oneaway' : isMostExpensive ? 'card card-3col' : 'card card-hilo';

      return `
      <div class="${cardClass}" id="card-${idx}">
        <div class="card-img-wrap">
          ${imgHtml}
        </div>
        <div class="card-name">${card.name}</div>
        <div class="card-price-pill" id="card-price-${idx}">
          ${card.priceLabel || ((products && products[idx]) ? formatVnd(products[idx].price) : '')}
        </div>
      </div>
      `;
    }).join('')}
  </div>

  <!-- Countdown Overlay -->
  <div class="countdown-container" id="countdown-overlay">
    <svg class="countdown-ring" viewBox="0 0 300 300">
      <circle class="countdown-ring-bg" cx="150" cy="150" r="140"></circle>
      <circle class="countdown-ring-fill" id="countdown-circle" cx="150" cy="150" r="140"></circle>
    </svg>
    <div class="countdown-number" id="countdown-num">3</div>
  </div>

  <!-- Result Banner -->
  <div class="result-banner" id="result-banner">
    🎯 ĐÁP ÁN: ${isHiLo ? (game.gameplay.answer === 'higher' ? 'CAO HƠN ⬆️' : 'THẤP HƠN ⬇️') : game.gameplay.answer}
  </div>

  <!-- Bottom Zone -->
  <div class="bottom-zone">
    <div class="cta-banner" id="cta-banner">${game.content.cta}</div>
  </div>
</div>

<script>
  // Timeline Slots defined by the Game Engine
  const SLOTS = ${JSON.stringify(timeline.slots)};
  const TOTAL_DURATION = ${timeline.totalDuration || 18.0};
  const CARDS_DATA = ${JSON.stringify(cards)};
  const GAME_DATA = ${JSON.stringify(game)};

  const timerLabel = document.getElementById('timer-label');
  const progressLine = document.getElementById('progress-line');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownCircle = document.getElementById('countdown-circle');
  const countdownNum = document.getElementById('countdown-num');
  const resultBanner = document.getElementById('result-banner');
  const ctaBanner = document.getElementById('cta-banner');

  // Full circumference = 2 * PI * 140 ~= 879.6
  const CIRCLE_CIRCUMFERENCE = 879.6;

  /**
   * Deterministic Frame Seek API:
   * Called by Headless Chromium at exact timestamps (30fps -> 0.0333s per frame).
   */
  window.__SEEK_FRAME__ = function(frameIndex, timeSec) {
    timeSec = Math.max(0, Math.min(TOTAL_DURATION, timeSec));

    // Update progress & timer
    if (progressLine) progressLine.style.width = ((timeSec / TOTAL_DURATION) * 100) + '%';
    if (timerLabel) timerLabel.innerText = timeSec.toFixed(1) + 's / ' + TOTAL_DURATION.toFixed(1) + 's';

    // Find current scene slot
    let activeSlot = SLOTS.find(s => timeSec >= s.start && timeSec < s.end) || SLOTS[SLOTS.length - 1];
    let scene = activeSlot ? activeSlot.type : 'hook';
    let progressInSlot = activeSlot ? (timeSec - activeSlot.start) / activeSlot.duration : 0;

    // Countdown Scene (8.0s - 11.0s)
    if (scene === 'countdown') {
      countdownOverlay.style.opacity = '1';
      let remaining = Math.max(0, 3 - (progressInSlot * 3));
      let currentDigit = Math.min(3, Math.max(1, Math.ceil(remaining)));
      countdownNum.innerText = currentDigit;

      let ringProgress = 1 - progressInSlot;
      countdownCircle.style.strokeDashoffset = (CIRCLE_CIRCUMFERENCE * (1 - ringProgress));
    } else {
      countdownOverlay.style.opacity = '0';
    }

    // Reveal Scene (11.0s - 13.0s)
    if (timeSec >= 11.0) {
      // Reveal the true price on secret cards
      CARDS_DATA.forEach((card, idx) => {
        let priceEl = document.getElementById('card-price-' + idx);
        if (priceEl && card.revealPriceLabel) {
          priceEl.innerText = card.revealPriceLabel;
          priceEl.className = 'card-price-pill';
          priceEl.style.borderColor = '#10b981';
          priceEl.style.color = '#34d399';
        }
      });
    }

    // Result Scene (13.0s - 15.0s)
    if (scene === 'result') {
      resultBanner.style.opacity = '1';
    } else {
      resultBanner.style.opacity = '0';
    }

    // CTA Scene (15.0s - 18.0s)
    if (scene === 'cta') {
      ctaBanner.style.transform = 'scale(1.08)';
    } else {
      ctaBanner.style.transform = 'scale(1.0)';
    }
  };

  // Seek to initial frame 0
  window.__SEEK_FRAME__(0, 0);
</script>
</body>
</html>`;
}
