#!/usr/bin/env node
/**
 * gate-aesthetic.mjs — Aesthetic Quality Gate (A1..A7), heuristic, zero-dependency.
 * Bổ sung cho gate.mjs (C0..C3 chỉ kiểm tra hình học/load-bearing, KHÔNG thấy xấu-đẹp).
 *
 *   node gate-aesthetic.mjs                  # kiểm tra templates.json
 *   node gate-aesthetic.mjs --file templates.v2.json
 *
 * Các check:
 *   A1 FLOATING_DOTS   — nét chấm vô hình (len<2px) hoặc loop tí hon (<6px) lơ lửng,
 *                        không nằm trong loop lớn hơn (mắt chấm `l 0.01 0`).
 *   A2 FACE_LOOPS      — stroke mặt (mắt/mũi/mỏ/miệng) phải có >=2 closed loop
 *                        hình học (bbox >=8px). Mắt mũi vẽ thật, không chấm cho có.
 *   A3 WHISKER_CURVE   — râu phải là đường cong (Q/C), không phải gạch thẳng (L).
 *   A4 EXTERIOR_ATTACH — bộ phận ngoài (tai/chân/tay/đuôi/cánh...) phải chạm hook (<=25px).
 *   A5 HEAD_DISCONNECT — stroke đầu riêng (vòm đầu) phải chạm hook (<=12px).
 *   A6 ANCHOR_DEFINED  — template có accessory slot thì PHẢI khai báo anchors{}
 *                        (crown/glasses/bow). Phụ kiện tọa độ cứng = lơ lửng.
 *   A7 DEFORM_SANITY   — ma trận deform toàn cục (chibi/chubby/slender) làm méo
 *                        vòng đầu thành trứng (egg>10px) hoặc dịch tâm >30px.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pathToCurves, sampleCurvePoints } from "./gate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let file = "templates.json";
for (let i = 0; i < args.length; i++) if (args[i] === "--file") file = args[++i];

// ---------- helpers ----------
function splitSubpaths(d) {
  // tách theo lệnh M tuyệt đối (mọi template đều dùng M cho subpath mới)
  const chunks = d.match(/M[^Mm]*/g) || [d];
  return chunks.map((c) => {
    let pts = [];
    try {
      for (const cu of pathToCurves(c)) pts.push(...sampleCurvePoints(cu, 12));
    } catch { /* bỏ qua chunk lỗi */ }
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const first = pts[0], last = pts[pts.length - 1];
    const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) < 4;
    return { d: c, pts, bbox, len, closed, w: bbox[2] - bbox[0], h: bbox[3] - bbox[1] };
  }).filter(Boolean);
}
function minDistPts(a, b) {
  // NOTE: luôn xét điểm đầu/cuối (khớp nối thường nằm đúng ở đó).
  // Bản đầu dùng step 3 bỏ qua khớp nối → báo sai gap 25px cho nét đã chạm nhau.
  const idx = (arr) => {
    const s = new Set([0, arr.length - 1]);
    for (let k = 0; k < arr.length; k += 2) s.add(k);
    return [...s];
  };
  let m = 1e9;
  for (const i of idx(a))
    for (const j of idx(b)) {
      const v = Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]);
      if (v < m) m = v;
    }
  return m;
}
function inside(bboxOuter, x, y, pad = 0) {
  return x >= bboxOuter[0] - pad && x <= bboxOuter[2] + pad && y >= bboxOuter[1] - pad && y <= bboxOuter[3] + pad;
}
const FACE_RE = /mắt|mũi|mỏ|miệng|mặt|ráu|râu|eye|nose|beak|mouth|face|whisker/i;
const WHISKER_RE = /râu|whisker/i;
const EXTERIOR_RE = /tai|chân|tay|đuôi|bàn chân|móng|cánh|vây|lông vũ|bờm/i;
const HEADPART_RE = /đầu|vòm/i;

