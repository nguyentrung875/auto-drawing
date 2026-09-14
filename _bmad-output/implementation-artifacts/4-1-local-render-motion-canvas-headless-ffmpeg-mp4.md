# Story 4.1 — Local Render (Motion Canvas headless → FFmpeg MP4)

Status: done (2026-09-12)

## Scope

`RenderEngine.render(game, timeline, audio)` produces a vertical MP4 plus the
caption sidecar, with the affiliate link kept out of the pixels.

## Delivered

| File | Role |
| --- | --- |
| `src/render/RenderEngine.ts` | Orchestrates frame stage → muxer → burn scan → caption; owns `temp/<jobId>/` |
| `src/render/softwareFrameRenderer.ts` | Deterministic PNG sequence (`frame_%05d.png`, 540 frames @ 18.0s) |
| `src/render/scenePainter.ts`, `canvas.ts`, `raster.ts`, `geometry.ts`, `text/truetype.ts` | Software rasteriser + TrueType text (DejaVu) so headless render needs no GPU/browser |
| `src/render/ffmpeg.ts` | `FFmpegMuxer` (libx264 CRF 18 preset fast, AAC 128k, `+faststart`), `probeVideo()`, binary resolution |
| `src/render/process.ts` | `resolveBinary` + `runProcess` with SIGTERM→SIGKILL escalation |
| `src/render/pixelScan.ts` | `scanForAffiliateBurn()` — crops the bottom band and looks for rendered link glyphs |
| `src/render/png.ts`, `wav.ts`, `audioBed.ts` | Codec helpers (deflate PNG, 44.1 kHz WAV, mixed bed) |

Output layout: `export/<gameId>_<seed>.mp4` + `export/<gameId>_<seed>.caption.json`
(`{caption, hashtags, affiliate_link}`). `affiliate_link` appears only in the
caption/comment, never in the video.

## Acceptance evidence

- `test/render/RenderEngine.test.ts` — 10 tests: MP4 probe is 1080×1920@30
  H.264/AAC, render stays inside the 45s budget, no-frames case yields
  `E_RENDER_FRAMES_MISSING`, an over-budget render is reported as
  `W_RENDER_SLOW` (never a failure), the hang guard kills at 90s
  (`PROCESS_TIMEOUT`), `temp/<jobId>/` is removed in `finally` both on success
  and after a mux failure, and the software stage fallback is honest about it.
- Burn guarantee is proven from both directions: a clean render scans
  `burned:false`, and a deliberately burned render (same pipeline, link drawn
  into the bottom band) is caught with `E_AFFILIATE_BURNED_IN`.
- Live run: `export/hi_lo_839271_839271.mp4` (468 KB, 1080×1920, 18.0s,
  H.264/AAC) with `render_ms ≈ 5.4s` and `encode_ms ≈ 9.6s` on 2 CPUs.

## Notes

- Render inputs are validated before a frame is drawn; the frame stage runs on a
  wall-clock deadline and fails with `PROCESS_TIMEOUT` rather than hanging.
- `pixelScan` samples four timestamps in the bottom 360px band, rasterises the
  link in 15 heights × 4 link variants, and requires both ink and gap evidence
  (one-sided matching also matched progress bars). The scan costs ~1.0s per
  video.
