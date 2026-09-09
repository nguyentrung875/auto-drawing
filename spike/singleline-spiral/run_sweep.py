#!/usr/bin/env python3
"""Quet tham so (vong 6) — tinh chinh quanh g6-rim."""
import json, os, subprocess, sys

PY = sys.executable
IMG = "input/portrait.png"

CANDIDATES = {
    "g6-rim":     ["--mode", "density", "--prep", "sharp", "--gap-min", "1.35", "--gap-max", "7.5",
                   "--stroke-w", "1.5", "--gap-p", "1.8", "--rim", "250"],
    "h1-deep":    ["--mode", "density", "--prep", "sharp", "--gap-min", "1.3", "--gap-max", "8.0",
                   "--stroke-w", "1.5", "--gap-p", "2.0", "--eps", "0.12", "--gamma", "0.85", "--rim", "250"],
    "h2-edge":    ["--mode", "density", "--prep", "sharp", "--gap-min", "1.3", "--gap-max", "8.0",
                   "--stroke-w", "1.5", "--gap-p", "2.0", "--eps", "0.12", "--gamma", "0.85",
                   "--rim", "250", "--edge-k", "0.08"],
    "h3-video":   ["--mode", "density", "--prep", "sharp", "--gap-min", "1.6", "--gap-max", "8.0",
                   "--stroke-w", "1.5", "--gap-p", "2.0", "--rim", "250"],
    "h4-fine":    ["--mode", "density", "--prep", "sharp", "--gap-min", "1.3", "--gap-max", "8.0",
                   "--stroke-w", "1.5", "--gap-p", "2.0", "--eps", "0.12", "--gamma", "0.85",
                   "--rim", "250", "--pp-turn", "200", "--n-phi", "200"],
}

rows = []
for name, extra in CANDIDATES.items():
    out = f"output/sweep/{name}"
    subprocess.run([PY, "spiral.py", IMG, "--out", out, "--scale", "2", *extra],
                   check=True, capture_output=True)
    st = json.load(open(f"{out}/stats.json"))
    rows.append((name, st))

hdr = (f"{'name':12s} {'pts':>6s} {'len_k':>7s} {'tlx':>5s} {'S2':>7s} {'tone':>7s} "
       f"{'S2b2':>7s} {'tonb2':>7s} {'sharp':>7s}")
print(hdr)
for name, st in rows:
    print(f"{name:12s} {st['points']:6d} {st['length_px']/1000:7.1f} {st['timelapse_45s']:5.1f} "
          f"{st['likeness_S2']:7.4f} {st['tone_pearson']:+7.3f} "
          f"{st['likeness_S2_blur2']:7.4f} {st['tone_pearson_blur2']:+7.3f} "
          f"{st['sharpness']:7.4f}")
