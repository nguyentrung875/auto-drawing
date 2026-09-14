"use client";

import { useState } from "react";
import type { GameJson, HiLoGameplay, MostExpensiveGameplay, OneAwayGameplay } from "@/types/game";
import { maskPrice, formatVND, getGameTheme } from "@/lib/game-engine";

interface GamePreviewProps {
  game: GameJson;
  planningMs?: number;
}

function formatDuration(s: number) {
  return `${s.toFixed(1)}s`;
}

export function GamePreview({ game, planningMs }: GamePreviewProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "json" | "timeline" | "audio">("preview");
  const [copied, setCopied] = useState(false);

  const theme = getGameTheme(game.metadata.seed);
  const { mechanic, seed, resultVariant } = game.metadata;

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(game, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xs font-medium">✅ Game Rendered</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-gray-500 text-xs font-mono">{game.metadata.gameId}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-mono bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40">
              {mechanic}
            </span>
            <span className="text-xs font-mono text-gray-500">seed={seed}</span>
            <span className="text-xs font-mono text-gray-500">
              {resultVariant === "comment" ? "💬 comment" : "📺 in_video"}
            </span>
            {planningMs && (
              <span className="text-xs text-gray-600">{planningMs}ms</span>
            )}
          </div>
        </div>
        <button
          onClick={copyJson}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700"
        >
          {copied ? "✅ Copied!" : "Copy JSON"}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 flex">
        {(["preview", "json", "timeline", "audio"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "preview" && "🎮 "}
            {tab === "json" && "📄 "}
            {tab === "timeline" && "⏱️ "}
            {tab === "audio" && "🎵 "}
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "preview" && (
          <VideoPreview game={game} theme={theme} />
        )}

        {activeTab === "json" && (
          <pre className="text-xs text-gray-300 overflow-auto max-h-96 font-mono leading-relaxed bg-gray-950 rounded-lg p-4">
            {JSON.stringify(game, null, 2)}
          </pre>
        )}

        {activeTab === "timeline" && (
          <TimelineView game={game} />
        )}

        {activeTab === "audio" && (
          <AudioView game={game} />
        )}
      </div>

      {/* Publishing info */}
      <div className="border-t border-gray-800 p-4 space-y-2">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Publishing</div>
        <div className="bg-gray-950 rounded-lg p-3 space-y-1.5">
          <div className="text-xs text-gray-400">
            <span className="text-gray-600">Output: </span>
            <span className="font-mono text-gray-300">{game.publishing.outputPath}</span>
          </div>
          <div className="text-xs text-gray-400">
            <span className="text-gray-600">Caption: </span>
            <span className="text-gray-300 line-clamp-2">{game.publishing.caption}</span>
          </div>
          <div className="text-xs text-gray-400">
            <span className="text-gray-600">Hashtags: </span>
            <span className="text-indigo-400">{game.publishing.hashtags.join(" ")}</span>
          </div>
          <div className="text-xs text-gray-400">
            <span className="text-gray-600">Affiliate: </span>
            <a href={game.publishing.affiliateLink} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline font-mono truncate">
              {game.publishing.affiliateLink}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Video Preview (9:16 phone mockup) ─────────────────────────────────────────

function VideoPreview({ game, theme }: { game: GameJson; theme: ReturnType<typeof getGameTheme> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const scenes = game.scenes;
  const scene = scenes[currentScene];
  const entity = game.entities[0];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone mockup */}
      <div
        className="relative rounded-[2rem] border-4 border-gray-700 overflow-hidden shadow-2xl"
        style={{ width: 200, height: 355, backgroundColor: theme.bgColor }}
      >
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black/20 flex items-center justify-between px-4 z-10">
          <span className="text-[8px] text-white/70 font-medium">9:41</span>
          <span className="text-[8px] text-white/70">●●●</span>
        </div>

        {/* Scene content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-3"
          style={{ transform: `rotate(${theme.tiltDeg * 0.3}deg)` }}
        >
          <SceneRenderer
            scene={scene}
            game={game}
            theme={theme}
          />
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className="h-full bg-white/60 transition-all duration-300"
            style={{ width: `${((currentScene + 1) / scenes.length) * 100}%` }}
          />
        </div>

        {/* Tilt indicator (subtle) */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${theme.accentColor}08, transparent 50%)`,
          }}
        />
      </div>

      {/* Scene nav */}
      <div className="flex gap-1.5">
        {scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentScene(i)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs transition-all ${
              i === currentScene
                ? "bg-indigo-600/30 border border-indigo-500/50 text-white"
                : "bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="capitalize">{s.type}</span>
            <span className="text-gray-600 font-mono">{formatDuration(s.duration)}</span>
          </button>
        ))}
      </div>

      {/* Entity cards */}
      <div className="w-full grid grid-cols-2 gap-2">
        {game.entities.map((e, i) => (
          <div key={e.productId} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1 font-mono">
              {e.productId}
              {game.metadata.mechanic === "MOST_EXPENSIVE" &&
                (game.gameplay as MostExpensiveGameplay).answer === e.productId && (
                  <span className="ml-1 text-yellow-400">👑</span>
                )}
            </div>
            <div className="text-white text-xs font-medium leading-tight line-clamp-2 mb-1.5">
              {e.name}
            </div>
            <div
              className="text-sm font-black"
              style={{ color: theme.accentColor }}
            >
              {formatVND(e.price)}
            </div>
            <div className="text-gray-600 text-xs">{e.brand}</div>
          </div>
        ))}
      </div>

      {/* Answer display */}
      <AnswerDisplay game={game} theme={theme} />
    </div>
  );
}

function SceneRenderer({
  scene,
  game,
  theme,
}: {
  scene: GameJson["scenes"][0];
  game: GameJson;
  theme: ReturnType<typeof getGameTheme>;
}) {
  const entity = game.entities[0];

  switch (scene.type) {
    case "hook":
      return (
        <div className="text-center">
          <div className="text-3xl mb-2">🔥</div>
          <div
            className="text-sm font-black text-center leading-tight"
            style={{ color: theme.accentColor }}
          >
            {game.content.hook}
          </div>
          <div className="mt-2 text-[9px] text-gray-600 font-medium">
            HOOK · {scene.duration}s
          </div>
        </div>
      );

    case "product":
      return (
        <div className="text-center w-full">
          <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Sản phẩm</div>
          <div
            className="w-14 h-14 rounded-xl mx-auto mb-2 flex items-center justify-center text-2xl"
            style={{ backgroundColor: theme.accentColor + "20", border: `1px solid ${theme.accentColor}40` }}
          >
            📦
          </div>
          <div className="text-[10px] font-bold text-gray-900 leading-tight line-clamp-2 mb-1">
            {entity.name}
          </div>
          <div
            className="text-sm font-black"
            style={{ color: theme.accentColor }}
          >
            {game.metadata.mechanic === "ONE_AWAY"
              ? maskPrice(
                  entity.price,
                  (game.gameplay as OneAwayGameplay).hiddenIndex
                )
              : formatVND(entity.price)}
          </div>
          <div className="text-[8px] text-gray-500">{entity.brand}</div>
        </div>
      );

    case "question":
      return (
        <div className="text-center w-full">
          <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Câu hỏi</div>
          <div
            className="text-[10px] font-bold leading-tight text-gray-900 mb-3"
          >
            {game.content.question}
          </div>
          {game.metadata.mechanic === "HI_LO" && (
            <div className="flex gap-1.5">
              {(["CAO HƠN ⬆️", "THẤP HƠN ⬇️"]).map((c) => (
                <div
                  key={c}
                  className="flex-1 py-1.5 rounded-lg text-[8px] font-bold text-center"
                  style={{ backgroundColor: theme.accentColor + "20", color: theme.accentColor }}
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "countdown":
      return (
        <div className="text-center">
          <div className="text-5xl font-black" style={{ color: theme.accentColor }}>
            3
          </div>
          <div className="text-[8px] text-gray-600 mt-1">Đếm ngược!</div>
          <div className="flex gap-0.5 justify-center mt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: i === 0 ? theme.accentColor : theme.accentColor + "40" }}
              />
            ))}
          </div>
        </div>
      );

    case "reveal":
      return (
        <div className="text-center">
          <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Đáp án!</div>
          <div className="text-2xl mb-1">🎯</div>
          {game.metadata.mechanic === "ONE_AWAY" ? (
            <div className="text-lg font-black" style={{ color: theme.accentColor }}>
              {(game.gameplay as OneAwayGameplay).correctDigit}
            </div>
          ) : game.metadata.mechanic === "HI_LO" ? (
            <div className="text-xs font-bold" style={{ color: theme.accentColor }}>
              {(game.gameplay as HiLoGameplay).answer === "higher" ? "CAO HƠN ⬆️" : "THẤP HƠN ⬇️"}
            </div>
          ) : (
            <div className="text-[9px] font-bold text-gray-800 leading-tight">
              {game.entities.find((e) => e.productId === (game.gameplay as MostExpensiveGameplay).answer)?.name}
            </div>
          )}
          <div className="text-[8px] text-green-500 mt-1">✅ Chính xác!</div>
        </div>
      );

    case "result":
      return (
        <div className="text-center">
          {scene.variant === "comment" ? (
            <>
              <div className="text-2xl mb-1">💬</div>
              <div className="text-[9px] font-bold text-gray-800">
                Đáp án ở comment 👇
              </div>
              <div className="text-[8px] text-gray-600 mt-1">{game.content.cta}</div>
            </>
          ) : (
            <>
              <div className="text-2xl mb-1">🏆</div>
              <div className="text-[9px] font-bold" style={{ color: theme.accentColor }}>
                Bạn đoán đúng chưa?
              </div>
              <div
                className="mt-1.5 text-[8px] px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: theme.accentColor + "20", color: theme.accentColor }}
              >
                ✅ CÂU TRẢ LỜI ĐÚNG
              </div>
            </>
          )}
        </div>
      );

    case "cta":
      return (
        <div className="text-center">
          <div className="text-xl mb-1">🛒</div>
          <div className="text-[9px] font-bold text-gray-800 leading-tight mb-1">
            {game.content.cta}
          </div>
          <div
            className="text-[8px] px-2 py-1 rounded-full font-bold"
            style={{ backgroundColor: theme.accentColor, color: "white" }}
          >
            Mua ngay →
          </div>
        </div>
      );

    default:
      return null;
  }
}

function AnswerDisplay({ game, theme }: { game: GameJson; theme: ReturnType<typeof getGameTheme> }) {
  const m = game.metadata.mechanic;
  return (
    <div className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">
        Engine Answer (Deterministic)
      </div>
      {m === "HI_LO" && (
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {(game.gameplay as HiLoGameplay).answer === "higher" ? "⬆️" : "⬇️"}
          </span>
          <div>
            <div className="text-white font-bold text-sm">
              {(game.gameplay as HiLoGameplay).answer === "higher" ? "CAO HƠN" : "THẤP HƠN"}
            </div>
            <div className="text-gray-500 text-xs font-mono">
              {formatVND((game.gameplay as HiLoGameplay).priceA)} →{" "}
              {formatVND((game.gameplay as HiLoGameplay).priceB)}
            </div>
          </div>
        </div>
      )}
      {m === "MOST_EXPENSIVE" && (
        <div>
          <div className="text-yellow-400 font-bold text-sm">
            👑 {game.entities.find((e) => e.productId === (game.gameplay as MostExpensiveGameplay).answer)?.name}
          </div>
          <div className="text-gray-500 text-xs font-mono mt-0.5">
            {formatVND(game.entities.find((e) => e.productId === (game.gameplay as MostExpensiveGameplay).answer)?.price ?? 0)}
          </div>
        </div>
      )}
      {m === "ONE_AWAY" && (
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
            style={{ backgroundColor: theme.accentColor + "20", color: theme.accentColor }}
          >
            {(game.gameplay as OneAwayGameplay).correctDigit}
          </div>
          <div>
            <div className="text-white font-bold text-sm">
              Chữ số [{(game.gameplay as OneAwayGameplay).hiddenIndex}]
            </div>
            <div className="text-gray-500 text-xs font-mono">
              {maskPrice(
                (game.gameplay as OneAwayGameplay).price,
                (game.gameplay as OneAwayGameplay).hiddenIndex
              )} → {formatVND((game.gameplay as OneAwayGameplay).price)}
            </div>
            <div className="text-gray-600 text-xs mt-0.5">
              Lựa chọn: [{(game.gameplay as OneAwayGameplay).options.join(", ")}]
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineView({ game }: { game: GameJson }) {
  const total = game.timeline.totalDuration;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Timeline · {total.toFixed(1)}s total</span>
        <span className={total >= 15 && total <= 21 ? "text-green-400" : "text-red-400"}>
          {total >= 15 && total <= 21 ? "✅ 15-21s OK" : "❌ Out of range"}
        </span>
      </div>

      {/* Visual timeline */}
      <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
        {game.timeline.sceneTimings.map((s, i) => {
          const width = (s.duration / total) * 100;
          const colors = ["bg-blue-800", "bg-indigo-800", "bg-purple-800", "bg-red-800", "bg-orange-800", "bg-yellow-800", "bg-green-800"];
          return (
            <div
              key={i}
              className={`${colors[i % colors.length]} flex items-center justify-center overflow-hidden`}
              style={{ width: `${width}%` }}
              title={`${s.type}: ${s.duration}s`}
            >
              <span className="text-[9px] text-white/80 truncate px-0.5 font-medium">
                {s.type}
              </span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="space-y-1">
        {game.timeline.sceneTimings.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <div className="w-20 font-mono text-gray-400 capitalize">{s.type}</div>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${(s.duration / Math.max(...game.timeline.sceneTimings.map(t => t.duration))) * 100}%` }}
              />
            </div>
            <div className="font-mono text-gray-300 w-12 text-right">
              {formatDuration(s.duration)}
            </div>
            <div className="font-mono text-gray-600 w-20">
              {s.startAt.toFixed(1)}s → {s.endAt.toFixed(1)}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudioView({ game }: { game: GameJson }) {
  return (
    <div className="space-y-4">
      {/* Voice */}
      <div className="bg-gray-800/50 rounded-xl p-3">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Voice</div>
        <div className="text-sm text-white font-medium mb-1">
          🎤 {game.audio.voice.script}
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {game.audio.voice.wavPath} · {game.audio.voice.duration}s
        </div>
      </div>

      {/* Music */}
      <div className="bg-gray-800/50 rounded-xl p-3">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Music</div>
        <div className="flex items-center gap-2">
          <span className="text-xl">🎵</span>
          <div>
            <div className="text-sm text-white">{game.audio.music.track}</div>
            <div className="text-xs text-gray-500">volume={game.audio.music.volume} (LUFS -24, no vocal conflict)</div>
          </div>
        </div>
      </div>

      {/* SFX */}
      <div className="bg-gray-800/50 rounded-xl p-3">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">
          SFX Cues ({game.audio.sfx.length})
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {game.audio.sfx.map((sfx, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-indigo-400 w-10">{sfx.at.toFixed(1)}s</span>
              <span
                className={`px-1.5 py-0.5 rounded font-medium ${
                  sfx.type === "tick"
                    ? "bg-blue-900/50 text-blue-400"
                    : sfx.type === "reveal"
                    ? "bg-orange-900/50 text-orange-400"
                    : sfx.type === "correct"
                    ? "bg-green-900/50 text-green-400"
                    : sfx.type === "countdown"
                    ? "bg-red-900/50 text-red-400"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {sfx.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
