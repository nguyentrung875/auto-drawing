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
import type { MultiRoundChallenge, ChallengeRound, ChallengeChoice } from '../../challenge/types';
import { AllInOneScene } from '../../scene/AllInOneScene';

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
  const isLightStage = theme.id === 'bep_am_noi_tro' || theme.id === 'tap_hoa_vui_ve' || theme.id === 'dai_hoi_sieu_thi';
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
    } else if (theme.id === 'dai_hoi_sieu_thi') {
      priceColor = '#dc2626';
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

function resolveMechanicFromChallenge(gameId: string, roundMechanic?: string): string {
  const id = (roundMechanic || gameId || '').toUpperCase();
  if (id.includes('HI_LO') || id.includes('G1')) return 'HI_LO';
  if (id.includes('MOST_EXPENSIVE') || id.includes('G2')) return 'MOST_EXPENSIVE';
  if (id.includes('ONE_AWAY') || id.includes('G5')) return 'ONE_AWAY';
  if (id.includes('ODD_ONE_OUT') || id.includes('G3')) return 'ODD_ONE_OUT';
  if (id.includes('GUESS') || id.includes('G9')) return 'GUESS_THE_PRICE';
  if (id.includes('GROCERY') || id.includes('G7')) return 'GROCERY_BASKET';
  if (id.includes('DEAL') || id.includes('G41')) return 'DEAL_OR_SCAM';
  return 'HI_LO';
}

function buildMultiRoundVirtualDom(
  context: SatoriRenderContext,
  theme: VisualTheme,
  styles: SatoriThemeStyles,
): SatoriElement {
  const { input, timeSec, productImages } = context;
  const challenge = input.challenge!;
  const scene = new AllInOneScene(challenge);
  const timeline = scene.getTimeline();

  const slot =
    timeline.slots.find((s) => timeSec >= s.start && timeSec < s.end) ??
    timeline.slots.find((s) => timeSec >= s.start && timeSec <= s.end) ??
    timeline.slots[timeline.slots.length - 1];

  if (!slot || slot.type === 'hook') {
    return renderHookVirtualDom(challenge, theme, styles, productImages);
  }

  if (slot.type === 'scorecard') {
    return renderScorecardVirtualDom(challenge, theme, styles);
  }

  const current = scene.getCurrentRound(timeSec);
  const round = current?.round ?? challenge.rounds[0]!;
  const phase = current?.phase ?? 'play';

  return renderRoundVirtualDom({
    challenge,
    round,
    phase,
    phaseTime: current?.phaseTime ?? 0,
    timeSec,
    slot,
    theme,
    styles,
    productImages,
    input,
  });
}

function renderHookVirtualDom(
  challenge: MultiRoundChallenge,
  theme: VisualTheme,
  styles: SatoriThemeStyles,
  productImages: Map<string, string | null>,
): SatoriElement {
  const [bgTop, bgBottom] = theme.colors.backgroundGradient;
  const isDaiHoi = theme.id === 'dai_hoi_sieu_thi';
  const round1 = challenge.rounds[0];
  const round1Products = round1?.products ?? [];

  const mockGame: RenderGameView = {
    metadata: {
      gameId: challenge.gameId,
      mechanic: 'MULTI_ROUND' as any,
      seed: challenge.seed,
    },
    content: {
      title: challenge.title,
    },
    gameplay: {},
    entities: round1Products,
    publishing: {
      caption: challenge.title,
      hashtags: [],
    },
  };

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
        renderStageLighting(theme, styles),

        renderTopHeader(
          mockGame,
          'MULTI_ROUND',
          styles,
          `TẬP #${challenge.seriesNumber || 1} · THỬ THÁCH GIỜ VÀNG`,
          challenge.title,
        ),

        {
          type: 'div',
          props: {
            style: {
              width: '980px',
              backgroundColor: '#ffffff',
              border: isDaiHoi ? '7px solid #0f172a' : '5px solid #facc15',
              borderRadius: '24px',
              padding: '24px 30px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.35)',
              gap: '12px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: '#DC2626',
                    color: '#ffffff',
                    borderRadius: '9999px',
                    padding: '8px 28px',
                    fontSize: '26px',
                    fontWeight: '900',
                    letterSpacing: '2px',
                  },
                  children: '🔥 THỬ THÁCH ĐOÁN GIÁ 5 GIÂY 🔥',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '44px',
                    fontWeight: '900',
                    color: '#0f172a',
                    textAlign: 'center',
                    lineHeight: '1.25',
                    textTransform: 'uppercase',
                  },
                  children: round1?.hookText ?? challenge.title,
                },
              },
            ],
          },
        },

        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              width: '980px',
            },
            children: round1Products.slice(0, 2).map((p, idx) => {
              const img = productImages.get(p.productId);
              return {
                type: 'div',
                props: {
                  style: {
                    width: '460px',
                    height: '460px',
                    backgroundColor: '#ffffff',
                    border: '6px solid #DC2626',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.3)',
                  },
                  children: [
                    img
                      ? {
                          type: 'img',
                          props: {
                            src: img,
                            style: {
                              width: '320px',
                              height: '320px',
                              objectFit: 'contain',
                            },
                          },
                        }
                      : {
                          type: 'div',
                          props: {
                            style: {
                              width: '320px',
                              height: '320px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f1f5f9',
                              borderRadius: '16px',
                              color: '#64748b',
                              fontSize: '24px',
                              fontWeight: '700',
                            },
                            children: p.name,
                          },
                        },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '24px',
                          fontWeight: '800',
                          color: '#0f172a',
                          textAlign: 'center',
                          marginTop: '10px',
                          maxWidth: '420px',
                          overflow: 'hidden',
                        },
                        children: p.name,
                      },
                    },
                    renderExplosionPriceTag(
                      idx === 0 ? formatVnd(p.price) : '? GIÁ BÍ MẬT ?',
                      idx === 0 ? 'MỐC GIÁ' : 'CẦN ĐOÁN',
                      false,
                      true,
                    ),
                  ],
                },
              };
            }),
          },
        },

        {
          type: 'div',
          props: {
            style: {
              width: '980px',
              height: '110px',
              backgroundColor: '#16A34A',
              backgroundImage: 'linear-gradient(180deg, #22C55E 0%, #16A34A 50%, #15803D 100%)',
              border: '6px solid #0f172a',
              borderRadius: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.4)',
              color: '#ffffff',
              fontSize: '44px',
              fontWeight: '900',
              letterSpacing: '2px',
            },
            children: '🚀 CHUẨN BỊ... VÒNG 1 BẮT ĐẦU! 🚀',
          },
        },
      ],
    },
  };
}

