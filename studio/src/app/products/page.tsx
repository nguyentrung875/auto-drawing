"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Product } from "@/types/game";
import { formatVND } from "@/lib/game-engine";

const CATEGORIES = ["all", "Điện tử", "Gia dụng", "Làm đẹp", "Thời trang", "Thực phẩm", "Thể thao", "Sức khỏe"];

const CATEGORY_ICONS: Record<string, string> = {
  "Điện tử": "📱",
  "Gia dụng": "🏠",
  "Làm đẹp": "💄",
  "Thời trang": "👗",
  "Thực phẩm": "🍜",
  "Thể thao": "🏋️",
  "Sức khỏe": "❤️",
  all: "🛍️",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "price_asc" | "price_desc">("name");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((data) => {
        let sorted = [...(data.products || [])];
        if (sortBy === "price_asc") sorted.sort((a: Product, b: Product) => a.price - b.price);
        if (sortBy === "price_desc") sorted.sort((a: Product, b: Product) => b.price - a.price);
        if (sortBy === "name") sorted.sort((a: Product, b: Product) => a.name.localeCompare(b.name));
        setProducts(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category, search, sortBy]);

  const totalValue = products.reduce((sum, p) => sum + p.price, 0);
  const avgPrice = products.length > 0 ? totalValue / products.length : 0;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-semibold">📦 Product DB</span>
          </div>
          <Link href="/studio" className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            + Tạo Game
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Mock Product DB</h1>
          <p className="text-gray-500">
            50 SKU mock — source-of-truth cho price &amp; affiliate_link. LLM không được sinh giá từ DB này.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-2xl font-black text-indigo-400">{products.length}</div>
            <div className="text-gray-500 text-sm">Sản phẩm</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-2xl font-black text-green-400">{formatVND(avgPrice)}</div>
            <div className="text-gray-500 text-sm">Giá trung bình</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-2xl font-black text-purple-400">
              {new Set(products.map((p) => p.category)).size}
            </div>
            <div className="text-gray-500 text-sm">Danh mục</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="name">Sắp xếp: Tên</option>
            <option value="price_asc">Giá: Thấp → Cao</option>
            <option value="price_desc">Giá: Cao → Thấp</option>
          </select>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                category === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
              }`}
            >
              <span>{CATEGORY_ICONS[cat] || "📦"}</span>
              <span>{cat === "all" ? "Tất cả" : cat}</span>
            </button>
          ))}
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="text-gray-600 py-16 text-center">Đang tải...</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <div
                key={product.productId}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all group"
              >
                {/* Image placeholder */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 h-36 flex items-center justify-center border-b border-gray-800 relative">
                  <span className="text-5xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
                  <div className="absolute top-2 right-2 text-xs bg-gray-800/80 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                    {product.productId}
                  </div>
                  <div className="absolute bottom-2 left-2 text-xs bg-gray-800/80 text-gray-400 px-1.5 py-0.5 rounded">
                    {product.source}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="text-xs text-gray-600 mb-1">{product.brand} · {product.category}</div>
                  <h3 className="text-white font-semibold text-sm leading-tight mb-2 line-clamp-2">
                    {product.name}
                  </h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-indigo-400 font-black text-lg">
                        {formatVND(product.price)}
                      </div>
                      <div className="text-gray-600 text-xs">{product.currency}</div>
                    </div>
                    <Link
                      href={`/studio?mechanic=HI_LO&product=${product.productId}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/50 text-indigo-300 border border-indigo-700/40 transition-colors"
                    >
                      Dùng →
                    </Link>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <div className="text-xs text-gray-600 truncate">
                      🔗 <a href={product.affiliateLink} className="hover:text-blue-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        Affiliate Link
                      </a>
                    </div>
                    <div className="text-xs text-gray-700 mt-0.5">
                      Updated: {new Date(product.updatedAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-gray-500">Không tìm thấy sản phẩm</div>
          </div>
        )}
      </div>
    </div>
  );
}
