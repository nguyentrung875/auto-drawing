import type { VisualTheme, VisualThemeId } from './types';

export const BUILTIN_THEMES: Record<string, VisualTheme> = {
  tv_game_show: {
    id: 'tv_game_show',
    name: 'Truyền Hình Gameshow',
    colors: {
      backgroundGradient: ['#0f172a', '#1e1b4b'],
      stageOverlay: 'spotlight',
      cardBackground: '#1e293b',
      cardBorder: 'rgba(251, 191, 36, 0.4)',
      cardShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
      accent: '#fbbf24',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      countdownRing: '#eab308',
      revealBannerSuccess: '#22c55e',
      revealBannerWarning: '#ef4444',
    },
    typography: {
      fontFamilyHeadline: 'Be Vietnam Pro',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'Montserrat',
      textTransformHeadline: 'uppercase',
    },
    geometry: {
      cardBorderRadius: 24,
      cardBorderWidth: 3,
      glowIntensity: 8,
    },
    assets: {
      bgmTrack: 'audio/bgm/gameshow_suspense.mp3',
      correctSfx: 'audio/sfx/win_chime.wav',
      wrongSfx: 'audio/sfx/buzzer_wrong.wav',
      countdownSfx: 'audio/sfx/ticking_tension.wav',
    },
  },
  clean_shopping: {
    id: 'clean_shopping',
    name: 'Sàn TMĐT Tối Giản',
    colors: {
      backgroundGradient: ['#18181b', '#27272a'],
      stageOverlay: 'none',
      cardBackground: '#27272a',
      cardBorder: 'rgba(244, 244, 245, 0.15)',
      cardShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      accent: '#f97316',
      textPrimary: '#ffffff',
      textSecondary: '#a1a1aa',
      countdownRing: '#f97316',
      revealBannerSuccess: '#10b981',
      revealBannerWarning: '#f43f5e',
    },
    typography: {
      fontFamilyHeadline: 'Inter',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'Inter',
      textTransformHeadline: 'none',
    },
    geometry: {
      cardBorderRadius: 16,
      cardBorderWidth: 1.5,
      glowIntensity: 0,
    },
    assets: {
      bgmTrack: 'audio/bgm/shopping_upbeat.mp3',
      correctSfx: 'audio/sfx/cash_register.wav',
      wrongSfx: 'audio/sfx/buzzer_soft.wav',
      countdownSfx: 'audio/sfx/countdown_pop.wav',
    },
  },
  cyber_arcade: {
    id: 'cyber_arcade',
    name: 'Cyber Arcade Neon',
    colors: {
      backgroundGradient: ['#09090b', '#180828'],
      stageOverlay: 'grid',
      cardBackground: '#120e24',
      cardBorder: '#06b6d4',
      cardShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
      accent: '#06b6d4',
      textPrimary: '#f0fdf4',
      textSecondary: '#a78bfa',
      countdownRing: '#f43f5e',
      revealBannerSuccess: '#06b6d4',
      revealBannerWarning: '#f43f5e',
    },
    typography: {
      fontFamilyHeadline: 'Press Start 2P',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'VT323',
      textTransformHeadline: 'uppercase',
    },
    geometry: {
      cardBorderRadius: 0,
      cardBorderWidth: 4,
      glowIntensity: 20,
    },
    assets: {
      bgmTrack: 'audio/bgm/arcade_synth.mp3',
      correctSfx: 'audio/sfx/retro_coin.wav',
      wrongSfx: 'audio/sfx/retro_explosion.wav',
      countdownSfx: 'audio/sfx/retro_beep.wav',
    },
  },
};

export function getTheme(id: VisualThemeId): VisualTheme {
  const theme = BUILTIN_THEMES[id];
  if (!theme) throw new Error(`Unknown theme id: "${id}"`);
  return theme;
}
