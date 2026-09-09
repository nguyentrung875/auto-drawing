#!/usr/bin/env python3
"""Spiral Art generator — anh -> 1 net xoan oc lien tuc (single-line DSL).

Usage:
    .venv/bin/python spiral.py input/portrait.png --turns 90 --amp 2.2
    .venv/bin/python spiral.py input/portrait.png --turns 110 --amp 2.6 --out output/v2

Output (trong --out):
    render.png   — anh render de review bang mat (PIL)
    spiral.svg   — SVG trang tren nen toi (xem truc tiep)
    oneline.json — SingleLineTemplate: 1 stroke duy nhat, tuong thich gate.mjs/preview.mjs
    stats.json   — so diem, do dai, uoc luong thoi gian ve

Thuat toan: xoan oc Archimedes tu tam ra ngoai. Ban kinh tai moi goc:
    r = r0 + amp * brightness
Vung sang (mat) -> cac vong xit lai -> hien sang. Vung toi (nen) -> thua deu.
Net lien tuc 100% (1 lenh M duy nhat) — dung tieu chi S1.
"""
import argparse, json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 540, 760          # viewBox chuan cua repo
CX, CY = 270, 370        # tam xoan oc
R_MAX = 250              # ban kinh ngoai
WORK = 400               # kich thuoc anh lam viec (vuong)