function renderScorecardVirtualDom(
  challenge: MultiRoundChallenge,
  theme: VisualTheme,
  styles: SatoriThemeStyles,
): SatoriElement {
  const [bgTop, bgBottom] = theme.colors.backgroundGradient;
  const isDaiHoi = theme.id === 'dai_hoi_sieu_thi';

  const mockGame: RenderGameView = {
    metadata: {
      gameId: challenge.gameId,
      mechanic: 'MULTI_ROUND' as any,
      seed: challenge.seed,
    },
    content: {
      title: challenge.title,
    },
    gameplay: {},
    entities: [],
    publishing: {
      caption: challenge.title,
      hashtags: [],
    },
  };

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
        renderStageLighting(theme, styles),

        renderTopHeader(
          mockGame,
          'MULTI_ROUND',
          styles,
          'TỔNG KẾT THỬ THÁCH',
          challenge.title,
        ),

        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '980px',
              backgroundColor: isDaiHoi ? '#ffffff' : (styles.cardBg ?? '#1e293b'),
              border: isDaiHoi ? '8px solid #0f172a' : '6px solid #facc15',
              borderRadius: '28px',
              padding: '30px 24px',
              boxSizing: 'border-box',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              gap: '20px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: '18px',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  children: [1, 2, 3].map(() => ({
                    type: 'svg',
                    props: {
                      width: '54',
                      height: '54',
                      viewBox: '0 0 24 24',
                      children: [
                        {
                          type: 'polygon',
                          props: {
                            points: '12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9',
                            fill: '#FACC15',
                            stroke: '#CA8A04',
                            strokeWidth: '1.5',
                          },
                        },
                      ],
                    },
                  })),
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '48px',
                    fontWeight: '900',
                    color: isDaiHoi ? '#DC2626' : '#facc15',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  },
                  children: 'BẠN ĐÚNG ĐƯỢC MẤY CÂU?',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    width: '100%',
                    marginTop: '10px',
                  },
                  children: challenge.rounds.map((r) => {
                    const cleanReveal = r.revealText
                      ? r.revealText.replace(/^[🎉★]\s*/, '')
                      : `Đáp án: ${r.correctAnswer}`;
                    return {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: isDaiHoi ? '#F8FAFC' : 'rgba(255, 255, 255, 0.08)',
                          border: isDaiHoi ? '4px solid #16A34A' : '3px solid #facc15',
                          borderRadius: '16px',
                          padding: '14px 20px',
                          gap: '14px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                backgroundColor: '#16A34A',
                                borderRadius: '10px',
                                padding: '6px 14px',
                                color: '#ffffff',
                                fontSize: '24px',
                                fontWeight: '900',
                              },
                              children: `CÂU ${r.roundIndex}`,
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                flex: 1,
                                fontSize: '24px',
                                fontWeight: '700',
                                color: isDaiHoi ? '#0f172a' : '#ffffff',
                                lineHeight: '1.2',
                              },
                              children: cleanReveal,
                            },
                          },
                          {
                            type: 'svg',
                            props: {
                              width: '32',
                              height: '32',
                              viewBox: '0 0 24 24',
                              fill: 'none',
                              children: [
                                {
                                  type: 'path',
                                  props: {
                                    d: 'M20 6L9 17l-5-5',
                                    stroke: '#16A34A',
                                    strokeWidth: '3.5',
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    };
                  }),
                },
              },
            ],
          },
        },

        {
          type: 'div',
          props: {
            style: {
              width: '980px',
              backgroundColor: '#DC2626',
              backgroundImage: 'linear-gradient(180deg, #F59E0B 0%, #EA580C 50%, #DC2626 100%)',
              border: '6px solid #0f172a',
              borderRadius: '26px',
              padding: '24px 20px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.5)',
              gap: '6px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '38px',
                    fontWeight: '900',
                    color: '#ffffff',
                    letterSpacing: '1px',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                  },
                  children: challenge.finalCta || 'BÌNH LUẬN ĐIỂM SỐ CỦA BẠN XUỐNG DƯỚI! 👇',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '22px',
                    fontWeight: '700',
                    color: '#FEF08A',
                    letterSpacing: '1px',
                  },
                  children: 'AI ĐÚNG HẾT 3/3 VÒNG SẼ NHẬN QUÀ SIÊU ĐẶC BIỆT!',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

interface RoundVirtualDomParams {
  challenge: MultiRoundChallenge;
  round: ChallengeRound;
  phase: 'play' | 'reveal';
  phaseTime: number;
  timeSec: number;
  slot: import('../../types/game').TimelineSlot;
  theme: VisualTheme;
  styles: SatoriThemeStyles;
  productImages: Map<string, string | null>;
  input: RenderInput;
}

function renderRoundVirtualDom(params: RoundVirtualDomParams): SatoriElement {
  const { challenge, round, phase, phaseTime, slot, theme, styles, productImages, input } = params;
  const [bgTop, bgBottom] = theme.colors.backgroundGradient;

  const isReveal = phase === 'reveal';
  const isCountdown = phase === 'play';
  const remaining = isCountdown ? Math.max(0, round.timerSeconds - phaseTime) : 0;
  const countdownFormatted = remaining.toFixed(1);
  const circ = 408;
  const progress = Math.min(1, Math.max(0, remaining / Math.max(1, round.timerSeconds)));
  const strokeDashoffset = Math.round(circ * (1 - progress));

  const mechanic = resolveMechanicFromChallenge(challenge.gameId, round.mechanic);
  const totalRounds = challenge.rounds.length;

  const headerSub = round.microHook
    ? `⚡ ${round.microHook.replace(/^[⚠️⚡]\s*/, '')}`
    : round.roundIndex === totalRounds && totalRounds > 1
      ? '⚠️ CÂU CUỐI: 90% ĐOÁN SAI!'
      : `CÂU ${round.roundIndex}/${totalRounds}`;

  const revealText = round.revealText || `Đáp án: ${round.correctAnswer}`;

  const mockGame: RenderGameView = {
    metadata: {
      gameId: `${challenge.gameId}_r${round.roundIndex}`,
      mechanic: mechanic as any,
      seed: challenge.seed,
    },
    content: {
      title: challenge.title,
      question: round.question,
    },
    gameplay: {
      answer: round.correctAnswer,
      choices: round.choices,
    },
    entities: round.products.map((p) => ({
      productId: p.productId,
      name: p.name,
      price: p.price,
      image: p.image,
      brand: p.brand,
    })),
    publishing: {
      caption: challenge.title,
      hashtags: [],
    },
  };

  const mockInput: RenderInput = {
    ...input,
    game: mockGame,
    products: round.products,
  };

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
        renderStageLighting(theme, styles),

        renderTopHeader(mockGame, mechanic, styles, headerSub, challenge.title),

        renderQuestion(mockGame, mechanic, isReveal, styles, round.question, revealText),

        renderCardsArea(mechanic, round.products, [], productImages, isReveal, mockInput, styles),

        renderCenterStatus(isCountdown, isReveal, countdownFormatted, strokeDashoffset, circ, mockGame, styles),

        renderActionButtonsMultiRound(round.choices, round.correctAnswer, isReveal, styles, mechanic),
      ],
    },
  };
}

