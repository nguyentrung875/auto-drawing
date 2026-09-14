import Link from "next/link";
import { db } from "@/db";
import { games, batches, jobs } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [gamesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(games);
    const [batchesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(batches);
    const [doneGames] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(games)
      .where(sql`status = 'done'`);
    const [failedGames] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(games)
      .where(sql`status = 'failed'`);

    return {
      totalGames: gamesCount?.count ?? 0,
      totalBatches: batchesCount?.count ?? 0,
      doneGames: doneGames?.count ?? 0,
      failedGames: failedGames?.count ?? 0,
    };
  } catch {
    return { totalGames: 0, totalBatches: 0, doneGames: 0, failedGames: 0 };
  }
}

export default async function HomePage() {
  const stats = await getStats();
  const successRate =
    stats.totalGames > 0
      ? Math.round((stats.doneGames / stats.totalGames) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <span className="font-bold text-white text-lg tracking-tight">
              Universal AI Game Video Engine
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/studio"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Open Studio
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-pink-900/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Internal Factory · Local-first · MVP v1
            </div>
            <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight mb-6">
              Khai báo game +<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">
                data → 50 video 15s
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-8 leading-relaxed">
              Pipeline hoàn chỉnh:{" "}
              <span className="text-gray-300">
                LLM → Game JSON → Validator 2 tầng → Game Engine → Asset/Audio → MP4
              </span>
              . Lồng tiếng Việt, countdown, reveal — sẵn sàng đăng TikTok Shop &amp; Shopee Affiliate.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/studio"
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all hover:scale-105 shadow-lg shadow-indigo-900/40"
              >
                🎬 Tạo Video Ngay
              </Link>
              <Link
                href="/products"
                className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-all hover:scale-105 border border-gray-700"
              >
                📦 Xem 50 Sản Phẩm
              </Link>
              <Link
                href="/batch"
                className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-all hover:scale-105 border border-gray-700"
              >
                ⚡ Batch 50 Video
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Tổng Games", value: stats.totalGames, icon: "🎮", color: "text-indigo-400" },
            { label: "Thành công", value: stats.doneGames, icon: "✅", color: "text-green-400" },
            { label: "Thất bại", value: stats.failedGames, icon: "❌", color: "text-red-400" },
            { label: "Tỷ lệ thành công", value: `${successRate}%`, icon: "📊", color: "text-yellow-400" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-gray-500 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-2xl font-bold text-white mb-6">🔄 Pipeline</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { label: "Khai báo\n(Mechanic + Products)", icon: "📋", color: "bg-blue-900/50 border-blue-700/50 text-blue-300" },
              { label: "LLM\n(Hook/Question/CTA)", icon: "🤖", color: "bg-purple-900/50 border-purple-700/50 text-purple-300" },
              { label: "Game JSON\n(Universal Schema)", icon: "📄", color: "bg-indigo-900/50 border-indigo-700/50 text-indigo-300" },
              { label: "Validator 2 tầng\n(Schema + Logic)", icon: "✅", color: "bg-green-900/50 border-green-700/50 text-green-300" },
              { label: "Game Engine\n(Answer + Timeline)", icon: "⚙️", color: "bg-yellow-900/50 border-yellow-700/50 text-yellow-300" },
              { label: "Asset/Audio\n(ProductProvider + TTS)", icon: "🎵", color: "bg-orange-900/50 border-orange-700/50 text-orange-300" },
              { label: "Renderer\n(Motion Canvas + FFmpeg)", icon: "🎬", color: "bg-red-900/50 border-red-700/50 text-red-300" },
              { label: "MP4 Output\n(1080×1920 9:16)", icon: "📱", color: "bg-pink-900/50 border-pink-700/50 text-pink-300" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`flex-shrink-0 border rounded-xl px-3 py-2 text-center ${step.color}`}>
                  <div className="text-xl mb-1">{step.icon}</div>
                  <div className="font-medium whitespace-pre-line leading-tight text-xs">{step.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-gray-600 text-lg">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Mechanics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-2xl font-bold text-white mb-2">🎯 MVP: 3 Mechanics</h2>
        <p className="text-gray-500 text-sm mb-6">
          Chứng minh Universal Engine cân được 3 họ Interaction khác nhau
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              mechanic: "HI_LO",
              interaction: "BOOLEAN",
              icon: "⬆️⬇️",
              title: "Cao Hơn / Thấp Hơn",
              description:
                "Đoán sản phẩm B đắt hơn hay rẻ hơn sản phẩm A. Yêu cầu delta giá ≥5% để câu hỏi có nghĩa.",
              color: "from-blue-900/40 to-indigo-900/40 border-blue-700/40",
              badge: "bg-blue-900/60 text-blue-300",
              scenes: ["Hook 2s", "Product 3s", "Question 3s", "Countdown 3s", "Reveal 2s", "Result 2.5s", "CTA 2.5s"],
            },
            {
              mechanic: "MOST_EXPENSIVE",
              interaction: "MULTIPLE_CHOICE",
              icon: "💎",
              title: "Sản Phẩm Đắt Nhất",
              description:
                "Chọn sản phẩm đắt nhất trong 3-4 lựa chọn. Top 2 giá phải cách nhau ≥2%.",
              color: "from-purple-900/40 to-pink-900/40 border-purple-700/40",
              badge: "bg-purple-900/60 text-purple-300",
              scenes: ["Hook 2s", "Products 3s", "Question 3s", "Countdown 3s", "Reveal 2s", "Result 2.5s", "CTA 2.5s"],
            },
            {
              mechanic: "ONE_AWAY",
              interaction: "DIGIT",
              icon: "🔢",
              title: "Đoán Chữ Số",
              description:
                "Điền chữ số bị ẩn trong giá sản phẩm. Engine tính correct_digit deterministically từ seed.",
              color: "from-green-900/40 to-teal-900/40 border-green-700/40",
              badge: "bg-green-900/60 text-green-300",
              scenes: ["Hook 2s", "Product? 3s", "Question 3s", "Countdown 3s", "Digit Flip 2s", "Result 2.5s", "CTA 2.5s"],
            },
          ].map((m) => (
            <div
              key={m.mechanic}
              className={`bg-gradient-to-br ${m.color} border rounded-2xl p-6 flex flex-col gap-4`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-4xl mb-2">{m.icon}</div>
                  <h3 className="font-bold text-white text-lg">{m.title}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs font-mono font-bold text-gray-400">{m.mechanic}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.badge}`}>
                      {m.interaction}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{m.description}</p>
              <div className="flex flex-wrap gap-1">
                {m.scenes.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-800/60 text-gray-400 border border-gray-700/50"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <Link
                href={`/studio?mechanic=${m.mechanic}`}
                className="mt-auto text-center py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/10"
              >
                Tạo Video →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-2xl font-bold text-white mb-6">⚡ Tính Năng</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: "🛡️",
              title: "Validator 2 Tầng",
              desc: "Schema (zod) + Game Logic — chặn trước render. Reject LLM hallucinate giá, countdown <3s, trùng choices.",
            },
            {
              icon: "🎯",
              title: "Deterministic Engine",
              desc: "Cùng Game JSON + seed → cùng answer và timeline ±0.05s. 100% answer do Engine tính, không do LLM.",
            },
            {
              icon: "🏭",
              title: "Mock DB 50 SKU",
              desc: "ProductProvider với 50 sản phẩm thật từ Điện tử, Gia dụng, Làm đẹp, Thời trang, Thực phẩm, Thể thao.",
            },
            {
              icon: "🎬",
              title: "7 Scenes Tái Sử Dụng",
              desc: "Hook → Product → Question → Countdown → Reveal → Result (in_video/comment) → CTA. Tất cả mechanics dùng chung.",
            },
            {
              icon: "📊",
              title: "Batch Processing",
              desc: "game batch --count 50 enqueue 50 jobs, tự retry LLM hỏng tối đa 3 lần, ghi batch_report.json.",
            },
            {
              icon: "🤖",
              title: "Hermes-Ready Queue",
              desc: "File queue headless — Hermes chỉ cần ghi queue/*.json, engine tự pick. CLI + batch mode không cần HTTP API.",
            },
            {
              icon: "💰",
              title: "Cost ≈ 0đ/video",
              desc: "Local-first: Motion Canvas (MIT) + viPiper offline + FFmpeg. Không trả $0.20-0.50/video cho AI generator.",
            },
            {
              icon: "📱",
              title: "Export sẵn đăng",
              desc: "MP4 1080×1920 9:16 + caption.json {caption, hashtags[], affiliate_link} sẵn sàng TikTok/Shopee.",
            },
            {
              icon: "🎲",
              title: "Diversification",
              desc: "Seed-based: màu nền, accent color, tilt ±2° mỗi video → TikTok không quét trùng 50 video cùng mechanic.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-gray-800 mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-gray-600 text-sm">
            Universal AI Game Video Engine · PRD v1 · 2026-09-11
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/studio" className="text-gray-500 hover:text-white transition-colors">Studio</Link>
            <Link href="/products" className="text-gray-500 hover:text-white transition-colors">Products</Link>
            <Link href="/batch" className="text-gray-500 hover:text-white transition-colors">Batch</Link>
            <Link href="/games" className="text-gray-500 hover:text-white transition-colors">Games</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