def input_gate(img_path: str) -> dict:
    """S0: kiem tra ANH INPUT (truoc stretch) — loai som anh khong hop spiral.

    Calibrated tren 9 anh validation (xem VALIDATION-REPORT.md):
      std < 0.10  -> qua phang/mu (fog: 0.043)
      dark% < 50% -> nen khong toi / subject khong noi (street 43%, group 19%)
      edge > 0.06 -> qua roi (street 0.072)
    Anh tot: std 0.15-0.30, dark% 60-85%, edge 0.012-0.036.
    """
    a = Image.open(img_path).convert("L")
    s = min(a.size)
    a = a.crop(((a.width - s) // 2, (a.height - s) // 2,
                (a.width + s) // 2, (a.height + s) // 2)).resize((WORK, WORK), Image.LANCZOS)
    x = np.asarray(a, dtype=np.float32) / 255.0
    g = np.hypot(*np.gradient(x))
    std, dark, edge = float(x.std()), float((x < 0.2).mean()), float(g.mean())
    fails = []
    if std < 0.10:
        fails.append(f"flat(std={std:.3f})")
    if dark < 0.50:
        fails.append(f"no-dark-bg({dark * 100:.0f}%)")
    if edge > 0.06:
        fails.append(f"cluttered(edge={edge:.3f})")
    return {"std": round(std, 4), "dark_frac": round(dark, 4), "edge": round(edge, 4),
            "pass": len(fails) == 0, "reasons": fails}


def load_work_image(path: str) -> np.ndarray:
    img = Image.open(path).convert("L")
    # crop vuong giua anh
    s = min(img.size)
    x0 = (img.width - s) // 2
    y0 = (img.height - s) // 2
    img = img.crop((x0, y0, x0 + s, y0 + s)).resize((WORK, WORK), Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255.0
    # keo tuong phan (percentile stretch) de mat noi ro
    lo, hi = np.percentile(a, 5), np.percentile(a, 95)
    a = np.clip((a - lo) / max(1e-6, hi - lo), 0, 1)
    # mo nhe: diet nhieu pixel gay rung net
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255.0
    return a


def sample_bilinear(a: np.ndarray, fx: float, fy: float) -> float:
    h, w = a.shape
    fx = min(max(fx, 0), w - 1.001)
    fy = min(max(fy, 0), h - 1.001)
    x0, y0 = int(fx), int(fy)
    dx, dy = fx - x0, fy - y0
    return float(a[y0, x0] * (1 - dx) * (1 - dy) + a[y0, x0 + 1] * dx * (1 - dy)
                 + a[y0 + 1, x0] * (1 - dx) * dy + a[y0 + 1, x0 + 1] * dx * dy)


def tri_wave(u: float) -> float:
    p = u % 1.0
    return 4 * p - 1 if p < 0.5 else 3 - 4 * p


def generate(a: np.ndarray, turns: int, amp: float, pp_turn: int = 90,
             gamma: float = 0.7, mode: str = "am", fm_per_turn: int = 48):
    theta_max = 2 * math.pi * turns
    n = turns * pp_turn
    thetas = np.linspace(0, theta_max, n)
    pts = np.zeros((n, 2), dtype=np.float32)
    for i, th in enumerate(thetas):
        r0 = R_MAX * th / theta_max
        # vi tri co so -> pixel anh (anh WORKxWORK anh xa vao hinh vuong 2R x 2R)
        px = CX + r0 * math.cos(th)
        py = CY + r0 * math.sin(th)
        fx = (px - (CX - R_MAX)) / (2 * R_MAX) * (WORK - 1)
        fy = (py - (CY - R_MAX)) / (2 * R_MAX) * (WORK - 1)
        b = sample_bilinear(a, fx, fy) ** gamma
        if mode == "fm":
            # zigzag: bien do ~ do sang -> vung sang nhieu muc hon (tone mapping that)
            turn_k = int(th / (2 * math.pi))
            phase = turn_k * 2.39996  # golden angle: tranh soc truc xuyen tam
            r = r0 + amp * b * tri_wave(fm_per_turn * th / (2 * math.pi) + phase)
        else:
            r = r0 + amp * b
        pts[i, 0] = CX + r * math.cos(th)
        pts[i, 1] = CY + r * math.sin(th)
    return pts


def path_length(pts) -> float:
    d = np.diff(pts, axis=0)
    return float(np.hypot(d[:, 0], d[:, 1]).sum())


def to_path_d(pts) -> str:
    parts = [f"M {pts[0,0]:.1f} {pts[0,1]:.1f}"]
    for x, y in pts[1:]:
        parts.append(f"L {x:.1f} {y:.1f}")
    return " ".join(parts)


def render_png(pts, path, stroke_w=2):
    img = Image.new("RGB", (W, H), (15, 33, 29))
    dr = ImageDraw.Draw(img)
    flat = [float(v) for p in pts for v in p]
    dr.line(flat, fill=(255, 255, 255), width=stroke_w, joint="curve")
    img.save(path)


def likeness(render_path: str, a: np.ndarray) -> float:
    """S2: so sanh thumbnail render (mo) vs anh goc (mo) -> 0..1."""
    ren = Image.open(render_path).convert("L")
    # crop vung vuong 2R x 2R quanh tam (khop anh xa anh goc), roi moi resize
    ren = ren.crop((CX - R_MAX, CY - R_MAX, CX + R_MAX, CY + R_MAX))
    ren = ren.resize((WORK, WORK), Image.LANCZOS)
    ren = np.asarray(ren.filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255.0
    ref = np.asarray(Image.fromarray((a * 255).astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255.0
    # mask tron: chi so vung xoan oc bao phu
    yy, xx = np.mgrid[0:WORK, 0:WORK]
    mask = (((xx - WORK/2) / (WORK*0.47)) ** 2 + ((yy - WORK/2) / (WORK*0.47)) ** 2) < 1
    # S2 = tuong quan GRADIENT (canh): spiral AM nhan manh canh, khong phai tone.
    # Pearson tone am tinh cho ca ban dep -> sai metric (xem SPIKE-REPORT).
    gr = np.hypot(*np.gradient(ren))[mask]
    gf = np.hypot(*np.gradient(ref))[mask]
    gr0, gf0 = gr - gr.mean(), gf - gf.mean()
    denom = float(np.sqrt((gr0 ** 2).sum() * (gf0 ** 2).sum()))
    return round(float((gr0 * gf0).sum() / denom) if denom > 0 else 0.0, 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--turns", type=int, default=90)
    ap.add_argument("--amp", type=float, default=2.2)
    ap.add_argument("--pp-turn", type=int, default=90)
    ap.add_argument("--gamma", type=float, default=0.7)
    ap.add_argument("--mode", choices=["am", "fm"], default="am")
    ap.add_argument("--fm-per-turn", type=int, default=48)
    ap.add_argument("--stroke-w", type=int, default=2)
    ap.add_argument("--out", default="output/v1")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    s0 = input_gate(args.image)
    a = load_work_image(args.image)
    pts = generate(a, args.turns, args.amp, args.pp_turn, args.gamma,
                   args.mode, args.fm_per_turn)
    length = path_length(pts)
    d = to_path_d(pts)

    render_png(pts, f"{args.out}/render.png", args.stroke_w)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">\n'
           f'<rect width="{W}" height="{H}" fill="#0f211d"/>\n'
           f'<path d="{d}" fill="none" stroke="#ffffff" stroke-width="{args.stroke_w}" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>')
    open(f"{args.out}/spiral.svg", "w").write(svg)

    tpl = [{
        "id": "spiral_portrait_v1",
        "kind": "single-line",
        "hook": "spiral",
        "subject": os.path.basename(args.image),
        "source_image": args.image,
        "params": {"turns": args.turns, "amp": args.amp, "pp_turn": args.pp_turn},
        "strokes": [{
            "step": 1, "role": "hook", "absorbed": True,
            "part": "Xoan oc lien tuc duy nhat (khong nhac but)",
            "d": d, "dur": round(length / 250, 1),
            "voice_vi": "Ve chan dung nay bang mot net duy nhat, khong nhac but!"
        }]
    }]
    json.dump(tpl, open(f"{args.out}/oneline.json", "w"), ensure_ascii=False)

    stats = {
        "s0_input": s0,
        "points": len(pts),
        "length_px": round(length, 1),
        "d_chars": len(d),
        "m_commands": d.count("M "),
        "realtime_s": round(length / 250, 1),
        "timelapse_45s": round(length / 250 / 45, 2),
        "likeness_S2": likeness(f"{args.out}/render.png", a),
    }
    json.dump(stats, open(f"{args.out}/stats.json", "w"), indent=2)
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
