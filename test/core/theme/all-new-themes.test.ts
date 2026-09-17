import { describe, it, expect } from 'vitest';
import { getTheme, resolveTheme, BUILTIN_THEMES } from '../../../src/core/theme';
import type { VisualThemeId } from '../../../src/core/theme';

describe('All 5 New Production Themes for Vietnamese TV Gameshows', () => {
  const newThemeIds: VisualThemeId[] = [
    'hay_chon_gia_dung',
    'sieu_thi_gia_dinh',
    'bep_am_noi_tro',
    'gio_vang_san_deal',
    'tap_hoa_vui_ve',
  ];

  it('registers all 5 new themes in BUILTIN_THEMES', () => {
    for (const id of newThemeIds) {
      expect(BUILTIN_THEMES[id], `Theme ${id} must be defined`).toBeDefined();
      expect(BUILTIN_THEMES[id].id).toBe(id);
    }
  });

  it('guarantees clean white product cards (#ffffff) for high contrast', () => {
    for (const id of newThemeIds) {
      const theme = getTheme(id);
      expect(theme.colors.cardBackground.toLowerCase()).toBe('#ffffff');
      // Dark text on white card for readability
      expect(theme.colors.textPrimary).toMatch(/^#(0f172a|1c1917)$/);
    }
  });

  it('provides distinct gradients and geometry for each theme', () => {
    const hayChon = getTheme('hay_chon_gia_dung');
    expect(hayChon.name).toContain('Hãy Chọn Giá Đúng');
    expect(hayChon.colors.backgroundGradient[0]).toBe('#1e3a8a');
    expect(hayChon.geometry.cardBorderRadius).toBe(28);

    const sieuThi = getTheme('sieu_thi_gia_dinh');
    expect(sieuThi.name).toContain('Siêu Thị');
    expect(sieuThi.colors.backgroundGradient[0]).toBe('#15803d');
    expect(sieuThi.geometry.cardBorderRadius).toBe(24);

    const bepAm = getTheme('bep_am_noi_tro');
    expect(bepAm.name).toContain('Bếp Ấm');
    expect(bepAm.colors.backgroundGradient[0]).toBe('#fff7ed');
    expect(bepAm.geometry.cardBorderRadius).toBe(32);

    const gioVang = getTheme('gio_vang_san_deal');
    expect(gioVang.name).toContain('Giờ Vàng');
    expect(gioVang.colors.backgroundGradient[0]).toBe('#dc2626');

    const tapHoa = getTheme('tap_hoa_vui_ve');
    expect(tapHoa.name).toContain('Tạp Hóa');
    expect(tapHoa.colors.backgroundGradient[0]).toBe('#fef08a');
  });

  it('resolves theme gracefully via resolveTheme', () => {
    // Exact ID string
    expect(resolveTheme('sieu_thi_gia_dinh').id).toBe('sieu_thi_gia_dinh');
    // Object theme
    const custom = getTheme('bep_am_noi_tro');
    expect(resolveTheme(custom).id).toBe('bep_am_noi_tro');
    // Default fallback
    expect(resolveTheme(undefined).id).toBe('hay_chon_gia_dung');
    expect(resolveTheme('non_existent' as any).id).toBe('hay_chon_gia_dung');
  });
});
