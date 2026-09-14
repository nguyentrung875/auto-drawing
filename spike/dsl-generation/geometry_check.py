"""Kiem tra ty le hinh hoc cua Drawing DSL — KHONG can goi API.

Day la phan quan trong nhat cua spike: bien cau hoi chu quan "hinh co dep khong"
thanh cac phep do khach quan, lap lai duoc.

Cac loi ty le pho bien khi LLM sinh toa do tu mo ta ngu nghia:
  1. FLOATING    — bo phan le lung, khong cham vao bo phan nao khac
  2. OUT_OF_BOUNDS — tran ra ngoai canvas
  3. TINY/HUGE   — hinh qua nho hoac chiem gan het canvas
  4. WRONG_SIDE  — "on top of" nhung lai nam duoi, "inside" nhung lai o ngoai
  5. DEGENERATE  — ban kinh 0, polyline 1 diem, line dai 0
"""
from __future__ import annotations

import math

CANVAS = 1000.0


# ---------- trich xuat hinh bao (bounding box) cho tung loai shape ----------

def bbox(sh: dict) -> tuple[float, float, float, float] | None:
    """Tra ve (xmin, ymin, xmax, ymax) hoac None neu shape khong hop le."""
    t = sh.get("type")
    try:
        if t == "circle":
            cx, cy, r = float(sh["cx"]), float(sh["cy"]), float(sh["r"])
            return cx - r, cy - r, cx + r, cy + r
        if t in ("ellipse", "arc"):
            cx, cy = float(sh["cx"]), float(sh["cy"])
            rx, ry = float(sh["rx"]), float(sh["ry"])
            return cx - rx, cy - ry, cx + rx, cy + ry
        if t == "rect":
            x, y, w, h = float(sh["x"]), float(sh["y"]), float(sh["w"]), float(sh["h"])
            return min(x, x + w), min(y, y + h), max(x, x + w), max(y, y + h)
        if t == "line":
            x1, y1 = float(sh["x1"]), float(sh["y1"])
            x2, y2 = float(sh["x2"]), float(sh["y2"])
            return min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)
        if t == "polyline":
            pts = sh["points"]
            xs = [float(p[0]) for p in pts]
            ys = [float(p[1]) for p in pts]
            return min(xs), min(ys), max(xs), max(ys)
    except (KeyError, TypeError, ValueError, IndexError):
        return None
    return None


def center(sh: dict) -> tuple[float, float] | None:
    b = bbox(sh)
    if not b:
        return None
    return (b[0] + b[2]) / 2, (b[1] + b[3]) / 2


def is_degenerate(sh: dict) -> bool:
    b = bbox(sh)
    if not b:
        return True
    w, h = b[2] - b[0], b[3] - b[1]
    t = sh.get("type")
    if t == "line":
        return math.hypot(w, h) < 2.0
    if t == "polyline":
        pts = sh.get("points") or []
        if len(pts) < 2:
            return True
        return math.hypot(w, h) < 2.0
    return w < 2.0 or h < 2.0


def bbox_overlap(a: tuple, b: tuple) -> float:
    """Dien tich giao nhau cua hai bbox."""
    x = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    y = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    return x * y


def bbox_gap(a: tuple, b: tuple) -> float:
    """Khoang cach ngan nhat giua hai bbox (0 neu cham/chong nhau)."""
    dx = max(0.0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0.0, max(a[1], b[1]) - min(a[3], b[3]))
    return math.hypot(dx, dy)


# ---------- suy luan quan he tu mo ta ngu nghia ----------

REL_ABOVE = ("on top of", "above", "atop", "on top")
REL_BELOW = ("below", "beneath", "under", "at the bottom of")
REL_INSIDE = ("inside", "within", "on the face", "on the body", "on the head")
REL_TOUCH = ("overlapping", "attached", "connected", "touching")

# Tri thuc giai phau: bo phan nao HIEN NHIEN phai nam trong bo phan nao,
# ke ca khi description khong noi ro. Day la loai loi ty le nghiem trong nhat
# ma mo ta ngu nghia thuong bo sot.
ANATOMY_INSIDE = {
    "eye": "head", "eyes": "head", "pupil": "head", "nose": "head",
    "mouth": "head", "whisker": "head", "whiskers": "head",
    "face_details": "head", "face": "head", "inner_ear": "ear",
    "spot": "body", "spots": "body",
}
ANATOMY_ABOVE = {"ear": "head", "ears": "head", "horn": "head", "horns": "head",
                 "antler": "head", "ossicone": "head"}
ANATOMY_BELOW = {"leg": "body", "legs": "body", "foot": "body", "feet": "body",
                 "paw": "body", "paws": "body"}


