# Retrospective — Epics 1–4 (Universal AI Game Video Engine)

**Date:** 2026-09-12
**Scope:** all four epics, 14/14 stories `done`
**Mode:** headless (run without user confirmation, per trung's instruction "làm những việc còn lại, không hỏi lại")
**Verdict:** **accepted with conditions** — see Acceptance.

Every finding below carries a source (file, measurement, or log). Claims that
could not be pointed at were dropped.

---

## Epic summary

| Epic | Stories | Status | Retro verdict |
|---|---|---|---|
| 1 — Foundation | 3 | done | accepted |
| 2 — Game Engine | 5 | done | accepted |
| 3 — Scenes / Audio / Preview | 3 | done | accepted with conditions |
| 4 — Render / CLI / Batch | 3 | done | accepted with conditions |

No story was left unfinished, so the Phase 4 completeness gate does not force a
rejection. The conditions attach to *what the epics shipped*, not to whether
they finished.

---

## Finding 1 — The defect class that four green epics could not see

**Severity: high. This is the headline finding; the rest are consequences of it.**

Four separate defects reached "done" with `tsc`, `eslint` and the whole test
suite green:

| Defect | Where it lived | Why tests missed it |
|---|---|---|
| Answer caption painted over the 3rd card | `scenePainter.ts` reveal band | tests asserted scene data, not pixels |
| Cards showed `???` instead of real prices at reveal | `PriceReveal` | scene data had the price; the painter never swapped it |
| Narration was a zero-filled WAV on 100% of jobs | `ViPiperEngine` | no test asserted the audio was audible |
| Countdown froze on "3" for its whole duration | `softwareFrameRenderer` cache keyed by scene *name* | scene data emitted 3.0/2.5/2.0… correctly; only the raster was wrong |

The common root cause is a **seam**: the test suite asserted on the *scene tree*,
while all four bugs lived downstream in the *painted frame* and the *mixed
audio*. `validateProductCards()` compares card rectangles to each other, so it is
structurally incapable of seeing text-over-card. Coverage was high and pointed
at the wrong layer.

**Action taken this session (not deferred):**
- `src/render/layoutScan.ts` + `Canvas.paintedText` — the renderer now records
  every painted text block, and a geometric gate asserts no text collides or
  leaves the frame. It runs in the test suite across every mechanic × card count
  × result variant, **and** on every real job as `W_LAYOUT_OVERLAP`.
- It proved itself immediately: it failed on first run against a spacing bug in
  the brand-new ONE_AWAY reveal that had just been written and eyeballed.
- `test/render/countdown-frames.test.ts` pins the raster-cache bug.
- Audio assertions now count non-zero PCM frames instead of trusting a file path.

**Lesson:** a test that asserts on the data structure feeding a renderer is not a
test of the renderer. For any pipeline stage that *transforms* rather than
*computes*, assert on the output artifact.

---

## Finding 2 — "Deterministic" was verified, "audible" and "visible" were assumed

**Severity: high.**

AR-10 (no `Math.random()`) was enforced by lint and tested. Meanwhile:
- every MP4 had a silent voice track (`mean_volume -37.9 dB`, music bed only);
- every ProductCard drew a grey `P0xx` placeholder;
- `W_ASSET_PLACEHOLDER` and `W_MUSIC_MISSING` fired on **100%** of jobs.

The batch reported `50/50 passed` throughout. The acceptance criteria that were
*mechanically checkable* were checked; the ones that required looking at the
artifact were not. A 100%-firing warning is not a warning, it is a background
condition — and it was read as one.

**Root cause of the asset half was a one-character class of bug:** SKUs declared
`assets/pNNN.webp` while `isRenderableImage()` only decodes PNG. Not a missing
directory — a format mismatch that the placeholder path swallowed silently.

**Action taken:** `scripts/generate-assets.mjs` (50 PNGs, 6 SFX, 3 music beds,
deterministic, offline, `npm run assets:generate`); SKUs migrated to `.png`;
`FormantViEngine` gives real narration offline. Warnings per job: **4 → 1**.
Mix level: **−37.9 dB → −23.5 dB**.

**Lesson:** when a warning fires on 100% of runs, either fix it or delete it.
Leaving it in place trains everyone to ignore the warning channel.

---

## Finding 3 — Silent fallbacks were chosen three times, and hid three defects

**Severity: medium.**

A recurring design habit: when a dependency was missing, the code degraded
quietly and reported success.

- `ViPiperEngine` wrote a zero-filled WAV and reported nothing (FR-9 looked met).
- The asset check disabled itself when `assets/` was absent — the check most
  needed when assets are missing was the one that turned itself off.
- `drawProductCard` fell back to a placeholder without distinguishing "no image
  configured" from "image configured but undecodable".
- Piper's clip duration was clamped with `Math.min(1.9, duration)`, reporting a
  length the file did not have.

Each individually looks like defensive programming. Together they produced a
pipeline that could not fail, and therefore could not tell the truth.

**Action taken:** every fallback now reports — `W_VOICE_FORMANT_FALLBACK`,
`W_VOICE_SILENT_STUB`, `W_VOICE_OVER_BUDGET`, `W_ASSET_PLACEHOLDER`,
`W_LAYOUT_OVERLAP`; `REQUIRE_ASSETS=1` makes the asset check fail hard; the
duration clamp was removed in favour of reporting the real length.

**Lesson:** a fallback without a signal is indistinguishable from a bug. Degrade
if you must, but say so.

---

## Finding 4 — Metrics were reported optimistically

**Severity: low, but it shaped decisions.**

`BatchReporter.formatSummary` prints `avg_render_ms` (~6.4–7.9s) and omits encode
(~9.5s). Real wall-clock is ~17–19s per video; the 50-job batch takes **15m42s**.
Nothing is wrong with the number printed — it is simply the flattering half.

**Fixed this session** (DF10): `formatSummary` now prints
`avg_job <n>s wall-clock` alongside `avg_render_ms`, so the quoted figure is the
one capacity planning actually needs.

---

## What went well

- **Architecture held.** 10 ADs, 8 bounded contexts, enforced by
  `import/no-restricted-paths` and a dependency-rule test. Across every fix this
  session, the module boundaries never had to be renegotiated — the one attempt
  to cross `src/scene/` → `src/render/` was correctly blocked by lint, and
  duplicating a constant was the right call over weakening the rule.
- **Determinism is real.** Same seed → same answer, same bytes. The asset
  generator was written to the same standard (FNV-1a, no `Math.random()`), so
  `assets/` can stay git-ignored and still be reproducible.
- **Fail-forward batching works.** 50/50 twice, with per-job logs, warnings and
  timings that made every diagnosis in this session possible.
- **The two-layer validator caught real schema mistakes** and was the right place
  to resolve DF1/DF6.

---

## Action items

| ID | Item | Status |
|---|---|---|
| AI-1 | Visual layout gate over painted frames | **done** — `layoutScan.ts`, 12 tests, live as `W_LAYOUT_OVERLAP` |
| AI-2 | Audible-narration assertions (non-zero PCM) | **done** — `test/audio/voice-fallback.test.ts` |
| AI-3 | Countdown raster-cache regression test | **done** — `test/render/countdown-frames.test.ts` |
| AI-4 | Generate the asset pack; migrate `.webp` → `.png` | **done** — DF9 closed |
| AI-5 | Every fallback must emit a warning code | **done** — see Finding 3 |
| AI-6 | Install Piper + `vi_VN` model on a networked machine | **open** — DF8; blocked here by egress, no code change needed |
| AI-7 | Report total wall-clock per job, not just render ms | **done** — `BatchReporter.formatSummary` now prints `avg_job …s wall-clock` |
| AI-8 | End-to-end viewer review before publishing a batch | **open** — DF11; the countdown bug was found this way, not by a test |

---

## Acceptance

**Accepted with conditions.**

The four epics deliver what they claimed: a deterministic, offline, fail-forward
engine that renders 50 spec-compliant videos hands-free (verified: 50/50,
1080×1920, 30fps, H.264/AAC, captions present, zero layout warnings).

Two conditions attach:

1. **The voice is a placeholder.** `FormantViEngine` is audible and honest, but
   robotic. It is fit for internal review and pipeline validation; it is **not**
   fit to publish. Installing Piper clears this with no code change (DF8/AI-6).
2. **Asset imagery is synthetic.** The generated PNGs prove the image path works
   end-to-end; they are not product photography. Real imagery is a content task.

Both are visible in `batch_report.json` rather than hidden, which is the change
that matters. Everything that was *silently* broken at the start of this session
is now either fixed or reported.

## Assumptions recorded (headless run)

- Ran without per-phase confirmation, per trung's explicit instruction not to ask.
- Retro'd all four epics as one document rather than four, because the dominant
  findings are cross-epic (the scene-data-vs-pixels seam spans Epics 2–4) and
  four separate documents would have fragmented the single most important lesson.
- Machine verdict "accepted with conditions" was rendered on evidence alone; no
  human override was sought.
