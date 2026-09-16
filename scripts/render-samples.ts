import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findBrowserExecutable } from '../src/render/browserFrameRenderer';
import { BUILTIN_THEMES } from '../src/core/theme/themes';

const ROOT = process.cwd();
const ARTIFACT_DIR = 'C:/Users/trungnv0500/.gemini/antigravity/brain/fa8f091d-ae1b-484e-b30a-264eebbf0bc8';
const EXPORT_DIR = path.join(ROOT, 'export', 'test_renders');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function resolveBase64(relPath: string): string {
  const full = path.join(ROOT, relPath);
  if (fs.existsSync(full)) {
    const ext = path.extname(full).replace('.', '') || 'png';
    return `data:image/${ext};base64,${fs.readFileSync(full).toString('base64')}`;
  }
  return '';
}

function getProduct(id: string) {
  const pPath = path.join(ROOT, 'products', `${id}.json`);
  const data = JSON.parse(fs.readFileSync(pPath, 'utf-8'));
  return {
    ...data,
    imageBase64: resolveBase64(data.image),
  };
}

function generateHiLoHtml(themeKey: 'tv_game_show' | 'clean_shopping' | 'cyber_arcade') {
  const theme = BUILTIN_THEMES[themeKey]!;
  const pA = getProduct('p001');
  const pB = getProduct('p042');

  const isTv = themeKey === 'tv_game_show';
  const isShopping = themeKey === 'clean_shopping';
  const isCyber = themeKey === 'cyber_arcade';

  const bgGradient = `linear-gradient(180deg, ${theme.colors.backgroundGradient[0]}, ${theme.colors.backgroundGradient[1]})`;
  const accent = theme.colors.accent;
  const cardRadius = theme.geometry.cardBorderRadius;
  const cardBorder = theme.colors.cardBorder;
  const cardBg = theme.colors.cardBackground;
  const cardShadow = theme.colors.cardShadow;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: ${bgGradient};
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 160px 50px 440px 50px;
    position: relative;
  }

  ${isTv ? `
  .spotlight {
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    width: 950px;
    height: 950px;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.22) 0%, transparent 70%);
    pointer-events: none;
  }
  ` : ''}

  ${isCyber ? `
  .cyber-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6, 182, 212, 0.08) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .scanline {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 2px, transparent 2px, transparent 4px);
    pointer-events: none;
  }
  ` : ''}

  .top-badge {
    padding: 14px 40px;
    border-radius: 9999px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${accent};
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid ${accent};
    margin-bottom: 24px;
    z-index: 10;
  }

  .hook-title {
    font-size: 48px;
    font-weight: 900;
    text-align: center;
    color: ${accent};
    text-shadow: 0 4px 24px ${accent}66;
    margin-bottom: 14px;
    z-index: 10;
  }

  .question-box {
    background: rgba(255, 255, 255, 0.06);
    border: 2px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(20px);
    border-radius: 28px;
    padding: 26px 44px;
    font-size: 38px;
    font-weight: 800;
    text-align: center;
    line-height: 1.35;
    max-width: 980px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.35);
    margin-bottom: 40px;
    z-index: 10;
  }

  .cards-container {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: 36px;
    z-index: 10;
    margin-bottom: 44px;
  }

  .card {
    width: 450px;
    background: ${cardBg};
    border: ${isCyber ? '4px' : '3px'} solid ${cardBorder};
    border-radius: ${cardRadius}px;
    box-shadow: ${cardShadow};
    padding: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .card-img-wrap {
    width: 100%;
    aspect-ratio: 1/1;
    background: #ffffff;
    border-radius: ${Math.max(12, cardRadius - 8)}px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    overflow: hidden;
  }
  .card-img {
    width: 85%;
    height: 85%;
    object-fit: contain;
  }

  .card-name {
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    color: #e2e8f0;
    margin-bottom: 16px;
    line-height: 1.3;
    height: 62px;
    overflow: hidden;
  }

  .price-pill-known {
    background: rgba(16, 185, 129, 0.15);
    border: 2px solid #10b981;
    color: #34d399;
    padding: 12px 30px;
    border-radius: 18px;
    font-size: 34px;
    font-weight: 900;
    letter-spacing: 0.03em;
  }

  .price-pill-secret {
    background: rgba(245, 158, 11, 0.15);
    border: 2px solid #f59e0b;
    color: #fbbf24;
    padding: 12px 32px;
    border-radius: 18px;
    font-size: 34px;
    font-weight: 900;
    letter-spacing: 0.05em;
  }

  .choices-container {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: 32px;
    z-index: 10;
  }

  .choice-btn {
    flex: 1;
    max-width: 440px;
    padding: 28px 20px;
    border-radius: ${cardRadius}px;
    font-size: 38px;
    font-weight: 900;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 16px 36px rgba(0,0,0,0.4);
    border: 3px solid transparent;
  }
  .choice-higher {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #ffffff;
    border-color: #34d399;
  }
  .choice-lower {
    background: linear-gradient(135deg, #dc2626, #f43f5e);
    color: #ffffff;
    border-color: #fb7185;
  }

  .footer-cta {
    margin-top: 54px;
    padding: 20px 52px;
    background: rgba(255,255,255,0.08);
    border: 2px dashed rgba(255,255,255,0.25);
    border-radius: 9999px;
    font-size: 26px;
    font-weight: 800;
    color: #cbd5e1;
    z-index: 10;
  }
</style>
</head>
<body>
  ${isTv ? '<div class="spotlight"></div>' : ''}
  ${isCyber ? '<div class="cyber-grid"></div><div class="scanline"></div>' : ''}

  <div class="top-badge">${theme.name} · HI-LO</div>
  <div class="hook-title">🔥 TRẬN CHIẾN GIÁ CẢ 🔥</div>
  <div class="question-box">Món B có giá CAO HƠN hay THẤP HƠN món mốc A?</div>

  <div class="cards-container">
    <div class="card">
      <div class="card-img-wrap"><img class="card-img" src="${pA.imageBase64}"></div>
      <div class="card-name">${pA.name}</div>
      <div class="price-pill-known">189.000₫</div>
    </div>
    <div class="card">
      <div class="card-img-wrap"><img class="card-img" src="${pB.imageBase64}"></div>
      <div class="card-name">${pB.name}</div>
      <div class="price-pill-secret">❓ GIÁ BÍ MẬT ❓</div>
    </div>
  </div>

  <div class="choices-container">
    <div class="choice-btn choice-higher">⬆️ CAO HƠN</div>
    <div class="choice-btn choice-lower">⬇️ THẤP HƠN</div>
  </div>

  <div class="footer-cta">⏱️ 3 GIÂY SUY NGHĨ · BÌNH LUẬN ĐÁP ÁN!</div>
</body>
</html>`;
}

function generateGroceryBasketHtml() {
  const p1 = getProduct('p014');
  const p2 = getProduct('p027');
  const p3 = getProduct('p037');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(180deg, #18181b 0%, #09090b 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 160px 40px 440px 40px;
    position: relative;
  }

  .top-badge {
    padding: 14px 40px;
    border-radius: 9999px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f97316;
    background: rgba(249, 115, 22, 0.12);
    border: 2px solid #f97316;
    margin-bottom: 24px;
    z-index: 10;
  }

  .budget-banner {
    background: linear-gradient(90deg, #ea580c, #f97316);
    border: 3px solid #fdba74;
    padding: 20px 52px;
    border-radius: 32px;
    font-size: 44px;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 4px 12px rgba(0,0,0,0.3);
    box-shadow: 0 16px 36px rgba(234, 88, 12, 0.4);
    margin-bottom: 26px;
    z-index: 10;
  }

  .question-box {
    background: rgba(255, 255, 255, 0.07);
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
    padding: 22px 40px;
    font-size: 36px;
    font-weight: 800;
    text-align: center;
    max-width: 980px;
    line-height: 1.35;
    margin-bottom: 40px;
    z-index: 10;
  }

  /* 3-Item Tray */
  .tray-container {
    width: 100%;
    background: rgba(39, 39, 42, 0.75);
    border: 3px solid rgba(244, 244, 245, 0.2);
    border-radius: 36px;
    padding: 24px 20px;
    display: flex;
    justify-content: space-between;
    gap: 18px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    backdrop-filter: blur(16px);
    margin-bottom: 44px;
    z-index: 10;
  }

  .tray-item {
    flex: 1;
    background: #18181b;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .item-img-wrap {
    width: 100%;
    aspect-ratio: 1/1;
    background: #ffffff;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    overflow: hidden;
  }
  .item-img {
    width: 85%;
    height: 85%;
    object-fit: contain;
  }

  .item-name {
    font-size: 20px;
    font-weight: 700;
    text-align: center;
    color: #e4e4e7;
    margin-bottom: 14px;
    height: 52px;
    overflow: hidden;
    line-height: 1.3;
  }

  .item-price-secret {
    background: rgba(249, 115, 22, 0.15);
    border: 2px solid #f97316;
    color: #fb923c;
    padding: 10px 20px;
    border-radius: 16px;
    font-size: 28px;
    font-weight: 900;
  }

  .choices-container {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: 30px;
    z-index: 10;
  }

  .choice-btn {
    flex: 1;
    max-width: 460px;
    padding: 28px 20px;
    border-radius: 28px;
    font-size: 36px;
    font-weight: 900;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16px 36px rgba(0,0,0,0.4);
    border: 3px solid transparent;
  }
  .choice-under {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #ffffff;
    border-color: #34d399;
  }
  .choice-over {
    background: linear-gradient(135deg, #e11d48, #f43f5e);
    color: #ffffff;
    border-color: #fb7185;
  }

  .footer-cta {
    margin-top: 48px;
    padding: 20px 52px;
    background: rgba(255,255,255,0.08);
    border: 2px dashed rgba(255,255,255,0.25);
    border-radius: 9999px;
    font-size: 26px;
    font-weight: 800;
    color: #a1a1aa;
    z-index: 10;
  }
</style>
</head>
<body>
  <div class="top-badge">G7 · GIỎ HÀNG ĐI CHỢ</div>
  <div class="budget-banner">💵 NGÂN SÁCH: 400.000₫</div>
  <div class="question-box">Cả 3 món này cộng lại: Liệu ĐỦ TIỀN hay CHÁY TÚI?</div>

  <div class="tray-container">
    <div class="tray-item">
      <div class="item-img-wrap"><img class="item-img" src="${p1.imageBase64}"></div>
      <div class="item-name">${p1.name}</div>
      <div class="item-price-secret">❓ ??? ❓</div>
    </div>
    <div class="tray-item">
      <div class="item-img-wrap"><img class="item-img" src="${p2.imageBase64}"></div>
      <div class="item-name">${p2.name}</div>
      <div class="item-price-secret">❓ ??? ❓</div>
    </div>
    <div class="tray-item">
      <div class="item-img-wrap"><img class="item-img" src="${p3.imageBase64}"></div>
      <div class="item-name">${p3.name}</div>
      <div class="item-price-secret">❓ ??? ❓</div>
    </div>
  </div>

  <div class="choices-container">
    <div class="choice-btn choice-under">🛒 ĐỦ TIỀN</div>
    <div class="choice-btn choice-over">💥 CHÁY TÚI</div>
  </div>

  <div class="footer-cta">⏱️ 3 GIÂY ĐOÁN GIÁ · CHÁY TÚI HAY ĐỦ?</div>
</body>
</html>`;
}

function generateOneAwayHtml() {
  const p = getProduct('p003'); // Nồi chiên không dầu Lock&Lock

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(180deg, #09090b 0%, #180828 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 160px 50px 440px 50px;
    position: relative;
  }

  .cyber-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6, 182, 212, 0.08) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  .top-badge {
    padding: 14px 40px;
    border-radius: 6px;
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #06b6d4;
    background: rgba(6, 182, 212, 0.15);
    border: 3px solid #06b6d4;
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
    margin-bottom: 24px;
    z-index: 10;
  }

  .hook-title {
    font-size: 48px;
    font-weight: 900;
    text-align: center;
    color: #f43f5e;
    text-shadow: 0 0 25px rgba(244, 63, 94, 0.6);
    margin-bottom: 14px;
    z-index: 10;
  }

  .question-box {
    background: rgba(18, 14, 36, 0.85);
    border: 2px solid #06b6d4;
    border-radius: 16px;
    padding: 24px 40px;
    font-size: 38px;
    font-weight: 800;
    text-align: center;
    max-width: 980px;
    box-shadow: 0 0 30px rgba(6, 182, 212, 0.25);
    margin-bottom: 40px;
    z-index: 10;
  }

  .card {
    width: 650px;
    background: #120e24;
    border: 4px solid #06b6d4;
    border-radius: 12px;
    box-shadow: 0 0 40px rgba(6, 182, 212, 0.35);
    padding: 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 40px;
    z-index: 10;
  }

  .card-img-wrap {
    width: 480px;
    height: 480px;
    background: #ffffff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    overflow: hidden;
  }
  .card-img {
    width: 85%;
    height: 85%;
    object-fit: contain;
  }

  .card-name {
    font-size: 32px;
    font-weight: 800;
    text-align: center;
    color: #f0fdf4;
    margin-bottom: 24px;
    line-height: 1.3;
  }

  /* Masked Digit Display */
  .masked-price-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 60px;
    font-weight: 900;
    letter-spacing: 0.05em;
  }

  .digit-box {
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.2);
    padding: 8px 18px;
    border-radius: 8px;
    color: #ffffff;
  }

  .digit-secret {
    background: #f43f5e;
    border: 3px solid #fda4af;
    color: #ffffff;
    padding: 8px 24px;
    border-radius: 8px;
    box-shadow: 0 0 30px rgba(244, 63, 94, 0.8);
  }

  .choices-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    z-index: 10;
  }

  .keypad-row {
    display: flex;
    justify-content: center;
    gap: 18px;
  }

  .digit-key {
    width: 120px;
    height: 90px;
    border-radius: 8px;
    font-size: 42px;
    font-weight: 900;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.35);
    border: 3px solid #06b6d4;
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
  }

  .footer-cta {
    margin-top: 40px;
    padding: 18px 48px;
    border: 2px dashed #06b6d4;
    border-radius: 6px;
    font-size: 24px;
    font-weight: 800;
    color: #67e8f9;
    z-index: 10;
  }
