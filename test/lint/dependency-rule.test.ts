import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function lintOne(text: string, filePath: string) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: path.join(root, 'eslint.config.js'),
  });
  const [result] = await eslint.lintText(text, { filePath });
  return result!;
}

describe('dependency rule — eslint import/no-restricted-paths (Story 1.1)', () => {
  it('allows normal imports (no false positive)', async () => {
    const result = await lintOne(
      `import { ProductProvider } from '../product/ProductProvider';\n`,
      path.join(root, 'src/cli/ok.ts'),
    );
    expect(result.errorCount).toBe(0);
  });

  it('flags queue importing render (the AC example)', async () => {
    const result = await lintOne(
      `import { RENDER_CONTEXT } from '../render';\n`,
      path.join(root, 'src/queue/bad.ts'),
    );
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.messages.map((m) => m.ruleId)).toContain('import/no-restricted-paths');
  });
});
