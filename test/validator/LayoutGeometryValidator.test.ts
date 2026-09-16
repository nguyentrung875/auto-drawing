import { describe, it, expect } from 'vitest';
import { LayoutGeometryValidator, type LayoutBox } from '../../src/validator/LayoutGeometryValidator';
import { DEFAULT_LAYOUT_POLICY } from '../../src/core/policy';

describe('LayoutGeometryValidator (Pre-Render Gate)', () => {
  it('accepts elements within safe-zone margins', () => {
    const boxes: LayoutBox[] = [
      { id: 'card_a', x: 80, y: 300, width: 420, height: 500 },
      { id: 'card_b', x: 580, y: 300, width: 420, height: 500 },
    ];
    const res = LayoutGeometryValidator.validate(boxes, DEFAULT_LAYOUT_POLICY);
    expect(res.valid).toBe(true);
  });

  it('rejects elements overflowing top or bottom safe-zone', () => {
    const topOverflow: LayoutBox[] = [{ id: 'headline', x: 100, y: 50, width: 880, height: 80 }];
    const res = LayoutGeometryValidator.validate(topOverflow, DEFAULT_LAYOUT_POLICY);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/breaches top safe-zone/);

    const bottomOverflow: LayoutBox[] = [{ id: 'cta', x: 100, y: 1500, width: 880, height: 100 }];
    const res2 = LayoutGeometryValidator.validate(bottomOverflow, DEFAULT_LAYOUT_POLICY);
    expect(res2.valid).toBe(false);
    expect(res2.errors[0]).toMatch(/breaches bottom safe-zone/);
  });

  it('detects overlapping element boxes', () => {
    const overlapping: LayoutBox[] = [
      { id: 'card_1', x: 100, y: 400, width: 300, height: 300 },
      { id: 'card_2', x: 250, y: 450, width: 300, height: 300 },
    ];
    const res = LayoutGeometryValidator.validate(overlapping, DEFAULT_LAYOUT_POLICY);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/Overlap detected/);
  });
});
