"""奶蛙主角网页化：保留骨架与蒙皮，减面、缩贴图、导出GLB。用法见tools/naiwa_pipeline.mjs"""
import bpy, sys, os, time
argv=sys.argv[sys.argv.index('--')+1:]
src,dst=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
mesh=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in mesh:
    d=o.modifiers.new('网页减面','DECIMATE');d.ratio=0.075;d.use_collapse_triangulate=True
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=d.name)
for im in bpy.data.images:
    if max(im.size)>1024:
        k=1024/max(im.size);im.scale(int(im.size[0]*k),int(im.size[1]*k))
# 原模型本来就有骨架：禁止按静态道具脚本剥离
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90,
    export_skins=True,export_animations=False,export_yup=True,export_apply=False)
print('bones',sum(1 for o in bpy.data.objects if o.type=='ARMATURE'),'meshes',len(mesh),'size',os.path.getsize(dst),flush=True)
