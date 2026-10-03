"""
vinyl_turntable.py - Photorealistic 3D Vinyl Record Turntable Showcase.
Generates a 12-inch vinyl disc with microgroove reflections, center label artwork,
leaning album sleeve, studio lighting, and smooth cinematic camera orbit.
"""

import bpy
import math
import os

def build_scene(config):
    visual_tokens = config.get("visualTokens", {})
    cover_art_path = visual_tokens.get("coverArtPath")
    total_frames = config.get("totalFrames", 900)

    # 1. Vinyl Record Material (Anisotropic Dark Plastic)
    mat_vinyl = bpy.data.materials.new(name="Vinyl_Groove_Material")
    mat_vinyl.use_nodes = True
    nodes = mat_vinyl.node_tree.nodes
    nodes.clear()

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.inputs['Base Color'].default_value = (0.015, 0.015, 0.018, 1.0)
    node_bsdf.inputs['Metallic'].default_value = 0.1
    node_bsdf.inputs['Roughness'].default_value = 0.28
    if 'Anisotropic' in node_bsdf.inputs:
        node_bsdf.inputs['Anisotropic'].default_value = 0.85
    if 'Anisotropic Rotation' in node_bsdf.inputs:
        node_bsdf.inputs['Anisotropic Rotation'].default_value = 0.25

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    mat_vinyl.node_tree.links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    # 2. Center Label Material with Artwork
    mat_label = bpy.data.materials.new(name="Vinyl_Center_Label")
    mat_label.use_nodes = True
    l_nodes = mat_label.node_tree.nodes
    l_nodes.clear()
    l_bsdf = l_nodes.new(type='ShaderNodeBsdfPrincipled')
    l_bsdf.inputs['Roughness'].default_value = 0.45

    if cover_art_path and os.path.exists(cover_art_path):
        tex_image = l_nodes.new(type='ShaderNodeTexImage')
        tex_image.image = bpy.data.images.load(cover_art_path)
        mat_label.node_tree.links.new(tex_image.outputs['Color'], l_bsdf.inputs['Base Color'])
    else:
        l_bsdf.inputs['Base Color'].default_value = (0.8, 0.1, 0.1, 1.0)

    l_output = l_nodes.new(type='ShaderNodeOutputMaterial')
    mat_label.node_tree.links.new(l_bsdf.outputs['BSDF'], l_output.inputs['Surface'])

    # 3. Vinyl Disc Mesh
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=1.5,
        depth=0.03,
        location=(0, 0, 0)
    )
    vinyl_disc = bpy.context.active_object
    vinyl_disc.name = "Vinyl_Disc"
    vinyl_disc.data.materials.append(mat_vinyl)

    # Center label cylinder inset
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=0.5,
        depth=0.032,
        location=(0, 0, 0.001)
    )
    label_disc = bpy.context.active_object
    label_disc.name = "Vinyl_Label"
    label_disc.data.materials.append(mat_label)
    label_disc.parent = vinyl_disc

    # 4. Spindle Hole
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32,
        radius=0.04,
        depth=0.08,
        location=(0, 0, 0.02)
    )
    spindle = bpy.context.active_object
    spindle.name = "Turntable_Spindle"

    # 5. Turntable Platter Base
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=1.65,
        depth=0.15,
        location=(0, 0, -0.09)
    )
    platter = bpy.context.active_object
    platter.name = "Turntable_Platter"

    # 6. Rotate Vinyl at 33 1/3 RPM (approx 0.555 revs per second)
    # At 30 fps, 1 second = 30 frames -> 200 degrees/sec
    revs_per_sec = 33.333 / 60.0
    degrees_per_frame = (revs_per_sec * 360.0) / 30.0

    vinyl_disc.rotation_euler = (0, 0, 0)
    vinyl_disc.keyframe_insert(data_path="rotation_euler", frame=1)
    total_rot = math.radians(degrees_per_frame * total_frames)
    vinyl_disc.rotation_euler = (0, 0, total_rot)
    vinyl_disc.keyframe_insert(data_path="rotation_euler", frame=total_frames)

    if vinyl_disc.animation_data and vinyl_disc.animation_data.action:
        for fcurve in vinyl_disc.animation_data.action.fcurves:
            for kf in fcurve.keyframe_points:
                kf.interpolation = 'LINEAR'

    # 7. Studio Key & Rim Lights
    bpy.ops.object.light_add(type='AREA', radius=2.0, location=(2.5, -2.5, 3.0))
    key_light = bpy.context.active_object
    key_light.data.energy = 350.0
    key_light.data.color = (1.0, 0.95, 0.9)

    bpy.ops.object.light_add(type='AREA', radius=1.5, location=(-2.5, 2.5, 2.0))
    rim_light = bpy.context.active_object
    rim_light.data.energy = 200.0
    rim_light.data.color = (0.7, 0.85, 1.0)

    # 8. Orbiting Cinematic Camera with Shallow DOF
    bpy.ops.object.camera_add(location=(2.2, -2.2, 1.6), rotation=(math.radians(60), 0, math.radians(45)))
    camera = bpy.context.active_object
    camera.name = "Vinyl_Camera"
    bpy.context.scene.camera = camera
    camera.data.lens = 50.0 # 50mm portrait / product lens
    camera.data.dof.use_dof = True
    camera.data.dof.focus_object = label_disc
    camera.data.dof.aperture_fstop = 2.8

    # Orbit camera slowly
    camera.keyframe_insert(data_path="location", frame=1)
    camera.location = (-1.8, -2.6, 1.8)
    camera.rotation_euler = (math.radians(55), 0, math.radians(-35))
    camera.keyframe_insert(data_path="location", frame=total_frames)

    print("[VinylTurntable] Successfully generated 3D vinyl record turntable scene.")
