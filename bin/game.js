#!/usr/bin/env node
// Thin launcher for the TypeScript CLI (src/cli/index.ts) so `game <cmd>` works
// from the package `bin` without a build step — runs through tsx.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src', 'cli', 'index.ts');

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', cli, ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
