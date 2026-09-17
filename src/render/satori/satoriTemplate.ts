/**
 * Satori Virtual DOM Generator for Universal AI Game Video Engine.
 *
 * Produces clean, highly-optimized virtual DOM elements for Satori that render
 * deterministically across all 7 game mechanics at 1080×1920@30fps.
 *
 * Designed specifically without heavy SVG filters (feGaussianBlur/box-shadow/radial-gradient)
 * to guarantee blazingly fast ~20-50ms rasterization via @resvg/resvg-js.
 */
import type { RenderCardView, RenderGameView, RenderInput } from '../types';
import type { VisualTheme } from '../../core/theme/types';
import { resolveTheme } from '../../core/theme/themes';

export interface SatoriElement {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: SatoriElement[] | string | number | (SatoriElement | string | number | null | undefined)[] | null;
    src?: string;
    [key: string]: unknown;
  };
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface SatoriRenderContext {
  input: RenderInput;
  timeSec: number;
  productImages: Map<string, string | null>;
}

function isColorLight(hex: string): boolean {
  if (!hex) return false;
  const clean = hex.replace('#', '');
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    return false;
  }
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export interface SatoriThemeStyles {
  theme: VisualTheme;
  isLightStage: boolean;
  isLightCard: boolean;
  stageTextColor: string;
  cardBg: string;
  cardBorder: string;
  cardBorderRadius: string;
  cardBorderWidth: string;
  cardTextColor: string;
  priceColor: string;
}

export function computeThemeStyles(theme: VisualTheme): SatoriThemeStyles {
  const isLightStage = theme.id === 'bep_am_noi_tro' || theme.id === 'tap_hoa_vui_ve';
  const isLightCard = isColorLight(theme.colors.cardBackground);
  const cardBorderRadius = `${theme.geometry.cardBorderRadius ?? 28}px`;
  const cardBorderWidth = `${theme.geometry.cardBorderWidth ?? 3}px`;

  let priceColor = theme.colors.accent;
  if (isLightCard) {
    if (theme.id === 'sieu_thi_gia_dinh' || theme.id === 'gio_vang_san_deal') {
      priceColor = '#dc2626';
    } else if (theme.id === 'hay_chon_gia_dung') {
      priceColor = '#b45309';
    } else if (theme.id === 'bep_am_noi_tro') {
      priceColor = '#ea580c';
    } else if (theme.id === 'tap_hoa_vui_ve') {
      priceColor = '#0f766e';
    } else {
      priceColor = isColorLight(theme.colors.accent) ? '#dc2626' : theme.colors.accent;
    }
  }

  return {
    theme,
    isLightStage,
    isLightCard,
    stageTextColor: isLightStage ? '#1c1917' : '#ffffff',
    cardBg: theme.colors.cardBackground,
    cardBorder: theme.colors.cardBorder,
    cardBorderRadius,
    cardBorderWidth,
    cardTextColor: theme.colors.textPrimary,
    priceColor,
  };
}

export function buildSatoriVirtualDom(context: SatoriRenderContext): SatoriElement {
  const { input, timeSec, productImages } = context;
  const { game, sceneData, timeline } = input;
  const mechanic = game.metadata.mechanic;

  // Resolve visual theme
  const rawTheme = input.theme ?? (game.metadata as { theme?: string })?.theme ?? 'hay_chon_gia_dung';
  const theme = resolveTheme(rawTheme);
  const styles = computeThemeStyles(theme);

  const [bgTop, bgBottom] = theme.colors.backgroundGradient;

  const revealSlot = timeline?.slots?.find((s) => s.type === 'reveal');
  const revealAt = input.audio?.revealAt ?? revealSlot?.start ?? 11.0;
  const isReveal = timeSec >= revealAt;
  const isCountdown = timeSec >= 8.0 && timeSec < revealAt;
  const countdownRemaining = isCountdown ? Math.max(0, revealAt - timeSec) : (isReveal ? 0 : 3.0);
  const countdownFormatted = countdownRemaining.toFixed(1);

  // SVG circle circumference for r=65 is 2 * PI * 65 ≈ 408
  const circ = 408;
  const countdownProgress = Math.min(1, Math.max(0, (revealAt - timeSec) / 3.0));
  const strokeDashoffset = Math.round(circ * (1 - countdownProgress));

  const resolvedProducts = (input.products && input.products.length > 0)
    ? input.products
    : (game.entities ?? []).map((e) => ({
        productId: e.productId,
        name: e.name ?? '',
        price: e.price ?? 0,
        image: e.image ?? `assets/${e.productId}.png`,
        brand: e.brand,
      }));

  const cards = (sceneData?.cards ?? []) as RenderCardView[];

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '1080px',
        height: '1920px',
        position: 'relative',
        backgroundColor: bgTop,
        backgroundImage: `linear-gradient(to bottom, ${bgTop}, ${bgBottom})`,
        color: styles.stageTextColor,
        fontFamily: theme.typography?.fontFamilyHeadline ?? 'Segoe UI',
        padding: '60px 40px 80px 40px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      },
      children: [
        // --- 1. STAGE LIGHTING OVERLAY (SVG) ---
        renderStageLighting(theme, styles),

        // --- 2. TOP GAMESHOW PLAQUE & BADGE ---
        renderTopHeader(game, mechanic, styles),

        // --- 3. QUESTION BANNER BOX ---
        renderQuestion(game, mechanic, isReveal, styles),

        // --- 4. PRODUCT CARDS AREA ---
        renderCardsArea(mechanic, resolvedProducts, cards, productImages, isReveal, input, styles),

        // --- 5. COUNTDOWN & REVEAL STATUS ---
        renderCenterStatus(isCountdown, isReveal, countdownFormatted, strokeDashoffset, circ, game, styles),

        // --- 6. ACTION BUTTONS ---
        mechanic === 'ONE_AWAY'
          ? renderOneAwayStatus(isReveal, input.game.gameplay.answer, styles)
          : renderActionButtons(game, isReveal, styles),
      ],
    },
  };
}

