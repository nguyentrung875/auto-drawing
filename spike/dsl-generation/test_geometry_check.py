"""Self-test validator hinh hoc — phai chay dung TRUOC khi tin ket qua spike."""
import json, sys
from geometry_check import check

plan = json.load(open("concept_plans/cat_number20.json", encoding="utf-8"))

# --- Truong hop 1: hinh meo DUNG TY LE (tu ve tay) ---
good = {"subject_name":"cat","canvas":{"width":1000,"height":1000},"shapes":[
 {"id":"hook2","step":1,"part_name":"hook_number_20","type":"polyline",
  "points":[[300,700],[300,560],[420,560],[420,700],[300,700]]},
 {"id":"hook0","step":1,"part_name":"hook_number_20","type":"ellipse","cx":560,"cy":630,"rx":110,"ry":140},
 {"id":"head","step":2,"part_name":"head_outline","type":"circle","cx":500,"cy":420,"r":150},
 {"id":"ear_l","step":3,"part_name":"ears","type":"polyline","points":[[400,320],[380,220],[480,290]]},
 {"id":"ear_r","step":3,"part_name":"ears","type":"polyline","points":[[600,320],[620,220],[520,290]]},
 {"id":"eye_l","step":4,"part_name":"face_details","type":"circle","cx":450,"cy":400,"r":16},
 {"id":"eye_r","step":4,"part_name":"face_details","type":"circle","cx":550,"cy":400,"r":16},
 {"id":"nose","step":4,"part_name":"face_details","type":"polyline","points":[[485,450],[515,450],[500,470],[485,450]]},
]}

# --- Truong hop 2: TAI LE LUNG tren khong (loi kinh dien) ---
floating_ears = json.loads(json.dumps(good))
for s in floating_ears["shapes"]:
    if s["id"].startswith("ear"):
        s["points"] = [[p[0], p[1]-260] for p in s["points"]]

# --- Truong hop 3: MAT NAM NGOAI DAU ---
eyes_out = json.loads(json.dumps(good))
for s in eyes_out["shapes"]:
    if s["id"].startswith("eye"):
        s["cx"] += 400

# --- Truong hop 4: TAI NAM DUOI dau (sai huong) ---
ears_below = json.loads(json.dumps(good))
for s in ears_below["shapes"]:
    if s["id"].startswith("ear"):
        s["points"] = [[p[0], p[1]+300] for p in s["points"]]

# --- Truong hop 5: hinh qua nho ---
tiny = json.loads(json.dumps(good))
for s in tiny["shapes"]:
    if "cx" in s: s["cx"]=s["cx"]*0.2+400; s["cy"]=s["cy"]*0.2+400
    if "r" in s: s["r"]*=0.2
    if "rx" in s: s["rx"]*=0.2; s["ry"]*=0.2
    if "points" in s: s["points"]=[[p[0]*0.2+400,p[1]*0.2+400] for p in s["points"]]

# --- Truong hop 6: shape suy bien + thieu tham so ---
broken = {"subject_name":"cat","canvas":{"width":1000,"height":1000},"shapes":[
 {"id":"a","step":1,"part_name":"hook_number_20","type":"circle","cx":500,"cy":500,"r":0},
 {"id":"b","step":2,"part_name":"head_outline","type":"circle","cx":500},
 {"id":"c","step":3,"part_name":"ears","type":"polyline","points":[[10,10]]},
]}

# --- Truong hop 7: tran ra ngoai canvas ---
oob = json.loads(json.dumps(good))
for s in oob["shapes"]:
    if "cx" in s: s["cx"]+=500
    if "points" in s: s["points"]=[[p[0]+500,p[1]] for p in s["points"]]

cases=[("hinh dung ty le", good, 80, 100),
       ("tai le lung tren khong", floating_ears, 0, 80),
       ("mat nam ngoai dau", eyes_out, 0, 85),
       ("tai nam duoi dau", ears_below, 0, 85),
       ("hinh qua nho", tiny, 0, 90),
       ("shape hong/suy bien", broken, 0, 55),
       ("tran ra ngoai canvas", oob, 0, 92)]

print("\n🧪 Self-test validator hinh hoc\n" + "="*64)
fails=0
for name, dsl, lo, hi in cases:
    r = check(dsl, plan)
    ok = lo <= r["score_pct"] <= hi
    fails += not ok
    print(f"{'✅' if ok else '❌'} {name:26s} {r['score_pct']:5.1f}%  (can {lo}-{hi})")
    for i in r["issues"][:2]:
        print(f"      · {i}")
print("="*64)
print(f"{'✅ TAT CA PASS' if not fails else f'❌ {fails} CASE FAIL'}  ({len(cases)-fails}/{len(cases)})\n")
sys.exit(1 if fails else 0)
