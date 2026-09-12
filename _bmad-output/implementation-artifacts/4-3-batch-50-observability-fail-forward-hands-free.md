# Story 4.3 — Batch 50 + Observability (fail-forward, hands-free)

Status: done (2026-09-12)

## Scope

`game batch --count 50` (or 50 Hermes-written `queue/job_*.json`) renders
hands-free: FIFO, bounded worker pool, per-job logs, one batch report, and a
single bad job never stops the run.

## Delivered

| File | Role |
| --- | --- |
| `src/cli/batch.ts` | `game batch --count --mechanics --result-variant --seed [--quiet]`; wires the real render stage via the composition root |
| `src/queue/QueueStore.ts` | Atomic `tmp → rename` job files, FIFO by `enqueuedAt` → mtime, malformed files reported not thrown |
| `src/queue/schema.ts` | Zod `queueJobSchema`; `planBatchJobs()` distributes `--count` across mechanics with `seed = base + index*977` |
| `src/queue/WorkerPool.ts` | `min(CPU-1, 3)` workers (never <1), one job per worker at a time |
| `src/queue/JobRunner.ts` | validate → engine → audio → scene → render; never throws, always returns `JobOutcome`; writes `logs/<gameId>.json` |
| `src/queue/BatchOrchestrator.ts` | Pre-flight disk check, FIFO drain, progress callback, report emission |
| `src/observability/JobLogger.ts` | Per-job log with all AC timing/size fields |
| `src/observability/BatchReporter.ts` | `batch_report.json` + human summary, SM-1 (≥0.98) verdict |
| `src/observability/DiskGuard.ts` | 2 GB floor → `INSUFFICIENT_DISK_SPACE` before any render |
| `src/observability/filters.ts` | Error code → Hermes filter (`schema`, `game_logic`, `price_source`, `asset`, `audio`, `scene`, `render`, `timeout`, `disk`, `llm`, `queue`) |
| `src/queue/llmStub.ts` | LLM patch stub with 3× retry on malformed JSON, ownership rules (price/answer stay deterministic) |

## Contract

- RAM ceiling: jobs stream to disk, only one job per worker is in flight, and
  the pool is capped at `min(CPU-1, 3)`; the 50-job test asserts
  `process.memoryUsage().heapUsed` stays far below 4 GB.
- Fail-forward: a failing job records `{code, filter, cause}` in
  `logs/<gameId>.json`, sets `status: failed`, and the pool moves on. The batch
  report lists every failure under `failed_jobs[]`.
- `export/batch-<ts>/batch_report.json`:
  `{total, passed, failed, pass_rate, avg_render_ms, worker_pool_max, duration_ms, manual_interventions, jobs[], failed_jobs[], warnings[]}`
  with SM-1 satisfied at `passed/total ≥ 0.98`.
- Per-job log fields: `planning_ms, tts_ms, audio_voice_ms, render_ms,
  encode_ms, audio_mix_ms, total_ms, seed, products[], file_size,
  validator_errors[], attempts, retries, warnings[]`, plus `code/filter/cause`
  on failure.
- `temp/<jobId>/` is removed in a `finally` block regardless of outcome.

## Acceptance evidence

- `test/queue/queue.test.ts` — 18 tests: pool cap and concurrency, atomic queue
  writes + FIFO, status transitions, a full valid job logging every AC field, a
  missing product failing with code + filter, `E_RENDER_STAGE_MISSING` when the
  port is absent, temp cleanup even when the stage leaks, TTS timeout derived
  from script length, LLM stub retrying 3× then failing / succeeding on the 3rd
  attempt / refusing price+answer patches, 50 deterministic planned jobs,
  fail-forward (1 bad product, rest succeed), 50 enqueued jobs under the RAM
  ceiling, and the disk-floor abort.
- `test/observability/observability.test.ts` — 5 tests: log shape/atomicity and
  round-trip listing, batch report maths + summary text, SM-1 satisfied at
  49/50, and code→filter mapping.
- `test/cli/epic4-cli.test.ts` — batch flag parsing, a 5-job batch through the
  orchestrator, `INSUFFICIENT_DISK_SPACE` aborting before any render, and a
  malformed queue file being rejected while valid jobs still run.
- Live run: `game batch --count 50 --mechanics hi_lo,most_expensive,one_away
  --result-variant comment --seed 839271` on the real render engine; report at
  `export/batch-<ts>/batch_report.json` and every `logs/<gameId>.json` present.
