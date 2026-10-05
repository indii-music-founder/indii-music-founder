"""
runner.py - Headless execution runner for Blender CLI.
Invoked via: blender -b --factory-startup -P runner.py -- --config <config_json_path>
"""

import bpy
import sys
import os
import json

def clear_default_scene():
    """Removes all default objects, meshes, and lights."""
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup_render_engine(engine_name="BLENDER_EEVEE_NEXT", samples=64):
    """Configures the render engine and GPU acceleration if available."""
    scene = bpy.context.scene

    if engine_name == "CYCLES":
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = samples
        prefs = bpy.context.preferences
        cprefs = prefs.addons.get('cycles')
        if cprefs:
            cprefs_prefs = cprefs.preferences
            # Try Metal (Apple Silicon) -> CUDA -> OptiX -> CPU
            for device_type in ['METAL', 'OPTIX', 'CUDA', 'HIP']:
                try:
                    cprefs_prefs.compute_device_type = device_type
                    cprefs_prefs.get_devices()
                    for device in cprefs_prefs.devices:
                        device.use = True
                    scene.cycles.device = 'GPU'
                    print(f"[BlenderRunner] Cycles configured with {device_type} GPU acceleration.")
                    break
                except Exception:
                    continue
    else:
        # Default modern Eevee (BLENDER_EEVEE_NEXT in Blender 4.2+)
        try:
            scene.render.engine = 'BLENDER_EEVEE_NEXT'
        except Exception:
            scene.render.engine = 'BLENDER_EEVEE'
        print("[BlenderRunner] Render engine set to Eevee Next.")

def setup_resolution_and_framerate(aspect_ratio="16:9", resolution="1080p", fps=30, duration_seconds=30):
    scene = bpy.context.scene
    scene.render.fps = fps
    total_frames = int(fps * duration_seconds)
    scene.frame_start = 1
    scene.frame_end = total_frames

    # Determine base dimensions
    dim_map = {
        "720p": (1280, 720),
        "1080p": (1920, 1080),
        "4k": (3840, 2160)
    }
    w, h = dim_map.get(resolution, (1920, 1080))

    if aspect_ratio == "9:16":
        # Invert for vertical
        scene.render.resolution_x = h
        scene.render.resolution_y = w
    elif aspect_ratio == "1:1":
        # Square
        sq = min(w, h)
        scene.render.resolution_x = sq
        scene.render.resolution_y = sq
    else:
        # 16:9
        scene.render.resolution_x = w
        scene.render.resolution_y = h

    scene.render.resolution_percentage = 100
    return total_frames

def setup_audio_in_vse(audio_filepath):
    """Loads the audio file into the VSE so the output video has audio included."""
    if not audio_filepath or not os.path.exists(audio_filepath):
        raise RuntimeError("The selected music file is no longer available.")

    scene = bpy.context.scene
    if not scene.sequence_editor:
        scene.sequence_editor_create()

    # Support Blender 5.x ('strips') and Blender 4.x ('sequences')
    strips_coll = getattr(scene.sequence_editor, 'strips', None)
    if strips_coll is None:
        strips_coll = getattr(scene.sequence_editor, 'sequences', None)
    if strips_coll is None or not hasattr(strips_coll, 'new_sound'):
        raise RuntimeError("This Blender version cannot add the music track.")
    if strips_coll is not None and hasattr(strips_coll, 'new_sound'):
        sound_strip = strips_coll.new_sound(
            name="Master_Audio_Track",
            filepath=audio_filepath,
            channel=1,
            frame_start=1
        )
        print(f"[BlenderRunner] Added master audio track to VSE: {sound_strip.name}")

def setup_output_format(output_filepath):
    """Sets output format to FFmpeg H.264 MP4 with AAC 320kbps audio."""
    scene = bpy.context.scene
    scene.render.filepath = output_filepath

    # Support Blender 5.x media_type
    if hasattr(scene.render.image_settings, 'media_type'):
        try:
            scene.render.image_settings.media_type = 'VIDEO'
        except Exception:
            pass

    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'

    # Audio encoding
    scene.render.ffmpeg.audio_codec = 'AAC'
    scene.render.ffmpeg.audio_bitrate = 320
    scene.render.ffmpeg.audio_volume = 1.0

def main():
    # Parse CLI arguments after '--'
    argv = sys.argv
    if "--" not in argv:
        print("[BlenderRunner] Error: No '--' separator found in command arguments.")
        sys.exit(1)

    args = argv[argv.index("--") + 1:]
    config_path = None
    for i in range(len(args)):
        if args[i] == "--config" and i + 1 < len(args):
            config_path = args[i + 1]
            break

    if not config_path or not os.path.exists(config_path):
        print(f"[BlenderRunner] Error: Config file not found: {config_path}")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    print(f"[BlenderRunner] Loaded configuration for template: {config.get('templateId')}")

    # 1. Clear scene
    clear_default_scene()

    # 2. Engine & Device
    engine = config.get("engine", "BLENDER_EEVEE_NEXT")
    samples = config.get("samples", 64)
    setup_render_engine(engine, samples)

    # 3. Resolution, FPS, Duration
    aspect_ratio = config.get("aspectRatio", "16:9")
    resolution = config.get("resolution", "1080p")
    fps = config.get("fps", 30)
    duration_seconds = config.get("durationSeconds", 30)
    total_frames = setup_resolution_and_framerate(aspect_ratio, resolution, fps, duration_seconds)
    config["totalFrames"] = total_frames

    # 4. Audio loading
    audio_path = config.get("audioFilePath", "")
    setup_audio_in_vse(audio_path)

    # 5. Output file setup
    output_path = config.get("outputVideoPath", "/tmp/blender_render.mp4")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    setup_output_format(output_path)

    # 6. Execute Template or Custom Script
    template_id = config.get("templateId", "audio_reactive_tunnel")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, current_dir)

    custom_script = config.get("customScriptPath")
    if custom_script and os.path.exists(custom_script):
        print(f"[BlenderRunner] Executing custom script: {custom_script}")
        with open(custom_script, "r", encoding="utf-8") as sf:
            exec(sf.read(), {"__file__": custom_script, "config": config})
    else:
        # Load procedural template
        if template_id == "vinyl_turntable":
            from templates import vinyl_turntable
            vinyl_turntable.build_scene(config)
        elif template_id == "chrome_text":
            from templates import chrome_text
            chrome_text.build_scene(config)
        elif template_id == "spectrum_bars":
            from templates import spectrum_bars
            spectrum_bars.build_scene(config)
        elif template_id == "concert_stage":
            from templates import concert_stage
            concert_stage.build_scene(config)
        else:
            # Default audio_reactive_tunnel
            from templates import audio_tunnel
            audio_tunnel.build_scene(config)

    # 7. Render Animation
    print(f"[BlenderRunner] Starting animation render (1 to {total_frames} frames)...")
    bpy.ops.render.render(animation=True)
    print(f"[BlenderRunner] Render complete. Artifact saved to: {output_path}")

if __name__ == "__main__":
    main()
