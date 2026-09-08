"""
scoring.py — Rubric cham diem cho 2 che do Vision Ingestion
============================================================

Nguyen tac: moi che do duoc cham theo dung nhung gi no HUA lam duoc.
Khong cham mode concept theo tieu chi toa do (no co tinh khong sinh toa do).

CONCEPT MODE (100 diem)                  GEOMETRY MODE (100 diem)
  15  subject_name + subject_name_vi       10  subject_name
  10  hook_shape / suggested_hooks         10  step_count > 0
  10  step_count hop ly (3-10)             20  len(steps) == step_count
  20  len(steps) == step_count             20  moi step co new_strokes
  15  part_name unique + snake_case        20  stroke type la primitive hop le
  15  voice_cue tieng Viet, <= 10 tu        10  voice_cue present
  10  primitive_hint hop le                10  confidence >= 0.7
   5  complexity hop le
Bonus/penalty ground truth ap dung cho ca hai.

Ngoai diem, ta con do 2 chi so RIENG cho geometry mode de lo ra diem yeu that:
  - coord_validity : % toa do nam trong [0,1]
  - coord_degenerate: % net co ban kinh/kich thuoc ~ 0 (hinh suy bien)
"""

from __future__ import annotations

import re

VALID_PRIMITIVES = {"arc", "circle", "line", "bezier", "bezier_2", "bezier_3", "polyline", "rect"}
VALID_COMPLEXITY = {"easy", "medium", "hard"}

SNAKE_CASE = re.compile(r"^[a-z][a-z0-9_]*$")

# Ky tu co dau tieng Viet — dung de phat hien voice_cue that su la tieng Viet
VI_CHARS = set("ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ")
VI_STOPWORDS = {"va", "và", "them", "thêm", "cai", "cái", "roi", "rồi", "nhe", "nhé",
                "ve", "vẽ", "mot", "một", "hai", "cho", "nay", "này", "tiep", "tiếp",
                "la", "là", "cua", "của", "o", "ở", "xong", "ta", "ban", "bạn"}


def _pct(pts: float, max_pts: float) -> float:
    return round(pts / max_pts * 100, 1) if max_pts > 0 else 0.0


def _is_vietnamese(text: str) -> bool:
    if not text:
        return False
    low = text.lower()
    if any(ch in VI_CHARS for ch in low):
        return True
    words = set(re.findall(r"[a-z]+", low))
    return len(words & VI_STOPWORDS) >= 1


# ─── Concept mode ────────────────────────────────────────────────────────────

def score_concept(r: dict, ground_truth: dict | None = None) -> dict:
    if "error" in r:
        return {"score_pct": 0.0, "status": "error", "notes": [r["error"]]}
    gate = _rejection_gate(r, ground_truth)
    if gate is not None:
        return gate

    pts, max_pts, notes = 0.0, 0.0, []
    steps = r.get("steps") or []
    step_count = r.get("step_count") or 0

    # 1. subject naming (15)
    max_pts += 15
    if r.get("subject_name"):
        pts += 10
    else:
        notes.append("missing subject_name")
    if r.get("subject_name_vi"):
        pts += 5
    else:
        notes.append("missing subject_name_vi")

    # 2. hook (10)
    max_pts += 10
    hooks = r.get("suggested_hooks") or []
    if r.get("hook_shape"):
        pts += 10
    elif hooks:
        pts += 7
        notes.append("no hook detected, fell back to suggested_hooks")
    else:
        notes.append("no hook and no suggested_hooks")

    # 3. step_count in a usable range (10)
    max_pts += 10
    if 3 <= step_count <= 10:
        pts += 10
    elif step_count > 0:
        pts += 5
        notes.append(f"step_count={step_count} outside ideal 3-10")
    else:
        notes.append("step_count=0")

    # 4. steps array consistency (20)
    max_pts += 20
    if steps and len(steps) == step_count:
        pts += 20
    elif steps:
        pts += 10
        notes.append(f"len(steps)={len(steps)} != step_count={step_count}")
    else:
        notes.append("empty steps array")

    # 5. part_name unique + snake_case (15)
    max_pts += 15
    if steps:
        names = [s.get("part_name") or "" for s in steps]
        filled = [n for n in names if n]
        pts += 5 * (len(filled) / len(steps))
        if filled and len(set(filled)) == len(filled):
            pts += 5
        else:
            notes.append("duplicate part_name")
        ok_case = sum(1 for n in filled if SNAKE_CASE.match(n))
        pts += 5 * (ok_case / len(steps))
        if filled and ok_case < len(filled):
            notes.append("part_name not snake_case")

    # 6. voice_cue vietnamese + short (15)
    max_pts += 15
    if steps:
        with_cue = [s.get("voice_cue") or "" for s in steps]
        filled = [c for c in with_cue if c]
        pts += 5 * (len(filled) / len(steps))
        vi_ok = sum(1 for c in filled if _is_vietnamese(c))
        pts += 6 * (vi_ok / len(steps))
        if filled and vi_ok < len(filled):
            notes.append(f"only {vi_ok}/{len(filled)} voice_cue look Vietnamese")
        short_ok = sum(1 for c in filled if len(c.split()) <= 10)
        pts += 4 * (short_ok / len(steps))
        if filled and short_ok < len(filled):
            notes.append("some voice_cue longer than 10 words")

    # 7. primitive_hint valid (10)
    max_pts += 10
    if steps:
        hints = [s.get("primitive_hint") for s in steps]
        ok = sum(1 for h in hints if h in VALID_PRIMITIVES)
        pts += 10 * (ok / len(steps))
        if ok < len(steps):
            bad = {h for h in hints if h not in VALID_PRIMITIVES}
            notes.append(f"invalid primitive_hint: {bad}")

    # 8. complexity (5)
    max_pts += 5
    if r.get("complexity") in VALID_COMPLEXITY:
        pts += 5
    else:
        notes.append("missing/invalid complexity")

    out = {
        "score_pct": _pct(pts, max_pts),
        "pts": round(pts, 1),
        "max_pts": max_pts,
        "notes": notes,
        "step_count": step_count,
        "subject": r.get("subject_name"),
        "hook": r.get("hook_shape") or (hooks[0] if hooks else None),
        "confidence": r.get("confidence", 0),
        "elapsed_s": r.get("_meta", {}).get("elapsed_s"),
    }
    out.update(_ground_truth_delta(r, ground_truth))
    return out