function renderStageLighting(theme: VisualTheme, styles: SatoriThemeStyles): SatoriElement {
  let spotBeamColor = '#93c5fd';
  let spotMidColor = '#60a5fa';
  let spotEndColor = '#1e3a8a';
  let centerGlow = '#60a5fa';
  let bulbColor = '#fde047';

  if (theme.id === 'sieu_thi_gia_dinh') {
    spotBeamColor = '#86efac';
    spotMidColor = '#22c55e';
    spotEndColor = '#15803d';
    centerGlow = '#4ade80';
    bulbColor = '#facc15';
  } else if (theme.id === 'bep_am_noi_tro') {
    spotBeamColor = '#fed7aa';
    spotMidColor = '#fdba74';
    spotEndColor = '#ea580c';
    centerGlow = '#fb923c';
    bulbColor = '#ea580c';
  } else if (theme.id === 'gio_vang_san_deal') {
    spotBeamColor = '#fca5a5';
    spotMidColor = '#f87171';
    spotEndColor = '#dc2626';
    centerGlow = '#f97316';
    bulbColor = '#fde047';
  } else if (theme.id === 'tap_hoa_vui_ve') {
    spotBeamColor = '#fef08a';
    spotMidColor = '#facc15';
    spotEndColor = '#0f766e';
    centerGlow = '#fde047';
    bulbColor = '#0f766e';
  }

  const isLight = styles.isLightStage;
  const beamOpacity = isLight ? '0.35' : '0.55';
  const midOpacity = isLight ? '0.15' : '0.25';
  const centerGlowOpacity = isLight ? '0.2' : '0.35';

  return {
    type: 'svg',
    props: {
      width: '1080',
      height: '1920',
      viewBox: '0 0 1080 1920',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
      },
      children: [
        {
          type: 'defs',
          props: {
            children: [
              {
                type: 'linearGradient',
                props: {
                  id: 'satori_left_spot',
                  x1: '0',
                  y1: '0',
                  x2: '0.65',
                  y2: '1',
                  children: [
                    { type: 'stop', props: { offset: '0%', stopColor: spotBeamColor, stopOpacity: beamOpacity } },
                    { type: 'stop', props: { offset: '35%', stopColor: spotMidColor, stopOpacity: midOpacity } },
                    { type: 'stop', props: { offset: '100%', stopColor: spotEndColor, stopOpacity: '0' } },
                  ],
                },
              },
              {
                type: 'linearGradient',
                props: {
                  id: 'satori_right_spot',
                  x1: '1',
                  y1: '0',
                  x2: '0.35',
                  y2: '1',
                  children: [
                    { type: 'stop', props: { offset: '0%', stopColor: spotBeamColor, stopOpacity: beamOpacity } },
                    { type: 'stop', props: { offset: '35%', stopColor: spotMidColor, stopOpacity: midOpacity } },
                    { type: 'stop', props: { offset: '100%', stopColor: spotEndColor, stopOpacity: '0' } },
                  ],
                },
              },
              {
                type: 'radialGradient',
                props: {
                  id: 'satori_center_glow',
                  cx: '50%',
                  cy: '45%',
                  r: '50%',
                  children: [
                    { type: 'stop', props: { offset: '0%', stopColor: centerGlow, stopOpacity: centerGlowOpacity } },
                    { type: 'stop', props: { offset: '60%', stopColor: spotMidColor, stopOpacity: '0.1' } },
                    { type: 'stop', props: { offset: '100%', stopColor: spotEndColor, stopOpacity: '0' } },
                  ],
                },
              },
            ],
          },
        },
        // Central ambient stage glow
        {
          type: 'ellipse',
          props: {
            cx: '540',
            cy: '900',
            rx: '620',
            ry: '680',
            fill: 'url(#satori_center_glow)',
          },
        },
        // Left spotlight beam
        {
          type: 'polygon',
          props: {
            points: '0,0 520,1920 180,1920 0,680',
            fill: 'url(#satori_left_spot)',
          },
        },
        // Right spotlight beam
        {
          type: 'polygon',
          props: {
            points: '1080,0 900,1920 560,1920 1080,680',
            fill: 'url(#satori_right_spot)',
          },
        },
        // Top-left floodlights cluster
        { type: 'circle', props: { cx: '70', cy: '45', r: '14', fill: bulbColor, opacity: '0.95' } },
        { type: 'circle', props: { cx: '110', cy: '45', r: '14', fill: '#ffffff', opacity: '0.95' } },
        { type: 'circle', props: { cx: '150', cy: '45', r: '14', fill: bulbColor, opacity: '0.95' } },
        { type: 'circle', props: { cx: '90', cy: '80', r: '14', fill: '#ffffff', opacity: '0.95' } },
        { type: 'circle', props: { cx: '130', cy: '80', r: '14', fill: bulbColor, opacity: '0.95' } },
        // Top-right floodlights cluster
        { type: 'circle', props: { cx: '1010', cy: '45', r: '14', fill: bulbColor, opacity: '0.95' } },
        { type: 'circle', props: { cx: '970', cy: '45', r: '14', fill: '#ffffff', opacity: '0.95' } },
        { type: 'circle', props: { cx: '930', cy: '45', r: '14', fill: bulbColor, opacity: '0.95' } },
        { type: 'circle', props: { cx: '990', cy: '80', r: '14', fill: '#ffffff', opacity: '0.95' } },
        { type: 'circle', props: { cx: '950', cy: '80', r: '14', fill: bulbColor, opacity: '0.95' } },
      ],
    },
  };
}

