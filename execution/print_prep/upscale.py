"""upscale.py

High-performance deterministic tiled image upscaler using Spandrel and Real-ESRGAN weights.
Supports:
- Spandrel ModelLoader for modern ESRGAN/Compact/DAT/SwinIR architectures
- 2D smooth cosine/linear feather weight windowing across overlapping tiles
- Boundary mirror reflection padding (cv2.BORDER_REFLECT_101) to eliminate edge seam artifacts
- Lanczos post-resampling for precise target dimensions
- Color space preservation (RGB and RGBA with separate alpha handling)
- DPI metadata injection via Pillow
"""

import math
import os
from typing import Optional, Tuple, Union
import numpy as np
from PIL import Image

try:
    import torch
except ImportError:
    torch = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from spandrel import ModelLoader
except ImportError:
    ModelLoader = None


def create_weight_window(tile_size: int, feather: int) -> np.ndarray:
    """Creates a 2D weight window (0.0 to 1.0) with smooth linear feathering

    at tile boundaries to blend overlapping patches seamlessly.
    """
    if feather <= 0:
        return np.ones((tile_size, tile_size, 1), dtype=np.float32)

    ramp = np.linspace(0.0, 1.0, feather, dtype=np.float32)
    flat = np.ones(tile_size - 2 * feather, dtype=np.float32)
    one_d = np.concatenate([ramp, flat, ramp[::-1]])

    two_d = np.outer(one_d, one_d)[:, :, np.newaxis]
    return two_d.astype(np.float32)


def upscale_tile_chunk(
    tile_img: np.ndarray,
    model: any,
    device: any,
) -> np.ndarray:
    """Inference for a single RGB tile: (H, W, 3) in uint8 [0, 255] -> (H*scale, W*scale, 3) in uint8 [0, 255]."""
    # Normalize to [0, 1] tensor NCHW
    tile_float = tile_img.astype(np.float32) / 255.0
    tensor = torch.from_numpy(tile_float.transpose(2, 0, 1)).unsqueeze(0).to(device)

    with torch.no_grad():
        out_tensor = model(tensor)

    out_np = out_tensor.squeeze(0).clamp(0.0, 1.0).cpu().numpy().transpose(1, 2, 0)
    out_uint8 = (out_np * 255.0).round().astype(np.uint8)
    return out_uint8


def upscale_tiled(
    image: np.ndarray,
    model: any,
    device: any,
    tile_size: int = 512,
    tile_overlap: int = 64,
    scale: int = 4,
) -> np.ndarray:
    """Tiled upscale of an RGB image using weight ramp blending across overlaps."""
    h, w, c = image.shape
    out_h, out_w = h * scale, w * scale

    # If image is smaller than tile_size, run single inference
    if h <= tile_size and w <= tile_size:
        return upscale_tile_chunk(image, model, device)

    stride = tile_size - tile_overlap
    feather = tile_overlap // 2
    weight_win = create_weight_window(tile_size * scale, feather * scale)

    # Output canvas and accumulator
    accum = np.zeros((out_h, out_w, c), dtype=np.float32)
    weight_accum = np.zeros((out_h, out_w, 1), dtype=np.float32)

    # Pad image so tiles fit nicely
    pad_h = (math.ceil(max(0, h - tile_size) / stride) * stride + tile_size) - h
    pad_w = (math.ceil(max(0, w - tile_size) / stride) * stride + tile_size) - w

    if pad_h > 0 or pad_w > 0:
        if cv2 is not None:
            padded_img = cv2.copyMakeBorder(
                image, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT_101
            )
        else:
            padded_img = np.pad(
                image, ((0, pad_h), (0, pad_w), (0, 0)), mode="reflect"
            )
    else:
        padded_img = image

    pad_out_h, pad_out_w = padded_img.shape[0] * scale, padded_img.shape[1] * scale
    padded_accum = np.zeros((pad_out_h, pad_out_w, c), dtype=np.float32)
    padded_weight = np.zeros((pad_out_h, pad_out_w, 1), dtype=np.float32)

    y_steps = range(0, padded_img.shape[0] - tile_size + 1, stride)
    x_steps = range(0, padded_img.shape[1] - tile_size + 1, stride)

    for y in y_steps:
        for x in x_steps:
            tile = padded_img[y : y + tile_size, x : x + tile_size]
            out_tile = upscale_tile_chunk(tile, model, device)

            out_y = y * scale
            out_x = x * scale

            padded_accum[
                out_y : out_y + tile_size * scale,
                out_x : out_x + tile_size * scale,
            ] += (out_tile.astype(np.float32) * weight_win)

            padded_weight[
                out_y : out_y + tile_size * scale,
                out_x : out_x + tile_size * scale,
            ] += weight_win

    # Normalize weights
    safe_weight = np.maximum(padded_weight[:out_h, :out_w], 1e-6)
    result = (padded_accum[:out_h, :out_w] / safe_weight).clip(0, 255).astype(np.uint8)
    return result


