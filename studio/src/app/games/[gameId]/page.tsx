"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import type { GameJson } from "@/types/game";
import { GamePreview } from "@/components/GamePreview";
import { getGameTheme } from "@/lib/game-engine";

interface GameDetailRecord {
  gameId: string;
  mechanic: string;
  seed: number;
  resultVariant: string;
  status: string;
  gameJson: GameJson | null;
  outputPath: string | null;
  captionJson: Record<string, unknown> | null;
  validatorErrors: unknown[] | null;
  renderMs: number | null;
  planningMs: number | null;
  createdAt: string;
}

interface LogRecord {
  id: number;
  gameId: string;
  level: string;
  code: string | null;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export default function GameDetailPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [game, setGame] = useState<GameDetailRecord | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/${gameId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setGame(data.game);
          setLogs(data.logs || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load game");
        setLoading(false);
      });
  }, [gameId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Đang tải...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || "Game not found"}</div>
          <Link href="/games" className="text-indigo-400 hover:underline">← Quay lại Games</Link>
        </div>
      </div>
    );
  }

  const theme = game.gameJson ? getGameTheme(game.seed) : null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/games" className="text-gray-400 hover:text-white transition-colors text-sm">← Games</Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-mono text-sm">{game.gameId}</span>
          </div>
          <Link href={`/studio?mechanic=${game.mechanic}`} className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            Tạo tương tự →
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Info */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-white">{game.gameId}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40">
                      {game.mechanic}
                    </span>
                    <span className={`text-xs ${
                      game.status === "done" || game.status === "created" ? "text-green-400" :
                      game.status === "failed" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {game.status}
                    </span>
                    <span className="text-xs text-gray-500">{game.resultVariant}</span>
                  </div>
                </div>
                {theme && (
                  <div
                    className="w-8 h-8 rounded-xl border border-gray-700"
                    style={{ backgroundColor: theme.bgColor }}
                    title={`Tilt: ${theme.tiltDeg}°`}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Seed", value: game.seed },
                  { label: "Planning", value: game.planningMs ? `${game.planningMs}ms` : "—" },
                  { label: "Render", value: game.renderMs ? `${game.renderMs}ms` : "—" },
                  { label: "Created", value: new Date(game.createdAt).toLocaleString("vi-VN") },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-800/50 rounded-xl p-3">
                    <div className="text-xs text-gray-600 mb-0.5">{item.label}</div>
                    <div className="text-white text-sm font-mono">{String(item.value)}</div>
                  </div>
                ))}
              </div>

              {game.outputPath && (
                <div className="mt-3 bg-gray-800/50 rounded-xl p-3">
                  <div className="text-xs text-gray-600 mb-0.5">Output</div>
                  <div className="text-white text-xs font-mono">{game.outputPath}</div>
                </div>
              )}

              {game.captionJson && (
                <div className="mt-3 bg-gray-800/50 rounded-xl p-3">
                  <div className="text-xs text-gray-600 mb-1">Caption JSON</div>
                  <pre className="text-xs text-gray-300 overflow-auto font-mono">
                    {JSON.stringify(game.captionJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Validator errors */}
            {game.validatorErrors && Array.isArray(game.validatorErrors) && game.validatorErrors.length > 0 && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-4">
                <div className="text-red-400 text-sm font-medium mb-2">❌ Validator Errors</div>
                <div className="space-y-1">
                  {(game.validatorErrors as Array<{code: string; field?: string; hint?: string}>).map((e, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-red-400 font-mono font-bold">{e.code}</span>
                      {e.field && <span className="text-gray-500"> @ {e.field}</span>}
                      {e.hint && <span className="text-gray-400"> — {e.hint}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="text-white font-semibold text-sm mb-3">📋 Logs ({logs.length})</div>
              {logs.length === 0 ? (
                <div className="text-gray-600 text-sm">Không có log</div>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`text-xs p-2 rounded-lg ${
                        log.level === "error"
                          ? "bg-red-900/20 border border-red-800/20"
                          : log.level === "warn"
                          ? "bg-yellow-900/20 border border-yellow-800/20"
                          : "bg-gray-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`font-medium ${
                            log.level === "error" ? "text-red-400" :
                            log.level === "warn" ? "text-yellow-400" : "text-gray-400"
                          }`}
                        >
                          {log.level.toUpperCase()}
                        </span>
                        {log.code && <span className="font-mono text-gray-500">{log.code}</span>}
                        <span className="text-gray-700">
                          {new Date(log.createdAt).toLocaleTimeString("vi-VN")}
                        </span>
                      </div>
                      <div className="text-gray-300">{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <div className="sticky top-20">
              {game.gameJson ? (
                <GamePreview
                  game={game.gameJson}
                  planningMs={game.planningMs ?? 0}
                />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="text-4xl mb-3">📄</div>
                  <div className="text-gray-500 text-sm">
                    Game JSON chưa được lưu hoặc bị lỗi
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
