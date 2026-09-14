"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameJson } from "@/types/game";

interface UnifiedViewportProps {
  game: GameJson;
  currentTime: number;
  isPlaying?: boolean;
  totalDuration?: number;
  className?: string;
  onOpenFullscreen?: () => void;
}

export function UnifiedViewport({
  game,
  currentTime,
  onOpenFullscreen,
}: UnifiedViewportProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync seek frame into iframe
  const syncFrame = useCallback((time: number) => {
    try {
      const win = iframeRef.current?.contentWindow as any;
      if (win && typeof win.__SEEK_FRAME__ === "function") {
        win.__SEEK_FRAME__(0, time);
      }
    } catch {
      // ignore cross-origin or unready iframe calls
    }

    try {
      const fsWin = fullscreenIframeRef.current?.contentWindow as any;
      if (fsWin && typeof fsWin.__SEEK_FRAME__ === "function") {
        fsWin.__SEEK_FRAME__(0, time);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch identical 1080x1920 HTML template from server
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setIsIframeReady(false);

    fetch("/api/preview/html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => {
        if (active) {
          setHtmlContent(html);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Lỗi tải template preview");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [game]);

  // Sync frame on time seek
  useEffect(() => {
    if (isIframeReady) {
      syncFrame(currentTime);
    }
  }, [currentTime, isIframeReady, syncFrame]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Top action: WYSIWYG badge + Fullscreen inspect */}
      <div className="w-full flex justify-between items-center max-w-[280px] px-1">
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>100% WYSIWYG Template</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowFullscreen(true);
            onOpenFullscreen?.();
          }}
          className="text-[11px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
          title="Phóng to để soi chi tiết từng pixel chuẩn 1080×1920"
        >
          <span>⛶</span> Soi chi tiết
        </button>
      </div>

      {/* 9:16 Phone mockup */}
      <div
        className="relative rounded-[36px] border-4 border-slate-700 overflow-hidden shadow-2xl ring-1 ring-slate-600/40 bg-black flex items-center justify-center"
        style={{ width: 280, height: 498 }}
      >
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black/40 flex items-center justify-between px-4 z-20 pointer-events-none">
          <span className="text-[9px] text-white/80 font-medium">9:41</span>
          <span className="text-[9px] text-white/80">●●●</span>
        </div>

        {/* Scaled iframe containing exact video template */}
        {htmlContent && (
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            sandbox="allow-scripts"
            onLoad={() => {
              setIsIframeReady(true);
              syncFrame(currentTime);
            }}
            className="absolute top-0 left-0 border-0 pointer-events-none select-none"
            style={{
              width: 1080,
              height: 1920,
              transform: "scale(0.259259)",
              transformOrigin: "top left",
            }}
          />
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-30">
            <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-[10px] text-indigo-300">Đang dựng Preview 1080×1920...</span>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-red-950/90 text-center z-30">
            <span className="text-xl mb-1">⚠️</span>
            <span className="text-xs text-red-200 font-semibold">{error}</span>
          </div>
        )}
      </div>

      {/* Fullscreen modal for detailed pixel inspection */}
      {showFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[450px] flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-xs font-semibold">🔍 Soi chi tiết 1080×1920</span>
              <span className="text-[11px] text-gray-400 font-mono">
                Frame {Math.round(currentTime * 60)} ({currentTime.toFixed(2)}s)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowFullscreen(false)}
              className="text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            >
              ✕ Đóng
            </button>
          </div>

          {/* Large phone frame */}
          <div
            className="relative rounded-[40px] border-4 border-slate-700 overflow-hidden shadow-2xl ring-1 ring-slate-600/40 bg-black flex items-center justify-center"
            style={{ width: 450, height: 800 }}
          >
            {htmlContent && (
              <iframe
                ref={fullscreenIframeRef}
                srcDoc={htmlContent}
                sandbox="allow-scripts"
                onLoad={() => {
                  syncFrame(currentTime);
                }}
                className="absolute top-0 left-0 border-0 pointer-events-none select-none"
                style={{
                  width: 1080,
                  height: 1920,
                  transform: `scale(${450 / 1080})`,
                  transformOrigin: "top left",
                }}
              />
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500 text-center">
            Hiển thị template render chuẩn 1080×1920 gốc dùng cho Puppeteer MP4 render.
          </p>
        </div>
      )}
    </div>
  );
}
