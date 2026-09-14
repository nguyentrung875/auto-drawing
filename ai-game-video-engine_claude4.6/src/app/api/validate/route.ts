import { NextRequest, NextResponse } from "next/server";
import { validateGame } from "@/lib/validator";
import type { GameJson } from "@/types/game";

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json();
    const result = validateGame(body as Partial<GameJson>);
    const elapsedMs = Date.now() - startMs;
    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      elapsedMs,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