# ─── Geometry mode ───────────────────────────────────────────────────────────

def score_geometry(r: dict, ground_truth: dict | None = None) -> dict:
    if "error" in r:
        return {"score_pct": 0.0, "status": "error", "notes": [r["error"]]}
    gate = _rejection_gate(r, ground_truth)
    if gate is not None:
        return gate

    pts, max_pts, notes = 0.0, 0.0, []
    steps = r.get("steps") or []
    step_count = r.get("step_count") or 0

    # 1. subject_name (10)
    max_pts += 10
    if r.get("subject_name"):
        pts += 10
    else:
        notes.append("missing subject_name")

    # 2. step_count (10)
    max_pts += 10
    if step_count > 0:
        pts += 10
    else:
        notes.append("step_count=0")

    # 3. steps array consistency (20)
    max_pts += 20
    if steps and len(steps) == step_count:
        pts += 20
    elif steps:
        pts += 10
        notes.append(f"len(steps)={len(steps)} != step_count={step_count}")
    else:
        notes.append("empty steps array")

    # 4. every step has new_strokes (20)
    max_pts += 20
    if steps:
        with_strokes = sum(1 for s in steps if s.get("new_strokes"))
        pts += 20 * (with_strokes / len(steps))
        if with_strokes < len(steps):
            notes.append(f"only {with_strokes}/{len(steps)} steps have strokes")

    # 5. valid primitive types (20)
    max_pts += 20
    all_strokes = [s for step in steps for s in (step.get("new_strokes") or [])]
    if all_strokes:
        ok = sum(1 for s in all_strokes if s.get("type") in VALID_PRIMITIVES)
        pts += 20 * (ok / len(all_strokes))
        if ok < len(all_strokes):
            bad = {s.get("type") for s in all_strokes if s.get("type") not in VALID_PRIMITIVES}
            notes.append(f"invalid types: {bad}")
    else:
        notes.append("no strokes at all")

    # 6. voice_cue present (10)
    max_pts += 10
    if steps:
        with_voice = sum(1 for s in steps if s.get("voice_cue"))
        pts += 10 * (with_voice / len(steps))

    # 7. confidence (10)
    max_pts += 10
    conf = r.get("confidence", 0) or 0
    if conf >= 0.7:
        pts += 10
    elif conf >= 0.5:
        pts += 5
        notes.append(f"low confidence: {conf}")
    else:
        notes.append(f"very low confidence: {conf}")

    coord = _coord_health(all_strokes)
    if coord["coord_validity"] is not None and coord["coord_validity"] < 100:
        notes.append(f"{100 - coord['coord_validity']:.0f}% coords out of [0,1]")
    if coord["coord_degenerate"]:
        notes.append(f"{coord['coord_degenerate']:.0f}% strokes degenerate")

    out = {
        "score_pct": _pct(pts, max_pts),
        "pts": round(pts, 1),
        "max_pts": max_pts,
        "notes": notes,
        "step_count": step_count,
        "subject": r.get("subject_name"),
        "hook": r.get("hook_shape"),
        "confidence": conf,
        "elapsed_s": r.get("_meta", {}).get("elapsed_s"),
        "stroke_count": len(all_strokes),
        **coord,
    }
    out.update(_ground_truth_delta(r, ground_truth))
    return out


