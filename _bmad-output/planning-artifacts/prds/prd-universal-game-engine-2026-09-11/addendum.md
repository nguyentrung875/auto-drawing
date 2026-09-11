# Technical Addendum — Universal AI Game Video Engine

Tài liệu này lưu chi tiết kỹ thuật sâu để giữ PRD chính gọn, tập trung vào yêu cầu và hành vi.

---

## 1. Stack Evaluation (kế thừa từ auto-drawing v2)

| Khối | Lựa chọn MVP | License | Lý do chọn / Loại bỏ |
|---|---|---|---|
| **Render** | **Motion Canvas** (`motion-canvas/motion-canvas`) | MIT | Thay Remotion (Commercial/Company License) để giữ cost 0đ và MIT stack như ADR-01 PRD v2. Motion Canvas đủ cho text/price/timer SVG/CSS. Remotion để dự phòng nếu cần React ecosystem. |
| **TTS** | **viPiper / Piper** | MIT | Offline, <2s/voice, tiếng Việt tốt. Fallback Edge TTS free nếu cần hay hơn, vẫn ≤$0.01/video. |
| **Mux** | **FFmpeg** | LGPL/GPL | Chuẩn H.264/AAC, ghép voice+SFX+music. |
| **LLM** | OpenAI/Gemini (JSON mode, temp 0.3) | API | Chỉ sinh `content` (hook/question/cta/caption/hashtag/voice_script), không sinh price. Retry 3 lần nếu JSON hỏng. |
| **Queue** | File-based `queue/*.json` | — | Không cần Redis ở MVP; Hermes chỉ cần ghi file. Phase 2 cân nhắc SQLite/DB nếu >100 job/ngày. |

**ADR-01 (tái khẳng định):** Giữ **100% MIT/Apache 2.0** cho Renderer/TTS ở MVP để solo operator không bị ràng buộc bản quyền khi scale 100 video/ngày.

---

## 2. Scene Catalog Chi Tiết (7 MVP + 8 Phase 2)

### MVP 7 scenes

| Scene | Component chính | Duration | Audio cue |
|---|---|---|---|
| `HookScene` | `HookText` + `Badge` | 2s | `transition` SFX at 0s |
| `ProductScene` | `ProductCard` (image + name + price) | 3s | `tick` nhẹ |
| `QuestionScene` | `QuestionText` + `ChoiceButtons` (nếu có) | 3s | voice "Cao hơn hay thấp hơn?" |
| `CountdownScene` | `Timer` 3..0 + `ProgressBar` | **3.0s** | `countdown` tick mỗi 0.5s |
| `RevealScene` | `PriceReveal` / `DigitFlip` | 2s | `reveal` SFX |
| `ResultScene` | `Badge correct/wrong` **hoặc** `CTA comment` | 2s | `correct/wrong` |
| `CTAScene` | `CTAButton` + `affiliate_link` QR/text | 2-3s | voice CTA |

**2 biến thể ResultScene:**
- `variant=in_video`: hiện `answer` + highlight.
- `variant=comment`: ẩn `answer`, hiện "Đáp án ở comment 👇" — để A/B test SM-6.

### Phase 2 (8 scenes)
`ScoreScene, ProgressScene, TimerScene, PuzzleScene, SuccessScene, FailScene, ChoiceScene (nâng cao), PriceRevealScene (multi-price)`

---

## 3. Universal Game JSON Schema (rút gọn)

```json
{
  "metadata": {
    "gameId": "hi_lo_001",
    "mechanic": "HI_LO",
    "language": "vi-VN",
    "difficulty": "medium",
    "seed": 839271,
    "result_variant": "in_video"
  },
  "content": {
    "title": "Đoán giá #001",
    "hook": "Bạn đoán đúng được mấy vòng?",
    "question": "Robot hút bụi này CAO HƠN hay THẤP HƠN nước giặt 189K?",
    "cta": "Comment số vòng bạn đúng!",
    "caption": "Bạn đoán đúng không? #doangia #quiz",
    "hashtags": ["doangia","quiz"],
    "voice_script": "Nước giặt 189K. Robot này cao hơn hay thấp hơn?"
  },
  "entities": [
    {"productId":"p001","name":"Nước giặt 3.5kg","image":"assets/p001.webp","price":189000,"affiliate_link":"https://..."},
    {"productId":"p042","name":"Robot hút bụi","image":"assets/p042.webp","price":2490000,"affiliate_link":"https://..."}
  ],
  "gameplay": {
    "mechanic": "HI_LO",
    "answer": "higher",
    "interaction": "BOOLEAN"
  },
  "scenes": ["hook","product","question","countdown","reveal","result","cta"],
  "audio": {
    "voice": {"script": "Nước giặt 189K. Robot này cao hơn hay thấp hơn?", "enabled": true},
    "music": {"track": "tension_01", "volume": 0.18},
    "sfx": [{"type":"countdown","at":6},{"type":"reveal","at":9},{"type":"correct","at":12}]
  },
  "publishing": {
    "caption": "Bạn đoán đúng không?",
    "hashtags": ["doangia"],
    "affiliate_link": "https://...",
    "outputPath": "export/hi_lo_001_839271.mp4"
  }
}
```

