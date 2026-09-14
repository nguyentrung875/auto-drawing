import { NextRequest, NextResponse } from "next/server";
import { getGame, deleteGame } from "@/lib/file-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const { game, logs } = getGame(gameId);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ game, logs });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const deleted = deleteGame(gameId);

  return NextResponse.json({ deleted, gameId });
}
