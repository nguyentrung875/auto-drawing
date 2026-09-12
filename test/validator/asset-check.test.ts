/**
 * Regression guard for the asset check (Story 1.3 / AD-4).
 *
 * The pipeline used to compute `existsSync('assets') ? hasAsset(...) : true`,
 * which meant the `E_ASSET_MISSING` filter switched itself OFF exactly when the
 * assets were missing — the one condition it exists to detect. 50/50 SKUs had
 * no image and the validator reported zero problems.
 *
 * The relaxation is still there (images are not committed), but it is now
 * *reported*, and `REQUIRE_ASSETS=1` restores the hard check.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSETS_DIR_MISSING_WARNING, resolveAssetCheck } from '../../src/validator';

function tempRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'asset-check-'));
}

const previous = process.env.REQUIRE_ASSETS;

afterEach(() => {
  if (previous === undefined) delete process.env.REQUIRE_ASSETS;
  else process.env.REQUIRE_ASSETS = previous;
});

describe('resolveAssetCheck', () => {
  it('never disables the check silently — a missing assets/ dir is reported', () => {
    delete process.env.REQUIRE_ASSETS;
    const check = resolveAssetCheck(tempRoot());

    expect(check.enabled).toBe(false);
    expect(check.warning).toBeDefined();
    expect(check.warning?.code).toBe(ASSETS_DIR_MISSING_WARNING);
    expect(check.warning?.hint).toMatch(/REQUIRE_ASSETS=1/);
  });

  it('enforces the check with no warning once assets/ exists', () => {
    delete process.env.REQUIRE_ASSETS;
    const root = tempRoot();
    mkdirSync(path.join(root, 'assets'), { recursive: true });
    writeFileSync(path.join(root, 'assets', 'p001.png'), 'x');

    const check = resolveAssetCheck(root);
    expect(check.enabled).toBe(true);
    expect(check.warning).toBeUndefined();
  });

  it('keeps the check hard under REQUIRE_ASSETS=1 even without assets/', () => {
    process.env.REQUIRE_ASSETS = '1';
    const check = resolveAssetCheck(tempRoot());

    expect(check.enabled).toBe(true);
    expect(check.warning).toBeUndefined();
  });
});