function renderTopHeader(game: RenderGameView, mechanic: string, styles: SatoriThemeStyles): SatoriElement {
  const { theme, isLightStage } = styles;
  const plaqueBorder = theme.colors.cardBorder ?? '#facc15';
  const plaqueBgTop = isLightStage ? '#ffffff' : (theme.colors.backgroundGradient[0] ?? '#1e3a8a');
  const plaqueBgBottom = isLightStage ? '#f1f5f9' : '#0f172a';
  const starColor = isLightStage ? '#ea580c' : '#fde047';
  const titleColor = isLightStage ? '#0f172a' : '#fde047';
  const subColor = isLightStage ? '#475569' : '#ffffff';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: plaqueBgTop,
        backgroundImage: `linear-gradient(180deg, ${plaqueBgTop} 0%, ${plaqueBgBottom} 100%)`,
        border: `4px solid ${plaqueBorder}`,
        borderRadius: '24px',
        padding: '10px 52px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            },
            children: [
              {
                type: 'svg',
                props: {
                  width: '26',
                  height: '26',
                  viewBox: '0 0 24 24',
                  children: [
                    {
                      type: 'polygon',
                      props: {
                        points: '12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9',
                        fill: starColor,
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '28px',
                    fontWeight: '900',
                    color: titleColor,
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  },
                  children: `5 GIÂY ĐOÁN GIÁ · TẬP #${game.metadata.seed ? (game.metadata.seed % 99 + 1) : 1}`,
                },
              },
              {
                type: 'svg',
                props: {
                  width: '26',
                  height: '26',
                  viewBox: '0 0 24 24',
                  children: [
                    {
                      type: 'polygon',
                      props: {
                        points: '12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9',
                        fill: starColor,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '18px',
              fontWeight: '700',
              color: subColor,
              letterSpacing: '1px',
              marginTop: '2px',
              opacity: 0.9,
              textTransform: 'uppercase',
            },
            children: `${theme.name} · ${mechanic.replace(/_/g, ' ')}`,
          },
        },
      ],
    },
  };
}

function renderQuestion(
  game: RenderGameView,
  mechanic: string,
  isReveal: boolean,
  styles: SatoriThemeStyles,
): SatoriElement {
  const questionText = game.content.question ?? 'Sản phẩm nào ĐẮT NHẤT?';
  const { theme, isLightStage } = styles;
  const bannerBorder = theme.colors.cardBorder ?? '#fbbf24';
  const bannerBgTop = isLightStage ? '#ffffff' : (theme.colors.backgroundGradient[1] ?? '#1d4ed8');
  const bannerBgBottom = isLightStage ? '#f8fafc' : '#0f172a';
  const questionColor = isLightStage ? '#0f172a' : '#ffffff';
  const revealColor = theme.colors.revealBannerSuccess ?? '#16a34a';

  return {
    type: 'div',
    props: {
      style: {
        width: '980px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bannerBgTop,
        backgroundImage: `linear-gradient(180deg, ${bannerBgTop} 0%, ${bannerBgBottom} 100%)`,
        border: `5px solid ${bannerBorder}`,
        borderRadius: '26px',
        padding: '18px 24px',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
        margin: '10px 0',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: '44px',
              fontWeight: '900',
              color: questionColor,
              textAlign: 'center',
              lineHeight: '1.25',
              textTransform: 'uppercase',
            },
            children: questionText,
          },
        },
        isReveal
          ? {
              type: 'div',
              props: {
                style: {
                  fontSize: '32px',
                  fontWeight: '900',
                  color: revealColor,
                  marginTop: '10px',
                  letterSpacing: '1px',
                },
                children: '★ ĐÁP ÁN CHÍNH XÁC ĐÃ LỘ DIỆN! ★',
              },
            }
          : null,
      ],
    },
  };
}

