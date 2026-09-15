import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const svg = fs.readFileSync('spike/satori-resvg-probe/out/test.png'); // wait, let's make a real SVG
const simpleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <rect width="1080" height="1920" fill="#090d16"/>
  <text x="540" y="960" font-family="Segoe UI" font-size="60" fill="white" text-anchor="middle">Hello World</text>
</svg>`;

console.time('1st render default');
new Resvg(simpleSvg).render();
console.timeEnd('1st render default');

console.time('2nd render default');
new Resvg(simpleSvg).render();
console.timeEnd('2nd render default');

console.time('3rd render with loadSystemFonts: false');
new Resvg(simpleSvg, { font: { loadSystemFonts: false, fontFiles: ['C:/Windows/Fonts/segoeui.ttf'] } }).render();
console.timeEnd('3rd render with loadSystemFonts: false');
