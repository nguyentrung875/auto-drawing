export type VisualThemeId = 'tv_game_show' | 'clean_shopping' | 'cyber_arcade' | 'street_quiz';

export interface ThemeColors {
  backgroundGradient: [string, string];
  stageOverlay?: 'grid' | 'spotlight' | 'scanline' | 'none';
  cardBackground: string;
  cardBorder: string;
  cardShadow: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  countdownRing: string;
  revealBannerSuccess: string;
  revealBannerWarning: string;
}

export interface ThemeTypography {
  fontFamilyHeadline: string;
  fontFamilyBody: string;
  fontFamilyPrice: string;
  textTransformHeadline: 'uppercase' | 'none';
}

export interface ThemeGeometry {
  cardBorderRadius: number;
  cardBorderWidth: number;
  glowIntensity: number;
}

export interface VisualTheme {
  id: VisualThemeId;
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  geometry: ThemeGeometry;
  assets: {
    bgmTrack: string;
    correctSfx: string;
    wrongSfx: string;
    countdownSfx: string;
  };
}