function renderCardsArea(
  mechanic: string,
  products: Array<{ productId: string; name: string; price: number; image?: string }>,
  cards: RenderCardView[],
  productImages: Map<string, string | null>,
  isReveal: boolean,
  input: RenderInput,
  styles: SatoriThemeStyles,
): SatoriElement {
  if (mechanic === 'HI_LO') {
    return renderHiLoCards(products, cards, productImages, isReveal, styles);
  }
  if (mechanic === 'ONE_AWAY') {
    return renderOneAwayCard(products[0], input, productImages, isReveal, styles);
  }
  if (mechanic === 'MOST_EXPENSIVE' || mechanic === 'ODD_ONE_OUT') {
    if (products.length >= 4) {
      return renderGridCards(products, cards, productImages, isReveal, input, styles);
    }
    return renderStackedCards(products, cards, productImages, isReveal, input, styles);
  }
  if (mechanic === 'GROCERY_BASKET') {
    return renderGroceryBasketCards(products, productImages, isReveal, input, styles);
  }
  if (mechanic === 'DEAL_OR_SCAM') {
    return renderDealOrScamCard(products[0], productImages, isReveal, input, styles);
  }
  if (mechanic === 'GUESS_THE_PRICE') {
    return renderGuessThePriceCard(products[0], productImages, isReveal, input, styles);
  }

  // Default fallback
  return renderStackedCards(products, cards, productImages, isReveal, input, styles);
}

function renderHiLoCards(
  products: Array<{ productId: string; name: string; price: number; image?: string }>,
  cards: RenderCardView[],
  productImages: Map<string, string | null>,
  isReveal: boolean,
  styles: SatoriThemeStyles,
): SatoriElement {
  const pA = products[0] ?? { productId: 'p001', name: 'Sản phẩm A', price: 100000 };
  const pB = products[1] ?? { productId: 'p002', name: 'Sản phẩm B', price: 200000 };
  const imgA = productImages.get(pA.productId) ?? null;
  const imgB = productImages.get(pB.productId) ?? null;

  const defaultBorder = styles.cardBorder;
  const winnerBorder = styles.theme.colors.revealBannerSuccess ?? '#16a34a';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '980px',
        alignItems: 'center',
      },
      children: [
        // Card A (Price always visible)
        renderSingleCardRow(
          'SẢN PHẨM [A]',
          pA.name,
          formatVnd(pA.price),
          imgA,
          styles.priceColor,
          defaultBorder,
          false,
          isReveal,
          styles,
        ),
        // Card B (Secret until reveal)
        renderSingleCardRow(
          'SẢN PHẨM [B]',
          pB.name,
          isReveal ? formatVnd(pB.price) : '? GIÁ BÍ MẬT ?',
          imgB,
          isReveal
            ? (pB.price > pA.price ? '#16a34a' : '#dc2626')
            : (styles.isLightCard ? '#2563eb' : '#38bdf8'),
          isReveal ? winnerBorder : (styles.theme.id === 'hay_chon_gia_dung' ? '#3b82f6' : defaultBorder),
          true,
          isReveal,
          styles,
        ),
      ],
    },
  };
}

