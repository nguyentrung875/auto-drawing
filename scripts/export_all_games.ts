/**
 * Script to batch-render videos for all 7 game mechanics with timer = 10s
 * and 3 UI templates/themes: tv_game_show, clean_shopping, cyber_arcade.
 */
import { runRenderCommand } from '../src/cli/render';
import path from 'node:path';

const MECHANICS = [
  'hi_lo',
  'most_expensive',
  'odd_one_out',
  'one_away',
  'grocery_basket',
  'guess_the_price',
  'deal_or_scam',
] as const;

const THEMES = [
  'tv_game_show',
  'clean_shopping',
  'cyber_arcade',
] as const;

async function main() {
  console.log('🚀 Starting export of 7 game mechanics with 10s timer and 3 UI templates...\n');

  const results: Array<{ mechanic: string; theme: string; video?: string; ok: boolean; renderMs?: number }> = [];

  for (let i = 0; i < MECHANICS.length; i++) {
    const mechanic = MECHANICS[i]!;
    // Cycle through the 3 UI themes across the 7 games so every UI theme is showcased
    const theme = THEMES[i % THEMES.length]!;
    const seed = 1000 + i * 17;

    console.log(`🎬 [${i + 1}/${MECHANICS.length}] Rendering Game: ${mechanic} | Timer: 10s | Theme: ${theme} | Seed: ${seed}...`);

    try {
      const outcome = await runRenderCommand({
        mechanic,
        productIds: [],
        seed,
        timer: 10.0,
        theme,
        exportDir: 'export',
        rootDir: process.cwd(),
      });

      if (outcome.exitCode === 0 && outcome.videoPath) {
        console.log(` ✅ SUCCESS: Rendered to ${outcome.videoPath} (${outcome.renderMs}ms)`);
        results.push({ mechanic, theme, video: outcome.videoPath, ok: true, renderMs: outcome.renderMs });
      } else {
        console.error(` ❌ FAILED: ${outcome.error?.code} - ${outcome.error?.hint}`);
        results.push({ mechanic, theme, ok: false });
      }
    } catch (err) {
      console.error(` ❌ ERROR rendering ${mechanic}:`, err);
      results.push({ mechanic, theme, ok: false });
    }
  }

  console.log('\n📊 EXPORT SUMMARY REPORT');
  console.log('----------------------------------------------------');
  for (const r of results) {
    const status = r.ok ? `SUCCESS (${r.renderMs}ms) -> ${r.video}` : 'FAILED';
    console.log(`- Mechanic: ${r.mechanic.padEnd(16)} | Theme: ${r.theme.padEnd(16)} | Status: ${status}`);
  }
}

main().catch((err) => {
  console.error('Fatal error running export script:', err);
  process.exit(1);
});
