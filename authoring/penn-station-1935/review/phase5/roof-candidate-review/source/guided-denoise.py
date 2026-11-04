"""Denoise a diffuse lighting atlas without changing geometry or AO.

uv run --python 3.11 --with bpy==4.3.0 --with 'numpy<2' --with pillow==13.0.0
    python denoise_lighting.py INPUT --input-transfer srgb --out SCRATCH
    --zone waiting-room --radiance-scale 1

The historical retained HDRs used image.save(), which applied display transfer.
Use srgb for those inputs; corrected future linear HDR/EXR inputs use linear.
Reports use schemaVersion1: source hash/transfer/scales; original and filtered
linear statistics; relative mean change;0.18 transfer check; retained HDR
quantization; full/mobile PNG+WebP names and clipped RGB-sample counts.
"""
from pathlib import Path
import argparse,hashlib,json,math,time
import bpy,numpy as np
from PIL import Image

p=argparse.ArgumentParser()
p.add_argument('input',type=Path)
p.add_argument('--input-transfer',choices=['linear','srgb'],default='linear')
p.add_argument('--input-scale',type=float,default=1,help='Multiply decoded input by this normalization scale')
p.add_argument('--out',type=Path,required=True)
p.add_argument('--zone',required=True)
p.add_argument('--radiance-scale',type=float,default=1,help='Existing runtime normalization; HDR remains unnormalized. PNG overshoots are reported.')
p.add_argument('--threads',type=int,default=4)
p.add_argument('--normal-guide',type=Path,required=True)
p.add_argument('--full-size',type=int,help='Optional delivered atlas dimension; resize linear radiance, retain source-resolution HDR')
a=p.parse_args();started=time.monotonic()
if not a.zone or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in a.zone):raise ValueError('Invalid zone name')
if a.out.resolve()==a.input.parent.resolve():raise ValueError('Use a separate output directory to preserve source originals')
if min(a.input_scale,a.radiance_scale)<=0:raise ValueError('Radiance scales must be positive')
a.out.mkdir(parents=True,exist_ok=True)
def stats(x):return {'mean':float(x.mean()),'minimum':float(x.min()),'maximum':float(x.max())}
def srgb_decode(x):return np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)
def srgb_encode(x):return np.where(x<=.0031308,12.92*x,1.055*np.maximum(x,0)**(1/2.4)-.055)
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=1;s.render.threads_mode='FIXED';s.render.threads=max(1,a.threads)
c=bpy.data.objects.new('Image-only compositor camera',bpy.data.cameras.new('Image-only compositor camera'));s.collection.objects.link(c);s.camera=c
s.use_nodes=True;n=s.node_tree.nodes;n.clear();source=n.new('CompositorNodeImage');den=n.new('CompositorNodeDenoise');den.prefilter='NONE';comp=n.new('CompositorNodeComposite');s.node_tree.links.new(source.outputs['Image'],den.inputs['Image']);s.node_tree.links.new(den.outputs['Image'],comp.inputs['Image']);normal_source=n.new('CompositorNodeImage');s.node_tree.links.new(normal_source.outputs['Image'],den.inputs['Normal']);albedo=n.new('CompositorNodeImage');s.node_tree.links.new(albedo.outputs['Image'],den.inputs['Albedo']);s.view_settings.view_transform='Raw';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1

