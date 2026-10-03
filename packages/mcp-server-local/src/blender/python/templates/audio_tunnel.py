"""
audio_tunnel.py - Procedural Audio-Reactive Sci-Fi / Cyberpunk Tunnel.
Builds a segmented geometric tunnel with emissive neon rings, volumetric fog,
and camera moving forward at speed mapped to track BPM.
"""

import bpy
import math

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        return (r, g, b, 1.0)
    return (0.0, 0.9, 1.0, 1.0)

def build_scene(config):
    visual_tokens = config.get("visualTokens", {})
    primary_color = hex_to_rgb(visual_tokens.get("primaryColor", "#00F0FF"))
    secondary_color = hex_to_rgb(visual_tokens.get("secondaryColor", "#FF0055"))
    bloom = visual_tokens.get("bloomIntensity", 2.0)
    bpm = config.get("bpm", 120.0)
    total_frames = config.get("totalFrames", 900)

    # 1. Neon Emissive Material
    mat_neon = bpy.data.materials.new(name="Tunnel_Neon_Primary")
    mat_neon.use_nodes = True
    nodes = mat_neon.node_tree.nodes
    nodes.clear()
    node_emit = nodes.new(type='ShaderNodeEmission')
    node_emit.inputs['Color'].default_value = primary_color
    node_emit.inputs['Strength'].default_value = 5.0 * bloom
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    mat_neon.node_tree.links.new(node_emit.outputs['Emission'], node_output.inputs['Surface'])

    # 2. Dark Metallic Wall Material
    mat_wall = bpy.data.materials.new(name="Tunnel_Wall_Dark")
    mat_wall.use_nodes = True
    w_nodes = mat_wall.node_tree.nodes
    w_nodes.clear()
    node_bsdf = w_nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.inputs['Base Color'].default_value = (0.02, 0.02, 0.04, 1.0)
    node_bsdf.inputs['Metallic'].default_value = 0.9
    node_bsdf.inputs['Roughness'].default_value = 0.2
    w_output = w_nodes.new(type='ShaderNodeOutputMaterial')
    mat_wall.node_tree.links.new(node_bsdf.outputs['BSDF'], w_output.inputs['Surface'])

    # 3. Create Tunnel Rings
    num_rings = 40
    ring_spacing = 4.0
    tunnel_collection = bpy.data.collections.new("Tunnel_Geometry")
    bpy.context.scene.collection.children.link(tunnel_collection)

    for i in range(num_rings):
        z_pos = -float(i) * ring_spacing
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=8,
            radius=5.0,
            depth=0.5,
            end_fill_type='NOTHING',
            location=(0, 0, z_pos),
            rotation=(math.radians(90), 0, 0)
        )
        ring = bpy.context.active_object
        ring.name = f"Tunnel_Ring_{i}"
        tunnel_collection.objects.link(ring)
        bpy.context.scene.collection.objects.unlink(ring)

        # Alternate materials
        if i % 3 == 0:
            ring.data.materials.append(mat_neon)
        else:
            ring.data.materials.append(mat_wall)

        # Keyframe subtle rotation
        ring.rotation_euler = (math.radians(90), 0, math.radians(i * 15))

    # 4. Animated Camera Flying Through Tunnel
    bpy.ops.object.camera_add(location=(0, 0, 5), rotation=(math.radians(90), 0, 0))
    camera = bpy.context.active_object
    camera.name = "Tunnel_Camera"
    bpy.context.scene.camera = camera
    camera.data.lens = 24.0 # Wide angle

    # Flight animation speed locked to BPM
    flight_distance = (bpm / 60.0) * (total_frames / 30.0) * 12.0
    camera.location = (0, 0, 2)
    camera.keyframe_insert(data_path="location", frame=1)

    camera.location = (0, 0, -flight_distance)
    camera.keyframe_insert(data_path="location", frame=total_frames)

    # Linear extrapolation for constant forward motion
    if camera.animation_data and camera.animation_data.action:
        for fcurve in camera.animation_data.action.fcurves:
            for kf in fcurve.keyframe_points:
                kf.interpolation = 'LINEAR'

    print("[AudioTunnel] Successfully generated procedural cyber tunnel.")