function renderSingleCardRow(
  badge: string,
  name: string,
  priceStr: string,
  imgBase64: string | null,
  accentColor: string,
  borderColor: string,
  isSecret: boolean,
  isReveal: boolean,
  styles: SatoriThemeStyles,
): SatoriElement {
  const { isLightCard, cardBg, cardBorderRadius, cardTextColor } = styles;
  const isCardA = badge.includes('[A]');
  const isCardB = badge.includes('[B]');
  
  let tagBg = isCardA ? '#f59e0b' : (isReveal ? '#16a34a' : '#2563eb');
  let tagText = isCardA ? 'MÓN A · MỐC SO SÁNH' : (isReveal ? 'MÓN B · KẾT QUẢ' : 'MÓN B · CẦN ĐOÁN');
  if (!isCardA && !isCardB) {
    tagBg = '#0f766e';
    tagText = badge;
  }

  const priceBadgeBg = isSecret && !isReveal ? '#dbeafe' : (isCardA ? '#fef3c7' : '#dcfce7');
  const priceBadgeBorder = isSecret && !isReveal ? '#3b82f6' : (isCardA ? '#f59e0b' : '#16a34a');
  const priceBadgeColor = isSecret && !isReveal ? '#1d4ed8' : (isCardA ? '#b45309' : '#15803d');

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        width: '960px',
        height: '275px',
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: `5px solid ${borderColor}`,
        padding: '20px 30px',
        boxSizing: 'border-box',
        boxShadow: '0 16px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
      },
      children: [
        imgBase64
          ? {
              type: 'img',
              props: {
                src: imgBase64,
                style: {
                  width: '210px',
                  height: '210px',
                  borderRadius: '20px',
                  backgroundColor: isLightCard ? '#f8fafc' : '#0f172a',
                  objectFit: 'contain',
                },
              },
            }
          : {
              type: 'div',
              props: {
                style: {
                  width: '210px',
                  height: '210px',
                  borderRadius: '20px',
                  backgroundColor: isLightCard ? '#e2e8f0' : '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '22px',
                  fontWeight: 'bold',
                },
                children: 'ẢNH SẢN PHẨM',
              },
            },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              marginLeft: '32px',
              flex: 1,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          padding: '6px 18px',
                          borderRadius: '10px',
                          backgroundColor: tagBg,
                          color: '#ffffff',
                          fontSize: '20px',
                          fontWeight: '900',
                          letterSpacing: '1px',
                        },
                        children: tagText,
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '36px',
                    fontWeight: '900',
                    color: cardTextColor,
                    margin: '8px 0',
                  },
                  children: name,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          padding: '6px 22px',
                          borderRadius: '12px',
                          backgroundColor: priceBadgeBg,
                          border: `2px solid ${priceBadgeBorder}`,
                          fontSize: isSecret && !isReveal ? '38px' : '44px',
                          fontWeight: '900',
                          color: priceBadgeColor,
                        },
                        children: priceStr,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function renderOneAwayCard(
  product: { productId: string; name: string; price: number; image?: string } | undefined,
  input: RenderInput,
  productImages: Map<string, string | null>,
  isReveal: boolean,
  styles: SatoriThemeStyles,
): SatoriElement {
  const p = product ?? { productId: 'p001', name: 'Sản phẩm', price: 189000 };
  const img = productImages.get(p.productId) ?? null;
  const maskedPrice = input.sceneData?.maskedPrice ?? '1?9.000₫';
  const fullPrice = formatVnd(p.price);

  const { cardBg, cardBorder, cardBorderRadius, cardTextColor, isLightCard } = styles;
  const priceColor = isReveal
    ? (styles.theme.colors.revealBannerSuccess ?? '#16a34a')
    : styles.priceColor;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '900px',
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: `3px solid ${cardBorder}`,
        padding: '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: {
                  width: '380px',
                  height: '380px',
                  borderRadius: '24px',
                  backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                  objectFit: 'contain',
                },
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: {
              fontSize: '46px',
              fontWeight: 'bold',
              color: cardTextColor,
              margin: '20px 0 10px 0',
              textAlign: 'center',
            },
            children: p.name,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '64px',
              fontWeight: 'bold',
              color: priceColor,
              letterSpacing: '3px',
            },
            children: isReveal ? fullPrice : maskedPrice,
          },
        },
        // 2-row Digit Grid placed directly below masked price
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '20px',
              width: '100%',
              alignItems: 'center',
            },
            children: [
              renderDigitRow(['0', '1', '2', '3', '4'], String(input.game.gameplay.answer ?? ''), isReveal, styles),
              renderDigitRow(['5', '6', '7', '8', '9'], String(input.game.gameplay.answer ?? ''), isReveal, styles),
            ],
          },
        },
      ],
    },
  };
}

