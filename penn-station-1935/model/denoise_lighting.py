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
s.use_nodes=True;n=s.node_tree.nodes;n.clear();source=n.new('CompositorNodeImage');den=n.new('CompositorNodeDenoise');den.prefilter='NONE';comp=n.new('CompositorNodeComposite');s.node_tree.links.new(source.outputs['Image'],den.inputs['Image']);s.node_tree.links.new(den.outputs['Image'],comp.inputs['Image']);s.view_settings.view_transform='Raw';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1

def filter_linear(rgb,label):
 h,w=rgb.shape[:2];den.mute=bool(float(rgb.max()-rgb.min())<1e-7);im=bpy.data.images.new(label,width=w,height=h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';rgba=np.ones((h,w,4),np.float32);rgba[:,:,:3]=rgb;im.pixels.foreach_set(rgba.reshape(-1));im.update();source.image=im;s.render.resolution_x=w;s.render.resolution_y=h;s.render.resolution_percentage=100;bpy.ops.render.render();tmp=a.out/(label+'.exr');s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='32';bpy.data.images['Render Result'].save_render(str(tmp),scene=s)
 result=bpy.data.images.load(str(tmp),check_existing=False);result.colorspace_settings.name='Non-Color';v=np.empty(len(result.pixels),np.float32);result.pixels.foreach_get(v);data=v.reshape(h,w,4)[:,:,:3].copy();bpy.data.images.remove(result);bpy.data.images.remove(im);tmp.unlink();return data

constant=np.full((128,128,3),.18,np.float32);constant_filtered=filter_linear(constant,a.zone+'-constant018-test');constant_error=float(np.abs(constant_filtered-.18).max())
if constant_error>.0002:raise RuntimeError(f'Linear0.18 calibration failed: {constant_error}')
raw_image=bpy.data.images.load(str(a.input.resolve()),check_existing=False);raw_image.colorspace_settings.name='Non-Color';w,h=raw_image.size;v=np.empty(len(raw_image.pixels),np.float32);raw_image.pixels.foreach_get(v);stored=v.reshape(h,w,4)[:,:,:3].copy();decoded=(srgb_decode(stored) if a.input_transfer=='srgb' else stored)*a.input_scale
if not np.isfinite(decoded).all():raise ValueError('Input contains non-finite radiance')
filtered=filter_linear(decoded,a.zone+'-oidn-color');negative=int((filtered<0).sum());filtered=np.maximum(filtered,0)
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

stem=f'lighting-{a.zone}-sky';hdr=a.out/(stem+'-denoised-linear.hdr');write_hdr(hdr,filtered);full=write_display(stem,filtered)
small=np.stack([np.asarray(Image.fromarray(filtered[:,:,k],mode='F').resize((512,512),Image.Resampling.LANCZOS)) for k in range(3)],axis=2);low=write_display(stem+'-low',np.maximum(small,0))
roundtrip=bpy.data.images.load(str(hdr),check_existing=False);roundtrip.colorspace_settings.name='Non-Color';v=np.empty(len(roundtrip.pixels),np.float32);roundtrip.pixels.foreach_get(v);retained=v.reshape(h,w,4)[:,:,:3]
report={'schemaVersion':1,'zone':a.zone,'source':a.input.name,'sourceSha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),'inputTransfer':a.input_transfer,'inputScale':a.input_scale,'radianceScale':a.radiance_scale,'method':'Blender4.3 compositor OpenImageDenoise,color-only,prefilterNONE; no geometry/AO changes','encoding':'Explicit IEC61966-2-1 sRGB once for PNG/WebP; direct linear Radiance RGBE writer with no view transform','sourceStored':stats(stored),'originalLinear':stats(decoded),'denoisedLinear':stats(filtered),'relativeMeanChange':float(filtered.mean()/max(float(decoded.mean()),1e-20)-1),'negativeOutputSamplesClamped':negative,'constant018Test':{'before':.18,'after':float(constant_filtered.mean()),'maximumError':constant_error,'passed':True,'uniformInputProtection':'OIDN is bypassed for exactly uniform images so the learned denoiser cannot introduce false structure; compositor EXR/encoding path is still tested'},'retainedHdr':{'file':hdr.name,'sha256':hashlib.sha256(hdr.read_bytes()).hexdigest(),'decodedLinear':stats(retained),'meanQuantizationError':float(np.abs(retained-filtered).mean())},'full':full,'low':low,'limitations':'Color-only atlas denoising can soften tiny light/shadow features near islands. Inspect actual mapped geometry; higher-sample source bakes remain preferable. PNG clipping is explicitly reported.','elapsedSeconds':time.monotonic()-started}
(a.out/f'lighting-{a.zone}-denoise.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
