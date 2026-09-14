"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatVND } from "@/lib/game-engine";

interface GameRecord {
  gameId: string;
  mechanic: "HI_LO" | "MOST_EXPENSIVE" | "ONE_AWAY";
  seed: number;
  resultVariant: "in_video" | "comment";
  status: string;
  outputPath: string | null;
  captionJson: Record<string, unknown> | null;
  validatorErrors: unknown[] | null;
  renderMs: number | null;
  planningMs: number | null;
  createdAt: string;
}

const MECHANIC_COLORS: Record<string, string> = {
  HI_LO: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  MOST_EXPENSIVE: "bg-purple-900/40 text-purple-300 border-purple-700/40",
  ONE_AWAY: "bg-green-900/40 text-green-300 border-green-700/40",
};

const STATUS_COLORS: Record<string, string> = {
  created: "text-indigo-400",
  done: "text-green-400",
  failed: "text-red-400",
  running: "text-yellow-400",
};

export default function GamesPage() {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadGames();
  }, []);

  function loadGames() {
    setLoading(true);
    fetch("/api/games?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setGames(data.games || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function deleteGame(gameId: string) {
    setDeleting(gameId);
    try {
      await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      setGames((prev) => prev.filter((g) => g.gameId !== gameId));
    } finally {
      setDeleting(null);
    }
  }

  const filtered = filter === "all" ? games : games.filter((g) => g.mechanic === filter || g.status === filter);

  const stats = {
    total: games.length,
    done: games.filter((g) => g.status === "done" || g.status === "created").length,
    failed: games.filter((g) => g.status === "failed").length,
    hiLo: games.filter((g) => g.mechanic === "HI_LO").length,
    mostExpensive: games.filter((g) => g.mechanic === "MOST_EXPENSIVE").length,
    oneAway: games.filter((g) => g.mechanic === "ONE_AWAY").length,
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-semibold">🎮 Games History</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadGames}
              className="text-gray-400 hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
            >
              🔄 Refresh
            </button>
            <Link href="/studio" className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
              + Tạo Game
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Games History</h1>
          <p className="text-gray-500 text-sm">
            Tất cả games đã tạo. Mỗi game = 1 video Job trong queue.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Tổng", value: stats.total, color: "text-white" },
            { label: "Thành công", value: stats.done, color: "text-green-400" },
            { label: "Thất bại", value: stats.failed, color: "text-red-400" },
            { label: "HI_LO", value: stats.hiLo, color: "text-blue-400" },
            { label: "MOST_EXP", value: stats.mostExpensive, color: "text-purple-400" },
            { label: "ONE_AWAY", value: stats.oneAway, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-gray-600 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "HI_LO", "MOST_EXPENSIVE", "ONE_AWAY", "done", "created", "failed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Games table */}
        {loading ? (
          <div className="text-gray-600 py-16 text-center">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🎮</div>
            <div className="text-gray-500">Chưa có game nào</div>
            <Link href="/studio" className="mt-4 inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">
              Tạo game đầu tiên →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((game) => (
              <div
                key={game.gameId}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-white text-sm font-bold">{game.gameId}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-medium ${MECHANIC_COLORS[game.mechanic] || "bg-gray-800 text-gray-400 border-gray-700"}`}
                      >
                        {game.mechanic}
                      </span>
                      <span className={`text-xs font-medium ${STATUS_COLORS[game.status] || "text-gray-400"}`}>
                        {game.status === "done" || game.status === "created" ? "✅" : game.status === "failed" ? "❌" : "⏳"}{" "}
                        {game.status}
                      </span>
                      {game.resultVariant === "comment" && (
                        <span className="text-xs text-gray-500">💬 comment</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                      <span>seed={game.seed}</span>
                      {game.renderMs && <span>{game.renderMs}ms</span>}
                      {game.planningMs && <span>plan={game.planningMs}ms</span>}
                      <span>{new Date(game.createdAt).toLocaleString("vi-VN")}</span>
                    </div>

                    {game.outputPath && (
                      <div className="mt-1 text-xs font-mono text-gray-600 truncate">
                        {game.outputPath}
                      </div>
                    )}

                    {game.captionJson && typeof game.captionJson === "object" && "hashtags" in game.captionJson && (
                      <div className="mt-1 text-xs text-indigo-500">
                        {(game.captionJson.hashtags as string[]).slice(0, 5).join(" ")}
                      </div>
                    )}

                    {game.validatorErrors && Array.isArray(game.validatorErrors) && game.validatorErrors.length > 0 && (
                      <div className="mt-1 text-xs text-red-400">
                        {(game.validatorErrors as Array<{code: string}>).map((e) => e.code).join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Link
                      href={`/games/${game.gameId}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors"
                    >
                      Detail
                    </Link>
                    <button
                      onClick={() => deleteGame(game.gameId)}
                      disabled={deleting === game.gameId}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/40 transition-colors disabled:opacity-50"
                    >
                      {deleting === game.gameId ? "..." : "Del"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
