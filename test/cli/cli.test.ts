import { describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/index';

function captureLog(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => String(a)).join(' '));
    });
  return { lines, restore: () => spy.mockRestore() };
}

describe('CLI (Story 1.3)', () => {
  it('game products list prints header + 50 rows with VND formatting', () => {
    const { lines, restore } = captureLog();
    try {
      const code = run(['products', 'list']);
      expect(code).toBe(0);
      expect(lines.length).toBe(51); // 1 header + 50 SKUs
      expect(lines[0]).toContain('productId');
      expect(lines[1]).toContain('p001');
      expect(lines[1]).toContain('189.000');
      expect(lines[50]).toContain('p050');
    } finally {
      restore();
    }
  });

  it('unknown command returns exit code 1', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(run(['nonsense'])).toBe(1);
    } finally {
      err.mockRestore();
    }
  });

  it('--help returns exit code 0', () => {
    const { restore } = captureLog();
    try {
      expect(run(['--help'])).toBe(0);
    } finally {
      restore();
    }
  });
});
