"""Blender 后台减面：把几十万到几百万面的 GLB 减到游戏能用的大小。

用法（Blender 5.x）:
  Blender -b --factory-startup -P tools/assets/blender/jobs/decimate_glb.py -- <输入.glb> <输出.glb> [目标三角面数=16000] [贴图边长=1024]

做的事：导入 → 删掉骨架（游戏里整体摆动，不用骨骼）→ 每个网格按比例减面 → 贴图缩到 1024 → 导出 JPEG 贴图的 GLB。
"""
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
target = int(argv[2]) if len(argv) > 2 else 16000
tex = int(argv[3]) if len(argv) > 3 else 1024
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
print(f"[decimate] imported {src} in {time.time() - t0:.1f}s", flush=True)

# 骨架：先让网格脱离骨架（保持当前形状），再删掉骨架和骨架修改器
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes:
    for m in list(o.modifiers):
        if m.type == "ARMATURE":
            o.modifiers.remove(m)
    if o.parent and o.parent.type == "ARMATURE":
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    o.vertex_groups.clear()
for o in [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]:
    bpy.data.objects.remove(o, do_unlink=True)


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


total = sum(tri_count(o) for o in meshes)
ratio = min(1.0, target / max(total, 1))
print(f"[decimate] {len(meshes)} meshes, {total} tris -> ratio {ratio:.5f}", flush=True)
for o in meshes:
    if ratio >= 0.999:
        break
    bpy.context.view_layer.objects.active = o
    d = o.modifiers.new("dec", "DECIMATE")
    d.decimate_type = "COLLAPSE"
    d.ratio = ratio
    d.use_collapse_triangulate = True
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=d.name)
after = sum(tri_count(o) for o in meshes)
print(f"[decimate] now {after} tris ({time.time() - t0:.1f}s)", flush=True)

for img in bpy.data.images:
    w, h = img.size
    if max(w, h) > tex:
        k = tex / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))

bpy.ops.export_scene.gltf(
    filepath=dst, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85,
    export_skins=False, export_animations=False, export_apply=True, export_yup=True,
)
print(f"[decimate] wrote {dst} in {time.time() - t0:.1f}s", flush=True)
