"""
test_scoring.py — Self-test cho rubric, chay OFFLINE (khong ton API)
=====================================================================

Muc dich: chung minh rubric hoat dong dung TRUOC khi bo tien goi Vision API,
va sinh ra mot bao cao mau (compare_report.html) bang du lieu gia lap de
ban thay truoc format output.

Usage:
    python test_scoring.py            # chay assertions
    python test_scoring.py --demo     # them: sinh bao cao mau tu fixture
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from scoring import score
from compare import aggregate, build_recommendation, render_html, render_markdown

# ─── Fixtures ────────────────────────────────────────────────────────────────

PERFECT_CONCEPT = {
    "is_step_tutorial": True,
    "confidence": 0.92,
    "subject_name": "rabbit",
    "subject_name_vi": "con thỏ",
    "hook_shape": "number 3",
    "suggested_hooks": ["number 3"],
    "style_tags": ["cute", "simple"],
    "complexity": "easy",
    "step_count": 5,
    "steps": [
        {"step_number": 1, "part_name": "hook_digit_3", "description": "Draw the number 3",
         "primitive_hint": "bezier", "stroke_count": 1, "voice_cue": "Vẽ số ba nhé"},
        {"step_number": 2, "part_name": "left_ear", "description": "Long ear on the left",
         "primitive_hint": "arc", "stroke_count": 1, "voice_cue": "Thêm cái tai trái"},
        {"step_number": 3, "part_name": "right_ear", "description": "Long ear on the right",
         "primitive_hint": "arc", "stroke_count": 1, "voice_cue": "Rồi tai phải nữa"},
        {"step_number": 4, "part_name": "eyes", "description": "Two small round eyes",
         "primitive_hint": "circle", "stroke_count": 2, "voice_cue": "Hai con mắt tròn xoe"},
        {"step_number": 5, "part_name": "nose_mouth", "description": "Nose and smile",
         "primitive_hint": "polyline", "stroke_count": 2, "voice_cue": "Cuối cùng là mũi và miệng"},
    ],
}

SLOPPY_CONCEPT = {
    "is_step_tutorial": True,
    "confidence": 0.55,
    "subject_name": "rabbit",
    "hook_shape": None,
    "suggested_hooks": [],
    "step_count": 4,
    "steps": [
        {"step_number": 1, "part_name": "Body Part", "description": "draw body",
         "primitive_hint": "blob", "voice_cue": "Now we are going to draw the body of the rabbit carefully"},
        {"step_number": 2, "part_name": "Body Part", "description": "draw ears"},
    ],
}

PERFECT_GEOMETRY = {
    "is_step_tutorial": True,
    "confidence": 0.85,
    "subject_name": "rabbit",
    "hook_shape": "number 3",
    "step_count": 2,
    "steps": [
        {"step_number": 1, "description": "digit 3", "voice_cue": "Vẽ số ba",
         "new_strokes": [{"id": "s1", "type": "bezier", "relative_points": [[0.4, 0.3], [0.6, 0.45], [0.4, 0.6]]}]},
        {"step_number": 2, "description": "ears", "voice_cue": "Thêm tai",
         "new_strokes": [
             {"id": "s2", "type": "arc", "relative_cx": 0.45, "relative_cy": 0.25, "relative_rx": 0.06, "relative_ry": 0.14},
             {"id": "s3", "type": "arc", "relative_cx": 0.58, "relative_cy": 0.25, "relative_rx": 0.06, "relative_ry": 0.14},
         ]},
    ],
}

BROKEN_GEOMETRY = {
    "is_step_tutorial": True,
    "confidence": 0.45,
    "subject_name": "rabbit",
    "hook_shape": "3",
    "step_count": 3,
    "steps": [
        {"step_number": 1, "description": "body",
         "new_strokes": [{"id": "s1", "type": "blob", "relative_cx": 2.7, "relative_cy": -0.4, "relative_r": 0.0}]},
        {"step_number": 2, "description": "ears", "new_strokes": []},
    ],
}

REJECTED = {"is_step_tutorial": False, "confidence": 0.1,
            "reject_reason": "single finished illustration, not a step tutorial", "steps": []}

ERRORED = {"error": "OPENAI_API_KEY not set"}


# ─── Assertions ──────────────────────────────────────────────────────────────

def run_tests() -> None:
    checks = []

    def check(name: str, cond: bool, detail: str = "") -> None:
        checks.append((name, cond, detail))

    s = score("concept", PERFECT_CONCEPT)
    check("perfect concept -> pass", s["status"] == "pass", f"{s['score_pct']}% {s['notes']}")
    check("perfect concept >= 95%", s["score_pct"] >= 95, f"{s['score_pct']}%")

    s2 = score("concept", SLOPPY_CONCEPT)
    check("sloppy concept -> not pass", s2["status"] != "pass", f"{s2['score_pct']}%")
    check("sloppy concept flags english voice_cue",
          any("Vietnamese" in n for n in s2["notes"]), str(s2["notes"]))
    check("sloppy concept flags duplicate part_name",
          any("duplicate" in n for n in s2["notes"]), str(s2["notes"]))
    check("sloppy concept flags bad primitive",
          any("primitive_hint" in n for n in s2["notes"]), str(s2["notes"]))

    s3 = score("geometry", PERFECT_GEOMETRY)
    check("perfect geometry -> pass", s3["status"] == "pass", f"{s3['score_pct']}%")
    check("perfect geometry coords 100% valid", s3["coord_validity"] == 100.0, str(s3["coord_validity"]))

    s4 = score("geometry", BROKEN_GEOMETRY)
    check("broken geometry -> fail/partial", s4["status"] in ("fail", "partial"), f"{s4['score_pct']}%")
    check("broken geometry detects out-of-range coords",
          s4["coord_validity"] is not None and s4["coord_validity"] < 100, str(s4["coord_validity"]))
    check("broken geometry detects degenerate stroke",
          (s4["coord_degenerate"] or 0) > 0, str(s4["coord_degenerate"]))

    s5 = score("concept", REJECTED)
    check("rejected -> status rejected", s5["status"] == "rejected", str(s5))

    s6 = score("concept", ERRORED)
    check("error -> status error", s6["status"] == "error", str(s6))

    gt = {"step_count": 5, "subject_name": "rabbit", "hook_shape": "number 3"}
    s7 = score("concept", PERFECT_CONCEPT, gt)
    check("ground truth step accuracy = 1.0", s7.get("gt_step_accuracy") == 1.0, str(s7.get("gt_step_accuracy")))
    check("ground truth subject match", s7.get("gt_subject_match") is True, str(s7.get("gt_subject_match")))
    check("ground truth hook match", s7.get("gt_hook_match") is True, str(s7.get("gt_hook_match")))

    passed = sum(1 for _, c, _ in checks if c)
    print(f"\n🧪 Rubric self-test — {passed}/{len(checks)} passed\n")
    for name, cond, detail in checks:
        print(f"   {'✅' if cond else '❌'} {name}" + (f"   ({detail})" if not cond or detail else ""))

    print("\n📊 Diem mau:")
    print(f"   concept  perfect = {s['score_pct']}%   sloppy = {s2['score_pct']}%")
    print(f"   geometry perfect = {s3['score_pct']}%   broken = {s4['score_pct']}%")

    if passed != len(checks):
        raise SystemExit(1)


# ─── Demo report ─────────────────────────────────────────────────────────────

def build_demo() -> None:
    """Sinh bao cao mau bang fixture — de xem truoc format, khong goi API."""
    fixtures = [
        ("rabbit_easy.jpg", PERFECT_CONCEPT, PERFECT_GEOMETRY),
        ("cat_medium.jpg", PERFECT_CONCEPT, BROKEN_GEOMETRY),
        ("dog_hard.jpg", SLOPPY_CONCEPT, BROKEN_GEOMETRY),
    ]
    models = ["openai"]
    results = []
    for name, c, g in fixtures:
        for raw in (c, g):
            raw.setdefault("_meta", {"elapsed_s": 3.4})
        results.append({
            "image": f"images/{name}",
            "timestamp": datetime.now().isoformat(),
            "modes": {"concept": {"openai": c}, "geometry": {"openai": g}},
            "scores": {
                "concept": {"openai": score("concept", c)},
                "geometry": {"openai": score("geometry", g)},
            },
        })

    agg = aggregate(results, models)
    rec = build_recommendation(agg, models)
    Path("compare_report.demo.html").write_text(render_html(agg, rec, models, results), encoding="utf-8")
    Path("compare_report.demo.md").write_text(render_markdown(agg, rec, models, results), encoding="utf-8")
    Path("compare_report.demo.json").write_text(
        json.dumps({"aggregate": agg, "recommendation": rec}, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n📄 Demo reports (du lieu GIA LAP, khong phai ket qua that):")
    print("   compare_report.demo.html")
    print("   compare_report.demo.md")
    print(f"\n🏁 Demo decision: {rec['decision']}")
    print(f"   concept  avg = {agg['concept']['openai']['avg_score']}%")
    print(f"   geometry avg = {agg['geometry']['openai']['avg_score']}%")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true", help="Sinh them bao cao mau tu fixture")
    a = ap.parse_args()
    run_tests()
    if a.demo:
        build_demo()
