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

export function buildSatoriVirtualDom(context: SatoriRenderContext): SatoriElement {
  const { input, timeSec, productImages } = context;
  const { game, sceneData, timeline, diversification } = input;
  const mechanic = game.metadata.mechanic;
  // Always use dark cyberpunk background so white text and neon accents have maximum contrast
  const bgColor = '#090d16';

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
        backgroundColor: bgColor,
        color: '#ffffff',
        fontFamily: 'Segoe UI',
        padding: '70px 40px 100px 40px',
        boxSizing: 'border-box',
      },
      children: [
        // --- TOP BAR & BADGE ---
        renderTopHeader(game, mechanic),

        // --- QUESTION HEADER ---
        renderQuestion(game, mechanic, isReveal),

        // --- PRODUCT CARDS AREA ---
        renderCardsArea(mechanic, resolvedProducts, cards, productImages, isReveal, input),

        // --- COUNTDOWN & REVEAL STATUS ---
        renderCenterStatus(isCountdown, isReveal, countdownFormatted, strokeDashoffset, circ, game),

        // --- ACTION BUTTONS ---
        renderActionButtons(game, isReveal),
      ],
    },
  };
}

function renderTopHeader(game: RenderGameView, mechanic: string): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '1000px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '10px 28px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
              color: '#38bdf8',
              fontSize: '26px',
              fontWeight: 'bold',
              letterSpacing: '1px',
            },
            children: `GAME #${game.metadata.gameId.slice(0, 10).toUpperCase()}`,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '10px 28px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.6)',
              color: '#fbbf24',
              fontSize: '26px',
              fontWeight: 'bold',
              letterSpacing: '1px',
            },
            children: mechanic.replace(/_/g, ' '),
          },
        },
      ],
    },
  };
}

function renderQuestion(game: RenderGameView, mechanic: string, isReveal: boolean): SatoriElement {
  const questionText = game.content.question ?? 'Sản phẩm nào ĐẮT NHẤT?';
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        width: '1000px',
        margin: '10px 0',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: '52px',
              fontWeight: 'bold',
              color: '#f8fafc',
              lineHeight: '1.25',
            },
            children: questionText,
          },
        },
        isReveal
          ? {
              type: 'div',
              props: {
                style: {
                  fontSize: '34px',
                  fontWeight: 'bold',
                  color: '#34d399',
                  marginTop: '10px',
                },
                children: 'ĐÁP ÁN CHÍNH XÁC ĐÃ LỘ DIỆN!',
              },
            }
          : {
              type: 'div',
              props: {
                style: {
                  fontSize: '32px',
                  color: '#94a3b8',
                  marginTop: '10px',
                },
                children: 'Bạn có 3 giây để đưa ra đáp án!',
              },
            },
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
): SatoriElement {
  if (mechanic === 'HI_LO') {
    return renderHiLoCards(products, cards, productImages, isReveal);
  }
  if (mechanic === 'ONE_AWAY') {
    return renderOneAwayCard(products[0], input, productImages, isReveal);
  }
  if (mechanic === 'MOST_EXPENSIVE' || mechanic === 'ODD_ONE_OUT') {
    if (products.length >= 4) {
      return renderGridCards(products, cards, productImages, isReveal, input);
    }
    return renderStackedCards(products, cards, productImages, isReveal, input);
  }
  if (mechanic === 'GROCERY_BASKET') {
    return renderGroceryBasketCards(products, productImages, isReveal, input);
  }
  if (mechanic === 'DEAL_OR_SCAM') {
    return renderDealOrScamCard(products[0], productImages, isReveal, input);
  }
  if (mechanic === 'GUESS_THE_PRICE') {
    return renderGuessThePriceCard(products[0], productImages, isReveal, input);
  }

  // Default fallback
  return renderStackedCards(products, cards, productImages, isReveal, input);
}

