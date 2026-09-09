#!/usr/bin/env python3
"""Spiral Art generator — anh -> 1 net xoan oc lien tuc (single-line DSL).

Usage:
    .venv/bin/python spiral.py input/portrait.png --turns 90 --amp 2.2
    .venv/bin/python spiral.py input/portrait.png --turns 110 --amp 2.6 --out output/v2
    .venv/bin/python spiral.py input/portrait.png --mode density --out output/v6

Output (trong --out):
    render.png   — anh render de review bang mat (PIL)
    spiral.svg   — SVG trang tren nen toi (xem truc tiep)
    oneline.json — SingleLineTemplate: 1 stroke duy nhat, tuong thich gate.mjs/preview.mjs
    stats.json   — so diem, do dai, uoc luong thoi gian ve

Hai che do (mode):
    am      — (v1..v4) Archimedes tu tam ra ngoai: r = r0 + amp * brightness.
              Edge-emphasis: chi nhan bien sang-toi, vung phang bi rut net
              (SPIKE-REPORT F1) -> mat phai nheo moi thay.
    density — (v6+) tone-mapping that: buoc tien theo ban kinh moi diem
              gap = gap_min * ((1+eps)/(brightness+eps))**p.
              Vung sang -> buoc nho -> vong xit lai -> mat hien sang, net va
              ro nhu anh goc. Day la cach cac buc "one-line spiral portrait"
              viral duoc ve.

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

    Calibrated tren 9+3 anh validation (xem VALIDATION-REPORT.md):
      std < 0.10  -> qua phang/mu (fog: 0.043)
      dark% < 50% -> nen khong toi / subject khong noi (street 43%, group 19%)
      edge > 0.06 -> qua roi (street 0.072)
      color-loss  -> anh ruc mau nhung xam phang: tin nam o hue, gop xam la mat
                     (isoluminant: hoa do/la xanh cung do xam, S2=0.06)
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
    # color-loss: ruc mau nhung xam phang
    c = Image.open(img_path).convert("RGB")
    s = min(c.size)
    c = c.crop(((c.width - s) // 2, (c.height - s) // 2,
                (c.width + s) // 2, (c.height + s) // 2)).resize((WORK, WORK), Image.LANCZOS)
    rgb = np.asarray(c, dtype=np.float32) / 255.0
    rg, yb = rgb[..., 0] - rgb[..., 1], 0.5 * (rgb[..., 0] + rgb[..., 1]) - rgb[..., 2]
    colorful = float(rg.std() + yb.std())
    if colorful > 0.12 and std < 0.16:
        fails.append(f"color-loss(color={colorful:.2f},luma-std={std:.3f})")
    return {"std": round(std, 4), "dark_frac": round(dark, 4), "edge": round(edge, 4),
            "colorful": round(colorful, 4),
            "pass": len(fails) == 0, "reasons": fails}


def load_work_image(path: str, prep: str = "soft") -> np.ndarray:
    """Anh lam viec WORKxWORK, 0..1.

    prep=soft: giong het v4 (stretch 5-95, blur 1.2) — bao toan ket qua cu.
    prep=sharp: stretch 2-98 + unsharp + blur nhe (0.8) — net hon, cho v6.
    """
    img = Image.open(path).convert("L")
    s = min(img.size)
    x0 = (img.width - s) // 2
    y0 = (img.height - s) // 2
    img = img.crop((x0, y0, x0 + s, y0 + s)).resize((WORK, WORK), Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255.0
    if prep == "sharp":
        lo, hi = np.percentile(a, 2), np.percentile(a, 98)
        blur_r, unsharp = 0.8, 0.5
    else:
        lo, hi = np.percentile(a, 5), np.percentile(a, 95)
        blur_r, unsharp = 1.2, 0.0
    a = np.clip((a - lo) / max(1e-6, hi - lo), 0, 1)
    if unsharp > 0:
        b = np.asarray(Image.fromarray((a * 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(2.0)), dtype=np.float32) / 255.0
        a = np.clip(a + unsharp * (a - b), 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(blur_r)), dtype=np.float32) / 255.0
    return a


def _px(a: np.ndarray, r: float, th: float) -> float:
    """Sample bilinear 1 diem (scalar, nhanh) — (r, th) la toa do xoan oc."""
    px = CX + r * math.cos(th)
    py = CY + r * math.sin(th)
    fx = (px - (CX - R_MAX)) / (2 * R_MAX) * (WORK - 1)
    fy = (py - (CY - R_MAX)) / (2 * R_MAX) * (WORK - 1)
    fx = min(max(fx, 0), WORK - 1.001)
    fy = min(max(fy, 0), WORK - 1.001)
    x0, y0 = int(fx), int(fy)
    dx, dy = fx - x0, fy - y0
    x1, y1 = min(x0 + 1, WORK - 1), min(y0 + 1, WORK - 1)
    return float(a[y0, x0] * (1 - dx) * (1 - dy) + a[y0, x1] * dx * (1 - dy)
                 + a[y1, x0] * (1 - dx) * dy + a[y1, x1] * dx * dy)


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
    """Mode am/fm goc (v1..v5) — giu nguyen de bao toan ket qua cu."""
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


def gap_of(b: float, gap_min: float, eps: float, p: float,
           gap_max: float = float("inf")) -> float:
    """Buoc tien theo ban kinh (px/moi 2pi) — sang -> gap nho -> vong xit.

    gap_max chan phia toi: neu khong, nen toi bi cap qua lon -> lo toan net
    trang -> anh xam. Clamp giu nen toi that su toi, chi con net thua.
    """
    return np.minimum(gap_max, gap_min * ((1.0 + eps) / (b + eps)) ** p)


def _polar_field(a: np.ndarray, n_r: int = 260, n_phi: int = 128) -> np.ndarray:
    """Mau do sang tren luoi toa do cuc (rho x phi) — vector hoa."""
    rhos = np.linspace(0, R_MAX + 8, n_r)[:, None]
    phis = np.linspace(0, 2 * math.pi, n_phi, endpoint=False)[None, :]
    px = CX + rhos * np.cos(phis)
    py = CY + rhos * np.sin(phis)
    fx = (px - (CX - R_MAX)) / (2 * R_MAX) * (WORK - 1)
    fy = (py - (CY - R_MAX)) / (2 * R_MAX) * (WORK - 1)
    fx = np.clip(fx, 0, WORK - 1.001)
    fy = np.clip(fy, 0, WORK - 1.001)
    x0 = fx.astype(int)
    y0 = fy.astype(int)
    dx, dy = fx - x0, fy - y0
    x1 = np.minimum(x0 + 1, WORK - 1)
    y1 = np.minimum(y0 + 1, WORK - 1)
    return a[y0, x0] * (1 - dx) * (1 - dy) + a[y0, x1] * dx * (1 - dy) \
        + a[y1, x0] * (1 - dx) * dy + a[y1, x1] * dx * dy


def generate_density(a: np.ndarray, gap_min: float = 1.2, eps: float = 0.15,
                     p: float = 1.6, pp: int = 140, gamma: float = 0.8,
                     edge_k: float = 0.0, gap_max: float = 4.0,
                     n_phi: int = 160, rim: float = 0.0,
                     max_rings: int = 400) -> np.ndarray:
    """Mode density (v6): tone-mapping xoan oc theo GOC (level-set roi rac).

    Recursion per-ring, trang thai theo goc rieng biet:

        r_{k+1}(phi) = r_k(phi) + gap(b(r_k(phi), phi))

    - Khoang cach giua 2 vong xoan lien tiep TAI GOC phi bang gap cua do sang
      TAI GOC phi -> tone-mapping cuc bo dung nghia: vung sang (mat) xit vong,
      vung toi (nen) thua vong, duong vien mat giu DUNG HINH DANG (khong thanh
      dia tron nhu ban radial-only).
    - Tung vong la mot duong kin khong cat nhau (gap > 0 moi noi) -> net lien
      tuc duy nhat, khong nhac but.
    - Nen toi "chay" ra ngoai nhanh (gap lon) -> cac cung nen cua vong cuoi nam
      ngoai canvas, tu dong bi clip khi render (khong ton mau muc). Neu --rim > 0
      thi chan ban kinh tai rim (tao vien tron quanh chan dung).
    """
    n_r = 300
    bf = _polar_field(a, n_r, n_phi)            # bf[rho_i, phi_j]
    rho_axis = np.linspace(0, R_MAX + 50, n_r)
    phi_axis = np.linspace(0, 2 * math.pi, n_phi, endpoint=False)
    grad_r = None
    if edge_k > 0:
        g = np.gradient(bf, axis=0)
        grad_r = np.clip(np.abs(g) * (n_r - 1) / (R_MAX + 50), 0, 1)  # ~/px

    def sample_cols(rr):
        """Bilinear theo hang (radius) tai cot co dinh j — vector hoa."""
        cols = np.arange(n_phi)
        ri = np.interp(rr, rho_axis, np.arange(n_r))
        r0 = np.floor(ri).astype(int)
        r1 = np.minimum(r0 + 1, n_r - 1)
        fr = ri - r0
        return bf[r0, cols] * (1 - fr) + bf[r1, cols] * fr

    def sample_cols_grad(rr):
        cols = np.arange(n_phi)
        ri = np.interp(rr, rho_axis, np.arange(n_r))
        r0 = np.floor(ri).astype(int)
        r1 = np.minimum(r0 + 1, n_r - 1)
        fr = ri - r0
        return grad_r[r0, cols] * (1 - fr) + grad_r[r1, cols] * fr

    # noi suy vong theo goc (wrap-aware)
    xp = np.concatenate([phi_axis - 2 * math.pi, phi_axis, phi_axis + 2 * math.pi])
    sweep = np.linspace(0, 2 * math.pi, pp, endpoint=False)
    blocks = []
    r_prev = np.full(n_phi, 1.0, dtype=np.float32)
    for _ in range(max_rings):
        b = sample_cols(r_prev) ** gamma
        if edge_k > 0:
            b = np.minimum(1.0, b + edge_k * sample_cols_grad(r_prev))
        g = np.asarray(gap_of(b, gap_min, eps, p, gap_max))
        r_cur = r_prev + g
        if rim > 0:
            r_cur = np.minimum(r_cur, rim)
        # lam muot goc nhe (MA 3, wrap) de vong khong ran cua
        r_cur = (r_cur + np.roll(r_cur, 1) + np.roll(r_cur, -1)) / 3.0
        rs = np.interp(sweep, xp, np.concatenate([r_cur, r_cur, r_cur]))
        blocks.append(np.stack([CX + rs * np.cos(sweep), CY + rs * np.sin(sweep)], axis=1))
        r_prev = r_cur
        if float(r_cur.min()) >= R_MAX - 2:
            break
    pts = np.vstack(blocks)
    return pts


def generate_concentric(a: np.ndarray, gap_min: float = 1.4, gap_max: float = 7.5,
                        eps: float = 0.10, p: float = 2.0, pp: int = 180,
                        gamma: float = 0.9, wiggle: float = 1.2, edge_k: float = 0.0,
                        local_m: float = 0.6, n_r: int = 300, n_phi: int = 160,
                        k_phi: int = 24, rim: float = 250.0,
                        max_turns: int = 200) -> np.ndarray:
    """Mode concentric (v7): vong xoan oc TRON DONG TAM + tone-mapping cuc bo.

    Phan hoi nguoi dung (2026-09-09): v6 lam vong meo/lech (wobble 11.8 vs v4 0.48).
    v7 giu cau truc vong tron dong tam bang 2 nguyen tac:

    1. TAM CO DINH (chong lech): buoc tien TRUNG BINH moi vong dung bang
       spacing_radial(rho_k) — do sang trung binh theo ban kinh. Lech cuc bo
       theo goc bi ep zero-mean (FFT bo DC) nen KHONG tich luy thanh lech tam:
       r_k(phi) = rho_k + tong cac dev zero-mean (bounded) -> vong luon dong tam.
    2. MAT DO THEO GOC (chi tiet mat): moi vong, khoang cach cuc bo
       g(phi) = spacing_radial * (1 + local_m*(b(r_k(phi),phi)^g - bg^g))
       -> mat sang = vong xit (dang day), mat toi (mat, mui, moi, toc) = vong
       thua (thua loang) — tone-mapping cuc bo DUNG NGHIA nhu cac buc spiral
       portrait kinh dien, nhung tren vong tron con giu duoc hinh dang.

    So voi v6: cung dieu bien theo goc, nhung co rang buoc zero-mean moi vong
    -> mat do doi ma vong khong bao gio meo/lech (do bang wobble).
    """
    bf = _polar_field(a, n_r, n_phi)                    # bf[rho_i, phi_j]
    rho_axis = np.linspace(0, R_MAX + 50, n_r)
    phi_axis = np.linspace(0, 2 * math.pi, n_phi, endpoint=False)
    cols = np.arange(n_phi)

    # profile theo ban kinh (tone trung binh) — muot ky
    b_avg = bf.mean(axis=1)
    k = 7
    b_avg = np.convolve(b_avg, np.ones(k) / k, mode="same")
    bg = np.clip(b_avg, 0, 1) ** gamma
    spacing_radial = gap_of(bg, gap_min, eps, p, gap_max)

    grad_r = None
    if edge_k > 0:
        grad_r = np.clip(np.abs(np.gradient(bf, axis=0)) * (n_r - 1) / (R_MAX + 50), 0, 1)

    dth = 2 * math.pi / pp
    max_steps = int(max_turns * pp)
    rhos = np.empty(max_steps, dtype=np.float32)
    ths = np.empty(max_steps, dtype=np.float32)

    # vong co ban: duong tron dong tam, moi vong tien dung spacing_radial(rho)
    rho = 1.0
    base = [rho]
    while len(base) < max_steps // pp and rho < R_MAX - 2:
        rho += float(np.interp(rho, rho_axis, spacing_radial))
        base.append(rho)
    base = np.asarray(base, dtype=np.float32)

    # recursion theo goc, zero-mean moi vong
    def sample_cols(rr):
        ri = np.interp(rr, rho_axis, np.arange(n_r))
        r0 = np.floor(ri).astype(int)
        r1 = np.minimum(r0 + 1, n_r - 1)
        fr = ri - r0
        return bf[r0, cols] * (1 - fr) + bf[r1, cols] * fr

    def sample_cols_grad(rr):
        ri = np.interp(rr, rho_axis, np.arange(n_r))
        r0 = np.floor(ri).astype(int)
        r1 = np.minimum(r0 + 1, n_r - 1)
        fr = ri - r0
        return grad_r[r0, cols] * (1 - fr) + grad_r[r1, cols] * fr

    r_prev = np.full(n_phi, 1.0, dtype=np.float64)
    rings = []
    for kk in range(len(base)):
        b = sample_cols(r_prev) ** gamma
        local = b - float(np.interp(base[kk], rho_axis, bg))   # zero-mean ~
        local = local - local.mean()
        mod = np.clip(1.0 + local_m * local, 0.25, 2.0)
        if edge_k > 0:
            mod = np.clip(mod + edge_k * sample_cols_grad(r_prev), 0.25, 2.0)
        g = float(spacing_radial[np.clip(int(np.searchsorted(rho_axis, base[kk])), 0, n_r - 1)]) * mod
        g = g - (g.mean() - float(np.interp(base[kk], rho_axis, spacing_radial)))  # zero-mean advance
        r_cur = r_prev + g
        if rim > 0:
            r_cur = np.minimum(r_cur, rim)
        # low-pass theo goc tren phan lech (giu mean: FFT bo DC cua dev)
        dev = r_cur - base[kk]
        F = np.fft.rfft(dev)
        F[0] = 0.0
        if k_phi < len(F):
            F[k_phi:] = 0.0
        dev = np.fft.irfft(F, n=n_phi)
        r_cur = base[kk] + dev
        rings.append(r_cur)
        r_prev = r_cur

    # noi suy tung vong thanh duong lien tuc
    xp = np.concatenate([phi_axis - 2 * math.pi, phi_axis, phi_axis + 2 * math.pi])
    sweep = np.linspace(0, 2 * math.pi, pp, endpoint=False)
    blocks = []
    for r_cur in rings:
        rs = np.interp(sweep, xp, np.concatenate([r_cur, r_cur, r_cur]))
        blocks.append(np.stack([CX + rs * np.cos(sweep), CY + rs * np.sin(sweep)], axis=1))
    pts = np.vstack(blocks)
    return pts


def ring_concentricity(pts, pp: int) -> dict:
    """Do do dong tam: std ban kinh moi vong vs khoang cach vong.

    - ring_std_px: median(std ban kinh trong moi vong) — vong cang tron cang nho
    - ring_gap_px: median(khoang cach giua ban kinh trung binh 2 vong lien tiep)
    - wobble: ring_std / ring_gap — >1 = vong meo hon ca khoang cach vong
    """
    n = len(pts) // pp
    if n < 3:
        return {"ring_std_px": 0.0, "ring_gap_px": 0.0, "wobble": 0.0}
    rings = pts[: n * pp].reshape(n, pp, 2)
    radii = np.hypot(rings[..., 0] - CX, rings[..., 1] - CY)
    ring_std = radii.std(axis=1)
    ring_mean = radii.mean(axis=1)
    gaps = np.diff(ring_mean)
    return {"ring_std_px": round(float(np.median(ring_std)), 2),
            "ring_gap_px": round(float(np.median(gaps)), 2),
            "wobble": round(float(np.median(ring_std) / max(1e-6, float(np.median(gaps)))), 2)}


def path_length(pts) -> float:
    d = np.diff(pts, axis=0)
    return float(np.hypot(d[:, 0], d[:, 1]).sum())


def to_path_d(pts) -> str:
    parts = [f"M {pts[0,0]:.1f} {pts[0,1]:.1f}"]
    for x, y in pts[1:]:
        parts.append(f"L {x:.1f} {y:.1f}")
    return " ".join(parts)


def render_png(pts, path, stroke_w=2, scale=2):
    img = Image.new("RGB", (W * scale, H * scale), (15, 33, 29))
    dr = ImageDraw.Draw(img)
    flat = [float(v) * scale for p in pts for v in p]
    dr.line(flat, fill=(255, 255, 255), width=max(1, round(stroke_w * scale)), joint="curve")
    img.save(path)


def _metrics(render_path: str, a: np.ndarray, scale: int = 1) -> dict:
    """S2 (edge-corr), tone Pearson, sharpness — tren vung xoan oc bao phu."""
    ren = Image.open(render_path).convert("L")
    R, CXs, CYs = R_MAX * scale, CX * scale, CY * scale
    ren = ren.crop((CXs - R, CYs - R, CXs + R, CYs + R)).resize((WORK, WORK), Image.LANCZOS)
    ren = np.asarray(ren, dtype=np.float32) / 255.0
    yy, xx = np.mgrid[0:WORK, 0:WORK]
    mask = (((xx - WORK / 2) / (WORK * 0.47)) ** 2 + ((yy - WORK / 2) / (WORK * 0.47)) ** 2) < 1

    def blur(x, r):
        return np.asarray(Image.fromarray((x * 255).astype(np.uint8))
                          .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0

    def pearson(x, y):
        x0, y0 = x - x.mean(), y - y.mean()
        denom = float(np.sqrt((x0 ** 2).sum() * (y0 ** 2).sum()))
        return float((x0 * y0).sum() / denom) if denom > 0 else 0.0

    out = {}
    for rb in (4, 2):
        ren_b = blur(ren, rb)[mask]
        ref_b = blur(a, rb)[mask]
        gr = np.hypot(*np.gradient(blur(ren, rb)))[mask]
        gf = np.hypot(*np.gradient(blur(a, rb)))[mask]
        tag = "" if rb == 4 else "_blur2"
        out[f"likeness_S2{tag}"] = round(pearson(gr, gf), 4)
        out[f"tone_pearson{tag}"] = round(pearson(ren_b, ref_b), 4)
    out["sharpness"] = round(float(np.hypot(*np.gradient(ren))[mask].mean()), 4)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--turns", type=int, default=90)
    ap.add_argument("--amp", type=float, default=2.2)
    ap.add_argument("--pp-turn", type=int, default=140)
    ap.add_argument("--gamma", type=float, default=0.7)
    ap.add_argument("--mode", choices=["am", "fm", "density", "concentric"], default="am")
    ap.add_argument("--fm-per-turn", type=int, default=48)
    ap.add_argument("--gap-min", type=float, default=1.2)
    ap.add_argument("--eps", type=float, default=0.15)
    ap.add_argument("--gap-p", type=float, default=1.6)
    ap.add_argument("--gap-max", type=float, default=4.0)
    ap.add_argument("--edge-k", type=float, default=0.0)
    ap.add_argument("--wiggle", type=float, default=1.2)
    ap.add_argument("--local-m", type=float, default=0.6)
    ap.add_argument("--k-phi", type=int, default=24)
    ap.add_argument("--n-phi", type=int, default=160)
    ap.add_argument("--rim", type=float, default=0.0,
                    help="chan ban kinh (0 = khong chan, de cung nen clip tu nhien)")
    ap.add_argument("--prep", choices=["soft", "sharp"], default="soft")
    ap.add_argument("--stroke-w", type=float, default=2)
    ap.add_argument("--scale", type=int, default=2, help="render scale (2 = 1080x1520)")
    ap.add_argument("--out", default="output/v1")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    s0 = input_gate(args.image)
    a = load_work_image(args.image, args.prep)
    if args.mode == "density":
        pts = generate_density(a, args.gap_min, args.eps, args.gap_p,
                               args.pp_turn, args.gamma, args.edge_k, args.gap_max,
                               args.n_phi, args.rim)
        params = {"mode": "density", "gap_min": args.gap_min, "eps": args.eps,
                  "gap_p": args.gap_p, "gap_max": args.gap_max, "pp_turn": args.pp_turn,
                  "gamma": args.gamma, "edge_k": args.edge_k,
                  "n_phi": args.n_phi, "rim": args.rim, "prep": args.prep}
    elif args.mode == "concentric":
        pts = generate_concentric(a, args.gap_min, args.gap_max, args.eps, args.gap_p,
                                  args.pp_turn, args.gamma, args.wiggle, args.edge_k,
                                  args.local_m, rim=args.rim, k_phi=args.k_phi,
                                  n_phi=args.n_phi)
        params = {"mode": "concentric", "gap_min": args.gap_min, "eps": args.eps,
                  "gap_p": args.gap_p, "gap_max": args.gap_max, "pp_turn": args.pp_turn,
                  "gamma": args.gamma, "wiggle": args.wiggle, "edge_k": args.edge_k,
                  "local_m": args.local_m, "k_phi": args.k_phi, "n_phi": args.n_phi,
                  "rim": args.rim, "prep": args.prep}
    else:
        pts = generate(a, args.turns, args.amp, args.pp_turn, args.gamma,
                       args.mode, args.fm_per_turn)
        params = {"mode": args.mode, "turns": args.turns, "amp": args.amp,
                  "pp_turn": args.pp_turn, "gamma": args.gamma, "prep": args.prep}
    length = path_length(pts)
    d = to_path_d(pts)

    render_png(pts, f"{args.out}/render.png", args.stroke_w, args.scale)
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
        "params": params,
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
        "params": params,
        "points": len(pts),
        "length_px": round(length, 1),
        "d_chars": len(d),
        "m_commands": d.count("M "),
        "realtime_s": round(length / 250, 1),
        "timelapse_45s": round(length / 250 / 45, 2),
        **_metrics(f"{args.out}/render.png", a, args.scale),
        **ring_concentricity(pts, args.pp_turn),
    }
    json.dump(stats, open(f"{args.out}/stats.json", "w"), indent=2)
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
