import { describe, it, expect } from 'vitest';
import { getTheme, BUILTIN_THEMES } from '../../../src/core/theme';

describe('VisualTheme System', () => {
  it('provides all 3 standard production themes', () => {
    expect(BUILTIN_THEMES.tv_game_show).toBeDefined();
    expect(BUILTIN_THEMES.clean_shopping).toBeDefined();
    expect(BUILTIN_THEMES.cyber_arcade).toBeDefined();
  });

  it('retrieves valid theme tokens with color and geometry contracts', () => {
    const tv = getTheme('tv_game_show');
    expect(tv.name).toContain('Gameshow');
    expect(tv.colors.accent).toBe('#fbbf24');
    expect(tv.geometry.cardBorderRadius).toBe(24);

    const arcade = getTheme('cyber_arcade');
    expect(arcade.geometry.cardBorderRadius).toBe(0);
    expect(arcade.geometry.glowIntensity).toBeGreaterThan(0);
  });

  it('throws error for unknown theme', () => {
    expect(() => getTheme('unknown_theme' as any)).toThrow(/Unknown theme/);
  });
});
