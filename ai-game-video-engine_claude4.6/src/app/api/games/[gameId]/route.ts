import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { games, logs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.gameId, gameId))
    .limit(1);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameLogs = await db
    .select()
    .from(logs)
    .where(eq(logs.gameId, gameId))
    .orderBy(logs.createdAt);

  return NextResponse.json({ game, logs: gameLogs });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  await db.delete(logs).where(eq(logs.gameId, gameId));
  await db.delete(games).where(eq(games.gameId, gameId));

  return NextResponse.json({ deleted: true, gameId });
}
