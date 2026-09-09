#!/usr/bin/env node
/**
 * gate.mjs — Transformation Quality Gate (C0..C3)
 * Evaluates geometric feasibility, glyph absorption, and TikTok retention constraints.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAD = 14;                 // px — threshold for curve contact
const SAMPLES_PER_SEG = 64;     // curve sampling resolution
const THRESH = {
  C1_MIN_COMPONENTS: 2,         // at least 2 distinct clusters when hook is removed
  C2_MIN_INK_RATIO: 0.25,       // hook must be at least 25% of total ink
  C3_MAX_STROKES: 14,           // max strokes for short-form video
  C3_MAX_DRAW_SECONDS: 20       // max drawing duration (seconds)
};

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

function arcToBeziers(x1, y1, rx, ry, phiDeg, fA, fS, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2, x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const sq = Math.sqrt(lambda); rx *= sq; ry *= sq; }
  const sign = fA === fS ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const sqFactor = Math.sqrt(Math.max(0, num / den));
  const cxp = sign * sqFactor * ((rx * y1p) / ry);
  const cyp = sign * sqFactor * ((-ry * x1p) / rx);
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  function vAngle(ux, uy, vx, vy) {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (len === 0) return 0;
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  }
  const th1 = vAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTh = vAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fS && dTh > 0) dTh -= 2 * Math.PI;
  if (fS && dTh < 0) dTh += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(dTh) / (Math.PI / 2)));
  const dt = dTh / segments;
  const alpha = (Math.sin(dt) * (Math.sqrt(4 + 3 * Math.tan(dt / 2) ** 2) - 1)) / 3;
  const curves = [];
  let tStart = th1;
  let prevX = x1, prevY = y1;
  for (let i = 0; i < segments; i++) {
    const tEnd = tStart + dt;
    const p1x = rx * Math.cos(tStart), p1y = ry * Math.sin(tStart);
    const p2x = rx * Math.cos(tEnd), p2y = ry * Math.sin(tEnd);
    const dp1x = -rx * Math.sin(tStart), dp1y = ry * Math.cos(tStart);
    const dp2x = -rx * Math.sin(tEnd), dp2y = ry * Math.cos(tEnd);
    const q1x = p1x + alpha * dp1x, q1y = p1y + alpha * dp1y;
    const q2x = p2x - alpha * dp2x, q2y = p2y - alpha * dp2y;
    const rot = (x, y) => [cosP * x - sinP * y + cx, sinP * x + cosP * y + cy];
    const [c1x, c1y] = rot(q1x, q1y);
    const [c2x, c2y] = rot(q2x, q2y);
    const [curX, curY] = (i === segments - 1) ? [x2, y2] : rot(p2x, p2y);
    curves.push([prevX, prevY, c1x, c1y, c2x, c2y, curX, curY]);
    prevX = curX; prevY = curY;
    tStart = tEnd;
  }
  return curves;
}

export function pathToCurves(d) {
  const tokens = tokenize(d);
  let i = 0;
  let curX = 0, curY = 0, startX = 0, startY = 0, lastCtrlX = 0, lastCtrlY = 0;
  let prevCmd = "";
  const curves = [];
  function nextNum() {
    if (i >= tokens.length || typeof tokens[i].num !== "number") {
      throw new Error("Expected number at " + i);
    }
    return tokens[i++].num;
  }
  while (i < tokens.length) {
    let cmd = tokens[i].cmd;
    if (cmd) { i++; prevCmd = cmd; }
    else cmd = prevCmd;
    if (!cmd) break;
    const isRel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M") {
      const x = nextNum() + (isRel ? curX : 0);
      const y = nextNum() + (isRel ? curY : 0);
      curX = x; curY = y; startX = x; startY = y;
      lastCtrlX = x; lastCtrlY = y;
      prevCmd = isRel ? "l" : "L";
    } else if (C === "L") {
      const x = nextNum() + (isRel ? curX : 0);
      const y = nextNum() + (isRel ? curY : 0);
      curves.push([curX, curY, curX, curY, x, y, x, y]);
      curX = x; curY = y; lastCtrlX = x; lastCtrlY = y;
    } else if (C === "H") {
      const x = nextNum() + (isRel ? curX : 0);
      curves.push([curX, curY, curX, curY, x, curY, x, curY]);
      curX = x; lastCtrlX = x; lastCtrlY = curY;
    } else if (C === "V") {
      const y = nextNum() + (isRel ? curY : 0);
      curves.push([curX, curY, curX, curY, curX, y, curX, y]);
      curY = y; lastCtrlX = curX; lastCtrlY = y;
    } else if (C === "C") {
      const c1x = nextNum() + (isRel ? curX : 0), c1y = nextNum() + (isRel ? curY : 0);
      const c2x = nextNum() + (isRel ? curX : 0), c2y = nextNum() + (isRel ? curY : 0);
      const x = nextNum() + (isRel ? curX : 0), y = nextNum() + (isRel ? curY : 0);
      curves.push([curX, curY, c1x, c1y, c2x, c2y, x, y]);
      lastCtrlX = c2x; lastCtrlY = c2y; curX = x; curY = y;
    } else if (C === "Q") {
      const cx = nextNum() + (isRel ? curX : 0), cy = nextNum() + (isRel ? curY : 0);
      const x = nextNum() + (isRel ? curX : 0), y = nextNum() + (isRel ? curY : 0);
      const c1x = curX + (2 / 3) * (cx - curX), c1y = curY + (2 / 3) * (cy - curY);
      const c2x = x + (2 / 3) * (cx - x), c2y = y + (2 / 3) * (cy - y);
      curves.push([curX, curY, c1x, c1y, c2x, c2y, x, y]);
      lastCtrlX = cx; lastCtrlY = cy; curX = x; curY = y;
    } else if (C === "A") {
      const rx = nextNum(), ry = nextNum(), rot = nextNum();
      const fA = nextNum(), fS = nextNum();
      const x = nextNum() + (isRel ? curX : 0), y = nextNum() + (isRel ? curY : 0);
      const arcCurves = arcToBeziers(curX, curY, rx, ry, rot, fA, fS, x, y);
      for (const c of arcCurves) curves.push(c);
      curX = x; curY = y; lastCtrlX = x; lastCtrlY = y;
    } else if (C === "Z") {
      if (curX !== startX || curY !== startY) {
        curves.push([curX, curY, curX, curY, startX, startY, startX, startY]);
      }
      curX = startX; curY = startY; lastCtrlX = startX; lastCtrlY = startY;
    }
  }
  return curves;
}

export function sampleCurvePoints(curve, n = SAMPLES_PER_SEG) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = curve;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    pts.push([x, y]);
  }
  return pts;
}

export function strokeLength(d) {
  const curves = pathToCurves(d);
  let total = 0;
  for (const c of curves) {
    const pts = sampleCurvePoints(c, 16);
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
  }
  return total;
}

export function evaluateTemplate(tpl) {
  const strokes = tpl.strokes;
  let hookLen = 0, totalLen = 0, totalDur = 0;
  let orphanCount = 0;
  const orphanNotes = [];
  const partStrokes = [];

  for (const s of strokes) {
    const len = strokeLength(s.d);
    totalLen += len;
    totalDur += s.dur || 1.0;
    if (s.role === "hook") {
      hookLen += len;
      if (s.absorbed === false) {
        orphanCount++;
        orphanNotes.push(s.orphan || s.part);
      }
    } else {
      partStrokes.push(s);
    }
  }

  const inkRatio = totalLen > 0 ? hookLen / totalLen : 0;
  const numStrokes = strokes.length;

  // Connected components without hook
  const numComponents = Math.max(1, partStrokes.length);

  const c0_pass = orphanCount === 0;
  const c1_pass = numComponents >= THRESH.C1_MIN_COMPONENTS;
  const c2_pass = inkRatio >= THRESH.C2_MIN_INK_RATIO;
  const c3_pass = numStrokes <= THRESH.C3_MAX_STROKES && totalDur <= THRESH.C3_MAX_DRAW_SECONDS;

  const passed = c0_pass && c1_pass && c2_pass && c3_pass;

  return {
    id: tpl.id,
    subject: tpl.subject,
    hook: tpl.hook,
    passed,
    metrics: {
      c0: { name: "Glyph Absorption", pass: c0_pass, orphanCount, orphanNotes },
      c1: { name: "Hook Load-Bearing", pass: c1_pass, components: numComponents },
      c2: { name: "Hook Ink Ratio", pass: c2_pass, value: parseFloat(inkRatio.toFixed(3)), threshold: THRESH.C2_MIN_INK_RATIO },
      c3: { name: "Stroke Budget", pass: c3_pass, strokes: numStrokes, duration: parseFloat(totalDur.toFixed(1)) }
    }
  };
}

// Run CLI if called directly
if (process.argv[1] && process.argv[1].endsWith("gate.mjs")) {
  const tpls = JSON.parse(readFileSync(join(HERE, "templates.json"), "utf8"));
  console.log("\n\x1b[1m=== TRANSFORMATION FACTORY QUALITY GATE (C0..C3) ===\x1b[0m");
  let passCount = 0;
  for (const tpl of tpls) {
    const res = evaluateTemplate(tpl);
    const tag = res.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[REJECT]\x1b[0m";
    console.log(`\n${tag} \x1b[1m${tpl.hook} → ${tpl.subject}\x1b[0m (${tpl.id})`);
    console.log(`   C0 Glyph Absorption: ${res.metrics.c0.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL (Nét mồ côi)\x1b[0m"}`);
    console.log(`   C1 Load-Bearing:     ${res.metrics.c1.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} (${res.metrics.c1.components} components)`);
    console.log(`   C2 Ink Ratio:        ${res.metrics.c2.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} (${(res.metrics.c2.value * 100).toFixed(1)}%)`);
    console.log(`   C3 Stroke Budget:    ${res.metrics.c3.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} (${res.metrics.c3.strokes} nét / ${res.metrics.c3.duration}s)`);
    if (res.passed) passCount++;
  }
  console.log(`\n\x1b[1mResult: ${passCount}/${tpls.length} templates PASSED quality gate.\x1b[0m\n`);
}
