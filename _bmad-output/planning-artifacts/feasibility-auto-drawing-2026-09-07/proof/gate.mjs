#!/usr/bin/env node
/**
 * gate.mjs — Transformation Gate (C0..C3)
 * ------------------------------------------------------------------
 * Zero-dependency Node CLI. Đọc templates.json, tính chính xác:
 *   C0 Glyph Absorption   — số nét hook không map được vào bộ phận nào
 *   C1 Hook Load-bearing  — Fragmentation Index (số cụm nét rời sau khi bỏ hook)
 *   C2 Hook Ink Ratio     — hookLength / totalLength
 *   C3 Stroke Budget      — số nét + tổng thời lượng
 *
 * Logic GIỐNG HỆT index.html (pad = 14px, bbox = geometry bbox không tính stroke)
 * để số liệu trong browser và trong CI khớp nhau từng chữ số.
 *
 * Đây là prototype của thứ mà PRD §FR-5 đang thiếu: một scoring rubric đo được.
 * C4 (Recognizability) và C5 (Progressive Surprise) cần sketch classifier — xem R0.
 *
 * Dùng: node gate.mjs [--json out.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAD = 14;                 // px — ngưỡng "hai nét được coi là chạm nhau"
const SAMPLES_PER_SEG = 64;     // độ mịn khi lấy mẫu đường cong
const THRESH = { C1_MIN_COMPONENTS: 3, C2_MIN_INK_RATIO: 0.30, C3_MAX_STROKES: 14, C3_MAX_DRAW_SECONDS: 25 };

/* ======================= SVG path parser ======================= */

function tokenize(d) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  const out = [];
  let m;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) out.push({ cmd: m[1] });
    else out.push({ num: parseFloat(m[2]) });
  }
  return out;
}

/** Elliptical arc -> cubic beziers (theo SVG spec F.6.5) */
function arcToBeziers(x1, y1, rx, ry, phiDeg, fA, fS, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2, x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const sign = fA === fS ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = co * ((rx * y1p) / ry);
  const cyp = co * ((-ry * x1p) / rx);
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fS && dth > 0) dth -= 2 * Math.PI;
  if (fS && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2)));
  const step = dth / n;
  const bez = [];
  let th = th1;
  for (let i = 0; i < n; i++) {
    const a1 = th, a2 = th + step;
    const alpha = (4 / 3) * Math.tan((a2 - a1) / 4);
    const p = (a) => [cx + rx * Math.cos(a) * cosP - ry * Math.sin(a) * sinP,
                      cy + rx * Math.cos(a) * sinP + ry * Math.sin(a) * cosP];
    const p1 = p(a1), p2 = p(a2);
    const t1 = [-rx * Math.sin(a1) * cosP - ry * Math.cos(a1) * sinP,
                -rx * Math.sin(a1) * sinP + ry * Math.cos(a1) * cosP];
    const t2 = [-rx * Math.sin(a2) * cosP - ry * Math.cos(a2) * sinP,
                -rx * Math.sin(a2) * sinP + ry * Math.cos(a2) * cosP];
    bez.push([p1[0] + alpha * t1[0], p1[1] + alpha * t1[1],
              p2[0] - alpha * t2[0], p2[1] - alpha * t2[1], p2[0], p2[1]]);
    th = a2;
  }
  return bez;
}