def _find_ref(part_name: str, desc: str, prev: list[str], hint: str | None) -> str | None:
    """Tim bo phan tham chieu: uu tien ten duoc NHAC TOI trong description."""
    d = desc.lower()
    # 1. ten bo phan truoc do xuat hien nguyen van trong description
    for p in sorted(prev, key=len, reverse=True):
        if p.lower().replace("_", " ") in d or p.lower() in d:
            return p
    # 2. khop theo tu khoa giai phau (vd "head" -> part nao chua "head")
    if hint:
        for p in prev:
            if hint in p.lower():
                return p
    # 3. khop theo tu don xuat hien trong ca description lan ten part
    for p in prev:
        core = p.lower().split("_")[0]
        if len(core) > 2 and core in d:
            return p
    return None


def expected_relations(plan: dict) -> list[dict]:
    """Doc Concept Plan, suy ra cac rang buoc khong gian can kiem tra."""
    rels = []
    steps = plan["steps"]
    for i, s in enumerate(steps):
        d = s["description"].lower()
        name = s["part_name"]
        low = name.lower()
        if i == 0:
            continue
        prev = [p["part_name"] for p in steps[:i]]

        kind = None
        hint = None
        if any(k in d for k in REL_ABOVE):
            kind, hint = "above", "head"
        elif any(k in d for k in REL_BELOW):
            kind = "below"
        elif any(k in d for k in REL_INSIDE):
            kind = "inside"
        elif any(k in d for k in REL_TOUCH):
            kind = "touch"

        # Part GOP nhieu bo phan trai nguoc nhau (vd "legs_and_spots": chan nam
        # DUOI than nhung dom nam TRONG than) -> khong the kiem tra bang mot
        # rang buoc duy nhat. Bo qua de tranh bao loi gia.
        groups = set()
        for tbl, gname in ((ANATOMY_INSIDE, "in"), (ANATOMY_ABOVE, "up"),
                           (ANATOMY_BELOW, "down")):
            if any(k in low for k in tbl):
                groups.add(gname)
        if len(groups) > 1:
            continue

        # Tri thuc giai phau ghi de/bo sung khi mo ta khong noi ro
        for key, target in ANATOMY_INSIDE.items():
            if key in low:
                kind, hint = "inside", target
                break
        else:
            for key, target in ANATOMY_ABOVE.items():
                if key in low:
                    kind, hint = "above", target
                    break
            else:
                for key, target in ANATOMY_BELOW.items():
                    if key in low:
                        kind, hint = "below", target
                        break

        if not kind:
            continue
        ref = _find_ref(name, s["description"], prev, hint)
        if not ref:
            continue
        rels.append({"part": name, "kind": kind, "ref": ref,
                     "evidence": s["description"]})
    return rels


# ---------- cham diem ----------