function renderActionButtonsMultiRound(
  choices: ChallengeChoice[] | undefined,
  answer: string | number,
  isReveal: boolean,
  styles: SatoriThemeStyles,
  mechanic: string,
): SatoriElement {
  if (mechanic === 'ONE_AWAY') {
    return renderOneAwayStatus(isReveal, answer, styles);
  }

  const rawChoices = choices && choices.length > 0
    ? choices
    : [
        { id: 'higher', label: '▲ CAO HƠN', isCorrect: true },
        { id: 'lower', label: '▼ THẤP HƠN', isCorrect: false },
      ];

  const count = rawChoices.length;
  if (count <= 2) {
    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          width: '980px',
          gap: '24px',
        },
        children: rawChoices.map((c, idx) => {
          const isCorrect = isReveal && (c.isCorrect || c.id === answer || String(c.id) === String(answer));
          const isLoser = isReveal && !isCorrect;

          const bgTop = idx === 0 ? '#22c55e' : '#f97316';
          const bgMid = idx === 0 ? '#16a34a' : '#ea580c';
          const bgBottom = idx === 0 ? '#15803d' : '#c2410c';
          const bevelColor = idx === 0 ? '#14532d' : '#7c2d12';

          const border = isCorrect
            ? '6px solid #ffffff'
            : (styles.theme.id === 'dai_hoi_sieu_thi' ? '5px solid #0f172a' : '5px solid #fde047');

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
                opacity: isLoser ? 0.35 : 1,
              },
              children: c.label,
            },
          };
        }),
      },
    };
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '980px',
        gap: '16px',
      },
      children: rawChoices.map((c, idx) => {
        const isCorrect = isReveal && (c.isCorrect || c.id === answer || String(c.id) === String(answer));
        const isLoser = isReveal && !isCorrect;

        const colors = [
          ['#22c55e', '#16a34a', '#15803d'],
          ['#3b82f6', '#2563eb', '#1d4ed8'],
          ['#f97316', '#ea580c', '#c2410c'],
          ['#a855f7', '#9333ea', '#7e22ce'],
        ];
        const [bgTop, bgMid, bgBottom] = colors[idx % colors.length]!;

        return {
          type: 'div',
          props: {
            style: {
              flex: count === 3 ? '1 1 300px' : '1 1 460px',
              height: '95px',
              borderRadius: '20px',
              backgroundColor: bgMid,
              backgroundImage: `linear-gradient(180deg, ${bgTop} 0%, ${bgMid} 60%, ${bgBottom} 100%)`,
              border: isCorrect ? '6px solid #ffffff' : '4px solid #0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '32px',
              fontWeight: '900',
              opacity: isLoser ? 0.35 : 1,
              padding: '0 12px',
              boxSizing: 'border-box',
            },
            children: c.label,
          },
        };
      }),
    },
  };
}