/** Trả về { length, bbox:{x,y,w,h}, points:[[x,y],...] } */
function measure(d) {
  const toks = tokenize(d);
  let i = 0;
  const num = () => toks[i++].num;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let lastC = null;         // control point cuối (cho S/T)
  let prevCmd = null;
  const pts = [];
  let length = 0;
  const push = (x, y) => {
    if (pts.length) length += Math.hypot(x - pts[pts.length - 1][0], y - pts[pts.length - 1][1]);
    pts.push([x, y]);
    cx = x; cy = y;
  };
  const sampleBez = (p0, c1, c2, p1) => {
    for (let k = 1; k <= SAMPLES_PER_SEG; k++) {
      const t = k / SAMPLES_PER_SEG, u = 1 - t;
      push(u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p1[0],
           u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p1[1]);
    }
  };

  while (i < toks.length) {
    if (toks[i].cmd) { prevCmd = toks[i].cmd; i++; }
    const c = prevCmd;
    const abs = c === c.toUpperCase();
    const rel = (x, y) => (abs ? [x, y] : [cx + x, cy + y]);
    switch (c.toUpperCase()) {
      case "M": { const [x, y] = rel(num(), num()); cx = x; cy = y; sx = x; sy = y; pts.push([x, y]); lastC = null; break; }
      case "L": { const [x, y] = rel(num(), num()); push(x, y); lastC = null; break; }
      case "H": { const x = abs ? num() : cx + num(); push(x, cy); lastC = null; break; }
      case "V": { const y = abs ? num() : cy + num(); push(cx, y); lastC = null; break; }
      case "C": {
        const [x1, y1] = rel(num(), num()), [x2, y2] = rel(num(), num()), [x, y] = rel(num(), num());
        sampleBez([cx, cy], [x1, y1], [x2, y2], [x, y]); lastC = [x2, y2]; break;
      }
      case "S": {
        const r = lastC && /[CcSs]/.test(prevCmd) ? [2*cx - lastC[0], 2*cy - lastC[1]] : [cx, cy];
        const [x2, y2] = rel(num(), num()), [x, y] = rel(num(), num());
        sampleBez([cx, cy], r, [x2, y2], [x, y]); lastC = [x2, y2]; break;
      }
      case "Q": {
        const [x1, y1] = rel(num(), num()), [x, y] = rel(num(), num());
        const c1 = [cx + (2/3)*(x1-cx), cy + (2/3)*(y1-cy)];
        const c2 = [x  + (2/3)*(x1-x),  y  + (2/3)*(y1-y)];
        sampleBez([cx, cy], c1, c2, [x, y]); lastC = [x1, y1]; break;
      }
      case "T": {
        const r = lastC && /[QqTt]/.test(prevCmd) ? [2*cx - lastC[0], 2*cy - lastC[1]] : [cx, cy];
        const [x, y] = rel(num(), num());
        const c1 = [cx + (2/3)*(r[0]-cx), cy + (2/3)*(r[1]-cy)];
        const c2 = [x  + (2/3)*(r[0]-x),  y  + (2/3)*(r[1]-y)];
        sampleBez([cx, cy], c1, c2, [x, y]); lastC = r; break;
      }
      case "A": {
        const rx = num(), ry = num(), rot = num(), fA = num(), fS = num();
        const [x, y] = rel(num(), num());
        const bez = arcToBeziers(cx, cy, rx, ry, rot, fA, fS, x, y);
        for (const b of bez) sampleBez([cx, cy], [b[0], b[1]], [b[2], b[3]], [b[4], b[5]]);
        lastC = null; break;
      }
      case "Z": { push(sx, sy); lastC = null; break; }
      default: throw new Error("Lệnh SVG không hỗ trợ: " + c);
    }
    if (toks[i] && toks[i].cmd) continue;   // lệnh mới -> vòng lặp đọc tiếp
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x<minX)minX=x; if (y<minY)minY=y; if (x>maxX)maxX=x; if (y>maxY)maxY=y; }
  return { length, bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, points: pts };
}

/* ======================= Gate logic ======================= */

function overlap(a, b, pad) {
  return !(a.x - pad > b.x + b.width || b.x - pad > a.x + a.width ||
           a.y - pad > b.y + b.height || b.y - pad > a.y + a.height);
}

function fragmentation(partStrokes) {
  const boxes = partStrokes.map(s => s.m.bbox);
  const parent = boxes.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (overlap(boxes[i], boxes[j], PAD)) parent[find(i)] = find(j);
  const comps = new Set(boxes.map((_, i) => find(i)));
  const groups = [...comps].map(root =>
    partStrokes.filter((_, i) => find(i) === root).map(s => s.part));
  return { count: comps.size, groups };
}

