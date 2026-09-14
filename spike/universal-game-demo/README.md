# Spike: Universal Game Video Engine — Full Pipeline Mock (HTML Preview)

Kiểm chứng **theses nền tảng** trước khi build full:

> **Một engine + 7 scenes + 2 Result variants có cân được 3 họ Interaction (BOOLEAN / MULTIPLE_CHOICE / DIGIT) không — mà không cần render MP4 thật?**

Spike này mock toàn bộ pipeline `LLM stub → Game JSON → Validator (2 tầng) → ProductProvider (50 files) → Game Engine (answer/timeline) → Audio stub → HTML Preview 15s` — **không cài Motion Canvas/FFmpeg**, chỉ mở browser là xem được.

**Mục tiêu kiểm chứng (map tới AD/PRD):**

| Kiểm chứng | AD/PRD | Pass khi |
|---|---|---|
| Validator 2 tầng chặn JSON hỏng | AD-3, FR-3 | JSON thiếu `answer` / `price` → `E_GAME_LOGIC_INVALID` |
| Ownership `price` vs `affiliate_link` | AD-4, FR-2 | `price` sai → hard fail; `affiliate_link` thiếu → warning `W_AFFILIATE_MISSING` vẫn preview |
| 50 files `products/pXXX.json` | AD-5, FR-2 | Sửa 1 file không ảnh hưởng 49 file còn lại |
| 7 scenes reuse + `DigitReveal` riêng | AD-6, FR-5/8 | HI_LO và ONE_AWAY dùng 6 scenes giống hệt, chỉ `RevealScene` khác |
| Result 2 variants | FR-5 | `in_video` hiện đáp án, `comment` giấu đáp án |
| File queue + fail-forward + seed determinism | AD-9/10, FR-11 | `queue/job_*.json` poll FIFO, 1 job fail không chặn batch, cùng seed → cùng answer/timeline |

---

## Chạy spike (không cần cài gì ngoài Node.js)

```bash
cd spike/universal-game-demo

# 1. Chạy validator + engine + sinh HTML preview cho 3 mechanics
node src/run_spike.js

# 2. Mở preview (HTML 15s, 7 scenes chạy tự động)
# Windows: start output\preview_hi_lo.html
# macOS: open output/preview_hi_lo.html
# Hoặc mở bằng VS Code Live Preview

# Các file preview:
# output/preview_hi_lo.html          — HI_LO (BOOLEAN, 2 products)
# output/preview_most_expensive.html — MOST_EXPENSIVE (MULTIPLE_CHOICE, 4 products)
# output/preview_one_away.html       — ONE_AWAY (DIGIT, 1 product)
# output/batch_report.json           — batch 3 jobs fail-forward demo
# output/logs.json                   — observability logs
```

**Không tốn quota LLM** — `content` (hook/question/cta) là stub, không gọi API.

---

## Cấu trúc

```
spike/universal-game-demo/
├── products/
│   ├── p001.json  # Nước giặt 189K
│   ├── p042.json  # Robot hút bụi 2.49M
│   ├── p015.json  # Nồi chiên 890K
│   └── p028.json  # Máy xay 450K
├── games/
│   ├── hi_lo.json
│   ├── most_expensive.json
│   └── one_away.json
├── src/
│   ├── product-provider.js   # AD-5: 50 files cache
│   ├── validator.js          # AD-3: 2 tầng
│   ├── game-engine.js        # AD-10: answer + timeline determinism
│   ├── queue.js              # AD-9: file queue
│   └── run_spike.js          # runner + HTML generator
└── output/  # sinh sau khi chạy
```

---

## Kết quả mong đợi

- **6/6 checks pass** trong console.
- 3 HTML preview đều chạy **15–21s** (Hook 2s → Product 3s → Question 3s → Countdown 3s → Reveal 2s → Result 2s → CTA 3s), countdown tick mỗi 0.5s.
- `one_away` Reveal hiện `1,8?0,000 → 1,890,000` với `DigitReveal` flip, không dùng `PriceReveal`.
- Batch report: `total 3, passed 2, failed 1 (most_expensive tie)` → fail-forward đúng.
- Cùng `seed=839271` chạy 2 lần → `answer` và `timeline` giống hệt.

Nếu **≥5/6 pass** → architecture AD-3..AD-10 đủ cứng để sang `bmad-create-epics-and-stories`.
Nếu **<4 pass** → sửa AD trước khi build.

---

## Giới hạn

- **Không render MP4 thật** — HTML preview thay cho Motion Canvas + FFmpeg. Spike này không đo `render ≤45s` hay `RAM ≤4GB` (cần spike riêng với Motion Canvas headless sau).
- **Audio stub** — không gọi viPiper, chỉ hiện `voice_script` và SFX log. TTS sync sẽ spike riêng R0.
- **LLM stub** — `hook/question` hard-code trong `games/*.json`, không test LLM JSON mode.
