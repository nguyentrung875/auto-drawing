"""
eval.py — Batch Evaluation Runner
===================================
Chạy parse_image.py trên toàn bộ ảnh trong thư mục images/,
tổng hợp kết quả thành bảng eval và báo cáo accuracy.

Usage:
    python eval.py [--model openai|gemini|both] [--images-dir images/]

Output:
    - eval_results/  (thư mục chứa JSON từng ảnh)
    - eval_report.json  (tổng hợp)
    - eval_report.html  (bảng HTML đẹp để xem)
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# ─── Scoring ─────────────────────────────────────────────────────────────────

def score_result(result: dict, ground_truth: dict | None = None) -> dict:
    """
    Tính điểm cho một kết quả Vision LLM.
    Nếu có ground_truth (file .truth.json cạnh ảnh), so sánh trực tiếp.
    Nếu không, đánh giá dựa trên structural completeness.
    """
    scores = {}

    for model in ("openai", "gemini"):
        r = result.get(model, {})
        if "error" in r:
            scores[model] = {"score": 0.0, "reason": r["error"], "status": "error"}
            continue

        if not r.get("is_step_tutorial"):
            scores[model] = {"score": 0.0, "reason": "not detected as tutorial", "status": "rejected"}
            continue

        pts = 0
        max_pts = 0
        notes = []

        # 1. subject_name present (10 pts)
        max_pts += 10
        if r.get("subject_name"):
            pts += 10
        else:
            notes.append("missing subject_name")

        # 2. step_count > 0 (10 pts)
        max_pts += 10
        step_count = r.get("step_count", 0)
        if step_count > 0:
            pts += 10
        else:
            notes.append("step_count=0")

        # 3. steps array matches step_count (20 pts)
        max_pts += 20
        steps = r.get("steps", [])
        if len(steps) == step_count and step_count > 0:
            pts += 20
        elif len(steps) > 0:
            pts += 10
            notes.append(f"steps array len {len(steps)} != step_count {step_count}")
        else:
            notes.append("empty steps array")

        # 4. Each step has new_strokes (20 pts)
        max_pts += 20
        steps_with_strokes = sum(1 for s in steps if s.get("new_strokes"))
        if steps and steps_with_strokes == len(steps):
            pts += 20
        elif steps:
            ratio = steps_with_strokes / len(steps)
            pts += int(20 * ratio)
            notes.append(f"only {steps_with_strokes}/{len(steps)} steps have strokes")

        # 5. Stroke types are valid primitives (20 pts)
        max_pts += 20
        valid_types = {"arc", "circle", "line", "bezier", "polyline", "rect"}
        all_strokes = [s for step in steps for s in step.get("new_strokes", [])]
        if all_strokes:
            valid_count = sum(1 for s in all_strokes if s.get("type") in valid_types)
            ratio = valid_count / len(all_strokes)
            pts += int(20 * ratio)
            if ratio < 1.0:
                invalid = [s.get("type") for s in all_strokes if s.get("type") not in valid_types]
                notes.append(f"invalid types: {set(invalid)}")

        # 6. voice_cue present (10 pts)
        max_pts += 10
        steps_with_voice = sum(1 for s in steps if s.get("voice_cue"))
        if steps and steps_with_voice == len(steps):
            pts += 10
        elif steps:
            pts += int(10 * steps_with_voice / len(steps))

        # 7. confidence score (10 pts — bonus for self-awareness)
        max_pts += 10
        confidence = r.get("confidence", 0)
        if confidence >= 0.7:
            pts += 10
        elif confidence >= 0.5:
            pts += 5
            notes.append(f"low confidence: {confidence}")
        else:
            notes.append(f"very low confidence: {confidence}")

        # Ground truth comparison (if available)
        gt_match = None
        if ground_truth:
            gt_steps = ground_truth.get("step_count", 0)
            predicted_steps = step_count
            if gt_steps > 0:
                step_accuracy = 1.0 - abs(gt_steps - predicted_steps) / gt_steps
                gt_match = {"step_count_accuracy": round(step_accuracy, 2)}

        pct = round(pts / max_pts * 100, 1) if max_pts > 0 else 0
        scores[model] = {
            "score_pct": pct,
            "pts": pts,
            "max_pts": max_pts,
            "status": "pass" if pct >= 70 else ("partial" if pct >= 50 else "fail"),
            "notes": notes,
            "step_count": step_count,
            "subject": r.get("subject_name"),
            "hook": r.get("hook_shape"),
            "confidence": confidence,
            "elapsed_s": r.get("_meta", {}).get("elapsed_s"),
        }
        if gt_match:
            scores[model]["ground_truth"] = gt_match

    return scores


# ─── HTML Report ─────────────────────────────────────────────────────────────

def render_html_report(results: list[dict]) -> str:
    rows = ""
    for r in results:
        for model in ("openai", "gemini"):
            s = r.get("scores", {}).get(model, {})
            status = s.get("status", "—")
            color = {"pass": "#22c55e", "partial": "#f59e0b", "fail": "#ef4444", "error": "#94a3b8", "rejected": "#94a3b8"}.get(status, "#fff")
            rows += f"""
            <tr>
              <td>{Path(r['image']).name}</td>
              <td><b>{model}</b></td>
              <td style="color:{color};font-weight:bold">{s.get('score_pct', '—')}%</td>
              <td>{status}</td>
              <td>{s.get('step_count', '—')}</td>
              <td>{s.get('subject', '—')}</td>
              <td>{s.get('hook') or '—'}</td>
              <td>{s.get('confidence', '—')}</td>
              <td>{s.get('elapsed_s', '—')}s</td>
              <td style="font-size:0.8em;color:#64748b">{'; '.join(s.get('notes', []))}</td>
            </tr>"""

    total_openai = [r.get("scores", {}).get("openai", {}).get("score_pct", 0) for r in results if "error" not in r.get("scores", {}).get("openai", {})]
    total_gemini = [r.get("scores", {}).get("gemini", {}).get("score_pct", 0) for r in results if "error" not in r.get("scores", {}).get("gemini", {})]
    avg_openai = round(sum(total_openai) / len(total_openai), 1) if total_openai else 0
    avg_gemini = round(sum(total_gemini) / len(total_gemini), 1) if total_gemini else 0

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Vision Ingestion Spike — Eval Report</title>
<style>
  body {{ font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }}
  h1 {{ color: #38bdf8; }}
  .summary {{ display: flex; gap: 2rem; margin: 1.5rem 0; }}
  .card {{ background: #1e293b; border-radius: 12px; padding: 1.5rem 2rem; min-width: 160px; }}
  .card .label {{ font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }}
  .card .value {{ font-size: 2rem; font-weight: 700; margin-top: 0.25rem; }}
  .pass {{ color: #22c55e; }} .partial {{ color: #f59e0b; }} .fail {{ color: #ef4444; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 1rem; }}
  th {{ background: #1e293b; padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; }}
  td {{ padding: 0.6rem 1rem; border-bottom: 1px solid #1e293b; font-size: 0.9rem; }}
  tr:hover td {{ background: #1e293b44; }}
  .threshold {{ color: #94a3b8; font-size: 0.85rem; margin-top: 1rem; }}
</style>
</head>
<body>
<h1>🧪 Vision Ingestion Spike — Eval Report</h1>
<p style="color:#94a3b8">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

<div class="summary">
  <div class="card">
    <div class="label">Images tested</div>
    <div class="value">{len(results)}</div>
  </div>
  <div class="card">
    <div class="label">GPT-4o avg score</div>
    <div class="value {'pass' if avg_openai >= 70 else 'partial' if avg_openai >= 50 else 'fail'}">{avg_openai}%</div>
  </div>
  <div class="card">
    <div class="label">Gemini avg score</div>
    <div class="value {'pass' if avg_gemini >= 70 else 'partial' if avg_gemini >= 50 else 'fail'}">{avg_gemini}%</div>
  </div>
</div>

<p class="threshold">Pass threshold: ≥70% | Partial: 50–69% | Fail: &lt;50%</p>

<table>
  <thead>
    <tr>
      <th>Image</th><th>Model</th><th>Score</th><th>Status</th>
      <th>Steps</th><th>Subject</th><th>Hook</th><th>Confidence</th><th>Time</th><th>Notes</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>
</body>
</html>"""


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["openai", "gemini", "both"], default="both")
    parser.add_argument("--images-dir", default="images")
    args = parser.parse_args()

    images_dir = Path(args.images_dir)
    if not images_dir.exists():
        print(f"❌ Images directory not found: {images_dir}")
        print(f"   Tạo thư mục và đặt ảnh vào: {images_dir.absolute()}")
        sys.exit(1)

    image_files = [p for p in sorted(images_dir.iterdir()) if p.suffix.lower() in SUPPORTED_EXTS]
    if not image_files:
        print(f"❌ Không tìm thấy ảnh trong {images_dir}/ (jpg/png/webp)")
        sys.exit(1)

    print(f"\n🔬 Eval Runner — {len(image_files)} images, model={args.model}")
    print("=" * 60)

    out_dir = Path("eval_results")
    out_dir.mkdir(exist_ok=True)

    all_results = []

    for i, img_path in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}] {img_path.name}")

        # Run parse_image.py as subprocess
        result_path = out_dir / img_path.with_suffix(".result.json").name
        cmd = [
            sys.executable, "parse_image.py",
            str(img_path),
            "--model", args.model,
            "--out", str(result_path),
        ]
        subprocess.run(cmd, check=False)

        if result_path.exists():
            result = json.loads(result_path.read_text(encoding="utf-8"))
        else:
            result = {"image": str(img_path), "error": "parse_image.py failed"}

        # Load ground truth if exists
        truth_path = img_path.with_suffix(".truth.json")
        ground_truth = json.loads(truth_path.read_text(encoding="utf-8")) if truth_path.exists() else None

        scores = score_result(result, ground_truth)
        result["scores"] = scores
        all_results.append(result)

        for model, s in scores.items():
            status = s.get("status", "—")
            pct = s.get("score_pct", "—")
            print(f"   {model:8s}: {pct}% [{status}]  steps={s.get('step_count','?')} subject={s.get('subject','?')}")

    # Save report
    report = {
        "generated": datetime.now().isoformat(),
        "image_count": len(all_results),
        "results": all_results,
    }
    Path("eval_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    Path("eval_report.html").write_text(render_html_report(all_results), encoding="utf-8")

    print("\n" + "=" * 60)
    print("📊 Reports saved:")
    print("   eval_report.json")
    print("   eval_report.html  ← mở file này để xem bảng kết quả")
    print("\n🎨 Để xem visual render: mở render.html và load file JSON từ eval_results/")


if __name__ == "__main__":
    main()
