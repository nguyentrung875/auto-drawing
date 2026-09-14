# Task 1: Multi-Round 38s Frame Painter & Dynamic Timeline Rendering

## Files
- Modify: `src/render/scenePainter.ts`
- Create: `test/render/multi-round-painter.test.ts`

## Interfaces
- Consumes: `AllInOneScene`, `MultiRoundChallenge`, `src/render/canvas.ts`
- Produces: `paintMultiRoundFrame()` to render frames for any second `t` in `[0, 38]`.

## Steps
1. Create `test/render/multi-round-painter.test.ts` with tests for painting hook (0.5s), question play (4.0s), reveal (9.0s), micro-hook (11.0s), and scorecard (36.0s).
2. Implement `paintMultiRoundFrame(canvas: Canvas, scene: AllInOneScene, timeSeconds: number)` in `src/render/scenePainter.ts`.
   - Clears background with gradient.
   - Finds active slot in `scene.getTimeline()`.
   - If `slot.type === 'hook'`: Draws series HUD, hook badge, hook question text.
   - If `slot.type.startsWith('round_')`:
     - Round header dots and series badge.
     - Product card at y=450.
     - Question box at y=320.
     - Choice deck at y=1220.
     - If play phase: draw pill countdown bar with remaining seconds.
     - If reveal phase: highlight winning choice with green border and show reveal text / actual price.
   - If `slot.type.startsWith('micro_hook_')`:
     - Flash text transition banner (e.g., "Câu 2 bắt đầu xoắn não rồi đây!").
   - If `slot.type === 'scorecard'`:
     - Draw 3 stars (⭐⭐⭐), "BẠN ĐÚNG MẤY CÂU?", and CTA "Ai đúng 3/3 giơ tay!".
3. Run `npx vitest run test/render/multi-round-painter.test.ts` to verify it passes.
4. Commit: `git add src/render/scenePainter.ts test/render/multi-round-painter.test.ts; git commit -m "feat(render): implement paintMultiRoundFrame for 38s continuous timeline"`
