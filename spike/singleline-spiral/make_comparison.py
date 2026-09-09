#!/usr/bin/env python3
"""Tao anh so sanh (original | v4 | v6) + player.html tu template."""
import base64, io, json, os, sys

from PIL import Image, ImageDraw, ImageFont

SPIKE = os.path.dirname(os.path.abspath(__file__))
INPUT = os.path.join(SPIKE, "input", "portrait.png")


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def work_image(size=500):
    im = Image.open(INPUT).convert("L")
    s = min(im.size)
    x0, y0 = (im.width - s) // 2, (im.height - s) // 2
    return im.crop((x0, y0, x0 + s, y0 + s)).resize((size, size), Image.LANCZOS)


def render_circle(dirpath, size=500):
    im = Image.open(os.path.join(dirpath, "render.png")).convert("L")
    if im.size[0] > 540:  # scale 2
        return im.crop((40, 240, 1040, 1240)).resize((size, size), Image.LANCZOS)
    return im.crop((20, 120, 520, 620)).resize((size, size), Image.LANCZOS)


def make_comparison(out_path):
    panels = [
        ("Ảnh gốc (portrait)", work_image()),
        ("v4 — AM spiral (cũ)", render_circle(os.path.join(SPIKE, "output", "v4"))),
        ("v6 — density (vòng méo)", render_circle(os.path.join(SPIKE, "output", "v6"))),
        ("v7 — concentric (mới)", render_circle(os.path.join(SPIKE, "output", "v7"))),
    ]
    P, GAP, CAP = 500, 20, 44
    W = len(panels) * P + (len(panels) + 1) * GAP
    H = P + GAP + CAP
    canvas = Image.new("RGB", (W, H), (10, 18, 16))
    dr = ImageDraw.Draw(canvas)
    f = font(20)
    x = GAP
    for label, img in panels:
        canvas.paste(img.convert("RGB"), (x, GAP))
        bbox = dr.textbbox((0, 0), label, font=f)
        tw = bbox[2] - bbox[0]
        dr.text((x + (P - tw) / 2, P + GAP + 8), label, fill=(241, 245, 249), font=f)
        x += P + GAP
    canvas.save(out_path)
    print(f"wrote {out_path} ({W}x{H})")


def make_player(out_dir):
    tpl = json.load(open(os.path.join(out_dir, "oneline.json")))[0]
    d = tpl["strokes"][0]["d"]
    buf = io.BytesIO()
    work_image(400).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    html = open(os.path.join(SPIKE, "player-template.html")).read()
    html = html.replace("__PATH_D__", d).replace("__ORIG_B64__", b64)
    out = os.path.join(out_dir, "player.html")
    open(out, "w").write(html)
    print(f"wrote {out} ({os.path.getsize(out)//1024}KB)")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "compare"):
        make_comparison(os.path.join(SPIKE, "comparison-v4-v6-v7.png"))
    if which in ("all", "player"):
        for d in ("v6", "v6-video", "v7"):
            make_player(os.path.join(SPIKE, "output", d))
