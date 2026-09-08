"""
parse_image.py — Vision LLM Image Ingestion Spike
===================================================
Spike cho Path D. Ho tro 2 che do:

    --mode concept    Image-to-Concept  (ngu nghia, KHONG toa do)  [default]
    --mode geometry   Image-to-DSL      (co uoc luong toa do)
    --mode both-modes Chay ca hai de so sanh tren cung 1 anh

Usage:
    python parse_image.py <image_path> [--model openai|gemini|both] [--mode concept|geometry|both-modes]

Requirements:
    pip install openai google-generativeai pillow

Setup:
    OPENAI_API_KEY=sk-...
    GEMINI_API_KEY=AIza...
    (tuy chon) OPENAI_VISION_MODEL=gpt-4o
    (tuy chon) GEMINI_VISION_MODEL=gemini-1.5-pro
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime

from prompts import MODES, get_prompt

OPENAI_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")
GEMINI_MODEL = os.environ.get("GEMINI_VISION_MODEL", "gemini-3.6-flash")

MIME_MAP = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _strip_fences(raw_text: str) -> str:
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        parts = raw_text.split("```")
        raw_text = parts[1] if len(parts) > 1 else raw_text
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    return raw_text.strip()


def _to_json(raw_text: str) -> dict:
    cleaned = _strip_fences(raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse failed: {e}", "raw": cleaned}


# ─── OpenAI ──────────────────────────────────────────────────────────────────

def parse_with_openai(image_path: Path, mode: str) -> dict:
    try:
        import openai
    except ImportError:
        return {"error": "openai not installed. Run: pip install openai"}

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY not set"}

    client = openai.OpenAI(api_key=api_key)

    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    mime_type = MIME_MAP.get(image_path.suffix.lower().lstrip("."), "image/jpeg")

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": get_prompt(mode)},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_data}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=MODES[mode]["max_tokens"],
            temperature=0.1,
        )
    except Exception as e:  # noqa: BLE001 — spike: surface any API failure as data
        return {"error": f"OpenAI API call failed: {e}"}

    elapsed = round(time.time() - t0, 2)
    result = _to_json(response.choices[0].message.content)
    result["_meta"] = {
        "model": OPENAI_MODEL,
        "mode": mode,
        "elapsed_s": elapsed,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        },
    }
    return result


# ─── Gemini ──────────────────────────────────────────────────────────────────

def parse_with_gemini(image_path: Path, mode: str) -> dict:
    """Dung SDK moi `google-genai`. SDK cu `google-generativeai` da EOL."""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"error": "google-genai not installed. Run: pip install google-genai"}

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY / GOOGLE_API_KEY not set"}

    mime_type = MIME_MAP.get(image_path.suffix.lower().lstrip("."), "image/jpeg")
    image_bytes = image_path.read_bytes()

    client = genai.Client(api_key=api_key)

    t0 = time.time()
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                get_prompt(mode),
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=MODES[mode]["max_tokens"],
                response_mime_type="application/json",
            ),
        )
    except Exception as e:  # noqa: BLE001
        return {"error": f"Gemini API call failed: {e}"}

    elapsed = round(time.time() - t0, 2)

    text = getattr(response, "text", None)
    if not text:
        return {"error": f"Gemini returned no text (finish_reason may be MAX_TOKENS/SAFETY): {response}"}

    result = _to_json(text)
    meta = {"model": GEMINI_MODEL, "mode": mode, "elapsed_s": elapsed}
    usage = getattr(response, "usage_metadata", None)
    if usage:
        meta["usage"] = {
            "prompt_tokens": getattr(usage, "prompt_token_count", None),
            "completion_tokens": getattr(usage, "candidates_token_count", None),
        }
    result["_meta"] = meta
    return result


# ─── Orchestration ───────────────────────────────────────────────────────────

RETRYABLE = ("503", "unavailable", "high demand", "429", "rate limit",
             "resource_exhausted", "500", "internal", "deadline")


def _is_retryable(err: str) -> bool:
    low = err.lower()
    return any(x in low for x in RETRYABLE)


def parse_one(image_path: Path, models: list[str], modes: list[str],
              verbose: bool = True, retry: int = 0) -> dict:
    """Chay tat ca to hop (model x mode) tren 1 anh.

    Ket qua co dang:
        {"image":..., "timestamp":..., "modes": {"concept": {"openai": {...}, "gemini": {...}}}}
    """
    results = {
        "image": str(image_path),
        "timestamp": datetime.now().isoformat(),
        "modes": {},
    }

    for mode in modes:
        results["modes"][mode] = {}
        if verbose:
            print(f"\n  ── mode={mode} ({MODES[mode]['label']}) ──")

        for model_name, fn in (("openai", parse_with_openai), ("gemini", parse_with_gemini)):
            if model_name not in models:
                continue
            if verbose:
                print(f"  📡 {model_name}...", flush=True)
            r = fn(image_path, mode)

            # Retry khi gap loi tam thoi (503 high demand, 429 rate limit...)
            attempt = 0
            while attempt < retry and "error" in r and _is_retryable(r["error"]):
                attempt += 1
                wait = 5 * (2 ** (attempt - 1))  # 5s, 10s, 20s
                if verbose:
                    print(f"     ⏳ loi tam thoi, doi {wait}s roi thu lai "
                          f"({attempt}/{retry})...", flush=True)
                time.sleep(wait)
                r = fn(image_path, mode)

            results["modes"][mode][model_name] = r
            if verbose:
                if "error" in r:
                    print(f"     ❌ {r['error']}")
                else:
                    print(
                        f"     ✅ steps={r.get('step_count', '?')} "
                        f"subject='{r.get('subject_name', '?')}' "
                        f"hook='{r.get('hook_shape') or 'none'}' "
                        f"conf={r.get('confidence', '?')} "
                        f"t={r.get('_meta', {}).get('elapsed_s', '?')}s"
                    )
    return results


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Parse a how-to-draw image with Vision LLM")
    parser.add_argument("image", help="Path to image file (jpg/png/webp)")
    parser.add_argument(
        "--model",
        choices=["openai", "gemini", "both"],
        default="both",
        help="Which Vision model to use (default: both)",
    )
    parser.add_argument(
        "--mode",
        choices=["concept", "geometry", "both-modes"],
        default="concept",
        help="concept = semantic only (default) | geometry = with coordinates | both-modes = compare",
    )
    parser.add_argument("--out", help="Output JSON file path (default: <image>.result.json)")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"❌ File not found: {image_path}")
        sys.exit(1)

    models = ["openai", "gemini"] if args.model == "both" else [args.model]
    modes = ["concept", "geometry"] if args.mode == "both-modes" else [args.mode]

    print(f"\n🔍 Parsing: {image_path.name}")
    print(f"   Models: {', '.join(models)}   Modes: {', '.join(modes)}")
    print("─" * 60)

    results = parse_one(image_path, models, modes)

    out_path = Path(args.out) if args.out else image_path.with_suffix(".result.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n💾 Saved: {out_path}")
    print("🎨 Next: open render.html (geometry mode) hoac chay compare.py de so sanh 2 mode")

    return results


if __name__ == "__main__":
    main()