function renderDigitRow(
  digits: string[],
  winningDigit: string,
  isReveal: boolean,
  styles: SatoriThemeStyles,
): SatoriElement {
  const { isLightCard } = styles;
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'center',
        gap: '14px',
      },
      children: digits.map((d) => {
        const isWinner = isReveal && d === winningDigit;
        const defaultBg = isLightCard ? '#f1f5f9' : 'rgba(51, 65, 85, 0.8)';
        const defaultBorder = isLightCard ? '2px solid #cbd5e1' : '2px solid rgba(148, 163, 184, 0.3)';
        const defaultColor = isLightCard ? '#0f172a' : '#f1f5f9';

        const winnerBg = '#16a34a';
        const winnerBorder = '3px solid #22c55e';
        const winnerColor = '#ffffff';

        return {
          type: 'div',
          props: {
            style: {
              width: '85px',
              height: '70px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              backgroundColor: isWinner ? winnerBg : defaultBg,
              border: isWinner ? winnerBorder : defaultBorder,
              color: isWinner ? winnerColor : defaultColor,
              fontSize: '38px',
              fontWeight: 'bold',
            },
            children: d,
          },
        };
      }),
    },
  };
}

function renderOneAwayStatus(isReveal: boolean, answer: unknown, styles: SatoriThemeStyles): SatoriElement {
  const winnerColor = styles.theme.colors.revealBannerSuccess ?? '#16a34a';
  const neutralColor = styles.isLightStage ? '#475569' : '#94a3b8';
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '940px',
        height: '90px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: '36px',
              fontWeight: 'bold',
              color: isReveal ? winnerColor : neutralColor,
              letterSpacing: '1px',
            },
            children: isReveal
              ? `🎉 CHỮ SỐ CHÍNH XÁC: ${String(answer)}!`
              : 'CHỌN 1 CHỮ SỐ TỪ 0 ĐẾN 9',
          },
        },
      ],
    },
  };
}

function renderStackedCards(
  products: Array<{ productId: string; name: string; price: number; image?: string }>,
  cards: RenderCardView[],
  productImages: Map<string, string | null>,
  isReveal: boolean,
  input: RenderInput,
  styles: SatoriThemeStyles,
): SatoriElement {
  const winningAnswer = input.game.gameplay.answer;
  const labels = ['A', 'B', 'C'];

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '1000px',
        alignItems: 'center',
      },
      children: products.slice(0, 3).map((p, idx) => {
        const isWinner = isReveal && (p.productId === winningAnswer);
        const img = productImages.get(p.productId) ?? null;
        const priceDisplay = isReveal ? formatVnd(p.price) : '???';
        const winnerBorder = styles.theme.colors.revealBannerSuccess ?? '#16a34a';

        return renderSingleCardRow(
          `MÓN [${labels[idx]}]`,
          p.name,
          priceDisplay,
          img,
          isWinner ? '#16a34a' : styles.priceColor,
          isWinner ? winnerBorder : styles.cardBorder,
          false,
          isReveal,
          styles,
        );
      }),
    },
  };
}

function renderGridCards(
  products: Array<{ productId: string; name: string; price: number; image?: string }>,
  cards: RenderCardView[],
  productImages: Map<string, string | null>,
  isReveal: boolean,
  input: RenderInput,
  styles: SatoriThemeStyles,
): SatoriElement {
  const winningAnswer = input.game.gameplay.answer;
  const labels = ['A', 'B', 'C', 'D'];
  const { isLightCard, cardBg, cardBorder, cardTextColor, priceColor } = styles;
  const winnerBorder = styles.theme.colors.revealBannerSuccess ?? '#16a34a';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        width: '960px',
        justifyContent: 'center',
      },
      children: products.slice(0, 4).map((p, idx) => {
        const isWinner = isReveal && (p.productId === winningAnswer);
        const img = productImages.get(p.productId) ?? null;
        const currentBg = isWinner
          ? (isLightCard ? '#f0fdf4' : 'rgba(16, 185, 129, 0.2)')
          : cardBg;
        const currentBorder = isWinner
          ? `3px solid ${winnerBorder}`
          : `2px solid ${cardBorder}`;

        return {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '450px',
              height: '280px',
              backgroundColor: currentBg,
              border: currentBorder,
              borderRadius: '24px',
              padding: '16px',
              boxSizing: 'border-box',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    alignItems: 'center',
                    marginBottom: '8px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '22px',
                          fontWeight: 'bold',
                          color: isWinner ? '#16a34a' : (isLightCard ? '#2563eb' : '#38bdf8'),
                        },
                        children: `[${labels[idx]}]`,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '28px',
                          fontWeight: 'bold',
                          color: isWinner ? '#16a34a' : priceColor,
                        },
                        children: isReveal ? formatVnd(p.price) : '???',
                      },
                    },
                  ],
                },
              },
              img
                ? {
                    type: 'img',
                    props: {
                      src: img,
                      style: {
                        width: '150px',
                        height: '150px',
                        borderRadius: '16px',
                        backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                        objectFit: 'contain',
                      },
                    },
                  }
                : null,
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '26px',
                    fontWeight: 'bold',
                    color: cardTextColor,
                    marginTop: '8px',
                    textAlign: 'center',
                  },
                  children: p.name.length > 20 ? `${p.name.slice(0, 18)}...` : p.name,
                },
              },
            ],
          },
        };
      }),
    },
  };
}

