"""Author a restrained, seamless limestone micro-surface without photographs.

This is an appearance interpretation, not a historical scan or measured stone
sample. It preserves the current BedfordLimestoneConcourse shader's mean linear
colour and roughness, adding only seeded isotropic grain. Run with numpy<2 and
Pillow13. The output remains separate from served assets until reviewed.
"""
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
from PIL import Image

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--size',type=int,default=2048)
parser.add_argument('--seed',type=int,default=19351008)
args=parser.parse_args()
if args.size!=2048:raise ValueError('This reviewed source set uses2048px maps')
args.out.mkdir(parents=True,exist_ok=True)
size=args.size;tile_metres=1.5
rng=np.random.default_rng(args.seed)
spectral=np.fft.rfft2(rng.standard_normal((size,size)))
fy=np.fft.fftfreq(size)[:,None];fx=np.fft.rfftfreq(size)[None,:]
frequency2=fx*fx+fy*fy
def band(sigma):
    image=np.fft.irfft2(spectral*np.exp(-2*math.pi**2*sigma**2*frequency2),s=(size,size))
    return (image-image.mean())/image.std()
coarse,medium,fine=band(30),band(5),band(.8)
grain=np.tanh((.58*coarse+.30*medium+.12*fine)/1.8)
grain-=grain.mean()
colour=np.stack([mean+.022*grain for mean in [.56,.55,.49]],axis=2)
roughness=.65+.028*np.tanh((.6*coarse+.4*fine)/1.6)
roughness+=.65-roughness.mean()
height=.000045*medium+.000025*fine
spacing=tile_metres/size
dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(2*spacing)
dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/(2*spacing)
normal=np.stack([-dx,-dy,np.ones_like(height)],axis=2)
normal/=np.linalg.norm(normal,axis=2)[:,:,None]

def srgb_encode(value):return np.where(value<=.0031308,12.92*value,1.055*np.maximum(value,0)**(1/2.4)-.055)
def srgb_decode(value):return np.where(value<=.04045,value/12.92,((value+.055)/1.055)**2.4)

def quantize_mean(image,target,srgb):
    """Round to8bits, distributing a tiny residual at rounding boundaries.

    Mean matching uses the actual decoded8bit values; no undocumented colour
    multiplier is needed in the shader. Pixel changes remain at the ordinary
    quantization boundary and are deterministic for the chosen seed.
    """
    encoded=np.clip(srgb_encode(image) if srgb else image,0,1)*255
    low=np.floor(encoded).astype(np.int16)
    quantized=np.rint(encoded).astype(np.int16)
    lut=srgb_decode(np.arange(256)/255) if srgb else np.arange(256)/255
    flat=quantized.reshape(-1);lower=low.reshape(-1);fraction=(encoded-low).reshape(-1)
    correction=float(target*flat.size-lut[flat].sum())
    sign=1 if correction>0 else -1
    eligible=np.flatnonzero(((flat==lower)&(flat<255)) if sign>0 else ((flat>lower)&(flat>0)))
    gains=np.abs(lut[flat[eligible]+sign]-lut[flat[eligible]])
    needed=min(eligible.size,max(1,int(math.ceil(abs(correction)/max(float(gains.min()),1e-12)))+2))
    scores=(.5-fraction[eligible]) if sign>0 else (fraction[eligible]-.5)
    nearest=np.argpartition(scores,needed-1)[:needed]
    candidates=eligible[nearest]
    cumulative=np.cumsum(np.abs(lut[flat[candidates]+sign]-lut[flat[candidates]]))
    count=int(np.argmin(np.abs(np.concatenate([[0],cumulative])-abs(correction))))
    flat[candidates[:count]]+=sign
    output=quantized.astype(np.uint8)
    measured=float(lut[output].mean())
    if abs(measured-target)>2e-8:raise RuntimeError('Encoded mean preservation failed')
    return output

colour_bytes=np.stack([quantize_mean(colour[:,:,i],mean,True) for i,mean in enumerate([.56,.55,.49])],axis=2)
roughness_bytes=quantize_mean(roughness,.65,False)
normal_bytes=np.rint(np.clip(normal*.5+.5,0,1)*255).astype(np.uint8)
names={'colour':'BedfordLimestoneConcourse-Color.png','roughness':'BedfordLimestoneConcourse-Roughness.png','normal':'BedfordLimestoneConcourse-NormalGL.png'}
Image.fromarray(colour_bytes,'RGB').save(args.out/names['colour'])
Image.fromarray(roughness_bytes,'L').save(args.out/names['roughness'])
Image.fromarray(normal_bytes,'RGB').save(args.out/names['normal'])
def statistics(values):
    if values.ndim==2:values=values[:,:,None]
    return {'mean':values.mean(axis=(0,1)).tolist(),'minimum':values.min(axis=(0,1)).tolist(),
            'maximum':values.max(axis=(0,1)).tolist(),'standardDeviation':values.std(axis=(0,1)).tolist()}
decoded_colour=srgb_decode(np.asarray(Image.open(args.out/names['colour']).convert('RGB'))/255)
decoded_roughness=np.asarray(Image.open(args.out/names['roughness']))/255
decoded_normal=np.asarray(Image.open(args.out/names['normal']).convert('RGB'))/255*2-1
for actual,target in zip(decoded_colour.mean(axis=(0,1)),[.56,.55,.49]):assert abs(actual-target)<2e-8
assert abs(float(decoded_roughness.mean())-.65)<2e-8
report={'schemaVersion':1,'material':'BedfordLimestoneConcourse','authorship':'Original deterministic seeded isotropic stone-grain appearance; no photographs, scans or third-party image sampling',
    'historicalQualification':'Bedford limestone material identity follows the existing source ledger. This micro-surface, exact colour/roughness and normal response are authored appearance interpretations, not an authenticated historic surface sample.',
    'sourceScriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'seed':args.seed,'size':[size,size],'seamless':'Periodic Fourier-filtered random field; central-difference periodic height derivatives',
    'tileMetres':tile_metres,'colour':{'space':'sRGB encoded; statistics below are decoded linear','targetMeanLinear':[.56,.55,.49],**statistics(decoded_colour)},
    'roughness':{'space':'Non-Color linear','targetMean':.65,**statistics(decoded_roughness)},
    'normal':{'space':'Non-Color; OpenGL +Y tangent normal','heightRmsMetres':float(height.std()),'recommendedStrength':.15,
        'unscaledMeanAngularDeviationDegrees':float(np.degrees(np.arccos(np.clip(normal[:,:,2],-1,1))).mean()),
        'unscaledMaximumAngularDeviationDegrees':float(np.degrees(np.arccos(np.clip(normal[:,:,2],-1,1))).max()),
        'decodedVectorLengthMean':float(np.linalg.norm(decoded_normal,axis=2).mean())},
    'application':{'baseColorFactor':[1,1,1,1],'roughnessFactor':1,'metallicFactor':0,'normalStrength':.15,
        'uvScale':'ArchitecturalUV stores0.28UV/m before material preparation; use UV/(0.28*1.5) for a1.5m tile. Do not apply the colour(.56,.55,.49) a second time.',
        'textures':names},'files':[]}
for role,name in names.items():
    payload=(args.out/name).read_bytes();report['files'].append({'role':role,'file':name,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()})
(args.out/'bedford-surface-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'out':str(args.out),'meanLinearColour':report['colour']['mean'],'meanRoughness':report['roughness']['mean'],'files':report['files']}),flush=True)