def check(dsl: dict, plan: dict) -> dict:
    """Cham diem hinh hoc 100d. Tra ve dict co score_pct, issues, metrics."""
    issues: list[str] = []
    shapes = dsl.get("shapes") or []
    if not shapes:
        return {"score_pct": 0.0, "issues": ["khong co shape nao"], "metrics": {}}

    # gom shape theo part_name
    by_part: dict[str, list[dict]] = {}
    for sh in shapes:
        by_part.setdefault(sh.get("part_name", "?"), []).append(sh)

    def part_bbox(name: str):
        bs = [bbox(s) for s in by_part.get(name, [])]
        bs = [b for b in bs if b]
        if not bs:
            return None
        return (min(b[0] for b in bs), min(b[1] for b in bs),
                max(b[2] for b in bs), max(b[3] for b in bs))

    pts = 100.0

    # --- 1. Shape hop le (20d) ---
    bad = [s.get("id", "?") for s in shapes if bbox(s) is None]
    degen = [s.get("id", "?") for s in shapes if bbox(s) and is_degenerate(s)]
    if bad:
        pen = min(20.0, 20.0 * len(bad) / len(shapes))
        pts -= pen
        issues.append(f"{len(bad)}/{len(shapes)} shape thieu tham so hoac sai kieu: {bad[:4]} (-{pen:.0f}d)")
    if degen:
        pen = min(10.0, 10.0 * len(degen) / len(shapes))
        pts -= pen
        issues.append(f"{len(degen)}/{len(shapes)} shape suy bien (r=0 hoac dai 0): {degen[:4]} (-{pen:.0f}d)")

    valid = [s for s in shapes if bbox(s) and not is_degenerate(s)]
    if not valid:
        return {"score_pct": 0.0, "issues": issues + ["khong con shape hop le"], "metrics": {}}

    boxes = [bbox(s) for s in valid]

    # --- 2. Nam trong canvas (15d) ---
    out = [s.get("id", "?") for s, b in zip(valid, boxes)
           if b[0] < -1 or b[1] < -1 or b[2] > CANVAS + 1 or b[3] > CANVAS + 1]
    if out:
        pen = min(20.0, 8.0 + 12.0 * len(out) / len(valid))
        pts -= pen
        issues.append(f"{len(out)}/{len(valid)} shape tran ra ngoai canvas: {out[:4]} (-{pen:.0f}d)")

    # --- 3. Do lap day khung hinh (15d) ---
    gx0 = min(b[0] for b in boxes); gy0 = min(b[1] for b in boxes)
    gx1 = max(b[2] for b in boxes); gy1 = max(b[3] for b in boxes)
    fill_w = (gx1 - gx0) / CANVAS
    fill_h = (gy1 - gy0) / CANVAS
    fill = max(fill_w, fill_h)
    if fill < 0.45:
        pts -= 15.0
        issues.append(f"hinh qua nho, chi chiem {fill*100:.0f}% khung (-15d)")
    elif fill < 0.60:
        pts -= 7.0
        issues.append(f"hinh hoi nho, chiem {fill*100:.0f}% khung (-7d)")
    elif fill > 1.02:
        pts -= 10.0
        issues.append(f"hinh tran khung ({fill*100:.0f}%) (-10d)")

    # --- 4. Tinh lien mach: moi bo phan phai cham vao it nhat 1 bo phan khac (25d) ---
    TOL = 25.0  # px, cho phep ho nhe
    floating = []
    for name in by_part:
        b = part_bbox(name)
        if not b:
            continue
        others = [part_bbox(n) for n in by_part if n != name]
        others = [o for o in others if o]
        if not others:
            continue
        if all(bbox_gap(b, o) > TOL for o in others):
            gaps = sorted(bbox_gap(b, o) for o in others)
            floating.append((name, gaps[0]))
    if floating:
        # Le lung la loi NGHIEM TRONG: 1 bo phan le lung da lam hinh hong.
        # Phat 18d cho cai dau tien, +12d moi cai tiep theo.
        pen = min(30.0, 18.0 + 12.0 * (len(floating) - 1))
        pts -= pen
        det = ", ".join(f"{n} (ho {g:.0f}px)" for n, g in floating[:3])
        issues.append(f"{len(floating)}/{len(by_part)} bo phan LE LUNG khong cham hinh nao: {det} (-{pen:.0f}d)")

    # --- 5. Quan he khong gian dung nhu mo ta (25d) ---
    rels = expected_relations(plan)
    rel_fail = []
    for r in rels:
        b = part_bbox(r["part"])
        if not b:
            continue
        n_ref = r["ref"]
        b_ref = part_bbox(n_ref)
        if not b_ref:
            continue
        cy = (b[1] + b[3]) / 2
        cy_ref = (b_ref[1] + b_ref[3]) / 2
        k = r["kind"]
        ok = True
        why = ""
        if k == "above":
            ok = cy < cy_ref
            why = f"y={cy:.0f} phai NHO HON y_ref={cy_ref:.0f} ({n_ref})"
        elif k == "below":
            ok = cy > cy_ref
            why = f"y={cy:.0f} phai LON HON y_ref={cy_ref:.0f} ({n_ref})"
        elif k == "inside":
            area = (b[2] - b[0]) * (b[3] - b[1])
            ov = bbox_overlap(b, b_ref)
            ok = area > 0 and ov / area >= 0.55
            why = f"chi {ov/max(area,1)*100:.0f}% nam trong {n_ref} (can >=55%)"
        elif k == "touch":
            g = bbox_gap(b, b_ref)
            ok = g <= TOL
            why = f"ho {g:.0f}px so voi {n_ref} (can <={TOL:.0f}px)"
        if not ok:
            rel_fail.append((r["part"], k, why))
    if rels:
        # Sai quan he khong gian ("tai duoi dau", "mat ngoai dau") = hinh vo nghia.
        # Phat 22d cho cai dau, +13d moi cai tiep theo.
        pen = min(35.0, 22.0 + 13.0 * (len(rel_fail) - 1)) if rel_fail else 0.0
        pts -= pen
        if rel_fail:
            det = "; ".join(f"{p} phai '{k}' nhung {w}" for p, k, w in rel_fail[:3])
            issues.append(f"{len(rel_fail)}/{len(rels)} quan he khong gian SAI: {det} (-{pen:.0f}d)")

    # --- kiem tra phu: co du cac buoc khong ---
    plan_parts = {s["part_name"] for s in plan["steps"]}
    missing = plan_parts - set(by_part)
    if missing:
        pts -= min(15.0, 5.0 * len(missing))
        issues.append(f"thieu {len(missing)} bo phan: {sorted(missing)}")

    pts = max(0.0, min(100.0, pts))
    return {
        "score_pct": round(pts, 1),
        "status": "pass" if pts >= 70 else ("partial" if pts >= 40 else "fail"),
        "issues": issues,
        "metrics": {
            "n_shapes": len(shapes),
            "n_valid": len(valid),
            "fill_ratio": round(fill, 3),
            "n_floating": len(floating),
            "n_relations": len(rels),
            "n_relations_failed": len(rel_fail),
        },
    }
