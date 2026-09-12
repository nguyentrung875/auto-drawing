# Story 4.2 — CLI: single `game render` + `game products list`

Status: done (2026-09-12)

## Scope

One command renders one game end to end and leaves the same artefacts a batch
job leaves, so `game batch` is only a loop over this path.

## Delivered

| File | Role |
| --- | --- |
| `src/cli/index.ts` | Argument router; `HELP` lists `render`, `batch`, `products list`, `queue status`, `logs`, `config`, `plan` |
| `src/cli/render.ts` | `game render --mechanic … --products … --seed … --result-variant …` (also `--game <file>`, `--preview`, `--hidden-index`) |
| `src/cli/products.ts` | `game products list` — 50 SKUs as `productId | name | price VND | affiliate_link` |
| `src/cli/pipeline.ts` | Composition root: wires ProductProvider → Validator → GameEngine → AudioEngine → SceneSystem → RenderEngine, and exposes `createRenderStage()` for the batch loop |
| `src/cli/inspect.ts` | `queue status`, `logs`, `config` views |
| `src/cli/gameFile.ts` | Loads/normalises a pre-authored Game JSON |

## Behaviour

1. Flags are parsed and the requested products are validated against product
   count rules per mechanic (`HI_LO` 2, `ONE_AWAY` 1, `MOST_EXPENSIVE` ≥4).
2. `queue/job_<uuid>.json` is written with `status: pending`.
3. The job runs Validator → Engine → Audio → Scene → Render and is updated to
   `status: done` with `videoPath`.
4. `export/<gameId>_<seed>.mp4`, `export/<gameId>_<seed>.caption.json` and
   `logs/<gameId>.json` are produced; the one-job batch report is printed and
   the process exits 0.

Failure contract: exit 1 with `{"code","field","hint"}` on stdout. A product
pointed at a non-existent SKU yields `E_PRICE_SOURCE_INVALID`; an impossible
game logic (e.g. `MOST_EXPENSIVE` with a single product) yields
`E_GAME_LOGIC_INVALID` with the offending field.

## Acceptance evidence

- `test/cli/epic4-cli.test.ts` — 14 tests covering flag parsing, the happy path
  (queue file `status: done`, video path, report path, `passed 1/1`), the
  broken-JSON exit-1 contract (code + field + hint), wrong product counts
  failing before rendering, `--game` file loads, `products list` printing 51
  lines (header + 50 SKUs), `--help` listing all five commands, queue/logs
  formatting, and `E_ASYNC_COMMAND` when an async command is routed through the
  sync `run()`.
- Live run: `tsx src/cli/index.ts render --mechanic hi_lo --products
  p001,p042 --seed 839271 --result-variant in_video` → exit 0,
  `export/hi_lo_839271_839271.mp4` (468 KB), `export/hi_lo_839271_839271.caption.json`,
  `logs/hi_lo_839271.json` (`render_ms 5415.17`, `encode_ms 9610.82`), job file
  `status: done`.
