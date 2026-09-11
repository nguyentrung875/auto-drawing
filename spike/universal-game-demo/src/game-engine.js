// AD-10: Game Engine — deterministic answer + timeline + seed PRNG
function seededRandom(seed) {
  // simple xorshift determinism
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function computeAnswer(game, resolvedProducts, seed) {
  const mechanic = game.metadata.mechanic;
  const rand = seededRandom(seed);
  if (mechanic === 'HI_LO') {
    const [a,b] = resolvedProducts;
    const answer = b.price > a.price ? 'higher' : 'lower';
    return { answer, priceA: a.price, priceB: b.price, _randSample: rand() };
  }
  if (mechanic === 'MOST_EXPENSIVE') {
    let max = resolvedProducts[0];
    for (const p of resolvedProducts) if (p.price > max.price) max = p;
    return { answer: max.productId, prices: resolvedProducts.map(p=>({id:p.productId, price:p.price})), _randSample: rand() };
  }
  if (mechanic === 'ONE_AWAY') {
    const price = resolvedProducts[0].price;
    const priceStr = String(price);
    const idx = game.gameplay.hidden_index ?? 2;
    const correct_digit = priceStr[idx];
    const correctNum = parseInt(correct_digit, 10);
    const wrongNum = (correctNum + 1) % 10; // delta 1
    const options = [correctNum, wrongNum].sort(() => rand() - 0.5); // seeded shuffle via rand sample
    // For determinism, use rand to decide order: if rand()<0.5 keep, else swap
    const r = rand();
    const ordered = r < 0.5 ? [correctNum, wrongNum] : [wrongNum, correctNum];
    return { answer: correctNum, correct_digit, hidden_index: idx, price, priceStr, options: ordered, _randSample: r };
  }
  throw new Error(`unknown mechanic ${mechanic}`);
}

function buildTimeline(game, seed) {
  // 7 scenes: Hook 2s, Product 3s, Question 3s, Countdown 3s, Reveal 2s, Result 2s, CTA 3s = 18s
  const base = [
    { type: 'hook', duration: 2.0 },
    { type: 'product', duration: 3.0 },
    { type: 'question', duration: 3.0 },
    { type: 'countdown', duration: 3.0 },
    { type: 'reveal', duration: 2.0 },
    { type: 'result', duration: 2.0 },
    { type: 'cta', duration: 3.0 },
  ];
  // For MVP, fixed 18s; total must be 15-21s per FR-3
  let t = 0;
  const timeline = base.map(s => {
    const start = t;
    t += s.duration;
    return { ...s, start, end: t };
  });
  const totalDuration = t;
  // Check countdown is 3.0 ±0.1
  const countdown = timeline.find(s=>s.type==='countdown');
  if (Math.abs(countdown.duration - 3.0) > 0.1) throw new Error('E_TIMELINE_DRIFT');
  return { timeline, totalDuration };
}

function diversification(seed) {
  const rand = seededRandom(seed);
  const colors = ['#fef3c7','#fee2e2','#dbeafe','#dcfce7','#f3e8ff'];
  const tilts = [-2,-1,0,1,2];
  const bgms = ['tension_01','tension_02','tension_03'];
  return {
    bgColor: colors[Math.floor(rand()*colors.length)],
    tilt: tilts[Math.floor(rand()*tilts.length)],
    bgm: bgms[Math.floor(rand()*bgms.length)],
    _seed: seed
  };
}

module.exports = { computeAnswer, buildTimeline, seededRandom, diversification };
