"""
concert_stage.py - Virtual Concert Stage & Moving-Head Spotlights.
Builds a concert arena stage with truss rigs, robotic moving-head spotlights,
volumetric fog beams, and LED backdrop.
"""

import bpy
import math
import os

def build_scene(config):
    visual_tokens = config.get("visualTokens", {})
    cover_art_path = visual_tokens.get("coverArtPath")
    total_frames = config.get("totalFrames", 900)

    # 1. Stage Floor Platform
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.2))
    stage = bpy.context.active_object
    stage.name = "Concert_Stage_Floor"
    stage.scale = (16.0, 10.0, 0.4)

    mat_floor = bpy.data.materials.new(name="Stage_Floor_Material")
    mat_floor.use_nodes = True
    f_nodes = mat_floor.node_tree.nodes
    f_nodes.clear()
    f_bsdf = f_nodes.new(type='ShaderNodeBsdfPrincipled')
    f_bsdf.inputs['Base Color'].default_value = (0.02, 0.02, 0.03, 1.0)
    f_bsdf.inputs['Roughness'].default_value = 0.15
    f_bsdf.inputs['Metallic'].default_value = 0.8
    f_out = f_nodes.new(type='ShaderNodeOutputMaterial')
    mat_floor.node_tree.links.new(f_bsdf.outputs['BSDF'], f_out.inputs['Surface'])
    stage.data.materials.append(mat_floor)

    # 2. Giant LED Backdrop Wall
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 4.8, 4.0), rotation=(math.radians(90), 0, 0))
    led_wall = bpy.context.active_object
    led_wall.name = "LED_Backdrop_Wall"
    led_wall.scale = (14.0, 6.5, 1.0)

    mat_led = bpy.data.materials.new(name="LED_Screen_Material")
    mat_led.use_nodes = True
    l_nodes = mat_led.node_tree.nodes
    l_nodes.clear()

    l_emit = l_nodes.new(type='ShaderNodeEmission')
    l_emit.inputs['Strength'].default_value = 4.0

    if cover_art_path and os.path.exists(cover_art_path):
        tex = l_nodes.new(type='ShaderNodeTexImage')
        tex.image = bpy.data.images.load(cover_art_path)
        mat_led.node_tree.links.new(tex.outputs['Color'], l_emit.inputs['Color'])
    else:
        l_emit.inputs['Color'].default_value = (0.9, 0.05, 0.4, 1.0)

    l_out = l_nodes.new(type='ShaderNodeOutputMaterial')
    mat_led.node_tree.links.new(l_emit.outputs['Emission'], l_out.inputs['Surface'])
    led_wall.data.materials.append(mat_led)

    # 3. Overhead Moving-Head Spotlights (Spot lights with sharp cones)
    spot_positions = [-5.0, -2.5, 0.0, 2.5, 5.0]
    spot_colors = [
        (0.0, 0.8, 1.0),
        (1.0, 0.0, 0.5),
        (0.2, 1.0, 0.4),
        (1.0, 0.8, 0.0),
        (0.8, 0.0, 1.0)
    ]

    for idx, (x_pos, color) in enumerate(zip(spot_positions, spot_colors)):
        bpy.ops.object.light_add(type='SPOT', location=(x_pos, 2.0, 7.5))
        spot = bpy.context.active_object
        spot.name = f"Moving_Head_Spot_{idx}"
        spot.data.color = color
        spot.data.energy = 2500.0
        spot.data.spot_size = math.radians(28.0)
        spot.data.spot_blend = 0.25

        # Pan / sweep animation across frames
        for f in range(1, total_frames + 1, 45):
            pan_angle = math.sin((f / 30.0) + (idx * 0.8)) * 0.45
            tilt_angle = math.radians(-15.0) + math.cos((f / 25.0) + (idx * 0.5)) * 0.2
            spot.rotation_euler = (tilt_angle, pan_angle, 0)
            spot.keyframe_insert(data_path="rotation_euler", frame=f)

    # 4. Crowd Audience Camera
    bpy.ops.object.camera_add(location=(0, -8.0, 2.2), rotation=(math.radians(78), 0, 0))
    camera = bpy.context.active_object
    camera.name = "Concert_Camera"
    bpy.context.scene.camera = camera
    camera.data.lens = 28.0

    print("[ConcertStage] Successfully generated virtual concert stage scene.")
