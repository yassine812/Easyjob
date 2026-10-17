"""Small CPU/runtime compatibility edits; original upstream license is retained."""
from pathlib import Path
root=Path(__file__).resolve().parent/'runtime/SadTalker-local'
def edit(rel,old,new):
 p=root/rel;s=p.read_text(encoding='utf-8')
 if old in s:p.write_text(s.replace(old,new),encoding='utf-8')

edit('src/face3d/util/preprocess.py','from skimage import transform as trans','')
edit('src/face3d/util/preprocess.py','trans_params = np.array([w0, h0, s, t[0], t[1]])','trans_params = np.array([w0, h0, float(np.asarray(s).reshape(-1)[0]), float(np.asarray(t[0]).reshape(-1)[0]), float(np.asarray(t[1]).reshape(-1)[0])])')
edit('src/face3d/models/networks.py','from kornia.geometry import warp_affine','')
edit('src/face3d/models/networks.py','    return warp_affine(image, M, dsize=(dsize, dsize), align_corners=True)','    from kornia.geometry import warp_affine\n    return warp_affine(image, M, dsize=(dsize, dsize), align_corners=True)')
edit('src/utils/face_enhancer.py','from gfpgan import GFPGANer','')
edit('src/utils/face_enhancer.py',"    print('face enhancer....')","    from gfpgan import GFPGANer\n    print('face enhancer....')")
edit('src/face3d/extract_kp_videos_safe.py',"init_detection_model('retinaface_resnet50'","init_detection_model('retinaface_mobile0.25'")
edit('src/generate_facerender_batch.py','from skimage import io, img_as_float32, transform', '''import cv2
def img_as_float32(x):
    return x.astype(np.float32)/255.0 if x.dtype==np.uint8 else x.astype(np.float32)
class transform:
    @staticmethod
    def resize(x, shape):
        return cv2.resize(x,(shape[1],shape[0]),interpolation=cv2.INTER_LINEAR)
''')
edit('src/facerender/animate.py','from skimage import img_as_ubyte', '''def img_as_ubyte(x):
    return np.rint(np.clip(np.asarray(x),0,1)*255).astype(np.uint8)
''')
edit('src/utils/audio.py','import librosa\nimport librosa.filters','import math')
edit('src/utils/audio.py','    return librosa.core.load(path, sr=sr)[0]', '''    original_sr, samples = wavfile.read(path)
    if np.issubdtype(samples.dtype,np.integer):
        samples=samples.astype(np.float32)/max(abs(np.iinfo(samples.dtype).min),np.iinfo(samples.dtype).max)
    if samples.ndim>1:samples=samples.mean(axis=1)
    if original_sr!=sr:
        d=math.gcd(original_sr,sr)
        samples=signal.resample_poly(samples,sr//d,original_sr//d)
    return samples.astype(np.float32)''')
edit('src/utils/audio.py','    librosa.output.write_wav(path, wav, sr=sr)','    wavfile.write(path, sr, wav.astype(np.float32))')
edit('src/utils/audio.py','        return librosa.stft(y=y, n_fft=hp.n_fft, hop_length=get_hop_size(), win_length=hp.win_size)', '''        window=signal.get_window('hann', hp.win_size, fftbins=True)
        left=(hp.n_fft-hp.win_size)//2
        window=np.pad(window,(left,hp.n_fft-hp.win_size-left))
        padded=np.pad(y,(hp.n_fft//2,hp.n_fft//2),mode='reflect')
        frames=np.lib.stride_tricks.sliding_window_view(padded,hp.n_fft)[::get_hop_size()]
        return np.fft.rfft(frames*window,axis=1).T''')
edit('src/utils/audio.py', '''    return librosa.filters.mel(sr=hp.sample_rate, n_fft=hp.n_fft, n_mels=hp.num_mels,
                               fmin=hp.fmin, fmax=hp.fmax)''', '''    def hz_to_mel(hz):
        return hz/(200/3) if hz<1000 else 15+np.log(hz/1000)/(np.log(6.4)/27)
    mels=np.linspace(hz_to_mel(hp.fmin),hz_to_mel(hp.fmax),hp.num_mels+2)
    frequencies=np.where(mels<15,mels*(200/3),1000*np.exp((np.log(6.4)/27)*(mels-15)))
    fftfreq=np.linspace(0,hp.sample_rate/2,1+hp.n_fft//2)
    ramps=frequencies[:,None]-fftfreq[None,:]
    widths=np.diff(frequencies)
    weights=np.maximum(0,np.minimum(-ramps[:-2]/widths[:-1,None],ramps[2:]/widths[1:,None]))
    return (weights*(2/(frequencies[2:]-frequencies[:-2]))[:,None]).astype(np.float32)''')
print('CPU compatibility ready')
