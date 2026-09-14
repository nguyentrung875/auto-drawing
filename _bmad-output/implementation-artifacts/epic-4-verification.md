# Epic 4 — Verification & Self-Review (2026-09-12)

Stories: 4.1 local render · 4.2 single CLI · 4.3 batch 50 + observability.
Branch: `arena/01a09375-auto-drawing` (commit “Epic 4 — local render, single/batch CLI,
fail-forward observability”).

## Gate results

| Gate | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | clean |
| Lint (incl. AD-1 dependency rule) | `npx eslint src` | clean |
| Tests | `npx vitest run` | **134 passed / 17 files** (~67s) |
| Live single render | `game render --mechanic hi_lo --products p001,p042 --seed 839271 --result-variant in_video` | exit 0, MP4 1080×1920 18.0s + caption + log |
| Live batch 50 | `game batch --count 50 --mechanics hi_lo,most_expensive,one_away --result-variant comment --seed 839271` | **passed 50/50**, exit 0, 13.7 min |

## Live batch evidence (real FFmpeg renders, not stubs)

```json
{"batch_id":"2026-09-12T03-17-34-291Z","total":50,"passed":50,"failed":0,
 "pass_rate":1,"avg_render_ms":5424.37,"worker_pool_max":1,
 "manual_interventions":0,"duration_ms":821132,"warnings":[]}
```

- 50 MP4 (`export/*.mp4`, 24.0 MB total) + 50 `.caption.json` + 50 `logs/<gameId>.json`
  + 50 `queue/job_*.json` at `status: done`; `temp/` empty (cleanup in `finally`).
- Per-job real timings: `render_ms` 4.7–6.8s, `encode_ms` ≈9.6s, `total_ms` 15.3–20.1s
  — no job near the 45s budget, so no `W_RENDER_SLOW` in this run.
- Every AC log field present in all 50 logs: `planning_ms, tts_ms, render_ms, encode_ms,
  seed, products[], audio_voice_ms, file_size, validator_errors[]` (+ `audio_mix_ms,
  total_ms, attempts, retries, warnings[]`).
- `worker_pool_max = 1` because the sandbox has 2 CPUs (`min(2-1, 3) = 1`); on an 8-core
  machine the same formula yields 3, which is what the pool test asserts.
- Fail-forward was proven live too: an earlier 50-job run with an unwired render stage
  produced 50 `failed` jobs, one `failed_jobs[]` entry each, `passed 0/50`, and the batch
  still completed and wrote its report instead of aborting.

## Self-review round — findings and fixes

1. **`.gitignore` swallowed `src/queue/`** (severity: release-blocking). The runtime rule
   `queue/` was unanchored, so `git check-ignore` matched `src/queue/*.ts` — the whole
   Epic 4 queue module would have been absent from CI and from the PR. Root-anchored the
   runtime output rules (`/export/`, `/queue/`, `/logs/`, `/temp/`, `/assets/`) and added
   `test/lint/gitignore.test.ts`, a guard that fails if any file under `src/`, `test/`,
   `products/` or `games/` is git-ignored (negative case verified by temporarily
   reintroducing an unanchored rule).
2. **Tests wrote into the repository's runtime dirs.** The batch tests passed `rootDir:
   ROOT` without `logsDir`, so `game batch` wrote 50 fake-stage logs into the checkout's
   `logs/` next to a live batch. Every test now redirects `queueDir`/`exportDir`/`logsDir`
   into its temp work dir, and `productsDir` points at the real SKUs.
3. **FIFO was timing-dependent.** `QueueStore.list()` broke same-millisecond ties by
   `jobId`, which contradicted insertion order and made the FIFO test flaky (1 failure in
   a full-suite run). Ordering is now `enqueuedAt → file mtime → file name`, and the test
   asserts both the distinct-instant order and same-millisecond determinism (3 consecutive
   green runs).
4. **Batch exit code was too weak.** It exited 1 only when *all* jobs failed; automation
   could not tell a 40 % batch from a healthy one. Now exit 0 when SM-1 holds
   (`pass_rate ≥ 0.98`) and 1 when it does not, with a test for the 49/50 boundary.
5. **`game products list` format** was tab-separated; aligned to the story's literal
   `productId | name | price VND | affiliate_link` table (test updated, 51 lines).
6. **Wasted work per job**: the burn scan extracted four bands even when a game has no
   affiliate link (a <8-char link cannot be recognised). It now short-circuits with
   `{scanned: 0, burned: false}` while still resolving `ffmpeg` first, so
   `E_FFMPEG_MISSING` is unchanged.
7. **Readability**: named `MIN_PROFILE_SCORE` in `pixelScan`, and the audio-bed warning
   handling in `RenderEngine` (which filtered then re-scanned the array to throw) is a
   single `find`.

Also checked and left as-is: stage order in `JobRunner` (`products → mechanic → Validator`
is required because the validator validates the *computed* Game JSON), the deliberate
`W_RENDERER_FALLBACK` when the Motion Canvas backend is absent (recorded as DF5), and the
deliberate absence of automatic render-stage retries (DF7).

## Deferred (see `deferred-work.md`)

- **DF5** — real Motion Canvas headless backend (drop-in `IFrameRenderer`).
- **DF6** — `metadata.mechanic` vs `gameplay.mechanic` cross-check (carried from DF1).
- **DF7** — bounded render-stage retry once real overnight failure data exists.
