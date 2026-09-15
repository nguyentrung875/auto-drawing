import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const fontRegular = fs.readFileSync('C:/Windows/Fonts/segoeui.ttf');
const img1Buffer = fs.readFileSync('assets/p001.png');
const img1Base64 = `data:image/png;base64,${img1Buffer.toString('base64')}`;

// Test: Modern styled card with border, gradient, background, NO feGaussianBlur filter
const elementClean = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '1080px',
      height: '1920px',
      backgroundColor: '#090d16',
      color: '#ffffff',
      fontFamily: 'Segoe UI',
      padding: '80px 50px',
    },
    children: [
      {
        type: 'div',
        props: {
          style: {
            fontSize: '56px',
            fontWeight: 'bold',
            color: '#f8fafc',
          },
          children: 'Sản phẩm B CAO HƠN hay THẤP HƠN A?',
        },
      },
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            alignItems: 'center',
            width: '900px',
            height: '280px',
            backgroundColor: '#1e293b',
            borderRadius: '32px',
            border: '4px solid #38bdf8',
            padding: '24px',
          },
          children: [
            {
              type: 'img',
              props: {
                src: img1Base64,
                style: { width: '230px', height: '230px', borderRadius: '24px' },
              },
            },
            {
              type: 'div',
              props: {
                style: { display: 'flex', flexDirection: 'column', marginLeft: '40px' },
                children: [
                  { type: 'div', props: { style: { fontSize: '28px', color: '#38bdf8' }, children: 'Sản phẩm [A]' } },
                  { type: 'div', props: { style: { fontSize: '44px', fontWeight: 'bold' }, children: 'Nước giặt 3.5kg OMO' } },
                  { type: 'div', props: { style: { fontSize: '50px', color: '#fbbf24', fontWeight: 'bold' }, children: '189.000₫' } },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};

const svg = await satori(elementClean, {
  width: 1080,
  height: 1920,
  fonts: [{ name: 'Segoe UI', data: fontRegular, weight: 400 }],
});

const t0 = performance.now();
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1080 },
  font: { loadSystemFonts: false, fontFiles: ['C:/Windows/Fonts/segoeui.ttf'] },
});
const rendered = resvg.render();
const dt = performance.now() - t0;

console.log(`Rendered clean card 1080x1920:`);
console.log(`- SVG size: ${svg.length} bytes`);
console.log(`- Resvg render time: ${dt.toFixed(2)}ms`);
console.log(`- Buffer size: ${rendered.pixels.length} bytes (1080x1920x4 = ${1080*1920*4})`);
