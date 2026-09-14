"use client";

import { useState, useEffect } from "react";
import type { Product, Mechanic } from "@/types/game";
import { formatVND } from "@/lib/game-engine";

interface ProductSelectorProps {
  maxProducts: number;
  minProducts: number;
  selected: Product[];
  onSelect: (products: Product[]) => void;
  mechanic: Mechanic;
}

const CATEGORIES = ["all", "Điện tử", "Gia dụng", "Làm đẹp", "Thời trang", "Thực phẩm", "Thể thao", "Sức khỏe"];

export function ProductSelector({
  maxProducts,
  minProducts,
  selected,
  onSelect,
  mechanic,
}: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category, search]);

  function toggleProduct(product: Product) {
    const isSelected = selected.some((p) => p.productId === product.productId);
    if (isSelected) {
      onSelect(selected.filter((p) => p.productId !== product.productId));
    } else {
      if (selected.length >= maxProducts) {
        // Replace if maxProducts == 1, or replace first if at max
        if (maxProducts === 1) {
          onSelect([product]);
        } else {
          onSelect([...selected.slice(1), product]);
        }
      } else {
        onSelect([...selected, product]);
      }
    }
  }

  const selectedIds = new Set(selected.map((p) => p.productId));

  // Validation hints for mechanic
  function getValidationHint(product: Product): string | null {
    if (mechanic === "HI_LO" && selected.length === 1) {
      const other = selected[0];
      const delta = Math.abs(product.price - other.price) / other.price;
      if (delta < 0.05) {
        return `⚠️ Delta ${(delta * 100).toFixed(1)}% < 5%`;
      }
    }
    if (mechanic === "MOST_EXPENSIVE" && selected.length >= 2) {
      const allPrices = [...selected.map((p) => p.price), product.price].sort((a, b) => b - a);
      const top2Delta = (allPrices[0] - allPrices[1]) / allPrices[0];
      if (top2Delta < 0.02) {
        return `⚠️ Top2 delta ${(top2Delta * 100).toFixed(1)}% < 2%`;
      }
    }
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p, i) => (
            <div
              key={p.productId}
              className="flex items-center gap-1.5 bg-indigo-900/40 border border-indigo-700/50 rounded-lg px-2 py-1"
            >
              <span className="text-indigo-300 text-xs font-mono">{i + 1}</span>
              <span className="text-white text-xs font-medium truncate max-w-[100px]">{p.name}</span>
              <span className="text-indigo-400 text-xs">{formatVND(p.price)}</span>
              <button
                onClick={() => toggleProduct(p)}
                className="text-gray-500 hover:text-red-400 transition-colors ml-0.5 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Tìm sản phẩm..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
      />

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-2 py-1 rounded-lg text-xs transition-colors ${
              category === cat
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-500 hover:text-gray-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="text-gray-600 text-sm py-4 text-center">Đang tải...</div>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg">
          {products.map((product) => {
            const isSelected = selectedIds.has(product.productId);
            const hint = !isSelected ? getValidationHint(product) : null;

            return (
              <button
                key={product.productId}
                onClick={() => toggleProduct(product)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all border ${
                  isSelected
                    ? "bg-indigo-900/30 border-indigo-700/50 text-white"
                    : hint
                    ? "bg-gray-800/40 border-gray-700/30 text-gray-400 hover:bg-gray-800"
                    : "bg-gray-800/60 border-gray-700/40 text-gray-300 hover:text-white hover:border-gray-600"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs transition-all ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "border-gray-600"
                  }`}
                >
                  {isSelected ? "✓" : ""}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium leading-tight truncate">{product.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-gray-500">{product.productId}</span>
                    <span className="text-xs text-gray-500">{product.brand}</span>
                    <span className="text-xs text-gray-600">{product.category}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-bold text-indigo-400">
                    {formatVND(product.price)}
                  </div>
                  {hint && (
                    <div className="text-[9px] text-yellow-500 mt-0.5">{hint}</div>
                  )}
                </div>
              </button>
            );
          })}
          {products.length === 0 && (
            <div className="text-gray-600 text-sm py-4 text-center">Không tìm thấy sản phẩm</div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-600">
        {selected.length}/{maxProducts} chọn · Cần ≥{minProducts} sản phẩm để render
      </div>
    </div>
  );
}
