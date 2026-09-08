"""
eval.py — DEPRECATED, dung compare.py thay the
================================================

Truoc day eval.py chay batch cho 1 che do duy nhat (geometry) va cham diem
bang mot rubric duy nhat. Ke tu khi spike duoc mo rong thanh 2 che do
(concept vs geometry), toan bo chuc nang do da chuyen sang compare.py — noi
moi che do duoc cham theo rubric rieng va co bao cao so sanh side-by-side.

Tuong duong lenh:
    python eval.py --model both               ->  python compare.py --model both
    python eval.py --model gemini             ->  python compare.py --model gemini --modes geometry
"""

import sys

MESSAGE = """
⚠️  eval.py da duoc thay the boi compare.py

    Chay ca 2 che do (khuyen nghi):
        python compare.py --model both

    Chi chay geometry (hanh vi cu cua eval.py):
        python compare.py --modes geometry --model both

    Chi chay concept:
        python compare.py --modes concept --model both

    Kiem tra setup ma khong ton API cost:
        python compare.py --dry-run

Xem README.md de biet chi tiet.
"""

if __name__ == "__main__":
    print(MESSAGE)
    sys.exit(1)
