import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateRenderHtml } from '../src/render/template/renderTemplate.ts';

const inputStr = readFileSync(0, 'utf-8');
const input = JSON.parse(inputStr);
const html = generateRenderHtml(input);
process.stdout.write(html);
