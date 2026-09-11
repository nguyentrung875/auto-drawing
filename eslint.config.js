import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zone = (dir) => path.join(__dirname, 'src', dir);

// AR-1 / Story 1.1: dependency direction (left MAY import right, never the
// reverse — "no circular dep"):
//
//   queue -> validator -> game -> {audio, scene} -> render -> observability
//
// product, types, utils are leaves and carry no restriction here.
// Each zone forbids one reverse edge: `target` files must NOT import from `from`.
const zones = [
  { target: zone('validator'), from: zone('queue') }, // validator ↛ queue
  { target: zone('game'), from: zone('validator') }, // game ↛ validator
  { target: zone('game'), from: zone('queue') }, // game ↛ queue
  { target: zone('audio'), from: zone('game') }, // audio ↛ game
  { target: zone('scene'), from: zone('game') }, // scene ↛ game
  { target: zone('render'), from: zone('audio') }, // render ↛ audio
  { target: zone('render'), from: zone('scene') }, // render ↛ scene
  { target: zone('render'), from: zone('queue') }, // render ↛ queue
  { target: zone('queue'), from: zone('render') }, // queue ↛ render (AC 1.1 example)
  { target: zone('observability'), from: zone('render') }, // observability ↛ render
];

export default [
  {
    name: 'auto-drawing/dependency-rules',
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/parsers': { '@typescript-eslint/parser': ['.ts'] },
      'import/resolver': { node: { extensions: ['.ts', '.js', '.json'] } },
    },
    rules: {
      'import/no-restricted-paths': ['error', { zones }],
      // AR-10 / Story 2.2: determinism — all randomness must go through
      // `seedrandom` (src/game/rng.ts). Math.random() is banned.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math.random() is banned (AR-10) — use createRng(seed) from src/game/rng.ts',
        },
      ],
    },
  },
];
