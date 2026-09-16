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

    let stdout = '';
    try {
      stdout = execFileSync('git', ['check-ignore', '--stdin'], {
        input: files.map((f) => path.relative(ROOT, f)).join('\n'),
        cwd: ROOT,
        encoding: 'utf8',
      });
    } catch (e) {
      // exit code 1 means none of the files were ignored, or partial matches in stdout
      stdout = (e as { stdout?: string }).stdout ?? '';
    }
    const ignored = stdout.split(/\r?\n/).filter(Boolean);
    expect(ignored).toEqual([]);
  }, 30000);
});
