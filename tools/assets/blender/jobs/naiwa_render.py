import bpy,sys,math
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]
src,out=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.samples=16
s.world=bpy.data.worlds.new('World');s.world.color=(.06,.06,.06)
cam_data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',cam_data);s.collection.objects.link(cam)
cam.location=(2.0,-3.4,1.9);target=Vector((.13,0,.52));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=1.65;s.camera=cam
for name,loc,power,size in [('Key',(1,-2,3),350,3),('Fill',(-2,1,2),180,2)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
s.render.resolution_x=700;s.render.resolution_y=700;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.filepath=out
bpy.ops.render.render(write_still=True)
