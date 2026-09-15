import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const fontBuffer = fs.readFileSync('C:/Windows/Fonts/segoeui.ttf');

const element = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      fontSize: 60,
      fontFamily: 'Segoe UI',
    },
    children: 'Kiểm tra tiếng Việt: Nước giặt 189.000đ',
  },
};

const svg = await satori(element, {
  width: 1080,
  height: 1920,
  fonts: [
    {
      name: 'Segoe UI',
      data: fontBuffer,
      weight: 400,
      style: 'normal',
    },
  ],
});

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1080 },
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

fs.mkdirSync('spike/satori-resvg-probe/out', { recursive: true });
fs.writeFileSync('spike/satori-resvg-probe/out/test.png', pngBuffer);
console.log('Success! Rendered test.png, size:', pngBuffer.length);
