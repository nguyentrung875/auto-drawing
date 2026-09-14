import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "universal-game-video-engine-studio",
    persistence: "local-first-file-based",
  });
}
