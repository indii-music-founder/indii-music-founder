"""
spectrum_bars.py - 3D Circular Audio Spectrum Waveform Visualizer.
Builds an array of 3D equalizer bars positioned radially around a central core.
"""

import bpy
import math

def build_scene(config):
    total_frames = config.get("totalFrames", 900)
    num_bars = 48
    radius = 3.0

    # 1. Bar Material (Gradient Emissive)
    mat_bar = bpy.data.materials.new(name="Spectrum_Bar_Material")
    mat_bar.use_nodes = True
    nodes = mat_bar.node_tree.nodes
    nodes.clear()

    node_emit = nodes.new(type='ShaderNodeEmission')
    node_emit.inputs['Color'].default_value = (0.2, 0.7, 1.0, 1.0)
    node_emit.inputs['Strength'].default_value = 3.5

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    mat_bar.node_tree.links.new(node_emit.outputs['Emission'], node_output.inputs['Surface'])

    # 2. Generate Radial Bars
    bars_group = bpy.data.collections.new("Spectrum_Bars")
    bpy.context.scene.collection.children.link(bars_group)

    for i in range(num_bars):
        angle = (2.0 * math.pi / num_bars) * i
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)

        bpy.ops.mesh.primitive_cube_add(
            size=1.0,
            location=(x, y, 0),
            rotation=(0, 0, angle)
        )
        bar = bpy.context.active_object
        bar.name = f"EQ_Bar_{i}"
        bar.scale = (0.12, 0.25, 0.8)
        bar.data.materials.append(mat_bar)
        bars_group.objects.link(bar)
        bpy.context.scene.collection.objects.unlink(bar)

        # Procedural wave animation across bars
        for f in range(1, total_frames + 1, 30):
            phase = (f / 15.0) + (i * 0.3)
            h = 0.5 + 1.8 * (0.5 + 0.5 * math.sin(phase))
            bar.scale = (0.12, 0.25, h)
            bar.location = (x, y, h * 0.5)
            bar.keyframe_insert(data_path="scale", frame=f)
            bar.keyframe_insert(data_path="location", frame=f)

    # 3. Center Glowing Orb
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.2, location=(0, 0, 0))
    core_orb = bpy.context.active_object
    core_orb.name = "Spectrum_Core_Orb"
    mat_core = bpy.data.materials.new(name="Spectrum_Core_Material")
    mat_core.use_nodes = True
    c_nodes = mat_core.node_tree.nodes
    c_nodes.clear()
    c_emit = c_nodes.new(type='ShaderNodeEmission')
    c_emit.inputs['Color'].default_value = (1.0, 0.2, 0.5, 1.0)
    c_emit.inputs['Strength'].default_value = 4.0
    c_out = c_nodes.new(type='ShaderNodeOutputMaterial')
    mat_core.node_tree.links.new(c_emit.outputs['Emission'], c_out.inputs['Surface'])
    core_orb.data.materials.append(mat_core)

    # 4. Top-Down Angled Camera
    bpy.ops.object.camera_add(location=(0, -7.5, 5.5), rotation=(math.radians(55), 0, 0))
    camera = bpy.context.active_object
    camera.name = "Spectrum_Camera"
    bpy.context.scene.camera = camera
    camera.data.lens = 32.0

    print("[SpectrumBars] Successfully generated 3D circular audio spectrum scene.")