export function buildSatoriVirtualDom(context: SatoriRenderContext): SatoriElement {
  const { input, timeSec, productImages } = context;

  // Resolve visual theme
  const rawTheme = input.theme ?? (input.game?.metadata as { theme?: string })?.theme ?? 'dai_hoi_sieu_thi';
  const theme = resolveTheme(rawTheme);
  const styles = computeThemeStyles(theme);

  if (input.challenge) {
    return buildMultiRoundVirtualDom(context, theme, styles);
  }

  const { game, sceneData, timeline } = input;
  const mechanic = game.metadata.mechanic;

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

/**
 * Sunburst / Tia Nắng overlay for the "Đại Hội Siêu Thị Giờ Vàng" Pop-Art theme.
 * 20 alternating rays radiate from center (540, 960) outward to canvas edges.
 * Purely decorative — kept at low opacity so products remain the focal point.
 */
function renderSunburstOverlay(): SatoriElement {
  // Pre-compute 20 trapezoid rays; each ray spans 18°. Alternating colours.
  const cx = 540;
  const cy = 960;
  const innerR = 80;  // Dead-zone radius around center
  const outerR = 1560; // Reach past corners
  const totalRays = 20;
  const halfAngleDeg = 9; // half-width of each ray in degrees

  function polarToXY(angleDeg: number, r: number): [number, number] {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  const rays: SatoriElement[] = Array.from({ length: totalRays }, (_, i) => {
    const centerAngle = (i / totalRays) * 360;
    const aLeft = centerAngle - halfAngleDeg;
    const aRight = centerAngle + halfAngleDeg;

    const [ix1, iy1] = polarToXY(aLeft, innerR);
    const [ix2, iy2] = polarToXY(aRight, innerR);
    const [ox1, oy1] = polarToXY(aLeft, outerR);
    const [ox2, oy2] = polarToXY(aRight, outerR);

    const points = `${ix1.toFixed(1)},${iy1.toFixed(1)} ${ix2.toFixed(1)},${iy2.toFixed(1)} ${ox2.toFixed(1)},${oy2.toFixed(1)} ${ox1.toFixed(1)},${oy1.toFixed(1)}`;
    const fill = i % 2 === 0 ? '#FEF08A' : '#FDE68A';
    const opacity = i % 2 === 0 ? '0.55' : '0.30';

    return { type: 'polygon', props: { points, fill, opacity } } as SatoriElement;
  });

  // LED bulb clusters in the top-left and top-right corners (decorative)
  const bulbY = 48;
  const ledBulbs: SatoriElement[] = [
    // Top-left cluster
    { type: 'circle', props: { cx: '72', cy: String(bulbY), r: '16', fill: '#DC2626', opacity: '0.90' } },
    { type: 'circle', props: { cx: '116', cy: String(bulbY), r: '16', fill: '#FACC15', opacity: '0.95' } },
    { type: 'circle', props: { cx: '160', cy: String(bulbY), r: '16', fill: '#16A34A', opacity: '0.90' } },
    { type: 'circle', props: { cx: '204', cy: String(bulbY), r: '16', fill: '#DC2626', opacity: '0.90' } },
    { type: 'circle', props: { cx: '94', cy: String(bulbY + 38), r: '16', fill: '#FACC15', opacity: '0.95' } },
    { type: 'circle', props: { cx: '138', cy: String(bulbY + 38), r: '16', fill: '#DC2626', opacity: '0.90' } },
    // Top-right cluster
    { type: 'circle', props: { cx: '1008', cy: String(bulbY), r: '16', fill: '#DC2626', opacity: '0.90' } },
    { type: 'circle', props: { cx: '964', cy: String(bulbY), r: '16', fill: '#FACC15', opacity: '0.95' } },
    { type: 'circle', props: { cx: '920', cy: String(bulbY), r: '16', fill: '#16A34A', opacity: '0.90' } },
    { type: 'circle', props: { cx: '876', cy: String(bulbY), r: '16', fill: '#DC2626', opacity: '0.90' } },
    { type: 'circle', props: { cx: '986', cy: String(bulbY + 38), r: '16', fill: '#FACC15', opacity: '0.95' } },
    { type: 'circle', props: { cx: '942', cy: String(bulbY + 38), r: '16', fill: '#DC2626', opacity: '0.90' } },
  ] as SatoriElement[];

  return {
    type: 'svg',
    props: {
      width: '1080',
      height: '1920',
      viewBox: '0 0 1080 1920',
      style: { position: 'absolute', top: 0, left: 0 },
      children: [...rays, ...ledBulbs],
    },
  };
}

function renderStageLighting(theme: VisualTheme, styles: SatoriThemeStyles): SatoriElement {
  // ── DAI HOI SIEU THI: Sunburst Pop-Art overlay ──────────────────────────
  if (theme.id === 'dai_hoi_sieu_thi') {
    return renderSunburstOverlay();
  }

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

function renderTopHeader(
  game: RenderGameView,
  mechanic: string,
  styles: SatoriThemeStyles,
  customSubtitle?: string,
  customTitle?: string,
): SatoriElement {
  const { theme, isLightStage } = styles;

  // ── DAI HOI SIEU THI: Biển hiệu siêu thị Pop-Art ────────────────────────
  if (theme.id === 'dai_hoi_sieu_thi') {
    const episodeNum = game.metadata.seed ? (game.metadata.seed % 99 + 1) : 1;
    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '980px',
          backgroundColor: '#DC2626',
          backgroundImage: 'linear-gradient(180deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
          border: '6px solid #0f172a',
          borderRadius: '18px',
          padding: '0px',
          overflow: 'hidden',
          boxSizing: 'border-box',
        },
        children: [
          // Top stripe: vàng
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: '100%',
                height: '14px',
                backgroundColor: '#FACC15',
              },
            },
          },
          // Main content row
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '10px 28px 10px 28px',
              },
              children: [
                // Shopping cart SVG icon
                {
                  type: 'svg',
                  props: {
                    width: '48',
                    height: '48',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    children: [
                      {
                        type: 'path',
                        props: {
                          d: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z',
                          stroke: '#FACC15',
                          strokeWidth: '2',
                          strokeLinejoin: 'round',
                          fill: 'none',
                        },
                      },
                      {
                        type: 'path',
                        props: {
                          d: 'M3 6h18',
                          stroke: '#FACC15',
                          strokeWidth: '2',
                          strokeLinecap: 'round',
                        },
                      },
                      {
                        type: 'path',
                        props: {
                          d: 'M16 10a4 4 0 0 1-8 0',
                          stroke: '#FACC15',
                          strokeWidth: '2',
                          strokeLinecap: 'round',
                        },
                      },
                    ],
                  },
                },
                // Title text
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: '34px',
                            fontWeight: '900',
                            color: '#FACC15',
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            lineHeight: '1.1',
                          },
                          children: customTitle ? customTitle.toUpperCase() : `ĐẠI HỘI ĐOÁN GIÁ · TẬP #${episodeNum}`,
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: '19px',
                            fontWeight: '800',
                            color: '#FEF08A',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            marginTop: '2px',
                          },
                          children: customSubtitle ?? `${theme.name} · ${mechanic.replace(/_/g, ' ')}`,
                        },
                      },
                    ],
                  },
                },
                // Shopping cart icon (right side)
                {
                  type: 'svg',
                  props: {
                    width: '48',
                    height: '48',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    children: [
                      {
                        type: 'path',
                        props: {
                          d: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z',
                          stroke: '#FACC15',
                          strokeWidth: '2',
                          strokeLinejoin: 'round',
                          fill: 'none',
                        },
                      },
                      {
                        type: 'path',
                        props: {
                          d: 'M3 6h18',
                          stroke: '#FACC15',
                          strokeWidth: '2',
                          strokeLinecap: 'round',
                        },
                      },
                      {
                        type: 'path',
                        props: {
                          d: 'M16 10a4 4 0 0 1-8 0',
                          stroke: '#FACC15',
                          strokeWidth: '2',
                          strokeLinecap: 'round',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Bottom stripe: xanh lá
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: '100%',
                height: '14px',
                backgroundColor: '#16A34A',
              },
            },
          },
        ],
      },
    };
  }

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
            children: customSubtitle ?? `${theme.name} · ${mechanic.replace(/_/g, ' ')}`,
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
  customQuestion?: string,
  customReveal?: string,
): SatoriElement {
  const questionText = customQuestion ?? (game.content.question ?? 'Sản phẩm nào ĐẮT NHẤT?');
  const { theme, isLightStage } = styles;

  // ── DAI HOI SIEU THI: Biểu ngữ câu hỏi Pop-Art ──────────────────────────
  if (theme.id === 'dai_hoi_sieu_thi') {
    return {
      type: 'div',
      props: {
        style: {
          width: '980px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          border: '7px solid #0f172a',
          borderRadius: '20px',
          padding: '0px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          margin: '8px 0',
        },
        children: [
          // Top accent stripe
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: '100%',
                height: '12px',
                backgroundColor: '#DC2626',
              },
            },
          },
          // Question content
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '18px 28px 20px 28px',
                gap: '10px',
                width: '100%',
                boxSizing: 'border-box',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '46px',
                      fontWeight: '900',
                      color: '#0f172a',
                      textAlign: 'center',
                      lineHeight: '1.2',
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
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#16A34A',
                          border: '4px solid #0f172a',
                          borderRadius: '9999px',
                          padding: '8px 32px',
                          fontSize: '28px',
                          fontWeight: '900',
                          color: '#ffffff',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                        },
                        children: customReveal ? customReveal.toUpperCase() : 'CHỐT RỒI! ĐÃ LỘ DIỆN!',
                      },
                    }
                  : {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#FACC15',
                          border: '4px solid #0f172a',
                          borderRadius: '9999px',
                          padding: '6px 28px',
                          fontSize: '24px',
                          fontWeight: '900',
                          color: '#0f172a',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                        },
                        children: 'HÃY BÌNH LUẬN NGAY TRƯỚC KHI HẾT GIỜ!',
                      },
                    },
              ],
            },
          },
          // Bottom accent stripe
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: '100%',
                height: '12px',
                backgroundColor: '#16A34A',
              },
            },
          },
        ],
      },
    };
  }

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
                children: customReveal ? `★ ${customReveal.toUpperCase()} ★` : '★ ĐÁP ÁN CHÍNH XÁC ĐÃ LỘ DIỆN! ★',
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
  const pA = products[0] ?? { productId: 'p001', name: 'S\u1ea3n ph\u1ea9m A', price: 100000 };
  const pB = products[1] ?? { productId: 'p002', name: 'S\u1ea3n ph\u1ea9m B', price: 200000 };
  const imgA = productImages.get(pA.productId) ?? null;
  const imgB = productImages.get(pB.productId) ?? null;

  // ── DAI HOI SIEU THI: Supermarket card layout ────────────────────────────
  if (styles.theme.id === 'dai_hoi_sieu_thi') {
    const bIsHigher = isReveal && pB.price > pA.price;
    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', gap: '30px', width: '980px', alignItems: 'center' },
        children: [
          renderSupermarketCardRow('SAN PHAM [A] · MOC SO SANH', pA.name, formatVnd(pA.price), imgA, false, isReveal, false, true),
          renderSupermarketCardRow(
            'SAN PHAM [B] · CAN DOAN',
            pB.name,
            isReveal ? formatVnd(pB.price) : '? GIA BI MAT ?',
            imgB,
            true,
            isReveal,
            bIsHigher,
            true,
          ),
        ],
      },
    };
  }

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


