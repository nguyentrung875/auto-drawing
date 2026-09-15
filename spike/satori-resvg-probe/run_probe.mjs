import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const FFMPEG_PATH = ffmpegInstaller.path;

// 1. Load Fonts
const fontRegular = fs.readFileSync('C:/Windows/Fonts/segoeui.ttf');
const fontBoldPath = fs.existsSync('C:/Windows/Fonts/segoeuib.ttf')
  ? 'C:/Windows/Fonts/segoeuib.ttf'
  : 'C:/Windows/Fonts/segoeui.ttf';
const fontBold = fs.readFileSync(fontBoldPath);

// 2. Load Sample Product Images
const img1Buffer = fs.readFileSync('assets/p001.png');
const img1Base64 = `data:image/png;base64,${img1Buffer.toString('base64')}`;

const img2Buffer = fs.readFileSync('assets/p002.png');
const img2Base64 = `data:image/png;base64,${img2Buffer.toString('base64')}`;

// 3. Define Virtual DOM generator function
function createGameFrame(timeSec) {
  const countdown = Math.max(0, 3.0 - timeSec);
  const countdownFormatted = countdown.toFixed(1);
  const progress = Math.min(1, Math.max(0, timeSec / 3.0));
  
  // Circumference for r=70 is 2 * Math.PI * 70 = 439.82
  const circ = 440;
  const strokeDashoffset = Math.round(circ * progress);

  return {
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
        padding: '80px 50px 100px 50px',
        boxSizing: 'border-box',
      },
      children: [
        // --- HEADER BADGE ---
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 36px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    border: '2px solid rgba(245, 158, 11, 0.6)',
                    color: '#fbbf24',
                    fontSize: '32px',
                    fontWeight: 'bold',
                    letterSpacing: '2px',
                  },
                  children: '⚡ SIÊU THỬ THÁCH ĐOÁN GIÁ — VÒNG 1 ⚡',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '56px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    color: '#f8fafc',
                    lineHeight: '1.2',
                  },
                  children: 'Sản phẩm B CAO HƠN hay THẤP HƠN A?',
                },
              },
            ],
          },
        },

        // --- 2 PRODUCT CARDS ---
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '40px',
              width: '100%',
              alignItems: 'center',
            },
            children: [
              // Card A
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    width: '900px',
                    height: '290px',
                    backgroundColor: 'rgba(30, 41, 59, 0.85)',
                    borderRadius: '32px',
                    border: '3px solid rgba(148, 163, 184, 0.25)',
                    padding: '24px 32px',
                    boxSizing: 'border-box',
                  },
                  children: [
                    {
                      type: 'img',
                      props: {
                        src: img1Base64,
                        style: {
                          width: '230px',
                          height: '230px',
                          borderRadius: '24px',
                          backgroundColor: '#0f172a',
                          objectFit: 'contain',
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          marginLeft: '40px',
                          flex: 1,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '26px',
                                color: '#94a3b8',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                              },
                              children: 'Sản phẩm [A]',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '42px',
                                fontWeight: 'bold',
                                color: '#ffffff',
                                margin: '8px 0',
                              },
                              children: 'Nước giặt 3.5kg OMO',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '50px',
                                fontWeight: 'bold',
                                color: '#fbbf24',
                              },
                              children: '189.000₫',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },

              // Card B
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    width: '900px',
                    height: '290px',
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    borderRadius: '32px',
                    border: '3px solid rgba(56, 189, 248, 0.5)',
                    padding: '24px 32px',
                    boxSizing: 'border-box',
                  },
                  children: [
                    {
                      type: 'img',
                      props: {
                        src: img2Base64,
                        style: {
                          width: '230px',
                          height: '230px',
                          borderRadius: '24px',
                          backgroundColor: '#0f172a',
                          objectFit: 'contain',
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          marginLeft: '40px',
                          flex: 1,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '26px',
                                color: '#38bdf8',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                              },
                              children: 'Sản phẩm [B]',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '42px',
                                fontWeight: 'bold',
                                color: '#ffffff',
                                margin: '8px 0',
                              },
                              children: 'Nước lau sàn 1.8L Sunlight',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '50px',
                                fontWeight: 'bold',
                                color: '#38bdf8',
                              },
                              children: '❓ ❓ ❓ ₫',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // --- COUNTDOWN TIMER ---
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              width: '200px',
              height: '200px',
              justifyContent: 'center',
            },
            children: [
              {
                type: 'svg',
                props: {
                  width: '200',
                  height: '200',
                  viewBox: '0 0 200 200',
                  style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'rotate(-90deg)',
                  },
                  children: [
                    {
                      type: 'circle',
                      props: {
                        cx: '100',
                        cy: '100',
                        r: '70',
                        stroke: 'rgba(255, 255, 255, 0.1)',
                        strokeWidth: '16',
                        fill: 'none',
                      },
                    },
                    {
                      type: 'circle',
                      props: {
                        cx: '100',
                        cy: '100',
                        r: '70',
                        stroke: '#fb7185',
                        strokeWidth: '16',
                        strokeDasharray: '440',
                        strokeDashoffset: String(strokeDashoffset),
                        strokeLinecap: 'round',
                        fill: 'none',
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '52px',
                    fontWeight: 'bold',
                    color: '#fb7185',
                  },
                  children: countdownFormatted,
                },
              },
            ],
          },
        },

        // --- CHOICE BUTTONS ---
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              width: '900px',
              gap: '40px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    flex: 1,
                    height: '110px',
                    borderRadius: '24px',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    border: '3px solid #10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                    fontSize: '44px',
                    fontWeight: 'bold',
                  },
                  children: '▲ CAO HƠN',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    flex: 1,
                    height: '110px',
                    borderRadius: '24px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '3px solid #ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f87171',
                    fontSize: '44px',
                    fontWeight: 'bold',
                  },
                  children: '▼ THẤP HƠN',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function runBenchmark() {
  console.log('=== KHỞI ĐỘNG BENCHMARK: SATORI + RESVG -> FFMPEG PIPE ===');
  console.log('Độ phân giải: 1080 × 1920 (Chuẩn Video Dọc)');
  console.log('Số khung hình thử nghiệm: 60 frames (2.0s tại 30 FPS)');
  console.log('FFmpeg binary:', FFMPEG_PATH);

  const outDir = path.resolve('spike/satori-resvg-probe/out');
  fs.mkdirSync(outDir, { recursive: true });
  const outMp4 = path.join(outDir, 'output_satori.mp4');

  // Spawn FFmpeg in rawvideo pipe mode
  const ffmpegProcess = spawn(FFMPEG_PATH, [
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', '1080x1920',
    '-r', '30',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    outMp4,
  ]);

  let ffmpegErr = '';
  ffmpegProcess.stderr.on('data', (d) => { ffmpegErr += d.toString(); });

  const totalFrames = 60;
  const times = [];
  const satoriTimes = [];
  const resvgTimes = [];

  const startAll = Date.now();

  for (let i = 0; i < totalFrames; i++) {
    const timeSec = i / 30.0;
    const t0 = performance.now();

    // 1. Generate Virtual DOM element
    const element = createGameFrame(timeSec);

    // 2. Satori: Render to SVG
    const tSatoriStart = performance.now();
    const svg = await satori(element, {
      width: 1080,
      height: 1920,
      fonts: [
        { name: 'Segoe UI', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Segoe UI', data: fontBold, weight: 700, style: 'normal' },
      ],
    });
    const tSatoriEnd = performance.now();

    // 3. Resvg: Rasterize SVG to raw RGBA Buffer
    const tResvgStart = performance.now();
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1080 },
      font: {
        loadSystemFonts: false,
        fontFiles: [
          'C:/Windows/Fonts/segoeui.ttf',
          fontBoldPath,
        ],
      },
    });
    const rendered = resvg.render();
    const pixels = rendered.pixels;
    const tResvgEnd = performance.now();

    // 4. Pipe raw RGBA buffer into FFmpeg stdin
    ffmpegProcess.stdin.write(pixels);

    const tEnd = performance.now();

    const dtSatori = tSatoriEnd - tSatoriStart;
    const dtResvg = tResvgEnd - tResvgStart;
    const dtTotal = tEnd - t0;

    satoriTimes.push(dtSatori);
    resvgTimes.push(dtResvg);
    times.push(dtTotal);

    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`Frame ${i + 1}/${totalFrames} - Total: ${dtTotal.toFixed(1)}ms (Satori: ${dtSatori.toFixed(1)}ms, Resvg: ${dtResvg.toFixed(1)}ms)`);
    }
  }

  // End stream to FFmpeg
  ffmpegProcess.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpegProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${ffmpegErr}`));
    });
  });

  const totalWallMs = Date.now() - startAll;
  const mem = process.memoryUsage();

  const avgSatori = satoriTimes.reduce((a, b) => a + b, 0) / totalFrames;
  const avgResvg = resvgTimes.reduce((a, b) => a + b, 0) / totalFrames;
  const avgTotal = times.reduce((a, b) => a + b, 0) / totalFrames;
  const effectiveFps = 1000 / avgTotal;

  console.log('\n================ BÁO CÁO KẾT QUẢ BENCHMARK ================');
  console.log(`⏱️  Tổng thời gian xử lý: ${(totalWallMs / 1000).toFixed(2)}s cho ${totalFrames} frames`);
  console.log(`⚡ Thời gian trung bình mỗi frame: ${avgTotal.toFixed(2)}ms`);
  console.log(`   - Satori (HTML/CSS -> SVG): ${avgSatori.toFixed(2)}ms`);
  console.log(`   - Resvg (SVG -> Raw RGBA):  ${avgResvg.toFixed(2)}ms`);
  console.log(`🚀 Tốc độ render: ${effectiveFps.toFixed(1)} FPS (Gấp ${(effectiveFps / 30).toFixed(1)}x thời gian thực)`);
  console.log(`🧠 Bộ nhớ RAM tiêu thụ đỉnh (RSS): ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`💾 Bộ nhớ Node.js Heap đã dùng:    ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 File video MP4 kết xuất: ${outMp4}`);
  console.log(`📦 Dung lượng video: ${(fs.statSync(outMp4).size / 1024).toFixed(1)} KB`);
  console.log('============================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Lỗi khi chạy benchmark:', err);
  process.exit(1);
});
