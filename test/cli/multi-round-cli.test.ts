import { describe, it, expect } from 'vitest';
import { parseRenderArgs } from '../../src/cli/render';

describe('Multi-Round CLI args parsing', () => {
  it('parses --rounds and --timer flags', () => {
    const args = parseRenderArgs(['--mechanic', 'g9', '--rounds', '4', '--timer', '6']);
    expect(args.rounds).toBe(4);
    expect(args.timer).toBe(6);
  });

  it('handles default undefined rounds and timer', () => {
    const args = parseRenderArgs(['--mechanic', 'hi_lo']);
    expect(args.rounds).toBeUndefined();
    expect(args.timer).toBeUndefined();
  });
});
