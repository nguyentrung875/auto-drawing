import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../game';
import type { Product } from '../product/schema';
import { SceneSystem, buildSceneTimeline } from '../scene';
import type { SceneData } from '../scene';
import type { ComputedGame, GameJson, Timeline } from '../types/game';

export interface PreviewOptions {
  outputDir?: string;
  timeline?: Timeline;
  computed?: ComputedGame;
  sceneData?: SceneData;
  autoPlay?: boolean;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function cardHtml(product: Product): string {
  return `<article class="card" data-product-id="${escapeHtml(product.productId)}">
    <div class="card-image">📦 ${escapeHtml(product.productId)}</div>
    <div class="card-name">${escapeHtml(product.name)}</div>
    <div class="card-price">${escapeHtml(product.price.toLocaleString('vi-VN'))}₫</div>
  </article>`;
}

function answerFor(game: GameJson, computed?: ComputedGame): string {
  const answer = computed?.answer ?? game.gameplay.answer;
  return answer === undefined ? '' : String(answer);
}

function revealHtml(game: GameJson, products: Product[], computed?: ComputedGame, sceneData?: SceneData): string {
  const answer = answerFor(game, computed);
  if (game.metadata.mechanic === 'ONE_AWAY') {
    const masked = sceneData?.maskedPrice ?? '?';
    return `<div class="reveal digit-reveal" data-reveal-type="DigitReveal">
      <span class="masked">${escapeHtml(masked)}</span><span class="flip-arrow">→</span><span class="digit">${escapeHtml(answer)}</span>
      <small>DigitReveal · flip</small>
    </div>`;
  }
  const priceLabels = products.map((product) => `${product.name}: ${product.price.toLocaleString('vi-VN')}₫`);
  return `<div class="reveal" data-reveal-type="PriceReveal">
    <div>PriceReveal</div><strong>${escapeHtml(answer.toUpperCase())}</strong>
    <small>${escapeHtml(priceLabels.join(' · '))}</small>
  </div>`;
}

function sceneLabel(scene: string, duration: number): string {
  return `<span class="timeline-segment" style="flex:${duration}" data-scene="${scene}">${scene} ${duration}s</span>`;
}

function buildPreviewHtml(
  game: GameJson,
  products: Product[],
  timeline: Timeline,
  computed?: ComputedGame,
  sceneData?: SceneData,
  autoPlay = true,
): string {
  const diversification = computed?.diversification ?? {
    bgColor: '#fef3c7',
    tilt: 0,
    bgm: game.audio.music?.track ?? 'tension_01',
  };
  const variant = game.metadata.result_variant ?? 'in_video';
  const cards = products.length > 0
    ? products.map(cardHtml).join('')
    : game.entities.map((entity) => `<article class="card"><div class="card-image">📦 ${escapeHtml(entity.productId)}</div></article>`).join('');
  const result = variant === 'comment'
    ? '<div class="result comment-result">Đáp án ở comment 👇</div>'
    : `<div class="result video-result">✅ Đáp án: ${escapeHtml(answerFor(game, computed))}</div>`;
  const timelineHtml = timeline.slots.map((slot) => sceneLabel(slot.type, slot.duration)).join('');
  const durations = timeline.slots.map((slot) => slot.duration);
  const total = timeline.totalDuration;
  const audioCues = (game.audio.sfx ?? []).map((cue) => `${cue.type}@${cue.at}s`).join(', ');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview ${escapeHtml(game.metadata.gameId)} — ${escapeHtml(game.metadata.mechanic)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,system-ui,sans-serif;background:${escapeHtml(diversification.bgColor)};color:#111827}
body{padding:24px}.preview-shell{width:min(100%,520px);margin:auto;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 14px 44px #11182726}
.timeline{display:flex;height:26px;background:#111827;color:#fff}.timeline-segment{min-width:0;padding:6px 4px;border-right:1px solid #ffffff55;font-size:10px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stage{position:relative;width:100%;aspect-ratio:9/16;overflow:hidden;background:linear-gradient(160deg,#fffef2,#fef3c7);transform:rotate(${escapeHtml(diversification.tilt)}deg);transform-origin:center}
.scene{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:34px;text-align:center}.scene.active{display:flex}
.badge{padding:6px 12px;border-radius:99px;background:#111827;color:#fff;font-size:11px;letter-spacing:.08em}.hook{font-size:29px;font-weight:850;line-height:1.1}.question{font-size:22px;font-weight:750;line-height:1.2}.voice{max-width:390px;color:#4b5563;font-size:12px}
.cards{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;width:100%}.card{width:min(400px,42%);min-width:140px;padding:16px 12px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 5px 14px #11182712}.card-image{height:54px;display:grid;place-items:center;background:#f3f4f6;border-radius:10px;font-size:13px;color:#6b7280}.card-name{margin-top:10px;font-weight:700;font-size:14px}.card-price{margin-top:7px;color:#047857;font-weight:850}.count{font-size:92px;line-height:1;font-weight:950;color:#dc2626}.tick-note{font-size:12px;color:#6b7280}.reveal{display:flex;flex-direction:column;gap:10px;max-width:430px;padding:22px;border:3px solid #111827;border-radius:18px;background:#fff;font-size:18px}.reveal strong{font-size:44px;color:#047857}.reveal small{font-size:12px;color:#6b7280}.digit-reveal{border-color:#7c3aed}.digit-reveal .masked{font-size:32px;font-weight:800}.digit-reveal .digit{font-size:60px;font-weight:950;color:#7c3aed}.flip-arrow{font-size:22px}.result{padding:15px 18px;border-radius:14px;font-weight:800}.video-result{background:#dcfce7;color:#065f46}.comment-result{background:#fef3c7;color:#92400e}.cta{padding:14px 22px;border-radius:99px;background:#111827;color:#fff;font-size:18px;font-weight:800}.meta,.controls{padding:14px 18px;border-top:1px solid #e5e7eb}.meta{font-size:12px;line-height:1.55;color:#4b5563}.controls{display:flex;align-items:center;justify-content:center;gap:10px}.controls button{padding:8px 14px;border:1px solid #111827;border-radius:99px;background:#fff;cursor:pointer}.controls .primary{background:#111827;color:#fff}.timer{font-size:12px;color:#6b7280}
</style>
</head>
<body>
<main class="preview-shell">
  <div class="timeline">${timelineHtml}</div>
  <section class="stage" id="stage" data-width="1080" data-height="1920" data-tilt="${escapeHtml(diversification.tilt)}">
    <div class="scene active" data-scene="hook"><span class="badge">HOOK · 2s</span><div class="hook">${escapeHtml(game.content.hook)}</div><div class="voice">seed ${escapeHtml(game.metadata.seed)} · ${escapeHtml(variant)} · ${escapeHtml(diversification.bgm)}</div></div>
    <div class="scene" data-scene="product"><span class="badge">PRODUCT · 3s</span><div class="cards">${cards}</div></div>
    <div class="scene" data-scene="question"><span class="badge">QUESTION · 3s</span><div class="question">${escapeHtml(game.content.question)}</div><div class="voice">🎙️ ${escapeHtml(game.audio.voice.script || game.content.voice_script)}</div></div>
    <div class="scene" data-scene="countdown"><span class="badge">COUNTDOWN · 3s</span><div class="count" id="count">3</div><div class="tick-note">SFX tick mỗi 0.5s · ${escapeHtml(audioCues)}</div></div>
    <div class="scene" data-scene="reveal"><span class="badge">REVEAL · 2s</span>${revealHtml(game, products, computed, sceneData)}</div>
    <div class="scene" data-scene="result"><span class="badge">RESULT · 2s</span>${result}</div>
    <div class="scene" data-scene="cta"><span class="badge">CTA · 3s</span><div class="cta">${escapeHtml(game.content.cta)}</div><div class="voice">affiliate link stays in caption/comment</div></div>
  </section>
  <div class="meta"><strong>${escapeHtml(game.content.title)} — ${escapeHtml(game.metadata.mechanic)}</strong><br>Timeline: ${escapeHtml(timeline.slots.map((slot) => `${slot.type} ${slot.duration}s`).join(' → '))} = ${total}s<br>Reveal: ${escapeHtml(computed?.revealType ?? (game.metadata.mechanic === 'ONE_AWAY' ? 'DigitReveal' : 'PriceReveal'))} · countdown ticks: 6</div>
  <div class="controls"><button class="primary" id="play">▶ Play ${total}s</button><button id="restart">↺ Restart</button><span class="timer" id="timer">0.0s / ${total}s</span></div>
</main>
<script>
const scenes=[...document.querySelectorAll('.scene')];
const durations=${jsonForScript(durations)};const total=${total};const autoPlay=${autoPlay};
let raf=0,start=0,index=0;
function show(next){index=next;scenes.forEach((scene,i)=>scene.classList.toggle('active',i===next));}
function updateCountdown(elapsed){const begin=durations.slice(0,3).reduce((a,b)=>a+b,0);const value=Math.max(0,3-Math.floor((elapsed-begin)*2)/2);document.getElementById('count').textContent=String(value%1===0?value:value.toFixed(1));}
function play(){cancelAnimationFrame(raf);start=performance.now();show(0);document.getElementById('count').textContent='3';function tick(now){const elapsed=Math.min(total,(now-start)/1000);document.getElementById('timer').textContent=elapsed.toFixed(1)+'s / '+total+'s';let cursor=0,next=durations.length-1;for(let i=0;i<durations.length;i++){cursor+=durations[i];if(elapsed<cursor){next=i;break;}}if(next!==index)show(next);if(scenes[index]?.dataset.scene==='countdown')updateCountdown(elapsed);if(elapsed<total)raf=requestAnimationFrame(tick);else document.getElementById('timer').textContent=total.toFixed(1)+'s — done';}raf=requestAnimationFrame(tick);}
function restart(){cancelAnimationFrame(raf);show(0);document.getElementById('count').textContent='3';document.getElementById('timer').textContent='0.0s / '+total+'s';}
document.getElementById('play').addEventListener('click',play);document.getElementById('restart').addEventListener('click',restart);if(autoPlay)play();
</script>
</body>
</html>`;
}

export function generatePreviewHtml(
  game: GameJson,
  products: Product[] = [],
  options: PreviewOptions = {},
): string {
  let computed = options.computed;
  let timeline = options.timeline;
  if (!timeline) {
    if (products.length > 0) {
      computed ??= GameEngine.compute(game, products, game.metadata.seed);
      timeline = computed.timeline;
    } else {
      timeline = buildSceneTimeline(game.scenes as Parameters<typeof buildSceneTimeline>[0]);
    }
  }
  SceneSystem.render(game, {
    products,
    computed,
    sceneData: options.sceneData,
    timeline,
  });
  return buildPreviewHtml(game, products, timeline, computed, options.sceneData, options.autoPlay);
}

export function writePreviewFile(
  game: GameJson,
  products: Product[] = [],
  options: PreviewOptions = {},
): string {
  const outputDir = path.resolve(options.outputDir ?? 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `preview_${game.metadata.mechanic.toLowerCase()}.html`);
  writeFileSync(outputPath, generatePreviewHtml(game, products, options), 'utf8');
  return outputPath;
}

export class PreviewRenderer {
  constructor(private readonly defaults: PreviewOptions = {}) {}

  render(game: GameJson, products: Product[] = [], options: PreviewOptions = {}): string {
    return generatePreviewHtml(game, products, { ...this.defaults, ...options });
  }

  write(game: GameJson, products: Product[] = [], options: PreviewOptions = {}): string {
    return writePreviewFile(game, products, { ...this.defaults, ...options });
  }
}

export const generatePreview = generatePreviewHtml;
export const renderPreview = generatePreviewHtml;
export const writePreview = writePreviewFile;
export const renderPreviewFile = writePreviewFile;
