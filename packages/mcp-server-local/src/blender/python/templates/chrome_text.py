"""
chrome_text.py - 3D Liquid Chrome & Metallic Typography.
Extrudes artist name and song title with liquid chrome materials,
zero-g floating animation, and studio reflections.
"""

import bpy
import math

def build_scene(config):
    visual_tokens = config.get("visualTokens", {})
    artist_name = visual_tokens.get("artistName", "INDII ARTIST").upper()
    track_title = visual_tokens.get("trackTitle", "NEW SINGLE").upper()
    total_frames = config.get("totalFrames", 450)

    # 1. Liquid Chrome Material
    mat_chrome = bpy.data.materials.new(name="Liquid_Chrome_Shader")
    mat_chrome.use_nodes = True
    nodes = mat_chrome.node_tree.nodes
    nodes.clear()

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.inputs['Base Color'].default_value = (0.95, 0.95, 0.98, 1.0)
    node_bsdf.inputs['Metallic'].default_value = 1.0
    node_bsdf.inputs['Roughness'].default_value = 0.05
    if 'IOR' in node_bsdf.inputs:
        node_bsdf.inputs['IOR'].default_value = 2.5

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    mat_chrome.node_tree.links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    # 2. Text Mesh - Artist Name
    bpy.ops.object.text_add(location=(0, 0, 0.8), rotation=(math.radians(90), 0, 0))
    text_artist = bpy.context.active_object
    text_artist.name = "Text_Artist"
    text_artist.data.body = artist_name
    text_artist.data.size = 1.1
    text_artist.data.extrude = 0.18
    text_artist.data.bevel_depth = 0.04
    text_artist.data.bevel_resolution = 4
    text_artist.data.align_x = 'CENTER'
    text_artist.data.align_y = 'CENTER'
    text_artist.data.materials.append(mat_chrome)

    # 3. Text Mesh - Track Title
    bpy.ops.object.text_add(location=(0, 0, -0.6), rotation=(math.radians(90), 0, 0))
    text_track = bpy.context.active_object
    text_track.name = "Text_Track"
    text_track.data.body = track_title
    text_track.data.size = 0.75
    text_track.data.extrude = 0.12
    text_track.data.bevel_depth = 0.03
    text_track.data.bevel_resolution = 4
    text_track.data.align_x = 'CENTER'
    text_track.data.align_y = 'CENTER'
    text_track.data.materials.append(mat_chrome)

    # Parent track title to artist
    text_track.parent = text_artist

    # 4. Floating / Tilting Animation
    text_artist.rotation_euler = (math.radians(85), math.radians(-10), math.radians(-5))
    text_artist.keyframe_insert(data_path="rotation_euler", frame=1)

    mid_frame = total_frames // 2
    text_artist.rotation_euler = (math.radians(95), math.radians(10), math.radians(5))
    text_artist.keyframe_insert(data_path="rotation_euler", frame=mid_frame)

    text_artist.rotation_euler = (math.radians(85), math.radians(-10), math.radians(-5))
    text_artist.keyframe_insert(data_path="rotation_euler", frame=total_frames)

    # 5. Colorful Studio Reflection Lights (creates the iconic chrome gradient)
    colors = [
        ((0.0, 0.8, 1.0), (3.0, -3.0, 3.0), 300.0),
        ((1.0, 0.0, 0.6), (-3.0, -2.5, -2.0), 280.0),
        ((1.0, 0.9, 0.4), (0.0, 3.5, 2.0), 250.0),
    ]

    for idx, (color, loc, energy) in enumerate(colors):
        bpy.ops.object.light_add(type='POINT', radius=1.0, location=loc)
        light = bpy.context.active_object
        light.name = f"Chrome_Light_{idx}"
        light.data.color = color
        light.data.energy = energy

    # 6. Camera (Vertical 9:16 optimized)
    bpy.ops.object.camera_add(location=(0, -6.5, 0), rotation=(math.radians(90), 0, 0))
    camera = bpy.context.active_object
    camera.name = "Chrome_Camera"
    bpy.context.scene.camera = camera
    camera.data.lens = 45.0

    print("[ChromeText] Successfully generated 3D chrome typography scene.")
