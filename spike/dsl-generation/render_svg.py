"""Ve Drawing DSL ra SVG de nguoi xem tan mat — khong can API."""
from __future__ import annotations

import math

PALETTE = ["#e11d48", "#0891b2", "#16a34a", "#ca8a04", "#7c3aed", "#db2777"]


def shape_to_svg(sh: dict, color: str) -> str:
    t = sh.get("type")
    st = f'fill="none" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"'
    try:
        if t == "circle":
            return f'<circle cx="{sh["cx"]}" cy="{sh["cy"]}" r="{sh["r"]}" {st}/>'
        if t == "ellipse":
            rot = sh.get("rotation", 0)
            tr = f' transform="rotate({rot} {sh["cx"]} {sh["cy"]})"' if rot else ""
            return f'<ellipse cx="{sh["cx"]}" cy="{sh["cy"]}" rx="{sh["rx"]}" ry="{sh["ry"]}"{tr} {st}/>'
        if t == "rect":
            rx = f' rx="{sh["rx"]}"' if sh.get("rx") else ""
            return f'<rect x="{sh["x"]}" y="{sh["y"]}" width="{sh["w"]}" height="{sh["h"]}"{rx} {st}/>'
        if t == "line":
            return f'<line x1="{sh["x1"]}" y1="{sh["y1"]}" x2="{sh["x2"]}" y2="{sh["y2"]}" {st}/>'
        if t == "polyline":
            pts = " ".join(f'{p[0]},{p[1]}' for p in sh["points"])
            return f'<polyline points="{pts}" {st}/>'
        if t == "arc":
            cx, cy = float(sh["cx"]), float(sh["cy"])
            rx, ry = float(sh["rx"]), float(sh["ry"])
            a0 = math.radians(float(sh["start_angle"]))
            a1 = math.radians(float(sh["end_angle"]))
            x0, y0 = cx + rx * math.cos(a0), cy - ry * math.sin(a0)
            x1, y1 = cx + rx * math.cos(a1), cy - ry * math.sin(a1)
            large = 1 if abs(a1 - a0) > math.pi else 0
            sweep = 0 if a1 > a0 else 1
            return (f'<path d="M {x0:.1f} {y0:.1f} A {rx} {ry} 0 {large} {sweep} '
                    f'{x1:.1f} {y1:.1f}" {st}/>')
    except (KeyError, TypeError, ValueError, IndexError):
        return f'<!-- shape hong: {sh.get("id")} -->'
    return f'<!-- type la: {t} -->'


def render(dsl: dict, title: str = "", subtitle: str = "") -> str:
    shapes = dsl.get("shapes") or []
    steps = sorted({s.get("step", 1) for s in shapes})
    body = []
    for sh in shapes:
        step = sh.get("step", 1)
        color = PALETTE[(steps.index(step) if step in steps else 0) % len(PALETTE)]
        body.append("  " + shape_to_svg(sh, color))

    legend = []
    for i, st in enumerate(steps):
        c = PALETTE[i % len(PALETTE)]
        names = sorted({s.get("part_name", "?") for s in shapes if s.get("step") == st})
        legend.append(
            f'<rect x="12" y="{12 + i*26}" width="14" height="14" fill="{c}"/>'
            f'<text x="34" y="{24 + i*26}" font-size="15" fill="#334155">'
            f'buoc {st}: {", ".join(names)[:44]}</text>'
        )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1120" width="500" height="560">
  <rect width="1000" height="1120" fill="#fffdf7"/>
  <rect x="0" y="0" width="1000" height="1000" fill="none" stroke="#cbd5e1" stroke-dasharray="6 6"/>
{chr(10).join(body)}
  <g transform="translate(0,1005)">
    <rect width="1000" height="115" fill="#f8fafc"/>
    {"".join(legend)}
    <text x="640" y="24" font-size="16" font-weight="bold" fill="#0f172a">{title}</text>
    <text x="640" y="46" font-size="13" fill="#64748b">{subtitle}</text>
  </g>
</svg>'''


def render_page(items: list[dict], out_path: str) -> None:
    """items: [{svg, name, score, status, issues}]"""
    cards = []
    for it in items:
        color = {"pass": "#16a34a", "partial": "#ca8a04"}.get(it["status"], "#dc2626")
        issues = "".join(f"<li>{i}</li>" for i in it["issues"]) or "<li>khong co loi</li>"
        cards.append(f'''
    <div class="card">
      <div class="hd"><b>{it["name"]}</b>
        <span class="badge" style="background:{color}">{it["score"]}% · {it["status"]}</span></div>
      {it["svg"]}
      <ul class="issues">{issues}</ul>
    </div>''')
    html = f'''<!doctype html><html lang="vi"><meta charset="utf-8">
<title>Spike DSL Generation — ket qua</title>
<style>
 body{{font-family:system-ui,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a}}
 h1{{font-size:22px;margin:0 0 4px}} .sub{{color:#64748b;margin-bottom:20px;font-size:14px}}
 .grid{{display:flex;flex-wrap:wrap;gap:18px}}
 .card{{background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px #0002;width:520px}}
 .hd{{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}}
 .badge{{color:#fff;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600}}
 .issues{{font-size:13px;color:#475569;margin:10px 0 0;padding-left:18px;line-height:1.6}}
 svg{{border:1px solid #e2e8f0;border-radius:6px;background:#fff}}
</style>
<h1>Spike: Concept Plan → Drawing DSL</h1>
<div class="sub">Kiem chung Open Question #5 — mo ta ngu nghia co du de LLM sinh ty le dep khong?</div>
<div class="grid">{"".join(cards)}</div>
</html>'''
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
