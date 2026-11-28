"""从用户奶蛙的真实骨架/蒙皮烘焙形变动画，供网页轻量播放。"""
import bpy,sys,math
from mathutils import Quaternion
argv=sys.argv[sys.argv.index('--')+1:]
src,dst=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.data.objects if o.type=='MESH']
s=bpy.context.scene;s.render.fps=30
rest={b.name:b.rotation_quaternion.copy() for b in a.pose.bones}
def bone(name):
 for suffix in ['_'+name,name]:
  if suffix in a.pose.bones:return a.pose.bones[suffix]
 return None
def pose(t,kind):
 for b in a.pose.bones:b.rotation_quaternion=rest[b.name].copy()
 for side,phase in [('L',1),('R',-1)]:
  for part,amp in [('Thigh',.42),('Calf',.25),('Upperarm',.32),('Forearm',.18)]:
   b=bone(side+'_'+part)
   if not b:continue
   if kind=='idle':ang=math.sin(t)*.018 if part=='Upperarm' else 0
   elif kind=='walk':ang=math.sin(t+phase*math.pi/2)*amp
   elif kind=='run':ang=math.sin(t+phase*math.pi/2)*amp*1.5
   elif kind=='jump':ang=-.45 if part in ['Thigh','Upperarm'] else .55
   elif kind=='bike':ang=-.6 if part in ['Thigh','Upperarm'] else .6
   else:ang=0
   b.rotation_quaternion=rest[b.name] @ Quaternion((1,0,0),ang)
 b=bone('Spine02')
 if b:b.rotation_quaternion=rest[b.name] @ Quaternion((1,0,0),math.sin(t*2)*.025)
for kind in [sys.argv[sys.argv.index('--')+3] if len(argv)>2 else 'bike']:
 s.frame_start=1;s.frame_end=49;s.frame_set(1)
 a.animation_data_create();a.animation_data.action=bpy.data.actions.new(kind)
 for f in range(1,50,2):
  t=(f-1)/48*math.pi*2
  pose(t,kind)
  for b in a.pose.bones:b.keyframe_insert(data_path='rotation_quaternion',frame=f,group=b.name)
 for obj in meshes:
  obj.shape_key_clear()
  obj.shape_key_add(name='Basis',from_mix=False)
  for frame in [1,13,25,37,49]:
   s.frame_set(frame);bpy.context.view_layer.update()
   deps=bpy.context.evaluated_depsgraph_get()
   # 为当前帧保存独立静态网格，烘焙真实蒙皮结果
   evaluated=obj.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
   key=obj.shape_key_add(name=f'{kind}_{frame:02d}',from_mix=False)
   key.data.foreach_set('co',[v for vert in mesh.vertices for v in vert.co])
   bpy.data.meshes.remove(mesh)
  # 保留Basis与各动作的完整形变，供GLTF直接输出morph targets
  # 只让Basis参与初始显示，各姿态由GLTF动画权重单独驱动，禁止导出前叠加全部形变
  for key in obj.data.shape_keys.key_blocks:
   key.value=0.0
  obj.data.shape_keys.key_blocks[0].value=0.0
  obj.data.shape_keys.name=kind+'_morphs'
print('baked morph source done',flush=True)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90,export_skins=False,export_animations=False,export_yup=True,export_apply=False,export_morph=True)
