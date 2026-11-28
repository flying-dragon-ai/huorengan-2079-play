"""按奶蛙真实骨架坐标，将抱腹双臂移到两侧A-Pose；保留蒙皮。"""
import bpy,sys
from mathutils import Matrix,Vector
argv=sys.argv[sys.argv.index('--')+1:]
src,dst=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=a
bpy.ops.object.mode_set(mode='POSE')
# 先清除屈肘，手臂沿各骨骼静止指向伸直
for side in ['L','R']:
 for suffix in ['Upperarm','Forearm','Hand']:
  b=a.pose.bones[side+'_'+suffix] if side+'_'+suffix in a.pose.bones else a.pose.bones.get(side+suffix)
  if b:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0)
a.update_tag();bpy.context.view_layer.update()
# 在骨架空间绕Z旋转整条上臂链。左臂-Y，右臂+Y，向两侧展开并略向下。
for side,sgn in [('L',1),('R',-1)]:
 b=a.pose.bones[side+'_Upperarm'] if side+'_Upperarm' in a.pose.bones else a.pose.bones.get(side+'Upperarm')
 b.rotation_mode='QUATERNION'
 # 原上臂约指向身体前方且朝下；旋转到±Y并向下10°
 desired=Vector((0,sgn*.97,-.24)).normalized()
 q=b.vector.normalized().rotation_difference(desired)
 b.rotation_quaternion=q @ b.rotation_quaternion
 a.update_tag();bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='POSE')
# 把调整后的双臂固化为骨架静止姿态，API才会按新姿态识别
bpy.context.view_layer.objects.active=a
a.select_set(True)
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90,export_skins=True,export_animations=False,export_yup=True,export_apply=False)
print('saved',dst,flush=True)
