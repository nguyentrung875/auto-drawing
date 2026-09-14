"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Choice {
  letter: string;
  text: string;
  isCorrect: boolean;
}

interface MechanicMockup {
  category: string;
  question: string;
  icon: string;
  title: string;
  brand: string;
  benchmark: string;
  choices: Choice[];
  reveal: string;
}

const MECHANICS_DATA: Record<string, MechanicMockup> = {
  HI_LO: {
    category: "THỬ THÁCH GIÁ ĐÚNG",
    question: "Nồi chiên không dầu Philips giá CAO HƠN hay THẤP HƠN 2.500.000đ?",
    icon: "🫕",
    title: "Nồi chiên không dầu Philips HD9252 (4.1L)",
    brand: "PHILIPS OFFICIAL",
    benchmark: "2.500.000đ",
    choices: [
      { letter: "A", text: "CAO HƠN ⬆️", isCorrect: false },
      { letter: "B", text: "THẤP HƠN ⬇️", isCorrect: true },
    ],
    reveal: "🎉 THẤP HƠN! Giá chính xác là 1.890.000đ",
  },
  GUESS_THE_PRICE: {
    category: "ĐOÁN KHOẢNG GIÁ",
    question: "Tai nghe Sony WH-1000XM5 chính hãng nằm trong khoảng giá nào?",
    icon: "🎧",
    title: "Tai nghe chống ồn không dây Sony WH-1000XM5",
    brand: "SONY STORE",
    benchmark: "Chọn 1 trong 4 khoảng giá",
    choices: [
      { letter: "A", text: "4tr - 5tr5", isCorrect: false },
      { letter: "B", text: "5tr6 - 7tr", isCorrect: true },
      { letter: "C", text: "7tr1 - 8tr5", isCorrect: false },
      { letter: "D", text: "Trên 8tr5", isCorrect: false },
    ],
    reveal: "🎯 ĐÁP ÁN B! Giá niêm yết là 6.490.000đ",
  },
  GROCERY_BASKET: {
    category: "ĐI CHỢ CÙNG SHOPPING",
    question: "Tổng giỏ hàng 3 món này có VƯỢT NGÂN SÁCH 500.000đ không?",
    icon: "🛒",
    title: "Combo: Sữa tươi + Hạt điều + Bột ngũ cốc",
    brand: "BASKET 3 ITEMS",
    benchmark: "Budget: 500.000đ",
    choices: [
      { letter: "A", text: "ĐỦ TIỀN 🛍️", isCorrect: true },
      { letter: "B", text: "CHÁY TÚI 💸", isCorrect: false },
    ],
    reveal: "🛍️ ĐỦ TIỀN! Tổng hoá đơn là 425.000đ (Dư 75k)",
  },
  DEAL_OR_SCAM: {
    category: "BẪY GIẢM GIÁ 85%",
    question: "Bàn phím cơ Bluetooth RGB giảm từ 1.800k xuống 250k: DEAL hay SCAM?",
    icon: "⌨️",
    title: "Bàn phím cơ Bluetooth RGB Hot-swap",
    brand: "FLASH SALE -85%",
    benchmark: "Giá gốc: 1.800.000đ → Còn 250k",
    choices: [
      { letter: "A", text: "DEAL HỜI 🔥", isCorrect: false },
      { letter: "B", text: "BẪY SCAM ⚠️", isCorrect: true },
    ],
    reveal: "⚠️ BẪY SCAM! Shop ảo clone hàng kém chất lượng!",
  },
};

