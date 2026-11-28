import bpy,sys
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1])
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for n in ['L_Upperarm','L_Forearm','L_Hand','R_Upperarm','R_Forearm','R_Hand','Pelvis','Head']:
 b=a.pose.bones[n]
 print(n,'head',tuple(round(x,5) for x in b.head),'tail',tuple(round(x,5) for x in b.tail),'axis',tuple(round(x,5) for x in b.vector),flush=True)
print('bounds',[(o.name,tuple(round(x,3) for x in o.dimensions)) for o in bpy.data.objects if o.type=='MESH'],flush=True)
