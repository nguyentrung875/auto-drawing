import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { games, logs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { buildGame } from "@/lib/game-engine";
import { validateGame } from "@/lib/validator";
import type { Mechanic, ResultVariant } from "@/types/game";

function nanoid(len = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const rows = await db
    .select()
    .from(games)
    .orderBy(desc(games.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ games: rows, total: rows.length });
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  try {
    const body = await req.json();
    const {
      mechanic,
      productIds,
      seed,
      resultVariant = "in_video",
    } = body as {
      mechanic: Mechanic;
      productIds: string[];
      seed?: number;
      resultVariant?: ResultVariant;
    };

    if (!mechanic || !productIds || productIds.length === 0) {
      return NextResponse.json(
        { error: "mechanic and productIds are required" },
        { status: 400 }
      );
    }

    const resolvedSeed = seed ?? Math.floor(Math.random() * 1000000);
    const gameId = `game_${nanoid(8)}`;

    // Build game deterministically
    const planningStart = Date.now();
    let gameResult;
    try {
      gameResult = buildGame({
        mechanic,
        productIds,
        seed: resolvedSeed,
        resultVariant,
        gameId,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: "Game build failed",
          code: errMsg.split(":")[0],
          hint: errMsg,
        },
        { status: 422 }
      );
    }
    const planningMs = Date.now() - planningStart;

    const { game, warnings } = gameResult;

    // Validate
    const validation = validateGame(game);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          validatorErrors: validation.errors,
        },
        { status: 422 }
      );
    }

    const totalMs = Date.now() - startMs;

    // Persist to DB
    await db.insert(games).values({
      gameId,
      mechanic,
      seed: resolvedSeed,
      resultVariant,
      status: "created",
      gameJson: game as unknown as Record<string, unknown>,
      outputPath: game.publishing.outputPath,
      captionJson: {
        caption: game.publishing.caption,
        hashtags: game.publishing.hashtags,
        affiliateLink: game.publishing.affiliateLink,
      } as unknown as Record<string, unknown>,
      validatorErrors: [] as unknown as Record<string, unknown>[],
      planningMs,
      renderMs: totalMs,
    });

    // Log
    await db.insert(logs).values({
      gameId,
      level: "info",
      message: `Game created: ${mechanic} seed=${resolvedSeed}`,
      meta: {
        planningMs,
        totalMs,
        warnings,
        productIds,
      } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      gameId,
      mechanic,
      seed: resolvedSeed,
      resultVariant,
      game,
      warnings,
      planningMs,
      totalMs,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
