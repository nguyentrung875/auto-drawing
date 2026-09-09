#!/usr/bin/env node
/**
 * gate-singleline.mjs — Gates S1..S4 cho track single-line (spike spiral).
 *   node gate-singleline.mjs output/v4
 * Đọc oneline.json (+ stats.json nếu có) trong thư mục output.
 *
 *   S1 CONTINUITY   — đúng 1 stroke, đúng 1 lệnh M (không nhấc bút) [HARD]
 *   S2 LIKENESS     — edge-correlation render vs ảnh gốc ≥ 0.25 (calibrated 1 ảnh:
 *                     v1=0.234 FAIL, v2=0.243 FAIL, v4=0.266 PASS, v5=0.285 PASS-nhưng-xấu).
 *                     Lưu ý spike: metric này game được (v5 texture điểm cao nhưng mắt thấy
 *                     xấu) → S2 chỉ là sàng lọc, mắt người duyệt cuối. Ngưỡng cần validate
 *                     lại trên nhiều ảnh trước khi vào CI.
 *   S3 DURATION     — realtime/45s ≤ 12x timelapse (nhanh hơn thì nét chạy quá nhanh,
 *                     mất cảm giác vẽ tay)
 *   S4 SIZE         — path `d` ≤ 500KB (pipeline sanity: JSON/parse/render)
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToCurves, strokeLength } from "../transformation-factory-spike/gate.mjs";

const dir = resolve(process.argv[2] || "output/v4");
const tpl = JSON.parse(readFileSync(join(dir, "oneline.json"), "utf8"))[0];
const statsPath = join(dir, "stats.json");
const stats = existsSync(statsPath) ? JSON.parse(readFileSync(statsPath, "utf8")) : {};
const d = tpl.strokes.map((s) => s.d).join(" ");

const rows = [];
// S1
const mCount = (d.match(/M /g) || []).length;
rows.push({ id: "S1", name: "Continuity (1 stroke, 1 pen-down)", pass: tpl.strokes.length === 1 && mCount === 1,
  detail: `${tpl.strokes.length} stroke(s), ${mCount} M-command(s)` });
// S2
const s2 = stats.likeness_S2;
rows.push({ id: "S2", name: "Likeness edge-corr ≥ 0.25", pass: typeof s2 === "number" && s2 >= 0.25,
  detail: typeof s2 === "number" ? `S2 = ${s2}` : "thiếu stats.json" });
// S3 + S4 (đo lại bằng parser của pipeline để khớp 100%)
let len = 0;
try { len = tpl.strokes.reduce((t, s) => t + strokeLength(s.d), 0); } catch (e) { /* parse fail */ }
const tlx = len / 250 / 45;
rows.push({ id: "S3", name: "Duration timelapse ≤ 12x/45s", pass: len > 0 && tlx <= 12,
  detail: len > 0 ? `${(len / 1000).toFixed(1)}k px → realtime ${(len / 250 / 60).toFixed(1)}m → ${tlx.toFixed(1)}x` : "parse path lỗi" });
rows.push({ id: "S4", name: "Path size ≤ 500KB", pass: d.length <= 500_000,
  detail: `${(d.length / 1024).toFixed(0)}KB` });

console.log(`\n\x1b[1m=== SINGLE-LINE GATE (S1..S4) — ${dir} ===\x1b[0m`);
for (const r of rows)
  console.log(`   ${r.id} ${r.name}: ${r.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} — ${r.detail}`);
const ok = rows.every((r) => r.pass);
console.log(`\n\x1b[1mResult: ${ok ? "PASS" : "FAIL"}\x1b[0m\n`);
process.exit(ok ? 0 : 1);