const DEFORMS = { // từ getDeformTransform() trong index.html — x' = sx*x+tx
  normal: [1, 1, 0, 0],
  chibi_cute: [1.08, 0.94, 0, -20],
  chubby: [1.15, 0.95, -20, 0],
  slender: [0.9, 1.08, 10, 0],
};
const ANCHOR_NEED = { birthday_hat: "crown", crown: "crown", sunglasses: "glasses", bow_collar: "bow" };

// ---------- evaluate ----------
function evaluateAesthetic(tpl) {
  const checks = [];
  const hookStrokes = tpl.strokes.filter((s) => s.role === "hook");
  const partStrokes = tpl.strokes.filter((s) => s.role === "part");
  const hookPts = hookStrokes.flatMap((s) => splitSubpaths(s.d).flatMap((sp) => sp.pts));
  const hookSubs = hookStrokes.flatMap((s) => splitSubpaths(s.d));

  // A1 — floating dots
  const allSubs = tpl.strokes.flatMap((s) => splitSubpaths(s.d).map((sp) => ({ ...sp, step: s.step, part: s.part })));
  // Parent hợp lệ = loop cỡ mắt thật (12..48px). Vòng đầu 120px+ KHÔNG tính
  // (nếu không, mắt chấm nằm trong đầu sẽ bị bỏ qua nhầm).
  const bigLoops = allSubs.filter((sp) => sp.closed && sp.w >= 12 && sp.h >= 12 && sp.w <= 48 && sp.h <= 48);
  const floatDots = allSubs.filter((sp) => {
    const tiny = sp.len < 2 || (sp.closed && sp.w < 6 && sp.h < 6);
    if (!tiny) return false;
    const cx = (sp.bbox[0] + sp.bbox[2]) / 2, cy = (sp.bbox[1] + sp.bbox[3]) / 2;
    return !bigLoops.some((L) => L !== sp && inside(L.bbox, cx, cy, 2)); // con ngươi trong mắt thì OK
  });
  checks.push({ id: "A1", name: "Floating dots", pass: floatDots.length === 0,
    detail: floatDots.length ? `${floatDots.length} chấm vô hình/lơ lửng (step ${[...new Set(floatDots.map((d) => d.step))].join(",")})` : "không có chấm lơ lửng" });

  // A2 — face loops
  const faceStrokes = partStrokes.filter((s) => FACE_RE.test(s.part || ""));
  let faceLoops = 0;
  for (const s of faceStrokes)
    for (const sp of splitSubpaths(s.d))
      if (sp.closed && sp.w >= 8 && sp.h >= 8 && sp.len > 20) faceLoops++;
  const a2na = faceStrokes.length === 0;
  checks.push({ id: "A2", name: "Face loops ≥2", pass: a2na || faceLoops >= 2, na: a2na,
    detail: a2na ? "không có stroke mặt" : `${faceLoops} closed loop ở mặt` });

  // A3 — whisker curves
  const wStrokes = partStrokes.filter((s) => WHISKER_RE.test(s.part || ""));
  const wCurved = wStrokes.every((s) => /[QqCcTtSsAa]/.test(s.d));
  checks.push({ id: "A3", name: "Whisker curves", pass: wStrokes.length === 0 || wCurved, na: wStrokes.length === 0,
    detail: wStrokes.length === 0 ? "không có râu" : wCurved ? "râu cong" : "râu toàn gạch thẳng (L)" });

  // A4 — exterior attach
  const extStrokes = partStrokes.filter((s) => EXTERIOR_RE.test(s.part || ""));
  const extBad = [];
  for (const s of extStrokes) {
    const pts = splitSubpaths(s.d).flatMap((sp) => sp.pts);
    const g = minDistPts(pts, hookPts);
    if (g > 25) extBad.push(`step${s.step} ${s.part} (hở ${g.toFixed(0)}px)`);
  }
  checks.push({ id: "A4", name: "Exterior attach ≤25px", pass: extBad.length === 0, na: extStrokes.length === 0,
    detail: extStrokes.length === 0 ? "không có bộ phận ngoài" : extBad.length ? extBad.join("; ") : "đều chạm hook" });

  // A5 — head disconnect
  const headStrokes = partStrokes.filter((s) => HEADPART_RE.test(s.part || ""));
  const headBad = [];
  for (const s of headStrokes) {
    const pts = splitSubpaths(s.d).flatMap((sp) => sp.pts);
    const g = minDistPts(pts, hookPts);
    if (g > 12) headBad.push(`step${s.step} ${s.part} (hở ${g.toFixed(0)}px)`);
  }
  checks.push({ id: "A5", name: "Head connected ≤12px", pass: headBad.length === 0, na: headStrokes.length === 0,
    detail: headStrokes.length === 0 ? "đầu chính là hook" : headBad.length ? headBad.join("; ") : "đầu liền hook" });

  // A6 — anchors
  const accs = (tpl.slots && tpl.slots.accessories) || [];
  const need = [...new Set(accs.filter((a) => a !== "none").map((a) => ANCHOR_NEED[a]).filter(Boolean))];
  const anchors = tpl.anchors || {};
  const missing = need.filter((k) => !anchors[k]);
  checks.push({ id: "A6", name: "Accessory anchors", pass: missing.length === 0, na: need.length === 0,
    detail: need.length === 0 ? "không có accessory" : missing.length ? `thiếu anchors: ${missing.join(",")} (phụ kiện sẽ lơ lửng)` : `đủ anchors: ${need.join(",")}` });

  // A7 — deform sanity (variant matrix)
  const headLoop = hookSubs.find((sp) => sp.closed && /A/.test(sp.d) && sp.w > 30 && sp.h > 30);
  const deformRows = [];
  if (headLoop) {
    const cx = (headLoop.bbox[0] + headLoop.bbox[2]) / 2, cy = (headLoop.bbox[1] + headLoop.bbox[3]) / 2;
    for (const [name, [sx, sy, tx, ty]] of Object.entries(DEFORMS)) {
      if (name === "normal") continue;
      const w2 = headLoop.w * sx, h2 = headLoop.h * sy;
      const egg = Math.abs(w2 - h2);
      const shift = Math.hypot(cx * sx + tx - cx, cy * sy + ty - cy);
      const verdict = egg > 10 || shift > 45 ? "FAIL" : egg > 6 || shift > 25 ? "WARN" : "ok";
      deformRows.push({ name, egg: +egg.toFixed(1), shift: +shift.toFixed(0), verdict });
    }
  }
  const a7fail = deformRows.filter((r) => r.verdict === "FAIL").length;
  const a7warn = deformRows.filter((r) => r.verdict === "WARN").length;
  checks.push({ id: "A7", name: "Deform sanity", pass: a7fail === 0, na: !headLoop,
    detail: !headLoop ? "hook không có vòng đầu khép kín — deform toàn cục càng rủi ro" :
      deformRows.map((r) => `${r.name}: egg ${r.egg}px/shift ${r.shift}px [${r.verdict}]`).join(" · ") +
      (a7warn ? " → deform toàn cục làm méo đầu, cần parametric rig" : "") });

  return { id: tpl.id, subject: tpl.subject, passed: checks.every((c) => c.pass), checks };
}

// ---------- CLI ----------
const tpls = JSON.parse(readFileSync(join(HERE, file), "utf8"));
console.log("\n\x1b[1m=== AESTHETIC QUALITY GATE (A1..A7) — " + file + " ===\x1b[0m");
let n = 0;
for (const tpl of tpls) {
  const r = evaluateAesthetic(tpl);
  const tag = r.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
  console.log(`\n${tag} \x1b[1m${r.id}\x1b[0m — ${r.subject}`);
  for (const c of r.checks) {
    const t = c.na ? "\x1b[90m[N/A]\x1b[0m" : c.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    console.log(`   ${c.id} ${c.name}: ${t} — ${c.detail}`);
  }
  if (r.passed) n++;
}
console.log(`\n\x1b[1mResult: ${n}/${tpls.length} templates PASSED aesthetic gate.\x1b[0m\n`);