function renderGroceryBasketCards(
  products: Array<{ productId: string; name: string; price: number; image?: string }>,
  productImages: Map<string, string | null>,
  isReveal: boolean,
  input: RenderInput,
  styles: SatoriThemeStyles,
): SatoriElement {
  const budget = input.game.gameplay.budget ?? 300000;
  const total = products.reduce((acc, p) => acc + p.price, 0);
  const { isLightStage } = styles;

  const budgetBg = isLightStage ? '#fef3c7' : 'rgba(234, 179, 8, 0.15)';
  const budgetBorder = isLightStage ? '#d97706' : '#eab308';
  const budgetColor = isLightStage ? '#92400e' : '#fde047';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        width: '1000px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              padding: '12px 36px',
              borderRadius: '9999px',
              backgroundColor: budgetBg,
              border: `2px solid ${budgetBorder}`,
              color: budgetColor,
              fontSize: '32px',
              fontWeight: 'bold',
            },
            children: `NGÂN SÁCH ĐI CHỢ: ${formatVnd(budget)}`,
          },
        },
        ...products.slice(0, 3).map((p, idx) => {
          const img = productImages.get(p.productId) ?? null;
          return renderSingleCardRow(
            `MÓN #${idx + 1}`,
            p.name,
            isReveal ? formatVnd(p.price) : '???',
            img,
            styles.priceColor,
            styles.cardBorder,
            false,
            isReveal,
            styles,
          );
        }),
        isReveal
          ? {
              type: 'div',
              props: {
                style: {
                  fontSize: '38px',
                  fontWeight: 'bold',
                  color: total <= budget ? '#16a34a' : '#dc2626',
                  marginTop: '10px',
                  textShadow: isLightStage ? 'none' : '0 2px 8px rgba(0,0,0,0.5)',
                },
                children: `TỔNG CỘNG: ${formatVnd(total)} (${total <= budget ? 'ĐỦ TIỀN' : 'CHÁY TÚI'})`,
              },
            }
          : null,
      ],
    },
  };
}

function renderDealOrScamCard(
  product: { productId: string; name: string; price: number; image?: string } | undefined,
  productImages: Map<string, string | null>,
  isReveal: boolean,
  input: RenderInput,
  styles: SatoriThemeStyles,
): SatoriElement {
  const p = product ?? { productId: 'p001', name: 'Sản phẩm Deal', price: 99000 };
  const img = productImages.get(p.productId) ?? null;
  const isDeal = input.game.gameplay.answer === 'deal';
  const { cardBg, cardBorderRadius, cardTextColor, isLightCard } = styles;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '900px',
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: '3px solid #dc2626',
        padding: '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: {
                  width: '380px',
                  height: '380px',
                  borderRadius: '24px',
                  backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                  objectFit: 'contain',
                },
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: {
              fontSize: '46px',
              fontWeight: 'bold',
              color: cardTextColor,
              margin: '20px 0 10px 0',
              textAlign: 'center',
            },
            children: p.name,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#dc2626',
            },
            children: `SALE SỐC: ${formatVnd(p.price)}`,
          },
        },
        isReveal
          ? {
              type: 'div',
              props: {
                style: {
                  fontSize: '44px',
                  fontWeight: 'bold',
                  color: isDeal ? '#16a34a' : '#dc2626',
                  marginTop: '16px',
                },
                children: isDeal ? 'ĐÁP ÁN: KÈO THƠM MÚC NGAY!' : 'ĐÁP ÁN: BẪY SALE ẢO / SCAM!',
              },
            }
          : null,
      ],
    },
  };
}

