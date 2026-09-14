"""
prompts.py — Prompt definitions for the two Vision Ingestion modes
===================================================================

Spike này so sánh 2 chế độ dùng Vision LLM để nạp ảnh how-to-draw:

  MODE "concept"   — Image-to-Concept  (đề xuất mới)
      LLM CHỈ đọc phần NGỮ NGHĨA: vẽ con gì, bắt đầu từ hook nào,
      có bao nhiêu bước, mỗi bước thêm bộ phận gì, lời thoại tiếng Việt.
      KHÔNG hỏi toạ độ. Geometry để Path A (LLM sinh DSL) / Path B (SVG) lo.
      → Ngưỡng pass đề xuất: >= 90%

  MODE "geometry"  — Image-to-DSL  (bản gốc trong PRD, FR-3b)
      LLM phải ước lượng thêm toạ độ tương đối (relative_cx/cy/rx/ry/points...)
      cho từng nét. Đây là phần model thị giác thường yếu.
      → Ngưỡng pass theo PRD/A-H13: >= 70%

Mục tiêu: có SỐ LIỆU thật để quyết định tách FR-3b thành
FR-3b (Image-to-Concept, vào MVP) và FR-3c (Image-to-Geometry, v2).
"""

# ─── MODE: concept ────────────────────────────────────────────────────────────

CONCEPT_PROMPT = """\
You are analyzing a "how to draw" tutorial image to extract a DRAWING PLAN.

IMPORTANT: Do NOT output any coordinates, numbers for positions, SVG, or path data.
We only want the SEMANTIC plan: what is drawn, in what order, and what to say.
Another system will generate the exact geometry later.

LOOK FOR:
1. Multiple panels/steps showing a drawing progression (step-by-step)
2. What character/object is being drawn (the "subject")
3. Whether the drawing starts from a simple recognizable shape such as a digit,
   a letter, or a basic symbol (the "hook") — this is the curiosity trigger
4. Which NEW body part / element is added at each step

RETURN ONLY valid JSON with this schema (no markdown fences, no explanation):
{
  "is_step_tutorial": <boolean>,
  "confidence": <float 0.0-1.0>,
  "reject_reason": <string or null, only when is_step_tutorial is false>,
  "subject_name": <string, lowercase english, e.g. "rabbit">,
  "subject_name_vi": <string, vietnamese, e.g. "con tho">,
  "hook_shape": <string or null, e.g. "number 3", "letter C", "oval", null>,
  "suggested_hooks": [<string>, ...],
  "style_tags": [<string>, ...],
  "complexity": <"easy"|"medium"|"hard">,
  "step_count": <integer>,
  "steps": [
    {
      "step_number": <int starting at 1>,
      "part_name": <string, snake_case english, e.g. "left_ear">,
      "description": <string, one sentence describing the new stroke(s) added>,
      "primitive_hint": <"arc"|"circle"|"line"|"bezier"|"polyline"|"rect">,
      "stroke_count": <integer, how many separate pen strokes in this step>,
      "voice_cue": <string, VIETNAMESE narration, max 10 words, natural spoken tone>
    }
  ]
}

RULES:
- steps MUST be ordered the same way a human would physically draw it
- part_name must be unique within the list
- voice_cue MUST be in Vietnamese, short, punchy, suitable for a TikTok voiceover
  (good: "Them hai cai tai nhe" / bad: "Now we add the two ears of the rabbit")
- primitive_hint is a HINT only, pick the closest match
- suggested_hooks: if hook_shape is null, propose 1-3 digits/letters this subject
  could plausibly be drawn from; otherwise repeat hook_shape as the single item
- If the image is NOT a step-by-step drawing tutorial:
  is_step_tutorial=false, steps=[], and explain in reject_reason
- NEVER invent coordinates. There are no coordinate fields in this schema.
"""

# ─── MODE: geometry ───────────────────────────────────────────────────────────
# Đây là prompt gốc của spike (giữ nguyên hành vi để so sánh công bằng).

GEOMETRY_PROMPT = """\
Analyze this "how to draw" tutorial image carefully.

LOOK FOR:
1. Multiple numbered panels/steps showing a drawing progression (step-by-step)
2. What character/shape is being drawn (the "subject")
3. Whether drawing starts from a simple shape like a digit or letter (the "hook")
4. Exactly what NEW strokes/lines are added at each step

RETURN ONLY valid JSON with this schema (no markdown, no explanation):
{
  "is_step_tutorial": <boolean>,
  "confidence": <float 0.0-1.0>,
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
          "relative_cx": <float 0-1, center x, for arc/circle>,
          "relative_cy": <float 0-1, center y, for arc/circle>,
          "relative_rx": <float 0-1, x-radius, for arc>,
          "relative_ry": <float 0-1, y-radius, for arc>,
          "relative_r":  <float 0-1, radius, for circle>,
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
- If not a step-by-step tutorial -> is_step_tutorial: false, steps: []
- hook_shape: null if drawing does NOT start from a recognizable digit/letter/symbol
- Estimate positions from what you see; be consistent across steps
"""

# ─── Registry ────────────────────────────────────────────────────────────────

MODES = {
    "concept": {
        "prompt": CONCEPT_PROMPT,
        "label": "Image-to-Concept",
        "pass_threshold": 90.0,
        "partial_threshold": 75.0,
        "max_tokens": 2000,
        "prd_ref": "FR-3b (proposed)",
        "note": "LLM chi doc ngu nghia; geometry do DSL Compiler lo",
    },
    "geometry": {
        "prompt": GEOMETRY_PROMPT,
        "label": "Image-to-DSL (geometry)",
        "pass_threshold": 70.0,
        "partial_threshold": 50.0,
        "max_tokens": 3000,
        "prd_ref": "FR-3b (current) / A-H13",
        "note": "LLM phai uoc luong toa do tuong doi tung net",
    },
}

DEFAULT_MODE = "concept"


def get_prompt(mode: str) -> str:
    if mode not in MODES:
        raise ValueError(f"Unknown mode '{mode}'. Choose from: {list(MODES)}")
    return MODES[mode]["prompt"]