# ─── Shared helpers ──────────────────────────────────────────────────────────

def _rejection_gate(r: dict, gt: dict | None) -> dict | None:
    """Xu ly truong hop model tra ve is_step_tutorial=false.

    Quan trong: bo anh test co ca NEGATIVE case (anh hoan thien, so do giai phau).
    Voi nhung anh do, tu choi dung LA THANH CONG -> cham 100, status "true_negative".
    Tu choi nham mot tutorial that -> "false_negative" (0 diem).
    Khong co ground truth -> giu nguyen "rejected" trung tinh, khong tinh vao avg.
    """
    said_tutorial = bool(r.get("is_step_tutorial"))
    gt_tutorial = gt.get("is_step_tutorial") if gt and "is_step_tutorial" in gt else None

    # Model NHAN dien la tutorial, nhung ground truth noi khong phai -> false positive
    if said_tutorial and gt_tutorial is False:
        return {
            "score_pct": 0.0,
            "status": "false_positive",
            "notes": ["ground truth: khong phai step tutorial, nhung model van parse"],
            "step_count": r.get("step_count", 0),
            "subject": r.get("subject_name"),
            "confidence": r.get("confidence", 0),
            "elapsed_s": r.get("_meta", {}).get("elapsed_s"),
        }

    if said_tutorial:
        return None  # di tiep vao rubric binh thuong

    # Model TU CHOI
    base = {
        "notes": [r.get("reject_reason") or "not detected as tutorial"],
        "step_count": 0,
        "subject": r.get("subject_name"),
        "confidence": r.get("confidence", 0),
        "elapsed_s": r.get("_meta", {}).get("elapsed_s"),
    }
    if gt_tutorial is False:
        return {**base, "score_pct": 100.0, "status": "true_negative",
                "notes": ["✅ tu choi dung (negative case)"] + base["notes"]}
    if gt_tutorial is True:
        return {**base, "score_pct": 0.0, "status": "false_negative",
                "notes": ["❌ tu choi nham mot tutorial that"] + base["notes"]}
    return {**base, "score_pct": 0.0, "status": "rejected"}


def _coord_health(strokes: list[dict]) -> dict:
    """Do suc khoe toa do — chi ap dung cho geometry mode."""
    if not strokes:
        return {"coord_validity": None, "coord_degenerate": None}

    total, in_range, degenerate = 0, 0, 0
    for s in strokes:
        vals = []
        for k in ("relative_cx", "relative_cy", "relative_rx", "relative_ry",
                  "relative_r", "relative_x", "relative_y", "relative_w", "relative_h"):
            v = s.get(k)
            if isinstance(v, (int, float)):
                vals.append((k, float(v)))
        for pt in s.get("relative_points") or []:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                vals.append(("px", float(pt[0])))
                vals.append(("py", float(pt[1])))

        for _, v in vals:
            total += 1
            if -0.05 <= v <= 1.05:
                in_range += 1

        sizes = [v for k, v in vals if k in ("relative_rx", "relative_ry", "relative_r",
                                             "relative_w", "relative_h")]
        if sizes and max(sizes) < 0.01:
            degenerate += 1

    return {
        "coord_validity": round(in_range / total * 100, 1) if total else None,
        "coord_degenerate": round(degenerate / len(strokes) * 100, 1),
    }


def _ground_truth_delta(r: dict, gt: dict | None) -> dict:
    if not gt:
        return {}
    out = {}
    gt_steps = gt.get("step_count") or 0
    if gt_steps > 0:
        pred = r.get("step_count") or 0
        out["gt_step_accuracy"] = round(max(0.0, 1 - abs(gt_steps - pred) / gt_steps), 2)
    if gt.get("subject_name"):
        pred = (r.get("subject_name") or "").lower()
        out["gt_subject_match"] = gt["subject_name"].lower() in pred or pred in gt["subject_name"].lower()
    if "hook_shape" in gt:
        pred_hook = (r.get("hook_shape") or "").lower()
        gt_hook = (gt.get("hook_shape") or "").lower()
        out["gt_hook_match"] = (pred_hook == gt_hook) or (bool(gt_hook) and gt_hook in pred_hook)
    return out


SCORERS = {"concept": score_concept, "geometry": score_geometry}


def score(mode: str, result: dict, ground_truth: dict | None = None) -> dict:
    s = SCORERS[mode](result, ground_truth)
    if "status" not in s:
        from prompts import MODES
        pt = MODES[mode]["pass_threshold"]
        pl = MODES[mode]["partial_threshold"]
        pct = s["score_pct"]
        s["status"] = "pass" if pct >= pt else ("partial" if pct >= pl else "fail")
    return s
