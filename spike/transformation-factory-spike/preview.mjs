#!/usr/bin/env node
/**
 * preview.mjs — Zero-dependency SVG path rasterizer + PNG encoder (node builtins only).
 * Render templates.json thành PNG để review chất lượng thẩm mỹ bằng mắt.
 * Dùng lại pathToCurves/sampleCurvePoints từ gate.mjs nên số liệu khớp 100% với gate.
 *
 * Usage:
 *   node preview.mjs                    # render tất cả template -> preview/*.png
 *   node preview.mjs 9_to_cat 2_to_swan # render 1 vài template
 *   node preview.mjs --file templates.v2.json --out preview-v2
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pathToCurves, sampleCurvePoints } from "./gate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 540, H = 760;

// ---------- CRC32 (cho PNG chunk) ----------
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, color type 2 (RGB)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Rasterizer ----------
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
const BG = hex("#0f211d"), HOOK_C = hex("#facc15"), PART_C = hex("#ffffff");

function stampCircle(rgb, cx, cy, r, col) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        const o = (y * W + x) * 3;
        rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];
      }
}

function drawPath(rgb, d, col, width) {
  let curves;
  try { curves = pathToCurves(d); } catch { return; }
  const r = width / 2;
  for (const c of curves) {
    const pts = sampleCurvePoints(c, 24);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(dist / (r * 0.6)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        stampCircle(rgb, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, col);
      }
    }
  }
}

function renderTemplate(tpl) {
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = BG[0]; rgb[i * 3 + 1] = BG[1]; rgb[i * 3 + 2] = BG[2]; }
  for (const s of tpl.strokes) {
    const isHook = s.role === "hook";
    drawPath(rgb, s.d, isHook ? HOOK_C : PART_C, isHook ? 8 : 6);
  }
  return encodePNG(W, H, rgb);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
let file = "templates.json", outDir = "preview", ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--file") file = args[++i];
  else if (args[i] === "--out") outDir = args[++i];
  else ids.push(args[i]);
}
const tpls = JSON.parse(readFileSync(join(HERE, file), "utf8"));
const out = join(HERE, outDir);
if (!existsSync(out)) mkdirSync(out, { recursive: true });
const list = ids.length ? tpls.filter((t) => ids.includes(t.id)) : tpls;
for (const t of list) {
  writeFileSync(join(out, `${t.id}.png`), renderTemplate(t));
  console.log(`rendered ${outDir}/${t.id}.png`);
}
