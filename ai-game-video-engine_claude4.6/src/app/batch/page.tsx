"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Mechanic, ResultVariant, BatchJobReport } from "@/types/game";

interface BatchResult {
  batchId: string;
  total: number;
  passed: number;
  failed: number;
  avgRenderMs: number;
  batchTotalMs: number;
  manualInterventions: number;
  jobs: BatchJobReport[];
}

interface BatchRecord {
  batchId: string;
  total: number;
  passed: number;
  failed: number;
  avgRenderMs: number | null;
  status: string;
  createdAt: string;
}

export default function BatchPage() {
  const [count, setCount] = useState(10);
  const [mechanics, setMechanics] = useState<Mechanic[]>(["HI_LO", "MOST_EXPENSIVE", "ONE_AWAY"]);
  const [resultVariant, setResultVariant] = useState<ResultVariant>("in_video");
  const [seed, setSeed] = useState<number | "auto">("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    fetch("/api/batch")
      .then((r) => r.json())
      .then((data) => {
        setBatches(data.batches || []);
        setLoadingBatches(false);
      })
      .catch(() => setLoadingBatches(false));
  }, [result]);

  function toggleMechanic(m: Mechanic) {
    if (mechanics.includes(m)) {
      if (mechanics.length > 1) {
        setMechanics(mechanics.filter((x) => x !== m));
      }
    } else {
      setMechanics([...mechanics, m]);
    }
  }

  async function handleBatch() {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 90));
    }, 400);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          mechanics,
          seed: seed === "auto" ? undefined : seed,
          resultVariant,
        }),
      });

      const data = await res.json();
      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        setError(data.error || "Batch failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  }

  const successRate = result
    ? Math.round((result.passed / result.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-semibold">⚡ Batch Engine</span>
          </div>
          <div className="text-gray-500 text-xs font-mono">Hermes-ready · CLI: game batch</div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Config */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Batch Processing</h1>
              <p className="text-gray-500 text-sm">
                Enqueue nhiều jobs, tự retry, ghi batch_report.json — interface headless cho Hermes.
              </p>
            </div>

            {/* Batch size */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-3 block">
                Số lượng video (1-50)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <div className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-center font-mono font-bold">
                  {count}
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Ước tính: ~{Math.ceil(count * 0.5)}s · {count} MP4 + caption.json
              </div>
            </div>

            {/* Mechanics */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-3 block">
                Mechanics (phân phối round-robin)
              </label>
              <div className="flex gap-2">
                {(["HI_LO", "MOST_EXPENSIVE", "ONE_AWAY"] as Mechanic[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMechanic(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border ${
                      mechanics.includes(m)
                        ? "bg-indigo-600/30 border-indigo-500/50 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <div>
                      {m === "HI_LO" ? "⬆️⬇️" : m === "MOST_EXPENSIVE" ? "💎" : "🔢"}
                    </div>
                    <div className="mt-0.5">{m}</div>
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Phân bổ: {mechanics.length > 0 && count > 0
                  ? mechanics.map((m, i) => `${m}: ${Math.ceil(count / mechanics.length)} (~)`).join(", ")
                  : "—"}
              </div>
            </div>

            {/* Options */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-2 block">
                  Batch Seed
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSeed("auto")}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      seed === "auto"
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    🎲 Auto
                  </button>
                  <input
                    type="number"
                    placeholder="Custom seed..."
                    value={seed === "auto" ? "" : seed}
                    onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : "auto")}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                  />
                </div>
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
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={handleBatch}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                !loading
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.01] shadow-lg shadow-indigo-900/40"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang xử lý batch...
                  </div>
                  <div className="text-sm font-normal text-gray-400">
                    {progress}% hoàn thành
                  </div>
                </div>
              ) : (
                `⚡ Chạy Batch ${count} Video`
              )}
            </button>

            {/* Progress bar */}
            {loading && (
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-400 text-sm">
                ❌ {error}
              </div>
            )}
          </div>

          {/* Result */}
          <div>
            {result ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white text-lg">📊 Batch Report</h2>
                    <span className="text-xs font-mono text-gray-500">{result.batchId}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                      <div className="text-3xl font-black text-green-400">{result.passed}</div>
                      <div className="text-gray-500 text-xs mt-1">Thành công</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                      <div className="text-3xl font-black text-red-400">{result.failed}</div>
                      <div className="text-gray-500 text-xs mt-1">Thất bại</div>
                    </div>
                  </div>

                  {/* Success rate bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Tỷ lệ thành công</span>
                      <span className={successRate >= 98 ? "text-green-400 font-bold" : "text-yellow-400"}>
                        {successRate}% {successRate >= 98 ? "✅ SM-1 Pass" : "⚠️ < 98%"}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          successRate >= 98 ? "bg-green-500" : "bg-yellow-500"
                        }`}
                        style={{ width: `${successRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-white font-bold text-sm">{result.avgRenderMs}ms</div>
                      <div className="text-gray-600 text-xs">Avg render</div>
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{(result.batchTotalMs / 1000).toFixed(1)}s</div>
                      <div className="text-gray-600 text-xs">Total time</div>
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${result.manualInterventions === 0 ? "text-green-400" : "text-red-400"}`}>
                        {result.manualInterventions}
                      </div>
                      <div className="text-gray-600 text-xs">Manual ops (SM-3)</div>
                    </div>
                  </div>
                </div>

                {/* Job list */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="font-semibold text-white text-sm mb-3">Jobs ({result.jobs.length})</h3>
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {result.jobs.map((job, i) => (
                      <div
                        key={job.jobId}
                        className={`flex items-center gap-3 p-2 rounded-lg text-xs ${
                          job.status === "done"
                            ? "bg-green-900/10 border border-green-800/20"
                            : "bg-red-900/10 border border-red-800/20"
                        }`}
                      >
                        <span className={job.status === "done" ? "text-green-400" : "text-red-400"}>
                          {job.status === "done" ? "✅" : "❌"}
                        </span>
                        <span className="font-mono text-gray-500 w-5">{i + 1}</span>
                        <span className="text-gray-400 font-mono text-[10px]">{job.gameId}</span>
                        <span className="text-gray-500">{job.mechanic}</span>
                        <span className="text-gray-600 flex-1 truncate">
                          {job.productIds.join(", ")}
                        </span>
                        {job.renderMs && (
                          <span className="text-gray-600 font-mono">{job.renderMs}ms</span>
                        )}
                        {job.errorMessage && (
                          <span className="text-red-400 text-[10px] truncate max-w-24" title={job.errorMessage}>
                            {job.errorMessage}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Success metrics */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="font-semibold text-white text-sm mb-3">📈 Success Metrics</h3>
                  <div className="space-y-2">
                    {[
                      {
                        id: "SM-1",
                        name: "Render success ≥98%",
                        value: `${successRate}%`,
                        pass: successRate >= 98,
                      },
                      {
                        id: "SM-3",
                        name: "Manual interventions = 0",
                        value: result.manualInterventions,
                        pass: result.manualInterventions === 0,
                      },
                      {
                        id: "NFR-3",
                        name: "Avg render ≤45s",
                        value: `${result.avgRenderMs}ms`,
                        pass: result.avgRenderMs <= 45000,
                      },
                      {
                        id: "SM-C2",
                        name: "Distinct products ≥20",
                        value: new Set(result.jobs.flatMap((j) => j.productIds)).size,
                        pass: new Set(result.jobs.flatMap((j) => j.productIds)).size >= 20,
                      },
                    ].map((metric) => (
                      <div key={metric.id} className="flex items-center gap-2 text-xs">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            metric.pass ? "bg-green-400" : "bg-red-400"
                          }`}
                        />
                        <span className="text-gray-500 font-mono">{metric.id}</span>
                        <span className="text-gray-400 flex-1">{metric.name}</span>
                        <span
                          className={`font-bold ${metric.pass ? "text-green-400" : "text-red-400"}`}
                        >
                          {String(metric.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="text-5xl mb-4">⚡</div>
                <h3 className="text-white font-semibold text-lg mb-2">Sẵn sàng chạy batch</h3>
                <p className="text-gray-500 text-sm max-w-xs">
                  Cấu hình và bấm "Chạy Batch" để xử lý nhiều video cùng lúc.
                  Hermes gọi qua queue/*.json file-based.
                </p>
                <div className="mt-6 text-left bg-gray-800/50 rounded-xl p-4 font-mono text-xs text-gray-400">
                  <div className="text-green-400">$ game batch \</div>
                  <div className="pl-4">--count 50 \</div>
                  <div className="pl-4">--mechanics hi_lo,most_expensive,one_away \</div>
                  <div className="pl-4">--seed auto</div>
                </div>
              </div>
            )}

            {/* Batch history */}
            {!loadingBatches && batches.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
                <h3 className="font-semibold text-white text-sm mb-3">📋 Batch History</h3>
                <div className="space-y-1">
                  {batches.slice(-5).reverse().map((b) => (
                    <div key={b.batchId} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-gray-800/50">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          b.status === "done" ? "bg-green-400" : b.status === "running" ? "bg-yellow-400" : "bg-red-400"
                        }`}
                      />
                      <span className="font-mono text-gray-500">{b.batchId}</span>
                      <span className="text-gray-500 flex-1">
                        {b.passed}/{b.total} passed
                      </span>
                      {b.avgRenderMs && (
                        <span className="text-gray-600 font-mono">{b.avgRenderMs}ms avg</span>
                      )}
                      <span className="text-gray-700">
                        {new Date(b.createdAt).toLocaleTimeString("vi-VN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