</style>
</head>
<body>
  <div class="cyber-grid"></div>

  <div class="top-badge">👾 ONE AWAY · BÀN PHÍM 10 SỐ</div>
  <div class="hook-title">⚡ ĐOÁN CHỮ SỐ BÍ ẨN ⚡</div>
  <div class="question-box">Chữ số bí ẩn còn thiếu từ 0 đến 9 là số mấy?</div>

  <div class="card">
    <div class="card-img-wrap"><img class="card-img" src="${p.imageBase64}"></div>
    <div class="card-name">${p.name}</div>
    <div class="masked-price-wrap">
      <div class="digit-box">1</div>
      <div class="digit-box">.</div>
      <div class="digit-secret">?</div>
      <div class="digit-box">9</div>
      <div class="digit-box">0</div>
      <div class="digit-box">.</div>
      <div class="digit-box">0</div>
      <div class="digit-box">0</div>
      <div class="digit-box">0</div>
      <div class="digit-box">₫</div>
    </div>
  </div>

  <div class="choices-container">
    <div class="keypad-row">
      <div class="digit-key">0</div>
      <div class="digit-key">1</div>
      <div class="digit-key">2</div>
      <div class="digit-key">3</div>
      <div class="digit-key">4</div>
    </div>
    <div class="keypad-row">
      <div class="digit-key">5</div>
      <div class="digit-key">6</div>
      <div class="digit-key">7</div>
      <div class="digit-key">8</div>
      <div class="digit-key">9</div>
    </div>
  </div>

  <div class="footer-cta">⏱️ 3 GIÂY SUY NGHĨ · BÌNH LUẬN CON SỐ BẠN CHỌN!</div>
