import { describe, it, expect } from 'vitest';
import { drawGroceryBasketTray, type TrayItem } from '../../src/render/trayPainter';
import { Canvas } from '../../src/render/canvas';
import { getTheme } from '../../src/core/theme';

describe('G7 Tray Painter', () => {
  it('renders 3-item grocery basket tray and calculates item slots without overlap', () => {
    const canvas = new Canvas(1080, 1920);
    const theme = getTheme('clean_shopping');
    const items: TrayItem[] = [
      { productId: 'm1', name: 'Sữa tươi 1L', priceLabel: '???', image: 'm1.png' },
      { productId: 'm2', name: 'Bánh mì sandwich', priceLabel: '???', image: 'm2.png' },
      { productId: 'm3', name: 'Trứng gà hộp 10 quả', priceLabel: '???', image: 'm3.png' },
    ];

    const boxes = drawGroceryBasketTray(canvas, items, {
      yOffset: 650,
      trayHeight: 480,
      theme,
    });

    expect(boxes).toHaveLength(3);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width);
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x + boxes[1].width);
  });
});
