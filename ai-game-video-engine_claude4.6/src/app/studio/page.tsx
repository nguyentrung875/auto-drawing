"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { GameJson, Mechanic, ResultVariant, Product } from "@/types/game";
import { GamePreview } from "@/components/GamePreview";
import { ProductSelector } from "@/components/ProductSelector";

function StudioContent() {
  const searchParams = useSearchParams();
  const initialMechanic = (searchParams.get("mechanic") as Mechanic) || "HI_LO";

  const [mechanic, setMechanic] = useState<Mechanic>(initialMechanic);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 999999));
  const [resultVariant, setResultVariant] = useState<ResultVariant>("in_video");
  const [loading, setLoading] = useState(false);
  const [game, setGame] = useState<GameJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validatorErrors, setValidatorErrors] = useState<Array<{ code: string; field?: string; hint?: string }>>([]);
  const [planningMs, setPlanningMs] = useState<number>(0);

  const mechanicConfig = {
    HI_LO: { label: "Cao Hơn / Thấp Hơn", icon: "⬆️⬇️", min: 2, max: 2, color: "border-blue-500" },
    MOST_EXPENSIVE: { label: "Sản Phẩm Đắt Nhất", icon: "💎", min: 3, max: 4, color: "border-purple-500" },
    ONE_AWAY: { label: "Đoán Chữ Số", icon: "🔢", min: 1, max: 1, color: "border-green-500" },
  };

  const config = mechanicConfig[mechanic];

  const canRender =
    selectedProducts.length >= config.min &&
    selectedProducts.length <= config.max;

  function handleRandomSeed() {
    setSeed(Math.floor(Math.random() * 999999));
  }

  async function handleRender() {
    if (!canRender) return;
    setLoading(true);
    setError(null);
    setWarnings([]);
    setValidatorErrors([]);
    setGame(null);

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mechanic,
          productIds: selectedProducts.map((p) => p.productId),
          seed,
          resultVariant,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.validatorErrors) {
          setValidatorErrors(data.validatorErrors);
          setError("Validation failed — xem chi tiết bên dưới");
        } else {
          setError(data.hint || data.error || "Render failed");
        }
        return;
      }

      setGame(data.game);
      setWarnings(data.warnings || []);
      setPlanningMs(data.planningMs || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Home
            </Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-semibold">🎬 Game Studio</span>
          </div>
          <Link href="/games" className="text-gray-400 hover:text-white text-sm transition-colors">
            Xem tất cả Games →
          </Link>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left panel: Config */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Tạo Video Game</h1>
              <p className="text-gray-500 text-sm">
                Chọn mechanic, sản phẩm và seed — Engine tính đáp án deterministically.
              </p>
            </div>

            {/* Mechanic selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-3 block">
                Mechanic
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(mechanicConfig) as [Mechanic, typeof mechanicConfig.HI_LO][]).map(
                  ([m, cfg]) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMechanic(m);
                        setSelectedProducts([]);
                        setGame(null);
                        setError(null);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        mechanic === m
                          ? `${cfg.color} bg-gray-800 text-white`
                          : "border-gray-700 bg-gray-800/50 text-gray-400 hover:text-white hover:border-gray-600"
                      }`}
                    >
                      <div className="text-2xl mb-1">{cfg.icon}</div>
                      <div className="text-xs font-medium leading-tight">{cfg.label}</div>
                      <div className="text-xs font-mono text-gray-500 mt-0.5">{m}</div>
                    </button>
                  )
                )}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Cần chọn{" "}
                <span className="text-white font-medium">
                  {config.min === config.max ? config.min : `${config.min}-${config.max}`}
                </span>{" "}
                sản phẩm cho mechanic này.
              </div>
            </div>

            {/* Product Selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-3 block">
                Sản phẩm ({selectedProducts.length}/{config.max})
              </label>
              <ProductSelector
                maxProducts={config.max}
                minProducts={config.min}
                selected={selectedProducts}
                onSelect={setSelectedProducts}
                mechanic={mechanic}
              />
            </div>

            {/* Seed & Variant */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-2 block">
                  Seed (Reproducibility)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleRandomSeed}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                    title="Random seed"
                  >
                    🎲
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Cùng seed + products → cùng answer & timeline
                </p>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-2 block">
                  Result Variant
                </label>
                <div className="flex gap-2">
                  {(["in_video", "comment"] as ResultVariant[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setResultVariant(v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        resultVariant === v
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                      }`}
                    >
                      {v === "in_video" ? "📺 In Video" : "💬 Comment"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {resultVariant === "comment"
                    ? "Ẩn đáp án, hiện CTA 'Xem đáp án trong comment 👇'"
                    : "Hiện đáp án trong video + badge correct/wrong"}
                </p>
              </div>
            </div>

            {/* Render button */}
            <button
              onClick={handleRender}
              disabled={!canRender || loading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                canRender && !loading
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.01] shadow-lg shadow-indigo-900/40"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang tạo game...
                </span>
              ) : canRender ? (
                "🎬 Render Game JSON"
              ) : (
                `Chọn ${config.min === config.max ? config.min : `${config.min}-${config.max}`} sản phẩm`
              )}
            </button>

            {/* Errors */}
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
                <div className="text-red-400 font-medium text-sm mb-1">❌ {error}</div>
                {validatorErrors.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {validatorErrors.map((e, i) => (
                      <li key={i} className="text-xs text-red-300">
                        <span className="font-mono font-bold">{e.code}</span>
                        {e.field && <span className="text-red-400"> @ {e.field}</span>}
                        {e.hint && <span className="text-gray-400"> — {e.hint}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
                {warnings.map((w, i) => (
                  <div key={i} className="text-yellow-400 text-xs">
                    ⚠️ {w}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Preview */}
          <div>
            <div className="sticky top-20">
              {game ? (
                <GamePreview game={game} planningMs={planningMs} />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[500px] text-center">
                  <div className="text-6xl mb-4">🎮</div>
                  <h3 className="text-white font-semibold text-lg mb-2">Preview sẽ hiện ở đây</h3>
                  <p className="text-gray-500 text-sm max-w-xs">
                    Chọn mechanic + sản phẩm + bấm Render để xem Game JSON và preview video.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>}>
      <StudioContent />
    </Suspense>
  );
}
