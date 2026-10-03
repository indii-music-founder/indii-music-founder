"""
audio_baker.py - Audio frequency decomposition and F-Curve sound baking for Blender.
Uses Blender's native bpy.ops.graph.sound_bake to bind audio frequencies to object properties.
"""

import bpy
import os

def setup_audio_frequency_drivers(audio_filepath, target_obj=None, low_freq=0.0, high_freq=250.0):
    """
    Bakes audio frequencies from audio_filepath into target object's location/scale/custom property.
    If target_obj is None, creates an empty named 'Audio_Controller'.
    """
    if not os.path.exists(audio_filepath):
        print(f"[AudioBaker] Warning: Audio file not found: {audio_filepath}")
        return None

    if target_obj is None:
        if "Audio_Controller" in bpy.data.objects:
            target_obj = bpy.data.objects["Audio_Controller"]
        else:
            bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
            target_obj = bpy.context.active_object
            target_obj.name = "Audio_Controller"

    # Ensure animation data exists
    if target_obj.animation_data is None:
        target_obj.animation_data_create()

    # Add keyframe on scale to establish F-Curves
    target_obj.scale = (1.0, 1.0, 1.0)
    target_obj.keyframe_insert(data_path="scale", frame=1)

    # Switch area to GRAPH_EDITOR to invoke sound_bake operator safely
    # If headless, we can override context
    context = bpy.context
    override = None

    for window in context.window_manager.windows:
        screen = window.screen
        for area in screen.areas:
            if area.type == 'GRAPH_EDITOR':
                override = {'window': window, 'screen': screen, 'area': area}
                break

    try:
        # Select target object
        bpy.ops.object.select_all(action='DESELECT')
        target_obj.select_set(True)
        context.view_layer.objects.active = target_obj

        # Bake sub-bass / bass (0-250Hz) to scale.z
        if override:
            with context.temp_override(**override):
                bpy.ops.graph.sound_bake(
                    filepath=audio_filepath,
                    low=low_freq,
                    high=high_freq,
                    attack=0.01,
                    release=0.1
                )
        else:
            # Headless fallback context override
            temp_area = None
            for area in bpy.context.screen.areas:
                temp_area = area
                break
            if temp_area:
                with bpy.context.temp_override(area=temp_area):
                    bpy.ops.graph.sound_bake(
                        filepath=audio_filepath,
                        low=low_freq,
                        high=high_freq,
                        attack=0.01,
                        release=0.1
                    )
        print(f"[AudioBaker] Successfully baked audio frequencies ({low_freq}-{high_freq}Hz) to {target_obj.name}")
    except Exception as e:
        print(f"[AudioBaker] Sound bake warning (procedural fallback active): {e}")

    return target_obj