/**
 * Renders a 12-point starburst explosion-tag sticker — the classic Pop-Art
 * supermarket price-tag shape — with a label and price centered inside.
 * Used exclusively by the "Đại Hội Siêu Thị Giờ Vàng" theme.
 */
function renderExplosionPriceTag(
  priceStr: string,
  sticker: string,
  isReveal: boolean,
  isLarge = false,
): SatoriElement {
  // 12-point starburst path; coordinates are relative to a 160×160 viewBox centered at 80,80
  const starPath =
    'M80,4 L91,40 L126,24 L110,58 L148,60 L118,80 L148,100 L110,102 L126,136 L91,120 L80,156 L69,120 L34,136 L50,102 L12,100 L42,80 L12,60 L50,58 L34,24 L69,40 Z';

  const tagBg = isReveal ? '#16A34A' : '#DC2626';
  const tagTextColor = '#ffffff';

  const tagSize = isLarge ? '175px' : '150px';
  const tagOffset = isLarge ? '-14px' : '-10px';
  const stickerFontSize = isLarge ? '14px' : '12px';
  const priceFontSize = isLarge ? '21px' : '17px';

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: tagOffset,
        right: tagOffset,
        width: tagSize,
        height: tagSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      children: [
        {
          type: 'svg',
          props: {
            width: tagSize,
            height: tagSize,
            viewBox: '0 0 160 160',
            style: { position: 'absolute', top: 0, left: 0 },
            children: [
              {
                type: 'path',
                props: {
                  d: starPath,
                  fill: tagBg,
                  stroke: '#0f172a',
                  strokeWidth: '4',
                },
              },
            ],
          },
        },
        // Text content overlaid on star
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: isLarge ? '32px 18px' : '26px 16px',
              textAlign: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: stickerFontSize,
                    fontWeight: '900',
                    color: tagTextColor,
                    textTransform: 'uppercase',
                    lineHeight: '1.1',
                  },
                  children: sticker,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: priceFontSize,
                    fontWeight: '900',
                    color: '#FACC15',
                    lineHeight: '1.0',
                  },
                  children: isReveal ? priceStr : '???',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * Supermarket Pop-Art card row — used exclusively by dai_hoi_sieu_thi theme.
 * Features: thick black border, white card background, colored badge strip,
 * explosion price tag sticker at bottom-right.
 *
 * Supports `isLarge`:
 * - `isLarge = true` (HI_LO, 2 cards): 260×260px image, 325px height, max visual presence.
 * - `isLarge = false` (MOST_EXPENSIVE, 3 cards): 220×220px image, 255px height, fits cleanly above y=1200.
 */