function renderHiLoCards(
  products: Array<{ productId: string; name: string; price: number; image?: string }>,
  cards: RenderCardView[],
  productImages: Map<string, string | null>,
  isReveal: boolean,
): SatoriElement {
  const pA = products[0] ?? { productId: 'p001', name: 'Sản phẩm A', price: 100000 };
  const pB = products[1] ?? { productId: 'p002', name: 'Sản phẩm B', price: 200000 };
  const imgA = productImages.get(pA.productId) ?? null;
  const imgB = productImages.get(pB.productId) ?? null;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '30px',
        width: '1000px',
        alignItems: 'center',
      },
      children: [
        // Card A (Price always visible)
        renderSingleCardRow(
          'SẢN PHẨM [A]',
          pA.name,
          formatVnd(pA.price),
          imgA,
          '#fbbf24',
          'rgba(148, 163, 184, 0.3)',
          false,
        ),
        // Card B (Secret until reveal)
        renderSingleCardRow(
          'SẢN PHẨM [B]',
          pB.name,
          isReveal ? formatVnd(pB.price) : '? GIÁ BÍ MẬT ?',
          imgB,
          isReveal ? (pB.price > pA.price ? '#34d399' : '#f87171') : '#38bdf8',
          isReveal ? 'rgba(56, 189, 248, 0.8)' : 'rgba(56, 189, 248, 0.4)',
          isReveal,
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
  highlight: boolean,
): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        width: '940px',
        height: '270px',
        backgroundColor: highlight ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 41, 59, 0.9)',
        borderRadius: '32px',
        border: `3px solid ${borderColor}`,
        padding: '20px 30px',
        boxSizing: 'border-box',
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
                  borderRadius: '24px',
                  backgroundColor: '#0f172a',
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
                  borderRadius: '24px',
                  backgroundColor: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '24px',
                },
                children: 'NO IMAGE',
              },
            },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              marginLeft: '36px',
              flex: 1,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '24px',
                    color: accentColor,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  },
                  children: badge,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '40px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    margin: '6px 0',
                  },
                  children: name,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '48px',
                    fontWeight: 'bold',
                    color: accentColor,
                  },
                  children: priceStr,
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
): SatoriElement {
  const p = product ?? { productId: 'p001', name: 'Sản phẩm', price: 189000 };
  const img = productImages.get(p.productId) ?? null;
  const maskedPrice = input.sceneData?.maskedPrice ?? '1?9.000₫';
  const fullPrice = formatVnd(p.price);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '900px',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderRadius: '36px',
        border: '3px solid rgba(129, 140, 248, 0.5)',
        padding: '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: { width: '380px', height: '380px', borderRadius: '28px', objectFit: 'contain' },
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: { fontSize: '46px', fontWeight: 'bold', margin: '20px 0 10px 0', textAlign: 'center' },
            children: p.name,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '64px',
              fontWeight: 'bold',
              color: isReveal ? '#34d399' : '#fbbf24',
              letterSpacing: '3px',
            },
            children: isReveal ? fullPrice : maskedPrice,
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
): SatoriElement {
  const winningAnswer = input.game.gameplay.answer;

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
        const labels = ['A', 'B', 'C'];
        const priceDisplay = isReveal ? formatVnd(p.price) : '???';

        return renderSingleCardRow(
          `MÓN [${labels[idx]}]`,
          p.name,
          priceDisplay,
          img,
          isWinner ? '#34d399' : '#fbbf24',
          isWinner ? '#10b981' : 'rgba(148, 163, 184, 0.25)',
          isWinner,
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
): SatoriElement {
  const winningAnswer = input.game.gameplay.answer;
  const labels = ['A', 'B', 'C', 'D'];

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

        return {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '450px',
              height: '280px',
              backgroundColor: isWinner ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.9)',
              border: isWinner ? '3px solid #10b981' : '2px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '28px',
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
                          color: isWinner ? '#34d399' : '#38bdf8',
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
                          color: isWinner ? '#34d399' : '#fbbf24',
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
                      style: { width: '150px', height: '150px', borderRadius: '18px', objectFit: 'contain' },
                    },
                  }
                : null,
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '26px',
                    fontWeight: 'bold',
                    color: '#ffffff',
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
): SatoriElement {
  const budget = input.game.gameplay.budget ?? 300000;
  const total = products.reduce((acc, p) => acc + p.price, 0);

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
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              border: '2px solid #eab308',
              color: '#fde047',
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
            '#38bdf8',
            'rgba(148, 163, 184, 0.25)',
            false,
          );
        }),
        isReveal
          ? {
              type: 'div',
              props: {
                style: {
                  fontSize: '38px',
                  fontWeight: 'bold',
                  color: total <= budget ? '#34d399' : '#f87171',
                  marginTop: '10px',
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
): SatoriElement {
  const p = product ?? { productId: 'p001', name: 'Sản phẩm Deal', price: 99000 };
  const img = productImages.get(p.productId) ?? null;
  const isDeal = input.game.gameplay.answer === 'deal';

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '900px',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderRadius: '36px',
        border: '3px solid #f43f5e',
        padding: '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: { width: '380px', height: '380px', borderRadius: '28px', objectFit: 'contain' },
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: { fontSize: '46px', fontWeight: 'bold', margin: '20px 0 10px 0', textAlign: 'center' },
            children: p.name,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '56px', fontWeight: 'bold', color: '#f43f5e' },
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
                  color: isDeal ? '#34d399' : '#f87171',
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
): SatoriElement {
  const p = product ?? { productId: 'p001', name: 'Sản phẩm', price: 299000 };
  const img = productImages.get(p.productId) ?? null;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '900px',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderRadius: '36px',
        border: '3px solid #fbbf24',
        padding: '36px',
        boxSizing: 'border-box',
      },
      children: [
        img
          ? {
              type: 'img',
              props: {
                src: img,
                style: { width: '380px', height: '380px', borderRadius: '28px', objectFit: 'contain' },
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: { fontSize: '46px', fontWeight: 'bold', margin: '20px 0 10px 0', textAlign: 'center' },
            children: p.name,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '56px',
              fontWeight: 'bold',
              color: isReveal ? '#34d399' : '#fbbf24',
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
): SatoriElement {
  if (isReveal) {
    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '160px',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                padding: '16px 48px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                border: '3px solid #10b981',
                color: '#34d399',
                fontSize: '44px',
                fontWeight: 'bold',
                letterSpacing: '1px',
              },
              children: 'ĐÃ CÔNG BỐ ĐÁP ÁN',
            },
          },
        ],
      },
    };
  }

  // Countdown timer circle
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        width: '180px',
        height: '180px',
        justifyContent: 'center',
      },
      children: [
        {
          type: 'svg',
          props: {
            width: '180',
            height: '180',
            viewBox: '0 0 180 180',
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'rotate(-90deg)',
            },
            children: [
              {
                type: 'circle',
                props: {
                  cx: '90',
                  cy: '90',
                  r: '65',
                  stroke: 'rgba(255, 255, 255, 0.1)',
                  strokeWidth: '14',
                  fill: 'none',
                },
              },
              {
                type: 'circle',
                props: {
                  cx: '90',
                  cy: '90',
                  r: '65',
                  stroke: '#fb7185',
                  strokeWidth: '14',
                  strokeDasharray: String(circ),
                  strokeDashoffset: String(strokeDashoffset),
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
              fontSize: '46px',
              fontWeight: 'bold',
              color: '#fb7185',
            },
            children: countdownFormatted,
          },
        },
      ],
    },
  };
}

function renderActionButtons(game: RenderGameView, isReveal: boolean): SatoriElement {
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
        width: '940px',
        gap: '30px',
      },
      children: choices.slice(0, 2).map((c, idx) => {
        const isCorrect = isReveal && (c.id === answer || String(c.id) === String(answer));
        const defaultColor = idx === 0 ? '#34d399' : '#f87171';
        const defaultBorder = idx === 0 ? '#10b981' : '#ef4444';
        const defaultBg = idx === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

        const color = isReveal ? (isCorrect ? '#34d399' : '#64748b') : defaultColor;
        const border = isReveal ? (isCorrect ? '3px solid #10b981' : '2px solid rgba(148, 163, 184, 0.2)') : `3px solid ${defaultBorder}`;
        const bg = isReveal ? (isCorrect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.4)') : defaultBg;

        return {
          type: 'div',
          props: {
            style: {
              flex: 1,
              height: '100px',
              borderRadius: '24px',
              backgroundColor: bg,
              border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              fontSize: '38px',
              fontWeight: 'bold',
            },
            children: c.label,
          },
        };
      }),
    },
  };
}
