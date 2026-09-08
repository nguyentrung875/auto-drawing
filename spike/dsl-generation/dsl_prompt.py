"""Prompt sinh Drawing DSL tu Concept Plan (FR-2).

Cau hoi spike tra loi — Open Question #5 trong PRD:
    Concept Plan chi mo ta NGU NGHIA ("long ear on the left"). Lieu tung ay
    thong tin co du de LLM sinh ra DSL co TY LE DEP khong?

Neu KHONG du -> phai bo sung goi y vi tri tho vao Concept Plan schema (FR-3b),
tuc la phai sua PRD lan nua.
"""

DSL_SCHEMA_DOC = """
{
  "subject_name": "cat",
  "canvas": {"width": 1000, "height": 1000},
  "shapes": [
    {
      "id": "body",                    // snake_case, duy nhat
      "step": 1,                       // buoc nao ve hinh nay (khop step_number)
      "part_name": "hook_number_20",   // khop part_name trong Concept Plan
      "type": "circle",                // circle | ellipse | line | polyline | arc | rect
      "cx": 500, "cy": 620, "r": 180   // tham so tuy theo type (toa do TUYET DOI, px)
    }
  ]
}

Tham so theo tung type:
  circle   : cx, cy, r
  ellipse  : cx, cy, rx, ry, [rotation]
  rect     : x, y, w, h, [rx]
  line     : x1, y1, x2, y2
  polyline : points: [[x,y], [x,y], ...]   (>= 2 diem)
  arc      : cx, cy, rx, ry, start_angle, end_angle   (goc tinh bang DO, 0 = huong 3 gio, tang nguoc chieu kim dong ho)
"""

SYSTEM = """Ban la mot hoa si ky thuat chuyen chuyen doi ke hoach ve thanh hinh hoc chinh xac.

Nhiem vu: nhan mot Concept Plan (mo ta ngu nghia tung buoc ve) va sinh ra Drawing DSL
voi TOA DO TUYET DOI tren canvas 1000x1000.

QUY TAC BAT BUOC:
1. Chi tra ve JSON hop le. Khong markdown, khong giai thich, khong ```json.
2. Toa do tuyet doi, don vi pixel, goc toa do (0,0) o GOC TREN BEN TRAI.
   Truc y huong XUONG DUOI (chuan SVG/canvas).
3. TAT CA cac shape phai nam trong canvas, va nen chiem 60-85% khung hinh
   (chua khoang le hop ly, khong dinh sat mep).
4. TY LE PHAI DUNG THUC TE. Vi du:
   - Tai meo phai NAM TREN dau va CHAM vao dau, khong lo lung.
   - Mat phai nam BEN TRONG duong vien dau.
   - Chan phai nam DUOI than va cham than.
   - Cac bo phan cua cung mot con vat phai KET NOI voi nhau thanh mot hinh lien mach.
5. Thu tu ve phai theo dung step_number trong Concept Plan.
6. Moi shape phai co truong "part_name" khop voi part_name cua buoc tuong ung.
7. Khi Concept Plan noi mot bo phan "on top of", "below", "inside", "overlapping"
   mot bo phan khac, hinh hoc ban sinh ra PHAI phan anh dung quan he do.

SCHEMA:
""" + DSL_SCHEMA_DOC


def build_user_prompt(plan: dict) -> str:
    lines = [
        f"Subject: {plan['subject_name']} ({plan.get('subject_name_vi', '')})",
        f"Hook shape: {plan.get('hook_shape') or 'khong co'}",
        f"Do phuc tap: {plan.get('complexity', 'medium')}",
        "",
        "CAC BUOC VE:",
    ]
    for s in plan["steps"]:
        lines.append(
            f"  Buoc {s['step_number']}: [{s['part_name']}] {s['description']}\n"
            f"      goi y primitive: {s['primitive_hint']}, so net: {s['stroke_count']}"
        )
    lines += [
        "",
        "Sinh Drawing DSL cho toan bo cac buoc tren. Chi tra ve JSON.",
    ]
    return "\n".join(lines)