function evaluate(tpl) {
  const strokes = tpl.strokes.map(s => ({ ...s, m: measure(s.d) }));
  const hook = strokes.filter(s => s.role === "hook");
  const part = strokes.filter(s => s.role === "part");
  const hookLen = hook.reduce((a, s) => a + s.m.length, 0);
  const totalLen = strokes.reduce((a, s) => a + s.m.length, 0);
  const inkRatio = hookLen / totalLen;
  const orphans = hook.filter(s => s.absorbed === false);
  const frag = fragmentation(part);
  const drawSeconds = strokes.reduce((a, s) => a + (s.dur || 0), 0);

  const gates = {
    C0: { name: "Glyph Absorption",  pass: orphans.length === 0,            value: `${orphans.length} nét mồ côi`, orphans: orphans.map(o => o.orphan || o.part) },
    C1: { name: "Hook Load-bearing", pass: frag.count >= THRESH.C1_MIN_COMPONENTS, value: `${frag.count} cụm`, groups: frag.groups },
    C2: { name: "Hook Ink Ratio",    pass: inkRatio >= THRESH.C2_MIN_INK_RATIO, value: inkRatio.toFixed(3) },
    C3: { name: "Stroke Budget",     pass: strokes.length <= THRESH.C3_MAX_STROKES && drawSeconds <= THRESH.C3_MAX_DRAW_SECONDS, value: `${strokes.length} nét / ${drawSeconds.toFixed(1)}s` },
  };
  const failed = Object.entries(gates).filter(([, g]) => !g.pass).map(([k]) => k);
  const verdict = failed.length === 0 ? "PASS" : failed.length === 1 ? "REVIEW" : "REJECT";
  return { id: tpl.id, transformation: `${tpl.hook} → ${tpl.subject}`, hookLen: +hookLen.toFixed(1), totalLen: +totalLen.toFixed(1), inkRatio: +inkRatio.toFixed(3), strokes: strokes.length, drawSeconds: +drawSeconds.toFixed(1), gates, failed, verdict };
}

/* ======================= CLI ======================= */

const templates = JSON.parse(readFileSync(join(HERE, "templates.json"), "utf8"));
const results = templates.map(evaluate);
const jsonIdx = process.argv.indexOf("--json");

const W = (s, n) => String(s).padEnd(n);
const mark = b => (b ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m");

console.log("\n\x1b[1mTRANSFORMATION GATE — báo cáo khả thi hình học (C0..C3)\x1b[0m");
console.log(`nguồn: templates.json · pad=${PAD}px · ngưỡng: C1≥${THRESH.C1_MIN_COMPONENTS} cụm, C2≥${THRESH.C2_MIN_INK_RATIO}, C3≤${THRESH.C3_MAX_STROKES} nét & ≤${THRESH.C3_MAX_DRAW_SECONDS}s vẽ\n`);

for (const r of results) {
  const banner = r.verdict === "PASS" ? "\x1b[32m" : r.verdict === "REVIEW" ? "\x1b[33m" : "\x1b[31m";
  console.log(`${banner}\x1b[1m── ${r.transformation}  [${r.verdict}]${r.failed.length ? "  fail: " + r.failed.join(", ") : ""}\x1b[0m`);
  for (const [k, g] of Object.entries(r.gates))
    console.log(`   ${W(k, 3)} ${W(g.name, 19)} ${mark(g.pass)}  ${g.value}`);
  console.log(`   ink: hook ${r.hookLen}px / tổng ${r.totalLen}px   ·   draw ${r.drawSeconds}s`);
  if (r.gates.C0.orphans.length) console.log(`   \x1b[31m⚠ nét mồ côi:\x1b[0m ${r.gates.C0.orphans.join(" | ")}`);
  console.log(`   \x1b[90mcụm nét sau khi bỏ hook: ${r.gates.C1.groups.map(g => "{" + g.join(", ") + "}").join(" ")}\x1b[0m\n`);
}

const pass = results.filter(r => r.verdict === "PASS").length;
console.log(`\x1b[1mTổng: ${pass}/${results.length} PASS · ${results.filter(r=>r.verdict==="REJECT").length} REJECT · ${results.filter(r=>r.verdict==="REVIEW").length} REVIEW\x1b[0m`);
console.log("\x1b[90mGhi chú: C4 (Final Recognizability) và C5 (Progressive Surprise) cần sketch classifier — chưa có trong gate này. Xem FEASIBILITY-ASSESSMENT.md mục R0.\x1b[0m\n");

if (jsonIdx !== -1) {
  writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ thresholds: THRESH, pad: PAD, results }, null, 2));
  console.log(`→ đã ghi ${process.argv[jsonIdx + 1]}`);
}
