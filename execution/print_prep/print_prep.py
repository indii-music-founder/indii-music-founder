"""print_prep.py

Deterministic print preparation engine:
- Presets strictly matching `@indii/shared` PrintSpec.ts
- Cover box aspect ratio fitting with configurable focal point coordinates (fx, fy)
- Bleed support:
  * 'fill': scales source to cover the entire trim + bleed rectangle, then crops
  * 'extend': scales source to cover trim only, then extends bleed outward via cv2.BORDER_REFLECT_101
- Proof / guide overlay generation with trim box (red line) and safe zone (green line)
- CLI and Python API with JSON planning output
"""

import argparse
import json
import math
import os
import sys
from typing import Any, Dict, Optional, Tuple
import numpy as np
from PIL import Image, ImageDraw

try:
    import cv2
except ImportError:
    cv2 = None

# Pure media preset registry matching packages/shared/src/print/PrintSpec.ts exactly
PRESETS: Dict[str, Dict[str, Any]] = {
    "vinyl_sleeve": {
        "id": "vinyl_sleeve",
        "label": "Vinyl front artwork (12.375″)",
        "category": "physical",
        "widthIn": 12.375,
        "heightIn": 12.375,
        "dpi": 300,
        "minDpi": 300,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "cassette_jcard": {
        "id": "cassette_jcard",
        "label": "Cassette J-card (3 panels, 4.125×4″)",
        "category": "physical",
        "widthIn": 4.125,
        "heightIn": 4.0,
        "dpi": 300,
        "minDpi": 300,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "poster_11x17": {
        "id": "poster_11x17",
        "label": "Poster 11×17″",
        "category": "physical",
        "widthIn": 11.0,
        "heightIn": 17.0,
        "dpi": 300,
        "minDpi": 150,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "poster_18x24": {
        "id": "poster_18x24",
        "label": "Poster 18×24″",
        "category": "physical",
        "widthIn": 18.0,
        "heightIn": 24.0,
        "dpi": 300,
        "minDpi": 150,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "poster_24x36": {
        "id": "poster_24x36",
        "label": "Poster 24×36″",
        "category": "physical",
        "widthIn": 24.0,
        "heightIn": 36.0,
        "dpi": 300,
        "minDpi": 150,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "dtf_12x16": {
        "id": "dtf_12x16",
        "label": "DTF transfer 12×16″",
        "category": "physical",
        "widthIn": 12.0,
        "heightIn": 16.0,
        "dpi": 300,
        "minDpi": 300,
        "bleedIn": 0.0,
        "safeIn": 0.0,
    },
    "cover_art_distributor": {
        "id": "cover_art_distributor",
        "label": "Distributor cover art (3000×3000)",
        "category": "distributor",
        "widthIn": 10.0,
        "heightIn": 10.0,
        "dpi": 300,
        "minDpi": 300,
        "minPixels": {"width": 3000, "height": 3000},
        "bleedIn": 0.0,
        "safeIn": 0.0,
    },
    "flyer_letter": {
        "id": "flyer_letter",
        "label": "Flyer 8.5×11″ (general printer)",
        "category": "physical",
        "widthIn": 8.5,
        "heightIn": 11.0,
        "dpi": 300,
        "minDpi": 300,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "gotprint_flyer_letter": {
        "id": "gotprint_flyer_letter",
        "label": "GotPrint flyer 8.5×11″",
        "category": "physical",
        "widthIn": 8.5,
        "heightIn": 11.0,
        "dpi": 350,
        "minDpi": 350,
        "bleedIn": 0.125,
        "safeIn": 0.125,
    },
    "social_1080x1350": {
        "id": "social_1080x1350",
        "label": "Social feed (1080×1350)",
        "category": "digital",
        "widthIn": 15.0,
        "heightIn": 18.75,
        "dpi": 72,
        "minDpi": 72,
        "bleedIn": 0.0,
        "safeIn": 0.0,
    },
}

MAX_CREDIBLE_UPSCALE = 4


def plan_print(src_width: int, src_height: int, preset_id: str, requested_dpi: Optional[int] = None) -> Dict[str, Any]:
    """Calculates exact required pixels and upscale verdict matching @indii/shared PrintSpec.ts."""
    if preset_id not in PRESETS:
        raise ValueError(f"Unknown preset id: {preset_id}")
    if src_width <= 0 or src_height <= 0:
        raise ValueError("Source dimensions must be positive integers")

    preset = PRESETS[preset_id]
    dpi = requested_dpi if requested_dpi is not None else preset["dpi"]
    bleed_in = preset.get("bleedIn", 0.0)
    safe_in = preset.get("safeIn", 0.0)

    full_width_in = preset["widthIn"] + bleed_in * 2
    full_height_in = preset["heightIn"] + bleed_in * 2

    min_px = preset.get("minPixels", {})
    req_w = max(math.ceil(full_width_in * dpi), min_px.get("width", 0))
    req_h = max(math.ceil(full_height_in * dpi), min_px.get("height", 0))

    trim_w_px = math.ceil(preset["widthIn"] * dpi)
    trim_h_px = math.ceil(preset["heightIn"] * dpi)
    bleed_px = math.ceil(bleed_in * dpi)
    safe_px = math.ceil(safe_in * dpi)

    required_factor = max(req_w / src_width, req_h / src_height)

    if required_factor <= 1.0:
        verdict = "sufficient"
    elif required_factor <= MAX_CREDIBLE_UPSCALE:
        verdict = "upscale"
    else:
        verdict = "insufficient"

    return {
        "presetId": preset_id,
        "dpi": dpi,
        "source": {"width": src_width, "height": src_height},
        "required": {"width": req_w, "height": req_h},
        "trimPx": {"width": trim_w_px, "height": trim_h_px},
        "bleedPx": bleed_px,
        "safePx": safe_px,
        "trimIn": {"width": preset["widthIn"], "height": preset["heightIn"]},
        "bleedIn": bleed_in,
        "safeIn": safe_in,
        "requiredUpscaleFactor": round(required_factor, 2),
        "verdict": verdict,
    }


def cover_box(
    img: Image.Image,
    target_width: int,
    target_height: int,
    fx: float = 0.5,
    fy: float = 0.5,
) -> Image.Image:
    """Scales image to cover target_width x target_height, then crops using normalized focal point (fx, fy).

    fx: 0.0 (left) to 1.0 (right), default 0.5 (center)
    fy: 0.0 (top) to 1.0 (bottom), default 0.5 (center)
    """
    fx = min(max(fx, 0.0), 1.0)
    fy = min(max(fy, 0.0), 1.0)

    src_w, src_h = img.size
    scale = max(target_width / src_w, target_height / src_h)

    scaled_w = int(math.ceil(src_w * scale))
    scaled_h = int(math.ceil(src_h * scale))

    scaled_img = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

    # Calculate crop coordinates based on focal center
    excess_x = scaled_w - target_width
    excess_y = scaled_h - target_height

    left = int(round(excess_x * fx))
    top = int(round(excess_y * fy))

    # Clamp boundaries
    left = max(0, min(left, excess_x))
    top = max(0, min(top, excess_y))
    right = left + target_width
    bottom = top + target_height

    return scaled_img.crop((left, top, right, bottom))


def extend_bleed(
    trim_img: Image.Image,
    bleed_px: int,
) -> Image.Image:
    """Extends bleed area outward from the trim image using mirror reflection (cv2.BORDER_REFLECT_101)."""
    if bleed_px <= 0:
        return trim_img

    img_np = np.array(trim_img)

    if cv2 is not None:
        padded_np = cv2.copyMakeBorder(
            img_np,
            bleed_px,
            bleed_px,
            bleed_px,
            bleed_px,
            cv2.BORDER_REFLECT_101,
        )
    else:
        # Fallback numpy reflect
        if img_np.ndim == 3:
            padded_np = np.pad(
                img_np,
                ((bleed_px, bleed_px), (bleed_px, bleed_px), (0, 0)),
                mode="reflect",
            )
        else:
            padded_np = np.pad(
                img_np,
                ((bleed_px, bleed_px), (bleed_px, bleed_px)),
                mode="reflect",
            )

    return Image.fromarray(padded_np)


def create_guide_overlay(
    full_img: Image.Image,
    bleed_px: int,
    safe_px: int,
) -> Image.Image:
    """Creates a copy of the image with a visual trim line (red) and safe zone line (green)."""
    guide = full_img.copy().convert("RGBA")
    overlay = Image.new("RGBA", guide.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    w, h = guide.size

    # Trim box (where the paper is cut)
    trim_left = bleed_px
    trim_top = bleed_px
    trim_right = w - bleed_px
    trim_bottom = h - bleed_px

    if bleed_px > 0:
        # Draw red dashed or solid trim line
        draw.rectangle(
            [trim_left, trim_top, trim_right - 1, trim_bottom - 1],
            outline=(255, 0, 0, 220),
            width=max(2, int(w * 0.002)),
        )

    # Safe box (inside trim)
    if safe_px > 0:
        safe_left = trim_left + safe_px
        safe_top = trim_top + safe_px
        safe_right = trim_right - safe_px
        safe_bottom = trim_bottom - safe_px

        draw.rectangle(
            [safe_left, safe_top, safe_right - 1, safe_bottom - 1],
            outline=(0, 255, 100, 220),
            width=max(2, int(w * 0.002)),
        )

    return Image.alpha_composite(guide, overlay)


def prepare_artwork(
    input_path: str,
    output_path: str,
    preset_id: str,
    bleed_mode: str = "extend",
    fx: float = 0.5,
    fy: float = 0.5,
    guide_path: Optional[str] = None,
    model_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Prepares source artwork for print:

    1. Computes print plan
    2. Upscales / fits using chosen bleed mode
    3. Saves final print-ready PNG with 300 DPI metadata
    4. Optionally saves proof guide overlay
    """
    src_img = Image.open(input_path)
    plan = plan_print(src_img.width, src_img.height, preset_id)

    target_total_w = plan["required"]["width"]
    target_total_h = plan["required"]["height"]
    bleed_px = plan["bleedPx"]
    safe_px = plan["safePx"]
    dpi = plan["dpi"]

    # In extend mode, source covers the trim rectangle, then bleed is reflected outward
    # In fill mode, source covers the full rectangle (trim + bleed), cropped to fit
    if bleed_mode == "extend" and bleed_px > 0:
        trim_w = plan["trimPx"]["width"]
        trim_h = plan["trimPx"]["height"]

        # Fit to trim box
        trim_fitted = cover_box(src_img, trim_w, trim_h, fx=fx, fy=fy)

        # Upscale with AI or Lanczos if needed
        # If upscale module is imported and model_path provided, run tiled upscale
        from execution.print_prep.upscale import upscale_image

        temp_trim_path = output_path + ".temp_trim.png"
        trim_fitted.save(temp_trim_path, format="PNG", dpi=(dpi, dpi))

        upscale_image(
            input_path=temp_trim_path,
            output_path=temp_trim_path,
            model_path=model_path,
            target_width=trim_w,
            target_height=trim_h,
            dpi=dpi,
        )

        trim_upscaled = Image.open(temp_trim_path)
        final_img = extend_bleed(trim_upscaled, bleed_px)

        if os.path.exists(temp_trim_path):
            os.remove(temp_trim_path)
    else:
        # Fill mode or bleed_px == 0: cover full dimensions
        full_fitted = cover_box(src_img, target_total_w, target_total_h, fx=fx, fy=fy)

        from execution.print_prep.upscale import upscale_image

        temp_full_path = output_path + ".temp_full.png"
        full_fitted.save(temp_full_path, format="PNG", dpi=(dpi, dpi))

        upscale_image(
            input_path=temp_full_path,
            output_path=temp_full_path,
            model_path=model_path,
            target_width=target_total_w,
            target_height=target_total_h,
            dpi=dpi,
        )

        final_img = Image.open(temp_full_path)
        if os.path.exists(temp_full_path):
            os.remove(temp_full_path)

    # Save final print image with exact DPI
    final_img.save(output_path, format="PNG", dpi=(dpi, dpi), optimize=True)

    if guide_path:
        guide_img = create_guide_overlay(final_img, bleed_px, safe_px)
        guide_img.save(guide_path, format="PNG", dpi=(dpi, dpi), optimize=True)

    return {
        "output": output_path,
        "guide": guide_path,
        "plan": plan,
        "width": final_img.width,
        "height": final_img.height,
        "dpi": dpi,
    }


def main():
    parser = argparse.ArgumentParser(description="indii Print Prep Engine")
    parser.add_argument("input", nargs="?", help="Input image path")
    parser.add_argument("output", nargs="?", help="Output image path")
    parser.add_argument("--preset", default="cover_art_distributor", help="Preset ID")
    parser.add_argument("--bleed-mode", choices=["fill", "extend"], default="extend", help="Bleed handling mode")
    parser.add_argument("--fx", type=float, default=0.5, help="Focal center X (0.0 to 1.0)")
    parser.add_argument("--fy", type=float, default=0.5, help="Focal center Y (0.0 to 1.0)")
    parser.add_argument("--guide", help="Optional guide preview output path")
    parser.add_argument("--model", help="Path to Spandrel/RealESRGAN weights")
    parser.add_argument("--plan", action="store_true", help="Print plan JSON and exit without processing image")

    args = parser.parse_args()

    if args.plan:
        if not args.input:
            print("Error: --plan requires an input image to read source dimensions.", file=sys.stderr)
            sys.exit(1)
        img = Image.open(args.input)
        plan = plan_print(img.width, img.height, args.preset)
        print(json.dumps(plan, indent=2))
        return

    if not args.input or not args.output:
        parser.print_help()
        sys.exit(1)

    result = prepare_artwork(
        input_path=args.input,
        output_path=args.output,
        preset_id=args.preset,
        bleed_mode=args.bleed_mode,
        fx=args.fx,
        fy=args.fy,
        guide_path=args.guide,
        model_path=args.model,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
