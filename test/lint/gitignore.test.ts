/**
 * Guard: no file under `src/`, `test/` or `products/` may be git-ignored.
 *
 * The runtime output dirs (`queue/`, `logs/`, `export/`, `temp/`, `assets/`)
 * live at the repository root, so their ignore patterns must be root-anchored —
 * an unanchored `queue/` silently ignores `src/queue/` and the module never
 * reaches CI.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const GUARDED = ['src', 'test', 'products', 'games'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('gitignore hygiene', () => {
  it('never ignores a tracked source file', () => {
    const files = GUARDED.flatMap((dir) => walk(path.join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(50);

    const ignored: string[] = [];
    for (const file of files) {
      try {
        execFileSync('git', ['check-ignore', '--quiet', file], { cwd: ROOT });
        ignored.push(path.relative(ROOT, file));
      } catch {
        // exit code 1 = not ignored (the expected case)
      }
    }
    expect(ignored).toEqual([]);
  });
});
