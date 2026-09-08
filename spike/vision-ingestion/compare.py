"""
compare.py — A/B so sanh Image-to-Concept vs Image-to-Geometry
================================================================

Chay CA HAI che do tren CUNG bo anh, cham diem theo rubric rieng cua tung che do,
roi xuat bao cao de quyet dinh co nen tach FR-3b thanh:
    FR-3b  Image-to-Concept   (vao MVP)
    FR-3c  Image-to-Geometry  (day sang v2, van spike-gated)

Usage:
    python compare.py                                  # both models, both modes
    python compare.py --model gemini                   # chi Gemini (re hon)
    python compare.py --images-dir images/ --limit 5
    python compare.py --dry-run                        # kiem tra setup, khong goi API

Output:
    compare_results/<image>.json   ket qua tho tung anh
    compare_report.json            tong hop machine-readable
    compare_report.html            bang so sanh side-by-side  <- MO CAI NAY
    compare_report.md              tom tat de dan vao PRD/validation-report
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from datetime import datetime
from pathlib import Path

from prompts import MODES
from parse_image import parse_one
from scoring import score

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MODE_ORDER = ["concept", "geometry"]


# ─── Aggregation ─────────────────────────────────────────────────────────────

def aggregate(all_results: list[dict], models: list[str]) -> dict:
    """Tong hop diem trung binh theo (mode, model)."""
    agg = {}
    for mode in MODE_ORDER:
        agg[mode] = {}
        for model in models:
            scores, times, rejects, errors = [], [], 0, 0
            coord_validity = []
            for r in all_results:
                s = r.get("scores", {}).get(mode, {}).get(model)
                if not s:
                    continue
                if s.get("status") == "error":
                    errors += 1
                    continue
                if s.get("status") == "rejected":
                    rejects += 1
                scores.append(s.get("score_pct", 0))
                if s.get("elapsed_s"):
                    times.append(s["elapsed_s"])
                if s.get("coord_validity") is not None:
                    coord_validity.append(s["coord_validity"])

            avg = round(statistics.mean(scores), 1) if scores else 0.0
            thresholds = MODES[mode]
            agg[mode][model] = {
                "n": len(scores),
                "avg_score": avg,
                "median_score": round(statistics.median(scores), 1) if scores else 0.0,
                "min_score": round(min(scores), 1) if scores else 0.0,
                "max_score": round(max(scores), 1) if scores else 0.0,
                "stdev": round(statistics.stdev(scores), 1) if len(scores) > 1 else 0.0,
                "pass_count": sum(1 for x in scores if x >= thresholds["pass_threshold"]),
                "avg_time_s": round(statistics.mean(times), 2) if times else None,
                "rejected": rejects,
                "errors": errors,
                "pass_threshold": thresholds["pass_threshold"],
                "verdict": "GO" if avg >= thresholds["pass_threshold"]
                           else ("REFINE" if avg >= thresholds["partial_threshold"] else "NO-GO"),
                "avg_coord_validity": round(statistics.mean(coord_validity), 1) if coord_validity else None,
            }
    return agg


def paired_compare(all_results: list[dict], models: list[str]) -> dict:
    """So sanh CHI tren nhung anh ma CA HAI mode deu chay thanh cong.

    Quan trong: neu concept chay duoc 9 anh con geometry chi 7 anh (do loi API
    ngau nhien), thi so sanh avg cua 2 tap khac nhau la SAI PHUONG PHAP —
    diem chenh lech co the chi phan anh anh nao tinh co that bai.
    """
    out = {}
    for model in models:
        pairs = []
        for r in all_results:
            c = r.get("scores", {}).get("concept", {}).get(model)
            g = r.get("scores", {}).get("geometry", {}).get(model)
            if not c or not g:
                continue
            if c.get("status") == "error" or g.get("status") == "error":
                continue
            pairs.append((Path(r["image"]).name, c.get("score_pct", 0), g.get("score_pct", 0)))
        if not pairs:
            out[model] = None
            continue
        ca = statistics.mean(p[1] for p in pairs)
        ga = statistics.mean(p[2] for p in pairs)
        out[model] = {
            "n": len(pairs),
            "concept_avg": round(ca, 1),
            "geometry_avg": round(ga, 1),
            "delta": round(ca - ga, 1),
            "pairs": pairs,
        }
    return out


def build_recommendation(agg: dict, models: list[str], paired: dict | None = None) -> dict:
    """Suy ra khuyen nghi PRD tu so lieu.

    Uu tien dung so lieu PAIRED (chi cac anh ca hai mode deu chay duoc) vi
    so sanh hai tap anh khac nhau la sai phuong phap.
    """
    def best(mode: str):
        # Neu co du lieu paired thi dung no
        if paired:
            cands = [(m, paired[m][f"{mode}_avg"]) for m in models
                     if paired.get(m) and paired[m]["n"] >= 3]
            if cands:
                return max(cands, key=lambda x: x[1])
        cands = [(m, agg[mode][m]["avg_score"]) for m in models if agg[mode][m]["n"] > 0]
        return max(cands, key=lambda x: x[1]) if cands else (None, 0.0)

    c_model, c_score = best("concept")
    g_model, g_score = best("geometry")

    c_ok = c_score >= MODES["concept"]["pass_threshold"]
    g_ok = g_score >= MODES["geometry"]["pass_threshold"]

    if c_ok and not g_ok:
        decision = "SPLIT"
        text = (
            f"Concept mode dat {c_score}% (nguong {MODES['concept']['pass_threshold']}%) trong khi "
            f"geometry mode chi dat {g_score}% (nguong {MODES['geometry']['pass_threshold']}%). "
            "Khuyen nghi TACH FR-3b: dua Image-to-Concept vao MVP, day Image-to-Geometry sang v2."
        )
    elif c_ok and g_ok:
        decision = "BOTH-GO"
        text = (
            f"Ca hai deu dat nguong (concept {c_score}%, geometry {g_score}%). "
            "Van nen uu tien concept mode lam duong chinh vi re hon va an toan ban quyen hon; "
            "geometry mode co the vao MVP nhu duong phu co operator duyet."
        )
    elif not c_ok and g_ok:
        decision = "UNEXPECTED"
        text = (
            f"Bat thuong: geometry ({g_score}%) vuot nguong nhung concept ({c_score}%) thi khong. "
            "Kiem tra lai rubric concept hoac chat luong bo anh test truoc khi ket luan."
        )
    else:
        decision = "BOTH-WEAK"
        text = (
            f"Ca hai deu duoi nguong (concept {c_score}%, geometry {g_score}%). "
            "Kha nang cao bo anh test khong dai dien hoac prompt can refine. "
            "Neu refine van khong len: bo hoan toan Path D, dung Path A + B, "
            "va dung seed list Hook->Subject thu cong."
        )

    return {
        "decision": decision,
        "text": text,
        "concept": {"best_model": c_model, "avg_score": c_score, "passed": c_ok},
        "geometry": {"best_model": g_model, "avg_score": g_score, "passed": g_ok},
        "prd_actions": _prd_actions(decision),
    }


def _prd_actions(decision: str) -> list[str]:
    return {
        "SPLIT": [
            "FR-3b -> doi ten thanh 'Image-to-Concept Ingestion', bo moi truong toa do khoi output schema",
            "Them FR-3c 'Image-to-Geometry Ingestion' vao muc 6.2 Out of Scope for MVP (v2)",
            "A-H13: ha rui ro tu Cao -> Trung binh, cap nhat nguong do luong thanh >= 90% cho concept",
            "UJ-3 Path D: sua mo ta thanh 'trich xuat y tuong + trinh tu ve', geometry do Path A/B lo",
            "Them assumption moi ve ban quyen anh tham chieu (Pinterest) khi dung o quy mo thuong mai",
        ],
        "BOTH-GO": [
            "Giu FR-3b nhung tach output thanh 2 tang: concept layer (bat buoc) + geometry layer (tuy chon)",
            "A-H13: ha rui ro tu Cao -> Thap",
            "Them quality gate: geometry chi duoc auto-commit khi coord_validity = 100%",
        ],
        "UNEXPECTED": [
            "Chua sua PRD. Review lai rubric trong scoring.py va bo anh test truoc",
        ],
        "BOTH-WEAK": [
            "Refine prompt them 1 ngay roi chay lai compare.py",
            "Neu van fail: chuyen FR-3b toan bo sang Out of Scope, ghi ro ly do trong PRD",
            "Bo sung FR moi: 'Curated Concept Seed List' — operator nap 50-100 cap Hook->Subject thu cong",
        ],
    }.get(decision, [])


# ─── Reports ─────────────────────────────────────────────────────────────────

def render_markdown(agg: dict, rec: dict, models: list[str], results: list[dict]) -> str:
    lines = [
        "# Vision Ingestion — Concept vs Geometry Comparison",
        "",
        f"_Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} — {len(results)} images_",
        "",
        "## Ket qua tong hop",
        "",
        "| Mode | Model | N | Avg | Median | Min-Max | Stdev | Pass | Threshold | Avg time | Verdict |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|",
    ]
    for mode in MODE_ORDER:
        for model in models:
            a = agg[mode][model]
            if a["n"] == 0:
                continue
            lines.append(
                f"| {MODES[mode]['label']} | {model} | {a['n']} | **{a['avg_score']}%** | "
                f"{a['median_score']}% | {a['min_score']}-{a['max_score']}% | {a['stdev']} | "
                f"{a['pass_count']}/{a['n']} | {a['pass_threshold']}% | "
                f"{a['avg_time_s'] or '—'}s | {a['verdict']} |"
            )

    lines += ["", "## Chi so rieng cua geometry mode", ""]
    any_coord = False
    for model in models:
        a = agg["geometry"][model]
        if a.get("avg_coord_validity") is not None:
            any_coord = True
            lines.append(f"- **{model}** — toa do nam trong [0,1]: **{a['avg_coord_validity']}%**")
    if not any_coord:
        lines.append("- _Khong co du lieu toa do (geometry mode chua chay hoac loi)_")

    lines += [
        "",
        "## Ket luan",
        "",
        f"**Decision: `{rec['decision']}`**",
        "",
        rec["text"],
        "",
        "### Hanh dong de xuat cho PRD",
        "",
    ]
    lines += [f"{i}. {a}" for i, a in enumerate(rec["prd_actions"], 1)] or ["_(khong co)_"]

    lines += ["", "## Chi tiet tung anh", "",
              "| Image | Mode | Model | Score | Status | Steps | Subject | Hook | Notes |",
              "|---|---|---|---:|---|---:|---|---|---|"]
    for r in results:
        name = Path(r["image"]).name
        for mode in MODE_ORDER:
            for model in models:
                s = r.get("scores", {}).get(mode, {}).get(model)
                if not s:
                    continue
                notes = "; ".join(s.get("notes", []))[:80]
                lines.append(
                    f"| {name} | {mode} | {model} | {s.get('score_pct', '—')}% | "
                    f"{s.get('status', '—')} | {s.get('step_count', '—')} | "
                    f"{s.get('subject') or '—'} | {s.get('hook') or '—'} | {notes} |"
                )
    return "\n".join(lines) + "\n"


def render_html(agg: dict, rec: dict, models: list[str], results: list[dict]) -> str:
    def color(status: str) -> str:
        return {"pass": "#22c55e", "partial": "#f59e0b", "fail": "#ef4444",
                "error": "#94a3b8", "rejected": "#94a3b8"}.get(status, "#e2e8f0")

    cards = ""
    for mode in MODE_ORDER:
        for model in models:
            a = agg[mode][model]
            if a["n"] == 0:
                continue
            cls = "pass" if a["verdict"] == "GO" else ("partial" if a["verdict"] == "REFINE" else "fail")
            cards += f"""
      <div class="card">
        <div class="label">{MODES[mode]['label']} · {model}</div>
        <div class="value {cls}">{a['avg_score']}%</div>
        <div class="sub">nguong {a['pass_threshold']}% · pass {a['pass_count']}/{a['n']} · <b>{a['verdict']}</b></div>
      </div>"""

    rows = ""
    for r in results:
        name = Path(r["image"]).name
        for mode in MODE_ORDER:
            for model in models:
                s = r.get("scores", {}).get(mode, {}).get(model)
                if not s:
                    continue
                st = s.get("status", "—")
                rows += f"""
      <tr>
        <td>{name}</td>
        <td><span class="badge {mode}">{mode}</span></td>
        <td>{model}</td>
        <td style="color:{color(st)};font-weight:700">{s.get('score_pct', '—')}%</td>
        <td>{st}</td>
        <td>{s.get('step_count', '—')}</td>
        <td>{s.get('subject') or '—'}</td>
        <td>{s.get('hook') or '—'}</td>
        <td>{s.get('coord_validity') if s.get('coord_validity') is not None else '—'}</td>
        <td>{s.get('elapsed_s') or '—'}s</td>
        <td class="notes">{'; '.join(s.get('notes', []))}</td>
      </tr>"""

    actions = "".join(f"<li>{a}</li>" for a in rec["prd_actions"])

    return f"""<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>Vision Ingestion — Concept vs Geometry</title>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; background:#0f172a; color:#e2e8f0; padding:2rem; max-width:1400px; margin:0 auto; }}
  h1 {{ color:#38bdf8; margin-bottom:0.25rem; }}
  h2 {{ color:#7dd3fc; margin-top:2.5rem; border-bottom:1px solid #1e293b; padding-bottom:0.5rem; }}
  .meta {{ color:#94a3b8; font-size:0.9rem; }}
  .summary {{ display:flex; gap:1rem; flex-wrap:wrap; margin:1.5rem 0; }}
  .card {{ background:#1e293b; border-radius:12px; padding:1.25rem 1.5rem; min-width:220px; flex:1; }}
  .card .label {{ font-size:0.75rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; }}
  .card .value {{ font-size:2.25rem; font-weight:800; margin:0.25rem 0; }}
  .card .sub {{ font-size:0.8rem; color:#94a3b8; }}
  .pass {{ color:#22c55e; }} .partial {{ color:#f59e0b; }} .fail {{ color:#ef4444; }}
  .verdict {{ background:#1e293b; border-left:4px solid #38bdf8; border-radius:8px; padding:1.25rem 1.5rem; margin:1rem 0; }}
  .verdict .tag {{ display:inline-block; background:#38bdf8; color:#0f172a; font-weight:800; padding:0.2rem 0.7rem; border-radius:6px; font-size:0.85rem; }}
  .verdict p {{ line-height:1.6; }}
  ol {{ line-height:1.9; }}
  table {{ width:100%; border-collapse:collapse; margin-top:1rem; font-size:0.85rem; }}
  th {{ background:#1e293b; padding:0.65rem 0.75rem; text-align:left; font-size:0.72rem; color:#94a3b8; text-transform:uppercase; position:sticky; top:0; }}
  td {{ padding:0.55rem 0.75rem; border-bottom:1px solid #1e293b; }}
  tr:hover td {{ background:#1e293b55; }}
  .notes {{ font-size:0.78rem; color:#64748b; max-width:280px; }}
  .badge {{ padding:0.15rem 0.5rem; border-radius:5px; font-size:0.72rem; font-weight:700; }}
  .badge.concept {{ background:#0e7490; color:#cffafe; }}
  .badge.geometry {{ background:#7c2d12; color:#fed7aa; }}
</style></head><body>

<h1>🧪 Vision Ingestion — Concept vs Geometry</h1>
<p class="meta">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} · {len(results)} images · models: {', '.join(models)}</p>

<div class="summary">{cards}</div>

<div class="verdict">
  <span class="tag">{rec['decision']}</span>
  <p>{rec['text']}</p>
</div>

<h2>Hanh dong de xuat cho PRD</h2>
<ol>{actions}</ol>

<h2>Chi tiet tung anh</h2>
<table>
  <thead><tr>
    <th>Image</th><th>Mode</th><th>Model</th><th>Score</th><th>Status</th>
    <th>Steps</th><th>Subject</th><th>Hook</th><th>Coord OK%</th><th>Time</th><th>Notes</th>
  </tr></thead>
  <tbody>{rows}</tbody>
</table>

</body></html>"""


# ─── Model discovery ─────────────────────────────────────────────────────────

def list_models() -> int:
    """Liet ke cac model Gemini ma key hien tai dung duoc."""
    import os

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("❌ Chua dat GEMINI_API_KEY")
        return 1
    try:
        from google import genai
    except ImportError:
        print("❌ Chua cai SDK. Chay: pip install google-genai pillow")
        return 1

    print("📡 Dang lay danh sach model...\n")
    try:
        client = genai.Client(api_key=key)
        names = []
        for m in client.models.list():
            actions = getattr(m, "supported_actions", None) or []
            if actions and "generateContent" not in actions:
                continue
            names.append(m.name.replace("models/", ""))
    except Exception as e:  # noqa: BLE001
        print(f"❌ That bai: {str(e)[:250]}")
        return 1

    if not names:
        print("⚠️  Khong co model nao ho tro generateContent")
        return 1

    # Uu tien model vision moi cho spike nay
    def rank(n: str) -> tuple:
        bad = any(x in n for x in ("embedding", "aqa", "imagen", "veo", "tts", "learnlm"))
        return (bad, "flash" not in n, n)

    print(f"✅ {len(names)} model kha dung:\n")
    for n in sorted(names, key=rank):
        star = " ⭐" if ("flash" in n and not any(
            x in n for x in ("embedding", "aqa", "imagen", "veo", "tts", "lite", "image"))) else ""
        print(f"   {n}{star}")

    recommended = next(
        (n for n in sorted(names, key=rank)
         if "flash" in n and not any(x in n for x in ("embedding", "aqa", "imagen", "veo", "tts", "lite", "image"))),
        None,
    )
    if recommended:
        print(f"\n💡 Khuyen nghi cho spike nay: {recommended}")
        print(f"   PowerShell : $env:GEMINI_VISION_MODEL = \"{recommended}\"")
        print(f"   cmd.exe    : set GEMINI_VISION_MODEL={recommended}")
    return 0


# ─── Key check ───────────────────────────────────────────────────────────────

def check_key() -> int:
    """Goi 1 request text nho de xac nhan key hoat dong. Tra ve exit code."""
    import os

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("❌ Chua dat GEMINI_API_KEY (hoac GOOGLE_API_KEY)")
        print("   PowerShell : $env:GEMINI_API_KEY = \"AQ.Ab8...\"")
        print("   cmd.exe    : set GEMINI_API_KEY=AQ.Ab8...")
        print("   bash       : export GEMINI_API_KEY=\"AQ.Ab8...\"")
        return 1

    masked = f"{key[:6]}...{key[-4:]}" if len(key) > 12 else "(qua ngan?)"
    print(f"🔑 Key: {masked}  (do dai {len(key)})")

    if key.startswith(("'", '"')) or key.endswith(("'", '"')):
        print("⚠️  Key co dau nhay o dau/cuoi — trong cmd.exe dung 'set K=abc' KHONG co dau nhay")

    if key.startswith("AQ."):
        print("   Dinh dang: Auth key (AQ.) — dinh dang MOI, dung")
    elif key.startswith("AIza"):
        print("   Dinh dang: Standard key (AIza) — dinh dang cu, Google dang khai tu")
    else:
        print("   ⚠️  Dinh dang la: khong phai AQ. hay AIza")

    try:
        from google import genai
    except ImportError:
        print("❌ Chua cai SDK. Chay: pip install google-genai pillow")
        return 1

    from parse_image import GEMINI_MODEL
    print(f"📡 Goi thu model {GEMINI_MODEL}...")
    try:
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(model=GEMINI_MODEL, contents="Reply with exactly: OK")
        print(f"✅ Key hoat dong. Model tra loi: {(resp.text or '').strip()[:40]}")
        print("\n   Chay tiep: python compare.py --model gemini")
        return 0
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        print(f"❌ That bai: {msg[:300]}")
        low = msg.lower()
        if "api key not valid" in low or "invalid" in low or "401" in low:
            print("\n   → Key sai hoac da bi xoa. Tao key moi tai aistudio.google.com/api-keys")
        elif "permission" in low or "403" in low:
            print("\n   → Key dung nhung thieu quyen / Gemini API chua bat cho project nay")
        elif "exceeded your current quota" in low or "billing details" in low:
            print("\n   → HET QUOTA NGAY (khong phai rate limit tuc thoi).")
            print("     Retry vo ich. Lua chon:")
            print("     1. Doi reset (free tier reset theo ngay, gio Thai Binh Duong)")
            print("     2. Bat billing: https://aistudio.google.com/apikey")
            print("     3. Model nhe hon: set GEMINI_VISION_MODEL=gemini-flash-lite-latest")
            print("     Xem quota: https://ai.dev/rate-limit")
        elif "quota" in low or "429" in low:
            print("\n   → Rate limit tuc thoi. Doi vai phut roi thu lai (--retry 3)")
        elif "not found" in low or "404" in low:
            print(f"\n   → Model '{GEMINI_MODEL}' khong dung duoc voi key nay.")
            # Google thuong goi y ten model moi ngay trong thong bao loi
            m = re.search(r"use\s+models/([\w.\-]+)", msg)
            if m:
                print(f"     Google goi y dung: {m.group(1)}")
                print(f"     PowerShell : $env:GEMINI_VISION_MODEL = \"{m.group(1)}\"")
                print(f"     cmd.exe    : set GEMINI_VISION_MODEL={m.group(1)}")
            print("\n     Xem tat ca model kha dung: python compare.py --list-models")
        else:
            print("\n   → Kiem tra ket noi mang / firewall / proxy")
        return 1


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Compare Image-to-Concept vs Image-to-Geometry")
    p.add_argument("--model", choices=["openai", "gemini", "both"], default="both")
    p.add_argument("--images-dir", default="images")
    p.add_argument("--limit", type=int, help="Chi chay N anh dau tien (tiet kiem cost)")
    p.add_argument("--modes", default="both", choices=["both", "concept", "geometry"])
    p.add_argument("--retry", type=int, default=2, metavar="N",
                   help="So lan thu lai khi gap loi tam thoi 503/429 (mac dinh 2)")
    p.add_argument("--skip-existing", action="store_true",
                   help="Bo qua anh da co ket qua trong compare_results/ (chay tiep sau khi het quota)")
    p.add_argument("--dry-run", action="store_true", help="Kiem tra setup, khong goi API")
    p.add_argument("--check-key", action="store_true",
                   help="Goi 1 request nho de kiem tra API key co dung khong (~$0.001)")
    p.add_argument("--list-models", action="store_true",
                   help="Liet ke cac model Gemini ma key hien tai dung duoc")
    args = p.parse_args()

    if args.list_models:
        sys.exit(list_models())
    if args.check_key:
        sys.exit(check_key())

    models = ["openai", "gemini"] if args.model == "both" else [args.model]
    modes = MODE_ORDER if args.modes == "both" else [args.modes]

    images_dir = Path(args.images_dir)
    if not images_dir.exists():
        print(f"❌ Khong tim thay thu muc anh: {images_dir.absolute()}")
        print("   Tao thu muc va dat 10 anh how-to-draw vao do (xem README.md).")
        sys.exit(1)

    files = [f for f in sorted(images_dir.iterdir()) if f.suffix.lower() in SUPPORTED_EXTS]
    if args.limit:
        files = files[: args.limit]
    if not files:
        print(f"❌ Khong co anh (jpg/png/webp) trong {images_dir}/")
        sys.exit(1)

    n_calls = len(files) * len(models) * len(modes)
    print(f"\n🔬 Compare Runner")
    print(f"   Images : {len(files)}")
    print(f"   Models : {', '.join(models)}")
    print(f"   Modes  : {', '.join(modes)}")
    print(f"   Total API calls: {n_calls}  (~${n_calls * 0.004:.2f} uoc tinh)")
    print("=" * 62)

    if args.dry_run:
        import os
        print("\n🧪 DRY RUN — khong goi API")
        for f in files:
            print(f"   • {f.name}")
        print(f"\n   OPENAI_API_KEY: {'✅ set' if os.environ.get('OPENAI_API_KEY') else '❌ missing'}")
        print(f"   GEMINI_API_KEY: {'✅ set' if os.environ.get('GEMINI_API_KEY') else '❌ missing'}")
        return

    out_dir = Path("compare_results")
    out_dir.mkdir(exist_ok=True)
    all_results = []

    for i, img in enumerate(files, 1):
        cached = out_dir / f"{img.stem}.json"
        if args.skip_existing and cached.exists():
            try:
                prev = json.loads(cached.read_text(encoding="utf-8"))
                has_err = any(
                    "error" in r
                    for md in prev.get("modes", {}).values()
                    for r in md.values() if isinstance(r, dict)
                )
                if not has_err:
                    print(f"\n[{i}/{len(files)}] {img.name}  ⏭️  bo qua (da co ket qua)")
                    all_results.append(prev)
                    continue
            except (json.JSONDecodeError, OSError):
                pass

        print(f"\n[{i}/{len(files)}] {img.name}")
        res = parse_one(img, models, modes, retry=args.retry)

        # Het quota -> dung ngay, khong dot them luot goi vo ich
        from parse_image import _is_quota_exhausted
        quota_hit = any(
            _is_quota_exhausted(r["error"])
            for md in res.get("modes", {}).values()
            for r in md.values()
            if isinstance(r, dict) and "error" in r
        )

        truth_path = img.with_suffix(".truth.json")
        gt = json.loads(truth_path.read_text(encoding="utf-8")) if truth_path.exists() else None

        res["scores"] = {}
        for mode in modes:
            res["scores"][mode] = {}
            for model in models:
                raw = res["modes"].get(mode, {}).get(model)
                if raw is None:
                    continue
                res["scores"][mode][model] = score(mode, raw, gt)

        (out_dir / f"{img.stem}.json").write_text(
            json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        all_results.append(res)

        if quota_hit:
            print("\n" + "!" * 62)
            print("⛔ HET QUOTA GEMINI — dung lai de khong lang phi them luot goi.")
            print("!" * 62)
            print(f"\n   Da xu ly {i}/{len(files)} anh. Ket qua duoc luu lai binh thuong.")
            print("\n   Lua chon:")
            print("   1. Doi quota reset (free tier reset theo ngay, gio Thai Binh Duong)")
            print("   2. Bat billing tai https://aistudio.google.com/apikey")
            print("   3. Doi model nhe hon: set GEMINI_VISION_MODEL=gemini-flash-lite-latest")
            print("   4. Chay tiep tu anh dang do: them --skip-existing")
            print("\n   Xem quota hien tai: https://ai.dev/rate-limit\n")
            break

        print("  ── scores ──")
        for mode in modes:
            for model in models:
                s = res["scores"][mode].get(model)
                if s:
                    print(f"     {mode:9s} {model:7s} {s['score_pct']:5.1f}%  [{s['status']}]")

    agg = aggregate(all_results, models)
    paired = paired_compare(all_results, models)
    rec = build_recommendation(agg, models, paired)

    report = {
        "generated": datetime.now().isoformat(),
        "image_count": len(all_results),
        "models": models,
        "modes": modes,
        "aggregate": agg,
        "paired": paired,
        "recommendation": rec,
        "results": all_results,
    }
    Path("compare_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    Path("compare_report.md").write_text(render_markdown(agg, rec, models, all_results), encoding="utf-8")
    Path("compare_report.html").write_text(render_html(agg, rec, models, all_results), encoding="utf-8")

    # Canh bao neu ty le loi API cao lam sai lech ket qua
    for mode in modes:
        for model in models:
            a = agg[mode][model]
            if a["errors"] and a["errors"] / max(1, len(all_results)) >= 0.2:
                print(f"\n⚠️  {mode}/{model}: {a['errors']}/{len(all_results)} anh LOI API "
                      f"({a['errors']/len(all_results)*100:.0f}%) — ket qua co the sai lech.")
                print("    Chay lai voi --retry 2 de giam nhieu.")

    print("\n" + "=" * 62)
    print("📊 KET QUA TONG HOP\n")
    for mode in modes:
        for model in models:
            a = agg[mode][model]
            if a["n"]:
                print(f"   {MODES[mode]['label']:24s} {model:7s} "
                      f"avg={a['avg_score']:5.1f}%  (nguong {a['pass_threshold']}%)  → {a['verdict']}")
    print(f"\n🏁 Decision: {rec['decision']}")
    print(f"   {rec['text']}\n")
    print("📄 Reports: compare_report.html  ← mo cai nay")
    print("            compare_report.md   ← dan vao PRD/validation-report")
    print("            compare_report.json")


if __name__ == "__main__":
    main()
