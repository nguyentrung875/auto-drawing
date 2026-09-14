import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tpls = JSON.parse(readFileSync("spike/transformation-factory-spike/templates.json", "utf8"));

for (const tpl of tpls) {
  const isFail = tpl.id.includes("rejected");
  const strokeColor = isFail ? "#ef4444" : "#ffffff";
  const hookColor = isFail ? "#f59e0b" : "#facc15";
  
  let paths = "";
  tpl.strokes.forEach((s, idx) => {
    const col = s.role === "hook" ? hookColor : strokeColor;
    const w = s.role === "hook" ? "8" : "6";
    paths += `  <!-- Step ${s.step}: ${s.part} -->\n`;
    paths += `  <path d="${s.d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 760" width="540" height="760">
  <rect width="540" height="760" fill="#0f211d"/>
  <!-- Title -->
  <text x="270" y="50" font-family="sans-serif" font-size="22" font-weight="bold" fill="#4ade80" text-anchor="middle">${tpl.hook} ➔ ${tpl.subject}</text>
  <text x="270" y="80" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">${tpl.hook_role_desc}</text>
  
  <!-- Drawing Body -->
  <g transform="translate(0, 30)">
${paths}
  </g>

  <!-- Footer Info -->
  <rect x="20" y="690" width="500" height="50" rx="8" fill="#132420" stroke="#24443b"/>
  <text x="35" y="720" font-family="monospace" font-size="12" fill="#facc15">Vàng: Nét Hook (${tpl.hook})</text>
  <text x="230" y="720" font-family="monospace" font-size="12" fill="#ffffff">Trắng: Nét thêm vào</text>
  <text x="440" y="720" font-family="sans-serif" font-size="12" font-weight="bold" fill="${isFail ? '#ef4444' : '#4ade80'}">${isFail ? 'REJECT' : 'PASS GATE'}</text>
</svg>`;

  writeFileSync(`spike/transformation-factory-spike/exports/${tpl.id}.svg`, svg, "utf8");
}

console.log("Exported all SVGs successfully to spike/transformation-factory-spike/exports/");
