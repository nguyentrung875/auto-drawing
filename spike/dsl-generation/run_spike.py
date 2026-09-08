#!/usr/bin/env python3
"""Spike: Concept Plan -> Drawing DSL. Kiem chung Open Question #5 cua PRD.

Cau hoi: Concept Plan chi mo ta NGU NGHIA. Lieu tung ay co du de LLM sinh ra
hinh hoc DUNG TY LE khong? Neu khong -> phai bo sung goi y vi tri vao FR-3b.

Chay:
    python run_spike.py --dry-run          # xem se goi gi, khong ton quota
    python run_spike.py                    # goi API that (2 plan x 1 model)
    python run_spike.py --baseline-only    # chi cham hinh mau, khong goi API
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

from dsl_prompt import SYSTEM, build_user_prompt
from geometry_check import check
from render_svg import render, render_page

HERE = Path(__file__).parent
PLANS = HERE / "concept_plans"
OUT = HERE / "results"
MODEL = os.environ.get("GEMINI_VISION_MODEL", "gemini-3.6-flash")


def strip_fence(t: str) -> str:
    t = t.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n", "", t)
        t = re.sub(r"\n```$", "", t.rstrip())
    return t.strip()


def call_gemini(plan: dict, retry: int = 2) -> dict:
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"error": "chua cai google-genai: pip install google-genai"}

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return {"error": "thieu GEMINI_API_KEY"}

    client = genai.Client(api_key=key)
    attempt = 0
    while True:
        t0 = time.time()
        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=build_user_prompt(plan),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM,
                    temperature=0.2,
                    max_output_tokens=8000,
                    response_mime_type="application/json",
                ),
            )
            raw = strip_fence(resp.text or "")
            data = json.loads(raw)
            data["_meta"] = {"elapsed_s": round(time.time() - t0, 2), "model": MODEL}
            return data
        except json.JSONDecodeError as e:
            return {"error": f"JSON parse failed: {e}", "_raw": raw[:600]}
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            low = msg.lower()
            if "exceeded your current quota" in low or "billing details" in low:
                return {"error": f"HET QUOTA: {msg[:200]}", "_quota": True}
            if attempt < retry and any(x in low for x in ("503", "unavailable", "429", "500")):
                attempt += 1
                wait = 5 * (2 ** (attempt - 1))
                print(f"     loi tam thoi, doi {wait}s ({attempt}/{retry})...", flush=True)
                time.sleep(wait)
                continue
            return {"error": msg[:300]}


def baseline_dsl(plan: dict) -> dict:
    """Hinh mau ve tay dung ty le — moc so sanh cho ket qua LLM."""
    f = HERE / "baseline" / f"{plan['_name']}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--baseline-only", action="store_true")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()

    plans = []
    for f in sorted(PLANS.glob("*.json")):
        p = json.loads(f.read_text(encoding="utf-8"))
        p["_name"] = f.stem
        plans.append(p)

    print(f"\n{'='*60}\nSpike: Concept Plan -> Drawing DSL\n{'='*60}")
    print(f"  Concept plans : {len(plans)}  ({', '.join(p['_name'] for p in plans)})")
    print(f"  Model         : {args.model}")
    print(f"  So luot goi   : {0 if args.baseline_only else len(plans)}")

    if args.dry_run:
        print("\n  [dry-run] Prompt mau cho plan dau tien:\n")
        print("  --- SYSTEM (rut gon) ---")
        print("  " + SYSTEM[:300].replace("\n", "\n  ") + "...")
        print("\n  --- USER ---")
        print("  " + build_user_prompt(plans[0]).replace("\n", "\n  "))
        return 0

    OUT.mkdir(exist_ok=True)
    items, scores = [], []

    for p in plans:
        name = p["_name"]
        print(f"\n[{name}]")

        if args.baseline_only:
            dsl = baseline_dsl(p)
            if not dsl:
                print("  bo qua: chua co baseline")
                continue
            label = "baseline (ve tay)"
        else:
            print(f"  goi {args.model}...", flush=True)
            dsl = call_gemini(p)
            label = args.model
            if "error" in dsl:
                print(f"  THAT BAI: {dsl['error'][:150]}")
                (OUT / f"{name}.error.json").write_text(
                    json.dumps(dsl, ensure_ascii=False, indent=2), encoding="utf-8")
                if dsl.get("_quota"):
                    print("\n  HET QUOTA — dung lai. Dung --baseline-only de xem moc so sanh.")
                    break
                continue
            (OUT / f"{name}.dsl.json").write_text(
                json.dumps(dsl, ensure_ascii=False, indent=2), encoding="utf-8")

        r = check(dsl, p)
        scores.append(r["score_pct"])
        el = dsl.get("_meta", {}).get("elapsed_s", 0)
        print(f"  diem hinh hoc: {r['score_pct']}%  [{r['status']}]  ({el}s)")
        for i in r["issues"]:
            print(f"    - {i}")
        m = r["metrics"]
        print(f"    shapes={m.get('n_shapes')} fill={m.get('fill_ratio')} "
              f"le_lung={m.get('n_floating')} quan_he_sai="
              f"{m.get('n_relations_failed')}/{m.get('n_relations')}")

        items.append({
            "name": f"{name} — {label}",
            "svg": render(dsl, p["subject_name"], f"hook: {p.get('hook_shape')}"),
            "score": r["score_pct"], "status": r["status"], "issues": r["issues"],
        })

    if items:
        page = OUT / "report.html"
        render_page(items, str(page))
        print(f"\n{'='*60}")
        if scores:
            avg = sum(scores) / len(scores)
            print(f"  TRUNG BINH: {avg:.1f}%   ({len(scores)} plan)")
            print(f"\n  KET LUAN:")
            if avg >= 70:
                print("  Mo ta ngu nghia DU de sinh ty le chap nhan duoc.")
                print("  -> Giu nguyen FR-3b schema. Dong Open Question #5.")
            elif avg >= 45:
                print("  Ty le CHUA on dinh. Can bo sung goi y vi tri tho vao")
                print("  Concept Plan (vd anchor: 'top-left of head') -> sua FR-3b.")
            else:
                print("  Mo ta ngu nghia KHONG du. Path A khong tu sinh duoc hinh")
                print("  dep tu Concept Plan -> can xem lai kien truc FR-2/FR-3b.")
        print(f"\n  Bao cao truc quan: {page}")
        print(f"{'='*60}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
