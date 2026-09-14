"use client";

import { useState, useEffect, useRef } from "react";
import type {
  GameJson,
  HiLoGameplay,
  MostExpensiveGameplay,
  OneAwayGameplay,
  OddOneOutGameplay,
  GuessThePriceGameplay,
  GroceryBasketGameplay,
  DealOrScamGameplay,
} from "@/types/game";
import { maskPrice, formatVND, formatVNDShort, getGameTheme } from "@/lib/game-engine";

interface GamePreviewProps {
  game: GameJson;
  planningMs?: number;
}

function formatDuration(s: number) {
  return `${s.toFixed(1)}s`;
}

export function GamePreview({ game, planningMs }: GamePreviewProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "video" | "json" | "timeline" | "audio">("preview");
  const [copied, setCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{
    stage: string;
    message: string;
    percent: number;
  } | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<{
    url: string;
    filename: string;
    caption?: string;
    hashtags?: string[];
    renderMs?: number;
  } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const theme = getGameTheme(game.metadata.seed);
  const { mechanic, seed, resultVariant } = game.metadata;

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(game, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleStartRender() {
    if (isRendering) return;
    setIsRendering(true);
    setRenderError(null);
    setRenderProgress({ stage: "init", message: "Bắt đầu gửi lệnh render...", percent: 5 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.metadata.gameId,
          gameJson: game,
          mechanic: game.metadata.mechanic,
          seed: game.metadata.seed,
          resultVariant: game.metadata.resultVariant,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      if (!res.body) {
        throw new Error("Không thể đọc luồng dữ liệu phản hồi từ server");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);
              if (eventType === "progress") {
                setRenderProgress({
                  stage: parsed.stage || "render",
                  message: parsed.message || "Đang xử lý...",
                  percent: parsed.percent || 0,
                });
              } else if (eventType === "done") {
                setRenderedVideo({
                  url: parsed.videoUrl,
                  filename: parsed.videoFilename,
                  caption: parsed.caption,
                  hashtags: parsed.hashtags,
                  renderMs: parsed.renderMs,
                });
                setActiveTab("video");
                setIsRendering(false);
                setRenderProgress(null);
              } else if (eventType === "error") {
                setRenderError(parsed.error || "Render failed");
                setIsRendering(false);
                setRenderProgress(null);
              }
            } catch {
              // ignore partial chunk json parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setRenderError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsRendering(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancelRender() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRendering(false);
    setRenderProgress(null);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xs font-medium">✅ Game Ready</span>
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

        <div className="flex items-center gap-2">
          {/* Render MP4 Button */}
          {isRendering ? (
            <button
              type="button"
              disabled
              className="text-xs px-3.5 py-1.5 rounded-lg bg-indigo-950 border border-indigo-500/50 text-indigo-200 flex items-center gap-2 cursor-wait"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Đang render ({renderProgress?.percent ?? 0}%)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartRender}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold shadow-md shadow-indigo-950 transition-all hover:scale-105 flex items-center gap-1.5"
            >
              <span>🎬</span>
              <span>{renderedVideo ? "Render Lại MP4" : "Render MP4 Thật"}</span>
            </button>
          )}

          <button
            onClick={copyJson}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700"
          >
            {copied ? "✅ Copied!" : "Copy JSON"}
          </button>
        </div>
      </div>

      {/* Live Render Progress Banner */}
      {isRendering && renderProgress && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-sm space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              {renderProgress.message}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-indigo-400">{renderProgress.percent}%</span>
              <button
                type="button"
                onClick={handleCancelRender}
                className="px-2 py-0.5 rounded bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-300 text-xs border border-gray-700 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${renderProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Alert */}
      {renderError && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>Lỗi render: {renderError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRenderError(null)}
            className="text-gray-400 hover:text-white text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800 flex mt-2">
        {(["preview", "video", "json", "timeline", "audio"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-indigo-500 font-semibold"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "preview" && "🎮 Mô phỏng"}
            {tab === "video" && (
              <span className="flex items-center justify-center gap-1">
                <span>🎥 Video Thật</span>
                {renderedVideo && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </span>
            )}
            {tab === "json" && "📄 JSON"}
            {tab === "timeline" && "⏱️ Timeline"}
            {tab === "audio" && "🎵 Audio"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "preview" && (
          <VideoPreview game={game} theme={theme} />
        )}

        {activeTab === "video" && (
          renderedVideo ? (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* 9:16 Video Player mockup */}
              <div
                className="relative rounded-[36px] border-4 border-slate-700 overflow-hidden shadow-2xl ring-1 ring-slate-600/40 bg-black flex items-center justify-center"
                style={{ width: 280, height: 498 }}
              >
                <video
                  src={renderedVideo.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Video Action controls & Stats */}
              <div className="w-full max-w-sm flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <a
                    href={renderedVideo.url}
                    download={renderedVideo.filename}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>⬇️</span> Tải Video MP4
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + renderedVideo.url);
                      alert("Đã sao chép link video!");
                    }}
                    className="py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors border border-gray-700 flex items-center gap-1.5"
                  >
                    <span>🔗</span> Copy Link
                  </button>
                </div>

                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>Thời gian render:</span>
                    <span className="font-mono text-indigo-400 font-semibold">
                      {renderedVideo.renderMs ? `${(renderedVideo.renderMs / 1000).toFixed(1)}s` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>File MP4 xuất:</span>
                    <span className="font-mono text-gray-300 truncate max-w-[180px]">
                      {renderedVideo.filename}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="text-4xl">🎬</div>
              <h4 className="text-white font-semibold text-sm">Chưa có video MP4</h4>
              <p className="text-gray-500 text-xs max-w-xs leading-relaxed">
                Bấm nút &quot;Render MP4 Thật&quot; ở trên để chạy pipeline Core Engine xuất video 1080×1920 hoàn chỉnh kèm giọng đọc tiếng Việt.
              </p>
              <button
                type="button"
                onClick={handleStartRender}
                disabled={isRendering}
                className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-semibold shadow transition-all"
              >
                🎬 Bắt Đầu Render Ngay
              </button>
            </div>
          )
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
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scenes = game.scenes;
  const scene = scenes[currentScene] || scenes[0];
  const timings = game.timeline.sceneTimings;
  const totalDuration = game.timeline.totalDuration;
  const isMultiRound = totalDuration >= 30;

  function handleTimeSeek(t: number) {
    setCurrentTime(t);
    const foundIdx = timings.findIndex((s) => t >= s.startAt && t < s.endAt);
    if (foundIdx !== -1) {
      setCurrentScene(foundIdx);
    } else if (t >= totalDuration) {
      setCurrentScene(scenes.length - 1);
    }
  }

  function handleSelectScene(idx: number) {
    setCurrentScene(idx);
    const sTiming = timings[idx];
    if (sTiming) {
      setCurrentTime(sTiming.startAt);
    }
  }

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = Math.round((prev + 0.1) * 10) / 10;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          const foundIdx = timings.findIndex((s) => next >= s.startAt && next < s.endAt);
          if (foundIdx !== -1) setCurrentScene(foundIdx);
          return next;
        });
      }, 100);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, totalDuration, timings]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone mockup */}
      <div
        className="relative rounded-[36px] border-4 border-slate-700 overflow-hidden shadow-2xl ring-1 ring-slate-600/40"
        style={{ width: 280, height: 498, background: "radial-gradient(circle at 50% 20%, #172033 0%, #080c16 80%, #020617 100%)" }}
      >
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black/40 flex items-center justify-between px-4 z-20">
          <span className="text-[9px] text-white/80 font-medium">9:41</span>
          <span className="text-[9px] text-white/80">●●●</span>
        </div>

        {/* Scene content */}
        <div
          className="absolute inset-0 pt-6 pb-2 px-3 flex flex-col justify-between z-10"
          style={{ transform: `rotate(${theme.tiltDeg * 0.2}deg)` }}
        >
          <SceneRenderer
            scene={scene}
            game={game}
            theme={theme}
            currentTime={currentTime}
            isMultiRound={isMultiRound}
          />
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 z-20">
          <div
            className="h-full bg-amber-400/80 transition-all duration-300"
            style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : ((currentScene + 1) / scenes.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (currentTime >= totalDuration) setCurrentTime(0);
                setIsPlaying(!isPlaying);
              }}
              className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors flex items-center gap-1"
            >
              {isPlaying ? "⏸ Tạm dừng" : "▶ Play"}
            </button>
            <span className="font-mono text-white text-xs">
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isMultiRound && (
              <span className="text-[10px] font-bold bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700/40">
                ⭐ 38s Multi-Round
              </span>
            )}
            <span className="capitalize text-gray-300 font-mono text-[11px] bg-gray-700/80 px-2 py-0.5 rounded">
              Scene: {scene.type}
            </span>
          </div>
        </div>

        {/* Scrubber slider */}
        <div className="relative pt-1 pb-1">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleTimeSeek(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Multi-round timeline markers */}
        {isMultiRound && (
          <div className="grid grid-cols-5 gap-1 text-[9px] text-center font-mono">
            <button
              type="button"
              onClick={() => handleTimeSeek(0)}
              className="p-1 rounded bg-blue-900/40 text-blue-300 border border-blue-700/40 hover:bg-blue-900/60 truncate"
            >
              Hook (0s)
            </button>
            <button
              type="button"
              onClick={() => handleTimeSeek(3)}
              className="p-1 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/40 hover:bg-indigo-900/60 truncate"
            >
              R1 Conf (3s)
            </button>
            <button
              type="button"
              onClick={() => handleTimeSeek(13.5)}
              className="p-1 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40 hover:bg-purple-900/60 truncate"
            >
              R2 Tens (14s)
            </button>
            <button
              type="button"
              onClick={() => handleTimeSeek(25)}
              className="p-1 rounded bg-rose-900/40 text-rose-300 border border-rose-700/40 hover:bg-rose-900/60 truncate"
            >
              R3 WTF (25s)
            </button>
            <button
              type="button"
              onClick={() => handleTimeSeek(33)}
              className="p-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 hover:bg-emerald-900/60 truncate"
            >
              Outro (33s)
            </button>
          </div>
        )}
      </div>

      {/* Scene nav */}
      <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1">
        {scenes.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSelectScene(i)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs transition-all flex-shrink-0 ${
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
      <div className={`w-full grid ${game.metadata.mechanic === "GROCERY_BASKET" ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
        {game.entities.map((e, i) => (
          <div key={e.productId} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1 font-mono flex items-center justify-between">
              <span>{e.productId}</span>
              {game.metadata.mechanic === "MOST_EXPENSIVE" &&
                (game.gameplay as MostExpensiveGameplay).answer === e.productId && (
                  <span className="text-yellow-400">👑</span>
                )}
              {game.metadata.mechanic === "DEAL_OR_SCAM" && (
                <span className="text-[10px] bg-rose-900/60 text-rose-300 px-1 rounded font-bold">
                  -{(game.gameplay as DealOrScamGameplay).discountPercent}%
                </span>
              )}
            </div>
            <div className="text-white text-xs font-medium leading-tight line-clamp-2 mb-1.5">
              {e.name}
            </div>
            {game.metadata.mechanic === "DEAL_OR_SCAM" && (
              <div className="text-[10px] text-gray-500 line-through">
                {formatVND((game.gameplay as DealOrScamGameplay).originalPrice || 0)}
              </div>
            )}
            <div
              className="text-sm font-black"
              style={{ color: theme.accentColor }}
            >
              {formatVND(e.price)}
            </div>
            <div className="text-gray-600 text-xs truncate">{e.brand}</div>
          </div>
        ))}
      </div>

      {/* Answer display */}
      <AnswerDisplay game={game} theme={theme} />
    </div>
  );
}

function getChoicesForGame(game: GameJson): {
  choices: Array<{ id: string; label: string; isCorrect: boolean }>;
  revealAnswerText: string;
} {
  const m = game.metadata.mechanic;
  if (m === "HI_LO") {
    const gp = game.gameplay as HiLoGameplay;
    const isHigher = gp.answer === "higher";
    return {
      choices: [
        { id: "A", label: "CAO HƠN ⬆️", isCorrect: isHigher },
        { id: "B", label: "THẤP HƠN ⬇️", isCorrect: !isHigher },
      ],
      revealAnswerText: isHigher ? `CAO HƠN! Giá thật: ${formatVND(gp.priceB)}` : `THẤP HƠN! Giá thật: ${formatVND(gp.priceB)}`,
    };
  }
  if (m === "DEAL_OR_SCAM") {
    const gp = game.gameplay as DealOrScamGameplay;
    const isDeal = gp.answer === "deal";
    return {
      choices: [
        { id: "A", label: "DEAL HỜI 🔥", isCorrect: isDeal },
        { id: "B", label: "BẪY SCAM ⚠️", isCorrect: !isDeal },
      ],
      revealAnswerText: isDeal ? "DEAL HỜI! Sale chính hãng!" : "BẪY SCAM! Shop ảo clone hàng",
    };
  }
  if (m === "GROCERY_BASKET") {
    const gp = game.gameplay as GroceryBasketGameplay;
    const isUnder = gp.answer === "under";
    return {
      choices: [
        { id: "A", label: "ĐỦ TIỀN 🛍️", isCorrect: isUnder },
        { id: "B", label: "CHÁY TÚI 💸", isCorrect: !isUnder },
      ],
      revealAnswerText: isUnder ? `ĐỦ TIỀN! Tổng hoá đơn: ${formatVND(gp.totalBill || 0)}` : `CHÁY TÚI! Vượt ngân sách!`,
    };
  }
  if (m === "GUESS_THE_PRICE") {
    const gp = game.gameplay as GuessThePriceGameplay;
    const rawChoices = (gp.choices || game.content.choices || []) as Array<unknown>;
    const choices = rawChoices.map((c: any, i) => {
      const letter = typeof c === 'object' && c && 'id' in c ? String(c.id) : String.fromCharCode(65 + i);
      const label = typeof c === 'object' && c && 'label' in c ? String(c.label) : String(c);
      const isCorrect = gp.answer === letter || gp.answer === label;
      return { id: letter, label, isCorrect };
    });
    return {
      choices: choices.length > 0 ? choices : [
        { id: "A", label: "Khoảng A", isCorrect: false },
        { id: "B", label: "Khoảng B", isCorrect: true },
      ],
      revealAnswerText: `Đáp án [${gp.answer}]! Giá thật: ${formatVND(game.entities[0]?.price || 0)}`,
    };
  }
  if (m === "ONE_AWAY") {
    const gp = game.gameplay as OneAwayGameplay;
    const choices = (gp.options || [gp.correctDigit, (gp.correctDigit + 1) % 10]).map((opt, i) => ({
      id: String.fromCharCode(65 + i),
      label: `Số ${opt}`,
      isCorrect: opt === gp.correctDigit,
    }));
    return {
      choices,
      revealAnswerText: `Chữ số đúng: ${gp.correctDigit}! Giá: ${formatVND(gp.price)}`,
    };
  }
  if (m === "MOST_EXPENSIVE") {
    const gp = game.gameplay as MostExpensiveGameplay;
    const choices = game.entities.slice(0, 4).map((e, i) => ({
      id: String.fromCharCode(65 + i),
      label: e.name.slice(0, 14),
      isCorrect: e.productId === gp.answer,
    }));
    const winner = game.entities.find((e) => e.productId === gp.answer);
    return {
      choices,
      revealAnswerText: `Đắt nhất: ${winner?.name || gp.answer} (${formatVND(winner?.price || 0)})`,
    };
  }
  if (m === "ODD_ONE_OUT") {
    const gp = game.gameplay as OddOneOutGameplay;
    const choices = game.entities.slice(0, 4).map((e, i) => ({
      id: String.fromCharCode(65 + i),
      label: e.name.slice(0, 14),
      isCorrect: e.productId === gp.answer,
    }));
    const odd = game.entities.find((e) => e.productId === gp.answer);
    return {
      choices,
      revealAnswerText: `Khác biệt: ${odd?.name || gp.answer}`,
    };
  }

  // Fallback
  return {
    choices: [
      { id: "A", label: "Lựa chọn A", isCorrect: true },
      { id: "B", label: "Lựa chọn B", isCorrect: false },
    ],
    revealAnswerText: "Đáp án A!",
  };
}

function SceneRenderer({
  scene,
  game,
  theme,
  currentTime = 0,
  isMultiRound = false,
}: {
  scene: GameJson["scenes"][0];
  game: GameJson;
  theme: ReturnType<typeof getGameTheme>;
  currentTime?: number;
  isMultiRound?: boolean;
}) {
  const entity = game.entities[0];

  if (scene.type === "hook") {
    return (
      <div className="text-center w-full flex flex-col items-center justify-center h-full px-2">
        <div className="px-2.5 py-1 rounded-full bg-slate-800 border border-amber-500/40 text-[9px] font-black text-amber-400 mb-3 shadow">
          🔥 THỬ THÁCH 5 GIÂY
        </div>
        <div className="text-4xl mb-3 animate-bounce">⚡</div>
        <h2 className="text-xs font-black text-center leading-snug text-white max-w-[240px]">
          {game.content.hook}
        </h2>
        <p className="mt-2 text-[10px] text-amber-400 font-bold">
          {game.content.title}
        </p>
        <div className="mt-4 text-[9px] text-slate-500 font-mono">
          HOOK · {scene.duration}s
        </div>
      </div>
    );
  }

  if (scene.type === "cta") {
    return (
      <div className="text-center w-full flex flex-col items-center justify-center h-full px-2">
        <div className="text-3xl mb-2">⭐ ⭐ ⭐</div>
        <h3 className="text-sm font-black text-white uppercase tracking-wide mb-1">
          BẠN ĐÚNG MẤY CÂU?
        </h3>
        <p className="text-[10px] text-slate-300 mb-4">
          {game.content.cta || "Ai đoán trúng giơ tay!"}
        </p>
        <div className="px-3 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-lg">
          Bình luận đáp án phía dưới! 👇
        </div>
      </div>
    );
  }

  // All-In-One Cyberpunk Neon View for product, question, countdown, reveal, result
  const { choices, revealAnswerText } = getChoicesForGame(game);
  const isReveal = scene.type === "reveal" || scene.type === "result";

  // Calculate countdown remaining seconds
  const countdownTiming = game.timeline.sceneTimings.find((s) => s.type === "countdown");
  const countdownDuration = countdownTiming ? countdownTiming.duration : 3.0;
  let remainingSeconds = 0;
  let countdownPercent = 0;

  if (countdownTiming) {
    if (currentTime < countdownTiming.startAt) {
      remainingSeconds = countdownDuration;
      countdownPercent = 100;
    } else if (currentTime >= countdownTiming.endAt) {
      remainingSeconds = 0;
      countdownPercent = 0;
    } else {
      remainingSeconds = Math.max(0, countdownTiming.endAt - currentTime);
      countdownPercent = Math.max(0, Math.min(100, (remainingSeconds / countdownDuration) * 100));
    }
  } else {
    remainingSeconds = isReveal ? 0 : 3.0;
    countdownPercent = isReveal ? 0 : 100;
  }

  return (
    <div className="w-full h-full flex flex-col justify-between py-1">
      {/* 1. HUD */}
      <div className="flex items-center justify-between">
        <div className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-amber-500/40 text-[9px] font-black text-amber-400">
          🔥 TẬP #{(game.metadata.seed % 99) + 1}
        </div>
        <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
          <span className="text-[8px] font-bold text-white/90 mr-0.5">
            {isMultiRound ? `CÂU 1/3` : `5 GIÂY`}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
        </div>
        <div className="px-1.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-600/50 text-[9px] font-bold text-rose-300">
          {game.metadata.resultVariant === "comment" ? "💬 Comment" : "📺 Video"}
        </div>
      </div>

      {/* 2. Question Box */}
      <div className="mt-1.5 p-2 rounded-xl bg-slate-900/90 border-2 border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.3)] text-center">
        <span className="text-[8px] uppercase tracking-widest text-amber-400 font-extrabold block">
          THỬ THÁCH GIÁ ĐÚNG
        </span>
        <h3 className="text-[11px] font-black text-white leading-snug">
          {game.content.question}
        </h3>
      </div>

      {/* 3. Hero Product Showcase */}
      <div className="my-auto w-full bg-slate-900/85 border border-slate-700/80 rounded-xl p-2 flex flex-col items-center relative overflow-hidden">
        {game.metadata.mechanic === "GROCERY_BASKET" ? (
          <div className="w-full text-center">
            <div className="text-[8px] font-bold text-amber-400 mb-1">🛒 COMBO 3 MÓN</div>
            <div className="grid grid-cols-3 gap-1 my-1">
              {game.entities.slice(0, 3).map((e, idx) => (
                <div key={idx} className="p-1 rounded bg-black/40 border border-white/10 flex flex-col items-center">
                  <div className="text-base">📦</div>
                  <div className="text-[7px] font-bold text-white truncate max-w-full">{e.name}</div>
                  <div className="text-[8px] font-black text-indigo-300">{formatVNDShort(e.price)}</div>
                </div>
              ))}
            </div>
            <div className="text-[8px] font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded inline-block mt-0.5">
              Ngân sách: {formatVND((game.gameplay as GroceryBasketGameplay).budget || 300000)}
            </div>
          </div>
        ) : game.metadata.mechanic === "DEAL_OR_SCAM" ? (
          <div className="w-full text-center">
            <div className="inline-block bg-rose-600 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full mb-1">
              🔥 SALE -{(game.gameplay as DealOrScamGameplay).discountPercent ?? 85}%
            </div>
            <div className="w-14 h-14 rounded-lg bg-slate-950 mx-auto flex items-center justify-center text-3xl mb-1 border border-slate-700">
              🏷️
            </div>
            <div className="text-[10px] font-bold text-white truncate px-1">{entity.name}</div>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-[8px] text-gray-500 line-through">
                {formatVND((game.gameplay as DealOrScamGameplay).originalPrice || 0)}
              </span>
              <span className="text-xs font-black text-amber-400 font-mono">
                {formatVND((game.gameplay as DealOrScamGameplay).salePrice || entity.price)}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full text-center">
            <div className="w-full h-20 rounded-lg bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700/60 flex items-center justify-center relative">
              <div className="text-3xl">📦</div>
              <span className="absolute bottom-1 right-1 text-[7px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-slate-300">
                {entity.brand || "CHÍNH HÃNG"}
              </span>
            </div>
            <div className="text-[10px] font-bold text-white truncate mt-1 px-1">{entity.name}</div>
            <div className="text-xs font-black text-amber-400 font-mono mt-0.5">
              {game.metadata.mechanic === "ONE_AWAY"
                ? (isReveal ? `Giá thật: ${formatVND(entity.price)}` : maskPrice(entity.price, (game.gameplay as OneAwayGameplay).hiddenIndex))
                : game.metadata.mechanic === "HI_LO"
                ? `Mốc so sánh: ${formatVND((game.gameplay as HiLoGameplay).priceA || entity.price)}`
                : (isReveal ? `Giá thật: ${formatVND(entity.price)}` : "Giá: ???")}
            </div>
          </div>
        )}
      </div>

      {/* 4. Action Deck & Timer */}
      <div className="mt-auto space-y-1.5">
        <div className={`grid gap-1.5 ${choices.length > 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {choices.map((c) => {
            let btnCls = "py-2 px-1 rounded-lg text-white font-black text-[10px] shadow transition-all flex items-center justify-center gap-1 border ";
            if (isReveal) {
              if (c.isCorrect) {
                btnCls += "bg-emerald-950 border-emerald-400 text-emerald-300 scale-[1.02] shadow-[0_0_12px_rgba(34,197,94,0.5)]";
              } else {
                btnCls += "bg-slate-900/60 border-slate-800 text-slate-600 opacity-40 line-through";
              }
            } else {
              btnCls += "bg-gradient-to-b from-slate-800 to-slate-900 border-indigo-500/50 hover:border-indigo-400";
            }
            return (
              <div key={c.id} className={btnCls}>
                <span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-[8px] flex items-center justify-center font-mono">
                  {c.id}
                </span>
                <span className="truncate">{c.label}</span>
              </div>
            );
          })}
        </div>

        {/* 5. Pill Countdown Bar */}
        <div className="space-y-0.5">
          <div className="relative w-full h-2.5 bg-slate-950 rounded-full border border-slate-700 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-100 ease-linear"
              style={{ width: isReveal ? "0%" : `${countdownPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono px-0.5">
            <span className="text-slate-400">⏱️ CÒN:</span>
            <span className="font-black text-amber-400">
              {isReveal ? "HẾT GIỜ!" : `${remainingSeconds.toFixed(1)}s`}
            </span>
          </div>
        </div>

        {/* 6. Reveal Banner */}
        {isReveal && (
          <div className="p-1 rounded-lg bg-emerald-950/90 border border-emerald-500 text-center animate-bounce shadow">
            <span className="text-[7px] font-bold uppercase text-emerald-400 block">KẾT QUẢ</span>
            <span className="text-[9px] font-extrabold text-white truncate block">
              🎉 {revealAnswerText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
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
      {m === "ODD_ONE_OUT" && (
        <div>
          <div className="text-amber-400 font-bold text-sm">
            🔍 {game.entities.find((e) => e.productId === (game.gameplay as OddOneOutGameplay).answer)?.name}
          </div>
          <div className="text-gray-500 text-xs mt-0.5">
            {(game.gameplay as OddOneOutGameplay).reason ?? "Kẻ lạ trong bầy"}
          </div>
        </div>
      )}
      {m === "GUESS_THE_PRICE" && (
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
            style={{ backgroundColor: theme.accentColor + "20", color: theme.accentColor }}
          >
            {(game.gameplay as GuessThePriceGameplay).answer}
          </div>
          <div>
            <div className="text-white font-bold text-sm">
              Đáp án: Lựa chọn [{(game.gameplay as GuessThePriceGameplay).answer}]
            </div>
            <div className="text-gray-500 text-xs font-mono">
              Giá niêm yết: {formatVND((game.gameplay as GuessThePriceGameplay).price)}
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              {(game.gameplay as GuessThePriceGameplay).choices?.join(" | ")}
            </div>
          </div>
        </div>
      )}
      {m === "GROCERY_BASKET" && (
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {(game.gameplay as GroceryBasketGameplay).answer === "under" ? "🛍️" : "💸"}
          </span>
          <div>
            <div className="text-white font-bold text-sm">
              {(game.gameplay as GroceryBasketGameplay).answer === "under"
                ? "ĐỦ TIỀN (DƯỚI BUDGET)"
                : "CHÁY TÚI (VƯỢT BUDGET)"}
            </div>
            <div className="text-gray-500 text-xs font-mono">
              Tổng bill: {formatVND((game.gameplay as GroceryBasketGameplay).totalBill || 0)} · Ngân sách:{" "}
              {formatVND((game.gameplay as GroceryBasketGameplay).budget || 300000)}
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              {(game.gameplay as GroceryBasketGameplay).choices?.join(" | ")}
            </div>
          </div>
        </div>
      )}
      {m === "DEAL_OR_SCAM" && (
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {(game.gameplay as DealOrScamGameplay).answer === "deal" ? "🔥" : "⚠️"}
          </span>
          <div>
            <div className="text-white font-bold text-sm">
              {(game.gameplay as DealOrScamGameplay).answer === "deal"
                ? "DEAL HỜI MÚC NGAY"
                : "BẪY SALE ẢO / SCAM"}
            </div>
            <div className="text-gray-500 text-xs font-mono">
              Gốc: {formatVND((game.gameplay as DealOrScamGameplay).originalPrice || 0)} → Sale:{" "}
              {formatVND((game.gameplay as DealOrScamGameplay).salePrice || 0)} (-{(game.gameplay as DealOrScamGameplay).discountPercent}%)
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              {(game.gameplay as DealOrScamGameplay).choices?.join(" | ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineView({ game }: { game: GameJson }) {
  const total = game.timeline.totalDuration;
  const isStandard = total >= 14.5 && total <= 21.5;
  const isMultiRound = total >= 35.0 && total <= 42.0;
  const isValidDuration = isStandard || isMultiRound;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Timeline · {total.toFixed(1)}s total</span>
        <span className={isValidDuration ? "text-green-400" : "text-red-400"}>
          {isMultiRound
            ? `✅ ${total.toFixed(1)}s Multi-Round Show OK`
            : isStandard
            ? "✅ 15-21s OK"
            : "❌ Out of range"}
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