**Quy tắc:**
- `entities[].price` luôn overwrite từ `ProductProvider` (log `W_PRICE_OVERWRITTEN` nếu LLM bịa).
- `gameplay.answer` do Engine tính, không do LLM.

---

## 4. Validator — Error Codes

| Layer | Code | Điều kiện |
|---|---|---|
| Schema | `E_SCHEMA_MISSING_FIELD` | thiếu required field |
| Schema | `E_SCHEMA_SCENE_INVALID` | scene không trong 7 MVP |
| Schema | `E_MISSING_REQUIRED_SCENE` | thiếu countdown/reveal |
| Game | `E_GAME_LOGIC_INVALID` | answer không khớp entities |
| Game | `E_PRICE_SOURCE_INVALID` | price không từ ProductProvider |
| Game | `E_ASSET_MISSING` | image không tồn tại |
| Game | `E_HILO_EQUAL_PRICE` | HI_LO delta <5% |
| Game | `E_MOST_EXPENSIVE_TIE` | MOST_EXPENSIVE prices trùng max |
| Game | `E_AUDIO_MISSING_SFX` | thiếu SFX bắt buộc |
| Timeline | `E_TIMELINE_DRIFT` | countdown ≠3.0s ±0.1s |

---

## 5. CLI & Queue Spec

```bash
# Single
game render --mechanic hi_lo --products p001,p042 --seed 839271 --result-variant in_video
# → queue/job_<uuid>.json → Validator → Render → export/hi_lo_<seed>.mp4 + caption.json

# Batch 50 (cover 3 mechanics)
game batch --count 50 --mechanics hi_lo,most_expensive,one_away --result-variant comment
# → queue/*.json (50 files) → pool min(CPU-1,3) → batch_report.json

# Inspect
game products list
game queue status
game logs --gameId hi_lo_001
```

**File queue:** `queue/<jobId>.json` với `status: pending|running|done|failed`, `retries: 0..3`.

---

## 6. Rendering Pipeline (Motion Canvas)

```
Game JSON
 → Validator 2 tầng
 → Timeline builder (7 scenes, total 15-21s)
 → Motion Canvas composition (React-like, SVG/CSS)
   ├── Hook/Product/Question layers
   ├── Countdown Timer (60fps, tick SFX sync)
   └── Reveal/Result/CTA
 → viPiper TTS (voice.wav)
 → FFmpeg mux (video + voice + SFX + music → MP4 H.264/AAC)
 → export/<gameId>_<seed>.mp4 + caption.json
```

**Diversification (tránh TikTok dedup):** random `background (5 mẫu) + inkColor + tilt ±2° + BGM` mỗi video.

---

## 7. Hermes Integration — Phase Plan

| Phase | Hermes capability | Engine interface |
|---|---|---|
| **MVP (v1)** | Stub: đề xuất 50 cặp product random (delta >10%), đọc `batch_report.json` | CLI + file queue, Trung bấm `game batch` |
| **Phase 2** | Crawl giá TikTok/Shopee, generate 100 Game JSON qua LLM, auto-post, comment AI | Hermes ghi `queue/*.json`, đọc `logs/*.json`, gọi `FFmpeg` post API (mock trước) |
| **Phase 3** | Học từ SM-4/5/6: mechanic nào + hook nào + SKU nào → retention cao, tự tối ưu ideas | Feedback loop: Analytics → Hermes prompt → new Game JSON |

**Interface contract (v1):** Hermes chỉ cần quyền ghi `queue/` và đọc `export/` + `logs/` + `batch_report.json`. Không cần HTTP API.

---

## 8. Rejected Alternatives

1. **Remotion thay Motion Canvas:** Loại ở MVP vì license Commercial/Company, không MIT — giữ lại làm fallback nếu Motion Canvas thiếu feature text animation phức tạp.
2. **AI Video Generator cho toàn bộ:** Loại vì cost $0.20-0.50/video, không kiểm soát text/timer, hallucinate price.
3. **Product DB live crawl ở MVP:** Hoãn Phase 2 vì scope lớn (crawl, dedup, giá thay đổi) — MVP mock 50 SKU đủ chứng minh Engine.
4. **CHECK_OUT thay ONE_AWAY ở MVP:** Hoãn CHECK_OUT (NUMBER) vì cả 3 mechanic ban đầu cùng họ price-choice; đổi sang ONE_AWAY (DIGIT) để test 3 interaction khác nhau, chứng minh universal thật.

---

## 9. Open Technical TODOs

- [ ] Spike Motion Canvas render 1 video HI_LO 1080×1920 trong ≤45s? (R0)
- [ ] viPiper blind test 5 câu quiz tiếng Việt (R0)
- [ ] Diversification có đủ qua TikTok dedup không? (20 video test)
- [ ] Benchmark file queue với 200 jobs (latency, lock)
