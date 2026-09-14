import { NextRequest, NextResponse } from "next/server";
import { buildGame } from "@/lib/game-engine";
import { validateGame } from "@/lib/validator";
import { saveGame, listGames } from "@/lib/file-store";
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

  const games = listGames(limit, offset);
  const total = listGames().length;

  return NextResponse.json({ games, total });
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
    const nowIso = new Date().toISOString();

    // Persist to file-based store
    saveGame(
      {
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
        },
        validatorErrors: [],
        planningMs,
        renderMs: totalMs,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      [
        {
          id: 1,
          gameId,
          level: "info",
          code: null,
          message: `Game created: ${mechanic} seed=${resolvedSeed}`,
          meta: {
            planningMs,
            totalMs,
            warnings,
            productIds,
          },
          createdAt: nowIso,
        },
      ]
    );

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
