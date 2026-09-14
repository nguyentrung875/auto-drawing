import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { games, jobs, batches, batchJobs, logs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildGame } from "@/lib/game-engine";
import { validateGame } from "@/lib/validator";
import { MOCK_PRODUCTS } from "@/lib/products-data";
import type { Mechanic, ResultVariant, BatchJobReport } from "@/types/game";
import { createRng } from "@/lib/seedrandom";

function nanoid(len = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function pickProductsForMechanic(mechanic: Mechanic, rng: ReturnType<typeof createRng>): string[] {
  const shuffled = rng.shuffle(MOCK_PRODUCTS.map((p) => p.productId));
  if (mechanic === "HI_LO") {
    for (let i = 0; i < shuffled.length - 1; i++) {
      const p1 = MOCK_PRODUCTS.find((p) => p.productId === shuffled[i])!;
      for (let j = i + 1; j < shuffled.length; j++) {
        const p2 = MOCK_PRODUCTS.find((p) => p.productId === shuffled[j])!;
        const delta = Math.abs(p2.price - p1.price) / p1.price;
        if (delta >= 0.05) return [p1.productId, p2.productId];
      }
    }
    return [shuffled[0], shuffled[1]];
  }
  if (mechanic === "MOST_EXPENSIVE") {
    const count = rng.next() > 0.5 ? 4 : 3;
    const picked: string[] = [];
    const usedPrices = new Set<number>();
    for (const pid of shuffled) {
      const p = MOCK_PRODUCTS.find((x) => x.productId === pid)!;
      if (!usedPrices.has(p.price)) {
        picked.push(pid);
        usedPrices.add(p.price);
        if (picked.length === count) break;
      }
    }
    if (picked.length >= 2) {
      const prices = picked
        .map((id) => MOCK_PRODUCTS.find((p) => p.productId === id)!.price)
        .sort((a, b) => b - a);
      const delta = (prices[0] - prices[1]) / prices[0];
      if (delta >= 0.02) return picked;
    }
    return shuffled.slice(0, 3);
  }
  // ONE_AWAY: 1 product
  return [shuffled[0]];
}

export async function POST(req: NextRequest) {
  const batchStart = Date.now();

  try {
    const body = await req.json();
    const {
      count = 10,
      mechanics = ["HI_LO", "MOST_EXPENSIVE", "ONE_AWAY"],
      seed: batchSeedRaw,
      resultVariant = "in_video",
    } = body as {
      count?: number;
      mechanics?: Mechanic[];
      seed?: number;
      resultVariant?: ResultVariant;
    };

    const clampedCount = Math.min(Math.max(count, 1), 50);
    const batchSeed = batchSeedRaw ?? Math.floor(Math.random() * 1000000);
    const batchId = `batch_${nanoid(8)}`;

    // Create batch record
    await db.insert(batches).values({
      batchId,
      total: clampedCount,
      passed: 0,
      failed: 0,
      status: "running",
    });

    const jobReports: BatchJobReport[] = [];
    const usedProductSets = new Set<string>();
    let passed = 0;
    let failed = 0;
    let totalRenderMs = 0;

    for (let i = 0; i < clampedCount; i++) {
      const mechanic = mechanics[i % mechanics.length];
      const jobSeed = batchSeed + i * 7919;
      const gameId = `game_${nanoid(8)}`;
      const jobId = `job_${nanoid(8)}`;

      let productIds: string[];
      let attempts = 0;
      do {
        productIds = pickProductsForMechanic(mechanic, createRng(jobSeed + attempts));
        attempts++;
      } while (usedProductSets.has([...productIds].sort().join(",")) && attempts < 10);
      usedProductSets.add([...productIds].sort().join(","));

      const jobStart = Date.now();

      await db.insert(games).values({
        gameId,
        mechanic,
        seed: jobSeed,
        resultVariant,
        status: "running",
      });

      await db.insert(jobs).values({
        jobId,
        gameId,
        mechanic,
        productIds: productIds as unknown as Record<string, unknown>,
        seed: jobSeed,
        resultVariant,
        status: "running",
        retries: 0,
      });

      await db.insert(batchJobs).values({ batchId, jobId });

      try {
        const gameResult = buildGame({
          mechanic,
          productIds,
          seed: jobSeed,
          resultVariant,
          gameId,
        });

        const validation = validateGame(gameResult.game);
        if (!validation.valid) {
          throw new Error(validation.errors.map((e) => e.code).join(", "));
        }

        const renderMs = Date.now() - jobStart;
        totalRenderMs += renderMs;
        passed++;

        await db
          .update(games)
          .set({
            status: "done",
            gameJson: gameResult.game as unknown as Record<string, unknown>,
            outputPath: gameResult.game.publishing.outputPath,
            captionJson: {
              caption: gameResult.game.publishing.caption,
              hashtags: gameResult.game.publishing.hashtags,
              affiliateLink: gameResult.game.publishing.affiliateLink,
            } as unknown as Record<string, unknown>,
            renderMs,
            updatedAt: new Date(),
          })
          .where(eq(games.gameId, gameId));

        await db
          .update(jobs)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(jobs.jobId, jobId));

        jobReports.push({
          jobId,
          gameId,
          status: "done",
          mechanic,
          productIds,
          renderMs,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        failed++;

        await db
          .update(games)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(games.gameId, gameId));

        await db
          .update(jobs)
          .set({
            status: "failed",
            errorMessage: errMsg.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(eq(jobs.jobId, jobId));

        await db.insert(logs).values({
          gameId,
          jobId,
          level: "error",
          code: "BATCH_JOB_FAILED",
          message: errMsg,
          meta: { mechanic, productIds, seed: jobSeed } as unknown as Record<string, unknown>,
        });

        jobReports.push({
          jobId,
          gameId,
          status: "failed",
          mechanic,
          productIds,
          errorMessage: errMsg,
        });
      }
    }

    const avgRenderMs = passed > 0 ? Math.round(totalRenderMs / passed) : 0;
    const batchTotalMs = Date.now() - batchStart;

    const report = {
      batchId,
      total: clampedCount,
      passed,
      failed,
      avgRenderMs,
      manualInterventions: 0,
      jobs: jobReports,
      createdAt: new Date().toISOString(),
    };

    await db
      .update(batches)
      .set({
        status: "done",
        passed,
        failed,
        avgRenderMs,
        reportJson: report as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(batches.batchId, batchId));

    return NextResponse.json({
      batchId,
      total: clampedCount,
      passed,
      failed,
      avgRenderMs,
      batchTotalMs,
      manualInterventions: 0,
      jobs: jobReports,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function GET() {
  const rows = await db
    .select()
    .from(batches)
    .orderBy(batches.createdAt);
  return NextResponse.json({ batches: rows });
}