</body>
</html>`;
}

async function run() {
  console.log('Finding browser executable...');
  const execPath = findBrowserExecutable();
  if (!execPath) {
    throw new Error('No Chrome or Edge browser executable found on system!');
  }
  console.log('Using browser at:', execPath);

  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1080,1920'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  const tasks = [
    { name: 'hilo_tv_game_show.png', html: generateHiLoHtml('tv_game_show') },
    { name: 'hilo_clean_shopping.png', html: generateHiLoHtml('clean_shopping') },
    { name: 'hilo_cyber_arcade.png', html: generateHiLoHtml('cyber_arcade') },
    { name: 'grocery_basket.png', html: generateGroceryBasketHtml() },
    { name: 'one_away.png', html: generateOneAwayHtml() },
  ];

  for (const t of tasks) {
    console.log(`Rendering ${t.name}...`);
    await page.setContent(t.html, { waitUntil: 'load' });
    const outWorkspace = path.join(EXPORT_DIR, t.name);
    const outArtifact = path.join(ARTIFACT_DIR, t.name);

    await page.screenshot({ path: outWorkspace, type: 'png' });
    fs.copyFileSync(outWorkspace, outArtifact);
    console.log(`Saved: ${outWorkspace} and copied to artifact: ${outArtifact}`);
  }

  await browser.close();
  console.log('All 5 test render images generated successfully!');
}

run().catch((err) => {
  console.error('Error rendering samples:', err);
  process.exit(1);
});