def filter_linear(rgb,label,normal=None):
 h,w=rgb.shape[:2]
 if normal is None:normal=np.broadcast_to(np.array([0,0,1],np.float32),(h,w,3))
 assert normal.shape==(h,w,3) and np.isfinite(normal).all()
 guide=bpy.data.images.new(label+'-normal',width=w,height=h,alpha=True,float_buffer=True);guide.colorspace_settings.name='Non-Color';guide_rgba=np.ones((h,w,4),np.float32);guide_rgba[:,:,:3]=normal;guide.pixels.foreach_set(guide_rgba.reshape(-1));guide.update();normal_source.image=guide;del guide_rgba
 unit_albedo=bpy.data.images.new(label+'-unit-albedo',width=w,height=h,alpha=True,float_buffer=True);unit_albedo.colorspace_settings.name='Non-Color';unit_albedo.pixels.foreach_set(np.ones(h*w*4,np.float32));unit_albedo.update();albedo.image=unit_albedo
 den.mute=bool(float(rgb.max()-rgb.min())<1e-7);im=bpy.data.images.new(label,width=w,height=h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';rgba=np.ones((h,w,4),np.float32);rgba[:,:,:3]=rgb;im.pixels.foreach_set(rgba.reshape(-1));im.update();source.image=im;s.render.resolution_x=w;s.render.resolution_y=h;s.render.resolution_percentage=100;bpy.ops.render.render();tmp=a.out/(label+'.exr');s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='32';bpy.data.images['Render Result'].save_render(str(tmp),scene=s)
 result=bpy.data.images.load(str(tmp),check_existing=False);result.colorspace_settings.name='Non-Color';v=np.empty(len(result.pixels),np.float32);result.pixels.foreach_get(v);data=v.reshape(h,w,4)[:,:,:3].copy();bpy.data.images.remove(result);bpy.data.images.remove(im);bpy.data.images.remove(guide);bpy.data.images.remove(unit_albedo);tmp.unlink();return data

constant=np.full((128,128,3),.18,np.float32);constant_filtered=filter_linear(constant,a.zone+'-constant018-test');constant_error=float(np.abs(constant_filtered-.18).max())
if constant_error>.0002:raise RuntimeError(f'Linear0.18 calibration failed: {constant_error}')
nonuniform=np.empty((256,256,3),np.float32);nonuniform[:,:128]=.09;nonuniform[:,128:]=.27
control_normal=np.zeros_like(nonuniform);control_normal[:,:128,2]=1;control_normal[:,128:,1]=1
nonuniform_filtered=filter_linear(nonuniform,a.zone+'-nonuniform-test',control_normal)
nonuniform_mean_change=float(nonuniform_filtered.mean(dtype=np.float64)/nonuniform.mean(dtype=np.float64)-1)
nonuniform_whole_image_error=float(np.abs(nonuniform_filtered-nonuniform).max())
nonuniform_interior_error=float(max(np.abs(nonuniform_filtered[16:240,16:96]-.09).max(),np.abs(nonuniform_filtered[16:240,160:240]-.27).max()))
if abs(nonuniform_mean_change)>.01 or nonuniform_interior_error>.002:raise RuntimeError('Nonuniform guided transfer control failed')
edge_profile=nonuniform_filtered.mean(axis=(0,2),dtype=np.float64)
edge_metrics={'columns120to135':edge_profile[120:136].tolist(),'transitionWidthPixels':int(((edge_profile>.10)&(edge_profile<.26)).sum()),'leftAdjacentError':float(abs(edge_profile[127]-.09)),'rightAdjacentError':float(abs(edge_profile[128]-.27)),'wholeImageMaximumError':nonuniform_whole_image_error,'interiorRegion':'Rows16:240 and columns16:96/160:240; outer image-frame padding reported separately','qualification':'Synthetic step with a matching guide-normal discontinuity; actual atlas chart/gutter and mapped edge checks remain required'}
if edge_metrics['transitionWidthPixels']>1 or max(edge_metrics['leftAdjacentError'],edge_metrics['rightAdjacentError'])>.002:raise RuntimeError('Guided synthetic edge control failed')
rng=np.random.default_rng(1935);sensitivity_colour=np.clip(.18+rng.normal(0,.025,(192,192,3)),0,1).astype(np.float32)
flat_normal=np.zeros_like(sensitivity_colour);flat_normal[:,:,2]=1
changed_normal=flat_normal.copy();changed_normal[:,96:]=[0,1,0]
flat_output=filter_linear(sensitivity_colour,a.zone+'-guide-flat-test',flat_normal)
changed_output=filter_linear(sensitivity_colour,a.zone+'-guide-changed-test',changed_normal)
sensitivity={'sameColourSha256':hashlib.sha256(sensitivity_colour.tobytes()).hexdigest(),'sameUnitWhiteImageAlbedo':True,'albedoIsSingleElement':False,'normalGuideChangedOnly':True,'maximumOutputDifference':float(np.abs(flat_output-changed_output).max()),'meanOutputDifference':float(np.abs(flat_output-changed_output).mean()),'flatOutputSha256':hashlib.sha256(flat_output.tobytes()).hexdigest(),'changedOutputSha256':hashlib.sha256(changed_output.tobytes()).hexdigest(),'normalInputLinked':den.inputs['Normal'].is_linked,'albedoInputLinked':den.inputs['Albedo'].is_linked,'albedoNodeType':albedo.bl_idname,'prefilter':den.prefilter}
if sensitivity['maximumOutputDifference']<1e-5:raise RuntimeError('Normal guidance is inactive in the sensitivity control')
sensitivity['passed']=True
(a.out/'guided-control-supplement.json').write_text(json.dumps({'constant018MaximumError':constant_error,'nonuniformRelativeMeanChange':nonuniform_mean_change,'nonuniformInteriorError':nonuniform_interior_error,'edge':edge_metrics,'guideSensitivity':sensitivity},indent=2)+'\n')
print('GUIDE SENSITIVITY PASS '+json.dumps(sensitivity),flush=True)
normal=np.load(a.normal_guide,mmap_mode='r',allow_pickle=False)
raw_image=bpy.data.images.load(str(a.input.resolve()),check_existing=False);raw_image.colorspace_settings.name='Non-Color';w,h=raw_image.size;v=np.empty(len(raw_image.pixels),np.float32);raw_image.pixels.foreach_get(v);stored=v.reshape(h,w,4)[:,:,:3].copy();decoded=(srgb_decode(stored) if a.input_transfer=='srgb' else stored)*a.input_scale
if not np.isfinite(decoded).all():raise ValueError('Input contains non-finite radiance')
filtered=filter_linear(decoded,a.zone+'-oidn-object-normal',normal);negative=int((filtered<0).sum());filtered=np.maximum(filtered,0)
if not np.isfinite(filtered).all():raise RuntimeError('Denoiser returned non-finite values')

def write_hdr(filename,rgb):
 data=np.maximum(rgb[::-1],0);peak=data.max(axis=2);mant,exponent=np.frexp(peak);scale=np.divide(mant*256,peak,out=np.zeros_like(peak),where=peak>1e-32);rgbe=np.zeros((*peak.shape,4),np.uint8);rgbe[:,:,:3]=np.clip(data*scale[:,:,None],0,255).astype(np.uint8);rgbe[:,:,3]=np.where(peak>1e-32,exponent+128,0).astype(np.uint8)
 with filename.open('wb') as f:
  f.write(f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n'.encode())
  for row in rgbe:
   f.write(bytes([2,2,w>>8,w&255]))
   for channel in range(4):
    for x in range(0,w,128):
     block=row[x:x+128,channel].tobytes();f.write(bytes([len(block)]));f.write(block)

def write_display(stem,rgb):
 normalized=rgb/a.radiance_scale;encoded=np.rint(np.clip(srgb_encode(np.maximum(normalized,0)),0,1)*255).astype(np.uint8)[::-1];image=Image.fromarray(encoded,'RGB');png=a.out/(stem+'.png');webp=a.out/(stem+'.webp');image.save(png);image.save(webp,format='WEBP',lossless=True,method=6)
 if not np.array_equal(np.asarray(Image.open(webp).convert('RGB')),encoded):raise RuntimeError('LosslessWebP pixel verification failed')
 return {'png':png.name,'webp':webp.name,'clippedRGBSamples':int((normalized>1).sum()),'width':rgb.shape[1],'height':rgb.shape[0]}

stem=f'lighting-{a.zone}-sky';hdr=a.out/(stem+'-denoised-linear.hdr');write_hdr(hdr,filtered)
if a.full_size and (a.full_size < 512 or a.full_size > max(w,h)):raise ValueError('Full derivative must be between512 and the source dimension')
full_pixels=filtered
if a.full_size and (w!=a.full_size or h!=a.full_size):
 full_pixels=np.maximum(np.stack([np.asarray(Image.fromarray(filtered[:,:,k],mode='F').resize((a.full_size,a.full_size),Image.Resampling.LANCZOS)) for k in range(3)],axis=2),0)
full=write_display(stem,full_pixels)
small=np.stack([np.asarray(Image.fromarray(filtered[:,:,k],mode='F').resize((512,512),Image.Resampling.LANCZOS)) for k in range(3)],axis=2);low=write_display(stem+'-low',np.maximum(small,0))
roundtrip=bpy.data.images.load(str(hdr),check_existing=False);roundtrip.colorspace_settings.name='Non-Color';v=np.empty(len(roundtrip.pixels),np.float32);roundtrip.pixels.foreach_get(v);retained=v.reshape(h,w,4)[:,:,:3]
report={'schemaVersion':1,'zone':a.zone,'source':a.input.name,'sourceSha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),'inputTransfer':a.input_transfer,'inputScale':a.input_scale,'radianceScale':a.radiance_scale,'method':'Blender4.3 compositor OpenImageDenoise,object-normal+unit-white-image-albedo,prefilterNONE; no geometry/AO changes','encoding':'Explicit IEC61966-2-1 sRGB once for PNG/WebP; direct linear Radiance RGBE writer with no view transform','sourceStored':stats(stored),'originalLinear':stats(decoded),'denoisedLinear':stats(filtered),'relativeMeanChange':float(filtered.mean()/max(float(decoded.mean()),1e-20)-1),'normalGuide':{'file':a.normal_guide.name,'sha256':hashlib.sha256(a.normal_guide.read_bytes()).hexdigest(),'shape':list(normal.shape),'encoding':'Signed unit object-space vectors; empty atlas background zero; bottom-to-top Blender pixel order','albedo':'Full-resolution unit-white image buffer, appropriate for outgoing unit-albedo diffuse GI; avoids Blender4.3 single-element auxiliary-input bypass'},'guideSensitivityControl':sensitivity,'syntheticEdgeControl':edge_metrics,'nonuniformControl':{'left':.09,'right':.27,'relativeMeanChange':nonuniform_mean_change,'maximumInteriorError':nonuniform_interior_error,'wholeImageMaximumError':nonuniform_whole_image_error,'interiorRegion':'Rows16:240, left columns16:96/right160:240; outer image-frame padding reported separately','passed':True},'negativeOutputSamplesClamped':negative,'constant018Test':{'before':.18,'after':float(constant_filtered.mean()),'maximumError':constant_error,'passed':True,'uniformInputProtection':'OIDN is bypassed for exactly uniform images so the learned denoiser cannot introduce false structure; compositor EXR/encoding path is still tested'},'retainedHdr':{'file':hdr.name,'sha256':hashlib.sha256(hdr.read_bytes()).hexdigest(),'decodedLinear':stats(retained),'meanQuantizationError':float(np.abs(retained-filtered).mean())},'full':full,'low':low,'limitations':'Normal-guided atlas denoising retains source coffer edge cues; guide/chart-boundary filtering still requires mapped browser review. No geometry, AO, UV or source illumination bake is changed. PNG clipping is explicitly reported.','elapsedSeconds':time.monotonic()-started}
(a.out/f'lighting-{a.zone}-denoise.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
