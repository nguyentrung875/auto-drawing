# Party-Mode Review — Fix Report (2026-09-12)

Review of all four epics (party mode, installed roster), followed by a fix pass on
everything found. Branch `arena/01a093df-auto-drawing`, commit `4198a52`.

## Verdict on the original question

**Đã code xong hết tất cả epic chưa?** Yes — epic 1–4 all `done`, 14/14 stories `done`,
11/11 FRs covered, and the gates were genuinely green (not green-by-stub).

**Còn lỗi chỗ nào không?** Yes — four defects that 134 passing tests did not catch,
because every test asserted on *scene data* while the bugs lived in the rendered pixels
and the audio track. All four are now fixed.

## Defects found and fixed

| # | Defect | Severity | Root cause |
| --- | --- | --- | --- |
| 1 | Answer caption painted over the last product card on every 3–4 card MOST_EXPENSIVE reveal | Release-blocking | Caption hardcoded at `y=1300`; 3-card layout runs to `y=1550`. Layout validation only compared card-vs-card, never card-vs-text |
| 2 | Reveal never showed the real price — cards kept `???` | Release-blocking | No code path substituted the true price. `maxPriceLabel()` was written for exactly this and never called (dead export) |
| 3 | Narration was pure silence, and undocumented | High | `ViPiperEngine` wrote a zero-filled WAV unconditionally; Piper was never invoked. Measured `mean_volume -37.9 dB` (music bed only) |
| 4 | The asset check disabled itself | High | `existsSync('assets') ? hasAsset(...) : true` — `E_ASSET_MISSING` switched off exactly when assets were missing. 50/50 SKUs had no image, validator reported nothing |
| 5 | DF6 recorded as open but already implemented | Low | Stale ledger entry |

### 1 + 2 — the reveal

`ProductCard` now carries `revealPriceLabel` (always the true ProductProvider price)
alongside the pre-answer `priceLabel`. `PriceReveal` swaps it in, and compacts the cards
above a reserved caption band (`REVEAL_TEXT_BAND_TOP = 1240`) by uniform scaling about the
stage centre — which preserves both the no-overlap guarantee and the ≤400px width cap, so
`validateProductCards` still holds. The painter anchors the caption below the lowest card
and stacks the sub-caption by measured block height. Card-internal text is now laid out
proportionally, so a scaled-down card does not collide name-over-price.

`maxPriceLabel` (dead) removed.

### 3 — narration

`ViPiperEngine` now really invokes Piper: `PIPER_PATH` → `piper` on PATH, voice model from
`PIPER_VOICE` → `assets/voices/vi_VN.onnx`, script on stdin, 20s timeout, duration read
back from the WAV header. When the binary or model is absent it still returns a valid
silent WAV so the pipeline runs offline — but reports `W_VOICE_SILENT_STUB` through
`AudioSegment.warnings` onto the job log. Piper is not installed in this environment, so
renders are still mute; that is now **visible** rather than silent (tracked as DF8).

### 4 — the asset check

`resolveAssetCheck(rootDir)` keeps the relaxation (product images are not committed, so a
fresh checkout must still run) but reports `W_ASSETS_DIR_MISSING`, and `REQUIRE_ASSETS=1`
restores the hard check for CI/release. Applied at both call sites (`JobRunner`, `plan`).

## Verification

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx eslint src` (incl. AD-1 dependency rule) | clean |
| `npx vitest run` | **150 passed / 20 files** (was 134/17) |
| Live single render, 3 mechanics | exit 0, MP4 1080×1920 30fps h264/aac 18.0s |
| Live batch, 3 mechanics interleaved | **9/9 passed**, exit 0, avg_render_ms 5430 |
| Visual check of REVEAL frames | 2-card, 3-card and 4-card layouts all clear |

**+16 regression tests**, all at the seam where the bugs actually lived:

- `test/scene/reveal-layout.test.ts` — real price shown at reveal, cards clear of the
  caption band, no card-vs-card overlap, width cap preserved. For HI_LO, 3-card and 4-card
  MOST_EXPENSIVE. *Confirmed to fail 5/10 against the pre-fix code.*
- `test/audio/voice-fallback.test.ts` — `W_VOICE_SILENT_STUB` raised when Piper is absent,
  warning propagates through `AudioEngine.synthesize`, no false warning for a real adapter.
- `test/validator/asset-check.test.ts` — check never disables silently, enforced when
  `assets/` exists, hard under `REQUIRE_ASSETS=1`.

Job logs from the live batch now carry all four warnings honestly:
`W_ASSETS_DIR_MISSING`, `W_VOICE_SILENT_STUB`, `W_MUSIC_MISSING`, `W_ASSET_PLACEHOLDER`.

## Still open (see `deferred-work.md`)

- **DF2** — dedicated error code for "invalid value" vs "missing field".
- **DF5** — real Motion Canvas headless backend (drop-in `IFrameRenderer`).
- **DF7** — bounded render-stage retry once real overnight failure data exists.
- **DF8** — install Piper + a `vi_VN` model to turn narration on (no code change needed).
- **DF9** — real product imagery; until then `W_ASSET_PLACEHOLDER` / `W_MUSIC_MISSING`
  fire on 100% of jobs and should be read as environment state, not per-job signal.

Process note: all four epic retrospectives are still `optional` and none have been run.