def load_model(
    model_path: str,
    device: Optional[Union[str, any]] = None,
):
    """Loads an ESRGAN checkpoint using Spandrel ModelLoader or standard Torch."""
    if device is None:
        if torch is not None and torch.cuda.is_available():
            device = torch.device("cuda")
        elif torch is not None and hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = torch.device("mps")
        else:
            device = torch.device("cpu") if torch is not None else "cpu"

    if ModelLoader is not None:
        loader = ModelLoader(device=device)
        model = loader.load_from_file(model_path)
        model.eval()
        return model, device
    else:
        raise RuntimeError("Spandrel is required to load upscale weights.")


def upscale_image(
    input_path: str,
    output_path: str,
    model_path: Optional[str] = None,
    target_width: Optional[int] = None,
    target_height: Optional[int] = None,
    dpi: int = 300,
    tile_size: int = 512,
    tile_overlap: int = 64,
) -> Tuple[int, int]:
    """Upscales an image file, optionally resizes to target_width/height using Lanczos,

    and saves with DPI metadata.
    Returns (final_width, final_height).
    """
    pil_img = Image.open(input_path)
    has_alpha = pil_img.mode == "RGBA"

    if has_alpha:
        rgb_img = pil_img.convert("RGB")
        alpha_channel = pil_img.split()[-1]
    else:
        rgb_img = pil_img.convert("RGB")
        alpha_channel = None

    img_np = np.array(rgb_img)

    if model_path and os.path.exists(model_path) and torch is not None and ModelLoader is not None:
        model, device = load_model(model_path)
        scale = getattr(model, "scale", 4)
        upscaled_np = upscale_tiled(
            img_np,
            model,
            device,
            tile_size=tile_size,
            tile_overlap=tile_overlap,
            scale=scale,
        )
        out_pil = Image.fromarray(upscaled_np)
    else:
        # Fallback to high quality Lanczos upscale if model not provided / loaded
        if target_width and target_height:
            out_pil = rgb_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        else:
            out_pil = rgb_img.resize((rgb_img.width * 4, rgb_img.height * 4), Image.Resampling.LANCZOS)

    # Post resize to exact target dimensions if requested and differs
    if target_width and target_height and (out_pil.width != target_width or out_pil.height != target_height):
        out_pil = out_pil.resize((target_width, target_height), Image.Resampling.LANCZOS)

    # Recombine alpha channel if needed
    if has_alpha and alpha_channel is not None:
        resized_alpha = alpha_channel.resize(out_pil.size, Image.Resampling.LANCZOS)
        out_pil.putalpha(resized_alpha)

    # Save with DPI metadata
    out_pil.save(
        output_path,
        format="PNG",
        dpi=(dpi, dpi),
        optimize=True,
    )

    return out_pil.size