export default function LayoutMockupPage() {
  const [mechanic, setMechanic] = useState<string>("HI_LO");
  const [theme, setTheme] = useState<"neon" | "minimal" | "gameshow">("neon");
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [currentTime, setCurrentTime] = useState<number>(1.5);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [glow, setGlow] = useState<number>(18);
  const [radius, setRadius] = useState<number>(16);

  const totalTime = 5.0;
  const isReveal = currentTime >= 3.5;
  const currentData = MECHANICS_DATA[mechanic] || MECHANICS_DATA.HI_LO;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = Math.round((prev + 0.1) * 10) / 10;
          if (next >= totalTime) {
            setIsPlaying(false);
            return totalTime;
          }
          return next;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalTime]);

  const remainingSec = Math.max(0, 3.5 - currentTime);
  const percentRemaining = Math.max(0, Math.min(100, (remainingSec / 3.5) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:text-white"
            >
              ← Trang chủ
            </Link>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <span>📐</span> Bản Mockup Bố cục Video Hiện đại (All-In-One)
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 px-3 py-1 rounded-full">
              Chuẩn 1080×1920 (9:16)
            </span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Loại Mini-Game / Thử thách
              </label>
              <select
                value={mechanic}
                onChange={(e) => setMechanic(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
              >
                <option value="HI_LO">1. HI_LO (Cao hơn / Thấp hơn)</option>
                <option value="GUESS_THE_PRICE">2. GUESS_THE_PRICE (4 Khoảng giá)</option>
                <option value="GROCERY_BASKET">3. GROCERY_BASKET (Giỏ hàng 3 món)</option>
                <option value="DEAL_OR_SCAM">4. DEAL_OR_SCAM (Sale sốc 85% Deal hay Scam)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Phong cách Đồ họa (Design Theme)
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
              >
                <option value="neon">🔥 Cyberpunk Neon (TikTok High-Retention)</option>
                <option value="minimal">💎 Modern Glass (Shopee / Apple Clean)</option>
                <option value="gameshow">🏆 TV Game Show (Vàng hoàng gia kịch tính)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Chế độ hiển thị
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("single")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition ${
                    viewMode === "single"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  Interactive Phone
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("compare")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition ${
                    viewMode === "compare"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  So sánh 3 Theme
                </button>
              </div>
            </div>
          </div>

          {/* Scrubber */}
          <div className="pt-3 border-t border-slate-800 flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (currentTime >= totalTime) setCurrentTime(0);
                  setIsPlaying(!isPlaying);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                {isPlaying ? "⏸ Tạm dừng" : "▶ Play (5s)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs border border-slate-700"
              >
                ↺ Reset
              </button>
            </div>

            <div className="flex-1 w-full flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400 w-12 text-right">
                {currentTime.toFixed(1)}s
              </span>
              <input
                type="range"
                min={0}
                max={totalTime}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentTime(parseFloat(e.target.value));
                }}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-xs font-mono text-slate-400 w-12">5.0s</span>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                isReveal
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-600"
                  : "bg-amber-950 text-amber-300 border border-amber-600/60"
              }`}
            >
              {isReveal ? "🎉 HIỆN ĐÁP ÁN (3.5s - 5s)" : "⏳ ĐANG ĐẾM NGƯỢC (0 - 3.5s)"}
            </span>
          </div>
        </div>

        {/* View Mode: Single Phone */}
        {viewMode === "single" && (
          <div className="flex flex-col lg:flex-row items-center justify-center gap-10 py-2">
            {/* Phone Container */}
            <div className="relative">
              <div className="w-[340px] h-[604px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700/80 ring-1 ring-slate-600/30">
                <div
                  className="w-full h-full rounded-[34px] overflow-hidden relative flex flex-col justify-between p-4 transition-all duration-500"
                  style={{
                    background:
                      theme === "neon"
                        ? "radial-gradient(circle at 50% 20%, #172033 0%, #080c16 80%, #020617 100%)"
                        : theme === "minimal"
                        ? "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)"
                        : "radial-gradient(circle at 50% 30%, #1e1b4b 0%, #0a0f1d 100%)",
                  }}
                >
                  {/* 1. HUD */}
                  <div className="relative z-10 flex items-center justify-between pt-1">
                    <div className="px-2.5 py-1 rounded-full bg-slate-800/90 border border-amber-500/40 text-[10px] font-black text-amber-400">
                      🔥 TẬP #42
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
                      <span className="text-[9px] font-bold text-white/90 mr-1">CÂU 1/3</span>
                      <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/40"></span>
                      <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                      <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-600/50 text-[10px] font-bold text-rose-300">
                      ⚡ 5 Giây
                    </div>
                  </div>

                  {/* 2. Question */}
                  <div className="relative z-10 mt-2">
                    <div
                      className={`p-3 text-center transition-all duration-300 ${
                        theme === "neon"
                          ? "bg-slate-900/90 border-2 border-amber-400/80 shadow-lg"
                          : theme === "minimal"
                          ? "bg-white/10 backdrop-blur-md border border-white/20 shadow-md"
                          : "bg-blue-950/90 border-2 border-yellow-400 shadow-xl"
                      }`}
                      style={{
                        borderRadius: `${radius}px`,
                        boxShadow:
                          theme === "neon"
                            ? `0 0 ${glow}px rgba(251, 191, 36, ${glow / 40})`
                            : undefined,
                      }}
                    >
                      <span className="text-[9px] uppercase tracking-widest text-amber-400 font-extrabold block mb-0.5">
                        {currentData.category}
                      </span>
                      <h3 className="text-xs font-black text-white leading-snug">
                        {currentData.question}
                      </h3>
                    </div>
                  </div>

                  {/* 3. Hero Product */}
                  <div className="relative z-10 my-auto flex flex-col items-center">
                    <div
                      className={`w-full p-3 flex flex-col items-center relative overflow-hidden ${
                        theme === "neon"
                          ? "bg-slate-900/85 border border-slate-700/80 shadow-xl"
                          : theme === "minimal"
                          ? "bg-white/5 backdrop-blur-md border border-white/10 shadow-sm"
                          : "bg-blue-950/70 border border-yellow-500/40 shadow-md"
                      }`}
                      style={{ borderRadius: `${radius}px` }}
                    >
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-rose-600 text-[9px] font-black text-white">
                        HOT DEAL
                      </div>

                      <div className="w-full h-36 rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700/60 flex items-center justify-center relative">
                        <div className="text-5xl">{currentData.icon}</div>
                        <span className="absolute bottom-1.5 right-2 text-[9px] font-bold px-2 py-0.5 rounded bg-black/60 text-slate-300">
                          {currentData.brand}
                        </span>
                      </div>

                      <div className="w-full text-center mt-2.5 space-y-0.5">
                        <div className="text-xs font-bold text-white line-clamp-1">
                          {currentData.title}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] text-slate-400">Mốc so sánh:</span>
                          <span className="text-sm font-black text-amber-400 font-mono">
                            {currentData.benchmark}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Action Deck & Timer */}
                  <div className="relative z-10 mt-auto space-y-2">
                    <div
                      className={`grid gap-2 ${
                        currentData.choices.length > 2 ? "grid-cols-2" : "grid-cols-2"
                      }`}
                    >
                      {currentData.choices.map((c) => {
                        let btnStyle =
                          "py-2.5 px-2 rounded-xl text-white font-black text-xs shadow-md transition-all duration-300 flex items-center justify-center gap-1.5 border-2 ";
                        if (isReveal) {
                          if (c.isCorrect) {
                            btnStyle +=
                              "bg-emerald-950 border-emerald-400 text-emerald-300 scale-[1.03] animate-pulse";
                          } else {
                            btnStyle +=
                              "bg-slate-900/60 border-slate-800 text-slate-600 opacity-40 line-through";
                          }
                        } else {
                          btnStyle +=
                            theme === "neon"
                              ? "bg-gradient-to-b from-slate-800 to-slate-900 border-indigo-500/50"
                              : theme === "minimal"
                              ? "bg-white/10 border-white/20"
                              : "bg-gradient-to-r from-amber-700 to-yellow-600 border-yellow-300";
                        }
                        return (
                          <div key={c.letter} className={btnStyle}>
                            <span className="w-4 h-4 rounded-full bg-slate-700/80 text-[9px] flex items-center justify-center font-mono">
                              {c.letter}
                            </span>
                            <span>{c.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pill Countdown Bar right under choices */}
                    <div className="space-y-1">
                      <div className="relative w-full h-3.5 bg-slate-950 rounded-full border border-slate-700/80 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-100 ease-linear"
                          style={{ width: isReveal ? "0%" : `${percentRemaining}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono px-1">
                        <span className="text-slate-400 font-semibold">⏱️ CÒN LẠI:</span>
                        <span className="font-black text-amber-400 text-xs">
                          {isReveal ? "HẾT GIỜ!" : `${remainingSec.toFixed(1)}s`}
                        </span>
                      </div>
                    </div>

                    {/* Reveal Banner */}
                    {isReveal && (
                      <div className="p-2 rounded-xl bg-emerald-950/90 border-2 border-emerald-500 text-center animate-bounce shadow-lg">
                        <span className="text-[9px] font-bold uppercase text-emerald-400 block">
                          KẾT QUẢ CHÍNH XÁC
                        </span>
                        <span className="text-xs font-extrabold text-white">
                          {currentData.reveal}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center mt-3 text-xs text-slate-500 font-mono">
                Mô phỏng Canvas 1080×1920 (9:16)
              </div>
            </div>

            {/* Explanations & Toggles */}
            <div className="max-w-md space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📐</span> Ưu điểm vượt trội của Bố cục All-In-One:
                </h2>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <div>
                      <strong className="text-white">Không nhảy cảnh rời rạc:</strong> Màn hình duy trì cố định câu hỏi + sản phẩm + nút bấm giúp giữ chân người xem (giảm drop-off trong 3s đầu).
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <div>
                      <strong className="text-white">Thanh đếm đặt dưới câu trả lời:</strong> Người xem hướng mắt xuống dưới, đọc nút [A] / [B] và thấy thanh giây đang cạn dần, kích thích comment ngay lập tức.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <div>
                      <strong className="text-white">Dễ nối tiếp nhiều câu (Multi-Round):</strong> Video 38s gồm 3 câu hỏi liên hoàn sẽ chỉ trượt nội dung card mà không đổi cấu trúc giao diện, xem rất mượt.
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tinh chỉnh nhanh hiệu ứng
                </h3>
                <div className="space-y-2">
                  <label className="text-xs text-slate-300 flex justify-between">
                    <span>Độ sáng Neon Glow:</span>
                    <span className="font-mono text-amber-400">{glow}px</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={glow}
                    onChange={(e) => setGlow(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>
                <div className="space-y-2 pt-2">
                  <label className="text-xs text-slate-300 flex justify-between">
                    <span>Bo góc (Radius):</span>
                    <span className="font-mono text-indigo-400">{radius}px</span>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={32}
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Compare 3 Themes */}
        {viewMode === "compare" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-items-center py-2">
            {/* Theme 1 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/50 px-3 py-1 rounded-full">
                🔥 1. CYBERPUNK NEON (Khuyên dùng)
              </span>
              <div
                className="w-[280px] h-[498px] rounded-[32px] p-3 shadow-2xl border-2 border-amber-500/50 relative overflow-hidden flex flex-col justify-between"
                style={{
                  background:
                    "radial-gradient(circle at 50% 20%, #151d30 0%, #030712 100%)",
                }}
              >
                <div className="flex justify-between items-center text-[8px] font-bold text-amber-400">
                  <span className="bg-black/60 px-2 py-0.5 rounded border border-amber-500/40">
                    TẬP #42
                  </span>
                  <span>CÂU 1/3 ● ○ ○</span>
                </div>
                <div className="bg-slate-900 border-2 border-amber-400 rounded-xl p-2 text-center shadow">
                  <div className="text-[8px] font-extrabold text-amber-400 uppercase">
                    THỬ THÁCH GIÁ ĐÚNG
                  </div>
                  <div className="text-[11px] font-black text-white leading-tight mt-0.5">
                    Giá CAO HƠN hay THẤP HƠN 250k?
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 text-center space-y-1">
                  <div className="w-full h-24 bg-slate-950 rounded-lg flex items-center justify-center text-3xl">
                    🫕
                  </div>
                  <div className="text-[10px] font-bold text-white truncate">
                    Nồi Chiên Philips 4.1L
                  </div>
                  <div className="text-xs font-black text-amber-400 font-mono">250.000đ</div>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="py-2 rounded-lg bg-indigo-950 border border-indigo-500 text-center text-[10px] font-black text-indigo-300">
                      A. CAO HƠN
                    </div>
                    <div className="py-2 rounded-lg bg-indigo-950 border border-indigo-500 text-center text-[10px] font-black text-indigo-300">
                      B. THẤP HƠN
                    </div>
                  </div>
                  <div className="h-2.5 bg-black rounded-full border border-amber-500/40 p-0.5">
                    <div className="h-full bg-amber-400 rounded-full w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme 2 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-3 py-1 rounded-full">
                💎 2. MODERN GLASS (Shopee Pro)
              </span>
              <div
                className="w-[280px] h-[498px] rounded-[32px] p-3 shadow-2xl border-2 border-slate-700 relative overflow-hidden flex flex-col justify-between"
                style={{
                  background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                }}
              >
                <div className="flex justify-between items-center text-[8px] font-semibold text-slate-300">
                  <span className="bg-white/10 px-2 py-0.5 rounded-full">Round 1/3</span>
                  <span className="text-cyan-400 font-mono">03.5s</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2 text-center">
                  <div className="text-[8px] font-bold text-cyan-300">QUESTION</div>
                  <div className="text-[11px] font-extrabold text-white leading-tight mt-0.5">
                    Giá CAO HƠN hay THẤP HƠN 250k?
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-2.5 text-center space-y-1">
                  <div className="w-full h-24 bg-white/5 rounded-lg flex items-center justify-center text-3xl">
                    🫕
                  </div>
                  <div className="text-[10px] font-semibold text-slate-100 truncate">
                    Philips Air Fryer HD9252
                  </div>
                  <div className="text-xs font-bold text-white font-mono">250.000đ</div>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="py-2 rounded-lg bg-white/10 border border-white/20 text-center text-[10px] font-bold text-white">
                      A. Cao Hơn
                    </div>
                    <div className="py-2 rounded-lg bg-white/10 border border-white/20 text-center text-[10px] font-bold text-white">
                      B. Thấp Hơn
                    </div>
                  </div>
                  <div className="h-2.5 bg-white/10 rounded-full p-0.5">
                    <div className="h-full bg-cyan-400 rounded-full w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme 3 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-yellow-300 bg-yellow-950/60 border border-yellow-800/50 px-3 py-1 rounded-full">
                🏆 3. TV GAME SHOW (Kịch tính)
              </span>
              <div
                className="w-[280px] h-[498px] rounded-[32px] p-3 shadow-2xl border-2 border-yellow-500/60 relative overflow-hidden flex flex-col justify-between"
                style={{
                  background:
                    "radial-gradient(circle at 50% 30%, #1e1b4b 0%, #0a0f1d 100%)",
                }}
              >
                <div className="flex justify-between items-center text-[8px] font-black text-yellow-400">
                  <span className="bg-yellow-500/20 px-2 py-0.5 rounded border border-yellow-400">
                    ĐẤU GIÁ NHANH
                  </span>
                  <span>⭐ VÒNG 1</span>
                </div>
                <div className="bg-blue-950/90 border-2 border-yellow-400 rounded-xl p-2 text-center shadow">
                  <div className="text-[8px] font-black text-yellow-400 uppercase">
                    CÂU HỎI SỐ 1
                  </div>
                  <div className="text-[11px] font-black text-white leading-tight mt-0.5">
                    Giá CAO HƠN hay THẤP HƠN 250k?
                  </div>
                </div>
                <div className="bg-blue-950/70 border border-yellow-500/40 rounded-xl p-2.5 text-center space-y-1">
                  <div className="w-full h-24 bg-blue-900/40 rounded-lg flex items-center justify-center text-3xl">
                    🫕
                  </div>
                  <div className="text-[10px] font-bold text-yellow-200 truncate">
                    Nồi Chiên Philips
                  </div>
                  <div className="text-xs font-black text-yellow-400 font-mono">
                    250.000 VNĐ
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="py-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 border border-yellow-300 text-center text-[10px] font-black text-white">
                      A. CAO HƠN
                    </div>
                    <div className="py-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 border border-yellow-300 text-center text-[10px] font-black text-white">
                      B. THẤP HƠN
                    </div>
                  </div>
                  <div className="h-2.5 bg-black rounded-full border border-yellow-500 p-0.5">
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
