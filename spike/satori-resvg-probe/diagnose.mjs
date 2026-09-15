import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const fontRegular = fs.readFileSync('C:/Windows/Fonts/segoeui.ttf');
const fontBold = fs.readFileSync('C:/Windows/Fonts/segoeuib.ttf');

const img1Buffer = fs.readFileSync('assets/p001.png');
const img1Base64 = `data:image/png;base64,${img1Buffer.toString('base64')}`;

// Let's test:
// 1. Without image
// 2. With image
// 3. With background gradient / filter

async function testVariant(name, element) {
  const svg = await satori(element, {
    width: 1080,
    height: 1920,
    fonts: [{ name: 'Segoe UI', data: fontRegular, weight: 400 }],
  });
  console.log(`[${name}] SVG size: ${svg.length} bytes`);

  const t0 = performance.now();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1080 },
    font: { loadSystemFonts: false, fontFiles: ['C:/Windows/Fonts/segoeui.ttf'] },
  });
  resvg.render();
  const dt = performance.now() - t0;
  console.log(`[${name}] Resvg time: ${dt.toFixed(2)}ms`);
}

// Case A: Pure layout, no image, no shadow
await testVariant('A: Pure layout no image', {
  type: 'div',
  props: {
    style: { display: 'flex', width: '1080px', height: '1920px', backgroundColor: '#090d16', color: 'white' },
    children: 'Hello',
  },
});

// Case B: With 1 base64 image
await testVariant('B: With 1 base64 image', {
  type: 'div',
  props: {
    style: { display: 'flex', width: '1080px', height: '1920px', backgroundColor: '#090d16' },
    children: [{ type: 'img', props: { src: img1Base64, style: { width: '230px', height: '230px' } } }],
  },
});

// Case C: With textShadow & boxShadow
await testVariant('C: With box-shadow & text-shadow', {
  type: 'div',
  props: {
    style: { display: 'flex', width: '1080px', height: '1920px', backgroundColor: '#090d16', color: 'white' },
    children: [{
      type: 'div',
      props: {
        style: { width: '900px', height: '300px', backgroundColor: '#1e293b', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' },
        children: 'Shadow',
      },
    }],
  },
});
