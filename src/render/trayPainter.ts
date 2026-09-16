import type { Canvas } from './canvas';
import type { VisualTheme } from '../core/theme/types';
import type { LayoutBox } from '../validator/LayoutGeometryValidator';

export interface TrayItem {
  productId: string;
  name: string;
  priceLabel: string;
  image: string;
}

export interface TrayRenderOptions {
  yOffset: number;
  trayHeight: number;
  theme: VisualTheme;
}

export function drawGroceryBasketTray(
  canvas: Canvas,
  items: TrayItem[],
  options: TrayRenderOptions,
): LayoutBox[] {
  const { yOffset, trayHeight, theme } = options;
  const stageWidth = 1080;
  const padding = 60;
  const gutter = 30;
  const availableWidth = stageWidth - padding * 2 - gutter * (items.length - 1);
  const cardWidth = Math.floor(availableWidth / items.length);

  const boxes: LayoutBox[] = [];

  // Draw tray backboard
  canvas.fillRoundRect(
    padding - 15,
    yOffset - 15,
    stageWidth - (padding - 15) * 2,
    trayHeight + 30,
    theme.geometry.cardBorderRadius + 8,
    'rgba(0, 0, 0, 0.45)',
  );
  canvas.strokeRoundRect(
    padding - 15,
    yOffset - 15,
    stageWidth - (padding - 15) * 2,
    trayHeight + 30,
    theme.geometry.cardBorderRadius + 8,
    theme.colors.cardBorder,
    2,
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const cardX = padding + i * (cardWidth + gutter);
    const box: LayoutBox = {
      id: `tray_item_${item.productId}`,
      x: cardX,
      y: yOffset,
      width: cardWidth,
      height: trayHeight,
    };
    boxes.push(box);

    // Draw card background
    canvas.fillRoundRect(
      box.x,
      box.y,
      box.width,
      box.height,
      theme.geometry.cardBorderRadius,
      theme.colors.cardBackground,
    );
    canvas.strokeRoundRect(
      box.x,
      box.y,
      box.width,
      box.height,
      theme.geometry.cardBorderRadius,
      theme.colors.cardBorder,
      theme.geometry.cardBorderWidth,
    );
  }

  return boxes;
}