function renderGuessThePriceCard(
  product: { productId: string; name: string; price: number; image?: string } | undefined,
  productImages: Map<string, string | null>,
  isReveal: boolean,
  input: RenderInput,
  styles: SatoriThemeStyles,
): SatoriElement {
  const p = product ?? { productId: 'p001', name: 'Sản phẩm', price: 299000 };
  const img = productImages.get(p.productId) ?? null;
  const { cardBg, cardBorder, cardBorderRadius, cardTextColor, isLightCard, priceColor } = styles;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '900px',
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: `3px solid ${cardBorder}`,
        padding: '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: {
                  width: '380px',
                  height: '380px',
                  borderRadius: '24px',
                  backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                  objectFit: 'contain',
                },
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: {
              fontSize: '46px',
              fontWeight: 'bold',
              color: cardTextColor,
              margin: '20px 0 10px 0',
              textAlign: 'center',
            },
            children: p.name,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '56px',
              fontWeight: 'bold',
              color: isReveal ? (styles.theme.colors.revealBannerSuccess ?? '#16a34a') : priceColor,
            },
            children: isReveal ? `GIÁ THẬT: ${formatVnd(p.price)}` : 'GIÁ LÀ BAO NHIÊU?',
          },
        },
      ],
    },
  };
}

function renderCenterStatus(
  isCountdown: boolean,
  isReveal: boolean,
  countdownFormatted: string,
  strokeDashoffset: number,
  circ: number,
  game: RenderGameView,
  styles: SatoriThemeStyles,
): SatoriElement {
  if (isReveal) {
    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#14532d',
          backgroundImage: 'linear-gradient(180deg, #16a34a 0%, #14532d 100%)',
          border: '4px solid #fde047',
          borderRadius: '9999px',
          padding: '12px 52px',
          boxShadow: '0 8px 24px rgba(22, 163, 74, 0.45)',
          gap: '14px',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: '38px',
                fontWeight: '900',
                color: '#ffffff',
                letterSpacing: '2px',
              },
              children: '★ ĐÃ CÔNG BỐ ĐÁP ÁN ★',
            },
          },
        ],
      },
    };
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7f1d1d',
        backgroundImage: 'linear-gradient(180deg, #b91c1c 0%, #450a0a 100%)',
        border: '4px solid #facc15',
        borderRadius: '9999px',
        padding: '12px 52px',
        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45)',
        gap: '14px',
      },
      children: [
        {
          type: 'svg',
          props: {
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            children: [
              {
                type: 'circle',
                props: {
                  cx: '12',
                  cy: '12',
                  r: '9',
                  stroke: '#fef08a',
                  strokeWidth: '2.5',
                  fill: 'none',
                },
              },
              {
                type: 'path',
                props: {
                  d: 'M12 7v5l3 3',
                  stroke: '#fef08a',
                  strokeWidth: '2.5',
                  strokeLinecap: 'round',
                  fill: 'none',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '40px',
              fontWeight: '900',
              color: '#fef08a',
              letterSpacing: '2px',
            },
            children: `ĐẾM NGƯỢC: ${countdownFormatted} GIÂY`,
          },
        },
      ],
    },
  };
}

function renderActionButtons(game: RenderGameView, isReveal: boolean, styles: SatoriThemeStyles): SatoriElement {
  const rawChoices = game.gameplay.choices ?? [
    { id: 'higher', label: '▲ CAO HƠN' },
    { id: 'lower', label: '▼ THẤP HƠN' },
  ];
  const answer = game.gameplay.answer;
  const choices = rawChoices.map((c) => (typeof c === 'string' ? { id: c, label: c } : c));

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '960px',
        gap: '24px',
      },
      children: choices.slice(0, 2).map((c, idx) => {
        const isCorrect = isReveal && (c.id === answer || String(c.id) === String(answer));
        const isLoser = isReveal && !isCorrect;

        // Button 0 = Emerald Green, Button 1 = Vibrant Orange/Red
        const bgTop = idx === 0 ? '#22c55e' : '#f97316';
        const bgMid = idx === 0 ? '#16a34a' : '#ea580c';
        const bgBottom = idx === 0 ? '#15803d' : '#c2410c';
        const bevelColor = idx === 0 ? '#14532d' : '#7c2d12';

        const border = isCorrect
          ? '6px solid #ffffff'
          : '5px solid #fde047';

        return {
          type: 'div',
          props: {
            style: {
              flex: 1,
              height: '110px',
              borderRadius: '26px',
              backgroundColor: bgMid,
              backgroundImage: `linear-gradient(180deg, ${bgTop} 0%, ${bgMid} 60%, ${bgBottom} 100%)`,
              border,
              borderBottom: `9px solid ${bevelColor}`,
              boxShadow: '0 12px 24px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '42px',
              fontWeight: '900',
              letterSpacing: '1px',
              opacity: isLoser ? 0.4 : 1,
            },
            children: c.label,
          },
        };
      }),
    },
  };
}
