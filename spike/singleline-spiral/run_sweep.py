#!/usr/bin/env python3
"""Quet tham so (vong 11) — tinh chinh quanh m6-contrast (champion concentric)."""
import json, os, subprocess, sys

PY = sys.executable
IMG = "input/portrait.png"

CANDIDATES = {
    "o1-m6repro":  ["--mode", "concentric", "--prep", "sharp", "--rim", "250", "--pp-turn", "180",
                    "--local-m", "0.9", "--wiggle", "1.0", "--k-phi", "28", "--gamma", "0.9",
                    "--gap-p", "2.2", "--gap-max", "8.5"],
    "o2-hires":    ["--mode", "concentric", "--prep", "sharp", "--rim", "250", "--pp-turn", "200",
                    "--local-m", "0.9", "--wiggle", "1.0", "--k-phi", "36", "--gamma", "0.9",
                    "--gap-p", "2.2", "--gap-max", "8.5", "--n-phi", "240"],
    "o3-edge":     ["--mode", "concentric", "--prep", "sharp", "--rim", "250", "--pp-turn", "200",
                    "--local-m", "0.9", "--wiggle", "1.0", "--k-phi", "36", "--gamma", "0.9",
                    "--gap-p", "2.2", "--gap-max", "8.5", "--n-phi", "240", "--edge-k", "0.05"],
    "o4-wig15":    ["--mode", "concentric", "--prep", "sharp", "--rim", "250", "--pp-turn", "180",
                    "--local-m", "0.9", "--wiggle", "1.5", "--k-phi", "32", "--gamma", "0.9",
                    "--gap-p", "2.2", "--gap-max", "8.5"],
    "o5-strong":   ["--mode", "concentric", "--prep", "sharp", "--rim", "250", "--pp-turn", "180",
                    "--local-m", "0.8", "--wiggle", "1.0", "--k-phi", "28", "--gamma", "0.85",
                    "--gap-p", "2.4", "--gap-max", "9.0", "--gap-min", "1.45"],
}

rows = []
for name, extra in CANDIDATES.items():
    out = f"output/sweep/{name}"
    subprocess.run([PY, "spiral.py", IMG, "--out", out, "--scale", "2", *extra],
                   check=True, capture_output=True)
    st = json.load(open(f"{out}/stats.json"))
    rows.append((name, st))

hdr = (f"{'name':11s} {'pts':>6s} {'len_k':>7s} {'tlx':>5s} {'S2':>7s} {'tone':>7s} "
       f"{'wobble':>6s} {'sharp':>7s}")
print(hdr)
for name, st in rows:
    print(f"{name:11s} {st['points']:6d} {st['length_px']/1000:7.1f} {st['timelapse_45s']:5.1f} "
          f"{st['likeness_S2']:7.4f} {st['tone_pearson']:+7.3f} "
          f"{st['wobble']:6.2f} {st['sharpness']:7.4f}")
