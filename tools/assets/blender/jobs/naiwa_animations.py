"""给用户的奶蛙生成轻量骨骼动作：待机、走、跑、骑车、跳、互动。保留原蒙皮。"""
import bpy,sys,math
from mathutils import Quaternion
argv=sys.argv[sys.argv.index('--')+1:]
src,dst=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for o in bpy.data.objects:
 if o.type=='ARMATURE':o.animation_data_clear()
s=bpy.context.scene;s.render.fps=30;s.frame_start=1;s.frame_end=49
# 保存局部静止四元数，动作只叠加轴向小旋转
rest={b.name:b.rotation_quaternion.copy() for b in a.pose.bones}
def bone(name):
 for suffix in ['_'+name,name]:
  if suffix in a.pose.bones:return a.pose.bones[suffix]
 return None
def pose(name,t,hips,arm,leg,bob,lean=0):
 for b in a.pose.bones:b.rotation_quaternion=rest[b.name].copy()
 for side,phase in [('L',1),('R',-1)]:
  for kind,amp in [('Thigh',leg),('Calf',leg*.65),('Upperarm',arm),('Forearm',arm*.45)]:
   b=bone(side+'_'+kind)
   if b:
    b.rotation_mode='QUATERNION'
    b.rotation_quaternion=rest[b.name] @ Quaternion((1,0,0),math.sin(t+phase*hips)*amp)
 b=bone('Pelvis')
 if b:b.rotation_quaternion=rest[b.name] @ Quaternion((0,0,1),lean)
 b=bone('Spine02')
 if b:b.rotation_quaternion=rest[b.name] @ Quaternion((1,0,0),bob*.04)
def make(name,kind,frames):
 a.animation_data_create();a.animation_data.action=bpy.data.actions.new(name)
 for f in range(1,frames+1,3):
  t=(f-1)/(frames-1)*math.pi*2
  if kind=='idle':pose(name,t,0,.025,0,math.sin(t)*.5)
  elif kind=='walk':pose(name,t,0,.30,.38,math.sin(t*2)*.5)
  elif kind=='run':pose(name,t,0,.52,.65,math.sin(t*2)*.65,.12)
  elif kind=='bike':
   for side in ['L','R']:
    for kind,amp in [('Upperarm',-.65),('Forearm',-.42),('Thigh',-.65),('Calf',.75)]:
     b=bone(side+'_'+kind)
     if b:b.rotation_mode='QUATERNION';b.rotation_quaternion=rest[b.name] @ Quaternion((1,0,0),amp)
  elif kind=='jump':pose(name,t,0,-.4,-.7,0,-.2)
  elif kind=='wave':
   pose(name,t,0,.04,0,0)
   b=bone('R_Upperarm')
   if b:b.rotation_quaternion=rest[b.name] @ Quaternion((0,0,1),-.8+math.sin(t)*.15)
  for b in a.pose.bones:b.keyframe_insert(data_path='rotation_quaternion',frame=f,group=b.name)
# 独立动作，便于Three.js状态机切换
for name,kind,n in [('Idle_Loop','idle',49),('Walk_Loop','walk',37),('Jog_Fwd_Loop','run',31),('Driving_Loop','bike',3),('Jump_Loop','jump',25),('Idle_Rail_Call','wave',37)]:
 make(name,kind,n)
s.frame_set(1)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90,
 export_skins=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_yup=True,export_apply=False)
print('exported',dst,flush=True)
