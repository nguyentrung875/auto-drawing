import type { LayoutPolicy } from '../core/policy/types';

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

export class LayoutGeometryValidator {
  static validate(elements: LayoutBox[], policy: LayoutPolicy): LayoutValidationResult {
    const errors: string[] = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!;
      if (el.y < policy.safeZoneTop) {
        errors.push(`Element "${el.id}" (y: ${el.y}) breaches top safe-zone (${policy.safeZoneTop}px)`);
      }
      if (el.y + el.height > policy.safeZoneBottom) {
        errors.push(
          `Element "${el.id}" bottom (${el.y + el.height}px) breaches bottom safe-zone (${policy.safeZoneBottom}px)`,
        );
      }

      for (let j = i + 1; j < elements.length; j++) {
        const other = elements[j]!;
        const overlapX = el.x < other.x + other.width && el.x + el.width > other.x;
        const overlapY = el.y < other.y + other.height && el.y + el.height > other.y;
        if (overlapX && overlapY) {
          errors.push(`Overlap detected between "${el.id}" and "${other.id}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
