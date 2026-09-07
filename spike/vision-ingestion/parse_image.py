"""
parse_image.py — Vision LLM Image Ingestion Spike
===================================================
Spike cho Path D: Image-to-DSL Ingestion
Gọi GPT-4o Vision và/hoặc Gemini Vision để extract Drawing Steps từ ảnh how-to-draw.

Usage:
    python parse_image.py <image_path> [--model openai|gemini|both]

Requirements:
    pip install openai google-generativeai pillow

Setup:
    Đặt API keys vào environment variables:
    - OPENAI_API_KEY=sk-...
    - GEMINI_API_KEY=AIza...
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime

# ─── Prompt ──────────────────────────────────────────────────────────────────

VISION_PROMPT = """\
Analyze this "how to draw" tutorial image carefully.

LOOK FOR:
1. Multiple numbered panels/steps showing a drawing progression (step-by-step)
2. What character/shape is being drawn (the "subject")
3. Whether drawing starts from a simple shape like a digit or letter (the "hook")
4. Exactly what NEW strokes/lines are added at each step

RETURN ONLY valid JSON with this schema (no markdown, no explanation):
{
  "is_step_tutorial": <boolean>,
  "confidence": <float 0.0–1.0>,
  "subject_name": <string, e.g. "rabbit">,
  "hook_shape": <string or null, e.g. "number 3", "letter C", null>,
  "step_count": <integer>,
  "steps": [
    {
      "step_number": <int starting at 1>,
      "description": <string, what to draw>,
      "voice_cue": <string, Vietnamese narration under 10 words>,
      "new_strokes": [
        {
          "id": <string, e.g. "s1_body">,
          "type": <"arc"|"circle"|"line"|"bezier"|"polyline"|"rect">,
          "description": <string, describe shape and position>,
          "relative_cx": <float 0–1, center x, for arc/circle>,
          "relative_cy": <float 0–1, center y, for arc/circle>,
          "relative_rx": <float 0–1, x-radius, for arc>,
          "relative_ry": <float 0–1, y-radius, for arc>,
          "relative_r":  <float 0–1, radius, for circle>,
          "relative_points": [[x,y],...],
          "relative_x": <float, left edge, for rect>,
          "relative_y": <float, top edge, for rect>,
          "relative_w": <float, width, for rect>,
          "relative_h": <float, height, for rect>
        }
      ]
    }
  ]
}

RULES:
- Relative coords: 0.0=left/top, 1.0=right/bottom of the full canvas
- Only include fields relevant to each stroke type
- If not a step-by-step tutorial → is_step_tutorial: false, steps: []
- hook_shape: null if drawing does NOT start from a recognizable digit/letter/symbol
- Estimate positions from what you see; be consistent across steps
"""

# ─── OpenAI ──────────────────────────────────────────────────────────────────

def parse_with_openai(image_path: Path) -> dict:
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

    ext = image_path.suffix.lower().lstrip(".")
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    mime_type = mime_map.get(ext, "image/jpeg")

    t0 = time.time()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_PROMPT},
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
        max_tokens=2000,
        temperature=0.1,
    )
    elapsed = round(time.time() - t0, 2)

    raw_text = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    raw_text = raw_text.strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as e:
        result = {"error": f"JSON parse failed: {e}", "raw": raw_text}

    result["_meta"] = {
        "model": "gpt-4o",
        "elapsed_s": elapsed,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        },
    }
    return result


# ─── Gemini ──────────────────────────────────────────────────────────────────

def parse_with_gemini(image_path: Path) -> dict:
    try:
        import google.generativeai as genai
    except ImportError:
        return {"error": "google-generativeai not installed. Run: pip install google-generativeai"}

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY not set"}

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-pro")

    try:
        from PIL import Image as PILImage
        img = PILImage.open(image_path)
    except ImportError:
        return {"error": "pillow not installed. Run: pip install pillow"}

    t0 = time.time()
    response = model.generate_content(
        [VISION_PROMPT, img],
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2000,
        ),
    )
    elapsed = round(time.time() - t0, 2)

    raw_text = response.text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    raw_text = raw_text.strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as e:
        result = {"error": f"JSON parse failed: {e}", "raw": raw_text}

    result["_meta"] = {
        "model": "gemini-1.5-pro",
        "elapsed_s": elapsed,
    }
    return result


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
    parser.add_argument("--out", help="Output JSON file path (default: <image>.result.json)")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"❌ File not found: {image_path}")
        sys.exit(1)

    print(f"\n🔍 Parsing: {image_path.name}")
    print(f"   Model: {args.model}")
    print("─" * 50)

    results = {"image": str(image_path), "timestamp": datetime.now().isoformat()}

    if args.model in ("openai", "both"):
        print("📡 Calling GPT-4o Vision...")
        result = parse_with_openai(image_path)
        results["openai"] = result
        if "error" not in result:
            print(f"   ✅ GPT-4o: {result.get('step_count', '?')} steps, "
                  f"subject='{result.get('subject_name', '?')}', "
                  f"hook='{result.get('hook_shape', 'none')}', "
                  f"confidence={result.get('confidence', '?')}, "
                  f"time={result['_meta']['elapsed_s']}s")
        else:
            print(f"   ❌ GPT-4o error: {result['error']}")

    if args.model in ("gemini", "both"):
        print("📡 Calling Gemini 1.5 Pro Vision...")
        result = parse_with_gemini(image_path)
        results["gemini"] = result
        if "error" not in result:
            print(f"   ✅ Gemini: {result.get('step_count', '?')} steps, "
                  f"subject='{result.get('subject_name', '?')}', "
                  f"hook='{result.get('hook_shape', 'none')}', "
                  f"confidence={result.get('confidence', '?')}, "
                  f"time={result['_meta']['elapsed_s']}s")
        else:
            print(f"   ❌ Gemini error: {result['error']}")

    out_path = Path(args.out) if args.out else image_path.with_suffix(".result.json")
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n💾 Saved: {out_path}")
    print(f"\n🎨 Next: open render.html and load {out_path.name}")

    return results


if __name__ == "__main__":
    main()