function renderSupermarketCardRow(
  badge: string,
  name: string,
  priceStr: string,
  imgBase64: string | null,
  isSecret: boolean,
  isReveal: boolean,
  isWinner: boolean,
  isLarge = false,
): SatoriElement {
  const STICKERS = ['RẺ KHÔNG TƯỞNG!', 'SALE SỐC!', 'CHỐT ĐƠN!', 'GIÁ HỜI!'];
  const stickerIdx = (badge.charCodeAt(badge.length - 2) || 0) % STICKERS.length;
  const sticker = isWinner ? 'CHIẾN THẮNG!' : STICKERS[stickerIdx];

  const badgeBg = badge.includes('[A]') || badge.includes('#1')
    ? '#DC2626'
    : badge.includes('[B]') || badge.includes('#2')
      ? '#2563eb'
      : '#16A34A';

  const borderColor = isWinner ? '#16A34A' : '#0f172a';

  // Responsive safe-size parameters based on card count
  const cardHeight = isLarge ? '325px' : '255px';
  const imgSize = isLarge ? '260px' : '220px';
  const cardPadding = isLarge ? '20px 28px' : '16px 22px';
  const nameFontSize = isLarge ? '38px' : '33px';
  const badgeFontSize = isLarge ? '20px' : '18px';
  const badgePadding = isLarge ? '6px 20px' : '5px 16px';
  const priceFontSize = isLarge
    ? (isSecret && !isReveal ? '38px' : '46px')
    : (isSecret && !isReveal ? '32px' : '38px');
  const pricePadding = isLarge ? '8px 24px' : '6px 18px';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        width: '960px',
        minHeight: cardHeight,
        height: cardHeight,
        backgroundColor: isWinner ? '#f0fdf4' : '#ffffff',
        borderRadius: '22px',
        border: `6px solid ${borderColor}`,
        padding: cardPadding,
        boxSizing: 'border-box',
        overflow: 'visible',
      },
      children: [
        // Product image - enlarged to max safe size
        imgBase64
          ? {
              type: 'img',
              props: {
                src: imgBase64,
                style: {
                  width: imgSize,
                  height: imgSize,
                  borderRadius: '18px',
                  backgroundColor: '#f8fafc',
                  objectFit: 'contain',
                  border: '4px solid #0f172a',
                  flexShrink: 0,
                },
              },
            }
          : {
              type: 'div',
              props: {
                style: {
                  width: imgSize,
                  height: imgSize,
                  borderRadius: '18px',
                  backgroundColor: '#f1f5f9',
                  border: '4px solid #0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#64748b',
                  flexShrink: 0,
                },
                children: 'ANH SP',
              },
            },
        // Info column
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              marginLeft: '26px',
              flex: 1,
              gap: isLarge ? '12px' : '8px',
            },
            children: [
              // Badge label
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
                          padding: badgePadding,
                          borderRadius: '8px',
                          border: '2px solid #0f172a',
                          backgroundColor: badgeBg,
                          color: '#ffffff',
                          fontSize: badgeFontSize,
                          fontWeight: '900',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                        },
                        children: badge,
                      },
                    },
                  ],
                },
              },
              // Product name
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: nameFontSize,
                    fontWeight: '900',
                    color: '#0f172a',
                    lineHeight: '1.2',
                    maxHeight: isLarge ? '95px' : '76px',
                    overflow: 'hidden',
                  },
                  children: name,
                },
              },
              // Price pill
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
                          padding: pricePadding,
                          borderRadius: '12px',
                          border: '3px solid #0f172a',
                          backgroundColor: isReveal ? (isWinner ? '#16A34A' : '#DC2626') : '#FACC15',
                          color: isReveal ? '#ffffff' : '#0f172a',
                          fontSize: priceFontSize,
                          fontWeight: '900',
                        },
                        children: isSecret && !isReveal ? '? GIA BI MAT ?' : priceStr,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Explosion sticker (absolute positioned, bottom-right)
        renderExplosionPriceTag(priceStr, sticker, isReveal, isLarge),
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

  const isSupermarket = styles.theme.id === 'dai_hoi_sieu_thi';
  const cardWidth = isSupermarket ? '940px' : '900px';
  const cardBorderFinal = isSupermarket ? '6px solid #0f172a' : `3px solid ${cardBorder}`;
  const imgSize = isSupermarket ? '430px' : '380px';
  const imgBorder = isSupermarket ? '4px solid #0f172a' : 'none';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: cardWidth,
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: cardBorderFinal,
        padding: isSupermarket ? '28px' : '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: {
                  width: imgSize,
                  height: imgSize,
                  borderRadius: '24px',
                  backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                  border: imgBorder,
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

  // ── DAI HOI SIEU THI: Supermarket stacked layout ─────────────────────────
  if (styles.theme.id === 'dai_hoi_sieu_thi') {
    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', gap: '18px', width: '980px', alignItems: 'center' },
        children: products.slice(0, 3).map((p, idx) => {
          const isWinner = isReveal && (p.productId === winningAnswer);
          const img = productImages.get(p.productId) ?? null;
          return renderSupermarketCardRow(
            `MON [${labels[idx]}]`,
            p.name,
            isReveal ? formatVnd(p.price) : '???',
            img,
            false,
            isReveal,
            isWinner,
            false,
          );
        }),
      },
    };
  }

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
          if (styles.theme.id === 'dai_hoi_sieu_thi') {
            return renderSupermarketCardRow(
              `MON #${idx + 1}`,
              p.name,
              isReveal ? formatVnd(p.price) : '???',
              img,
              false,
              isReveal,
              false,
              false,
            );
          }
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

  const isSupermarket = styles.theme.id === 'dai_hoi_sieu_thi';
  const cardWidth = isSupermarket ? '940px' : '900px';
  const cardBorderFinal = isSupermarket ? '6px solid #0f172a' : '3px solid #dc2626';
  const imgSize = isSupermarket ? '430px' : '380px';
  const imgBorder = isSupermarket ? '4px solid #0f172a' : 'none';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: cardWidth,
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: cardBorderFinal,
        padding: isSupermarket ? '28px' : '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: {
                  width: imgSize,
                  height: imgSize,
                  borderRadius: '24px',
                  backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                  border: imgBorder,
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

  const isSupermarket = styles.theme.id === 'dai_hoi_sieu_thi';
  const cardWidth = isSupermarket ? '940px' : '900px';
  const cardBorderFinal = isSupermarket ? '6px solid #0f172a' : `3px solid ${cardBorder}`;
  const imgSize = isSupermarket ? '430px' : '380px';
  const imgBorder = isSupermarket ? '4px solid #0f172a' : 'none';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: cardWidth,
        backgroundColor: cardBg,
        borderRadius: cardBorderRadius,
        border: cardBorderFinal,
        padding: isSupermarket ? '28px' : '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: {
                  width: imgSize,
                  height: imgSize,
                  borderRadius: '24px',
                  backgroundColor: isLightCard ? '#f1f5f9' : '#0f172a',
                  border: imgBorder,
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
  // ── DAI HOI SIEU THI: LED Bảng Điểm Điện Tử ─────────────────────────────
  if (styles.theme.id === 'dai_hoi_sieu_thi') {
    if (isReveal) {
      return {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#16A34A',
            border: '6px solid #0f172a',
            borderRadius: '16px',
            padding: '14px 44px',
            gap: '12px',
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
                  textTransform: 'uppercase',
                },
                children: 'CHỐT! ĐÃ LỘ DIỆN ĐÁP ÁN!',
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
          backgroundColor: '#0f172a',
          border: '6px solid #FACC15',
          borderRadius: '16px',
          padding: '14px 36px',
          gap: '16px',
        },
        children: [
          // Clock icon
          {
            type: 'svg',
            props: {
              width: '36',
              height: '36',
              viewBox: '0 0 24 24',
              children: [
                { type: 'circle', props: { cx: '12', cy: '12', r: '9', stroke: '#FACC15', strokeWidth: '2.5', fill: 'none' } },
                { type: 'path', props: { d: 'M12 7v5l3 3', stroke: '#FACC15', strokeWidth: '2.5', strokeLinecap: 'round', fill: 'none' } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '40px',
                fontWeight: '900',
                color: '#FACC15',
                letterSpacing: '4px',
                fontVariantNumeric: 'tabular-nums',
              },
              children: `CÒN ${countdownFormatted} GIÂY`,
            },
          },
          // Flashing red dot indicator
          {
            type: 'div',
            props: {
              style: {
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#DC2626',
                border: '2px solid #ffffff',
              },
            },
          },
        ],
      },
    };
  }

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
