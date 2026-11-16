"""Independent harmonic-family/phase-advance verification of captured Web Audio PCM.
Requires existing NumPy/SciPy and ffmpeg; no application dependency.
"""
import json,subprocess,csv,sys,math,tempfile
from pathlib import Path
import numpy as np
from scipy.signal import find_peaks,windows
from scipy.fft import rfft
SR=48000; N=8192; M=65536; D=384; HOP=997
W=windows.blackmanharris(N,sym=False)
def cents(a,b):return 1200*np.log2(np.asarray(a)/b)
def wm(x,w):
    ix=np.argsort(x);return float(np.asarray(x)[ix][np.searchsorted(np.cumsum(np.asarray(w)[ix]),sum(w)*.5)])
def spectral(y,start):
    x=y[start:start+N];z=y[start+D:start+D+N]
    if len(z)!=N:return None
    a=rfft((x-np.mean(x))*W,M);b=rfft((z-np.mean(z))*W,M);mag=abs(a)
    peaks=find_peaks(mag,prominence=max(mag)*.003,distance=round(M/N*3))[0]
    peaks=peaks[(peaks*SR/M>=100)&(peaks*SR/M<=15000)]
    peaks=peaks[np.argsort(mag[peaks])[-32:]]
    if not len(peaks):return None
    amp=mag[peaks]/max(mag);use=amp>.005;peaks=peaks[use];amp=amp[use]
    # Phase-advance frequency, not parabolic magnitude or autocorrelation lag.
    nominal=peaks*SR/M
    phase=np.angle(b[peaks]*np.conj(a[peaks])*np.exp(-2j*np.pi*peaks*D/M))
    frequencies=nominal+phase*SR/(2*np.pi*D)
    candidates=np.unique(np.round((frequencies[:,None]/np.arange(1,25)).ravel(),3))
    candidates=candidates[(candidates>=100)&(candidates<=2600)]
    hs=np.round(frequencies[None,:]/candidates[:,None]).astype(int)
    residual=abs(frequencies[None,:]-hs*candidates[:,None])
    tolerance=np.maximum(1.2,frequencies*(2**(8/1200)-1))
    valid=(hs>=1)&(hs<=24)&(residual<tolerance)
    weights=np.sqrt(amp)
    coverage=np.sum(valid*weights,axis=1)/sum(weights)
    dominant=valid&(amp[None,:]>.03)
    gcd=np.gcd.reduce(np.where(dominant,hs,0),axis=1)
    score=coverage-.0005*np.sum(valid*weights*hs,axis=1)/np.maximum(np.sum(valid*weights,axis=1),1e-12)
    score[gcd!=1]=-1
    best=int(np.argmax(score));base=candidates[best]
    valid=valid[best];h=hs[best]
    # One main lobe per harmonic; retain all evidence in the exported partial list.
    for n in np.unique(h[valid]):
        ids=np.where(valid&(h==n))[0];keep=ids[np.argmax(amp[ids])];valid[ids]=False;valid[keep]=True
    estimates=frequencies[valid]/h[valid]
    f0=wm(estimates,weights[valid]) if len(estimates) else None
    parts=[dict(h=int(n),hz=float(f),relative=float(v),f0_hz=float(f/n)) for n,f,v in zip(h[valid],frequencies[valid],amp[valid])]
    return dict(hz=f0,coverage=float(coverage[best]),partials=parts,partial_spread_cents=float(np.percentile(cents(estimates,f0),95)-np.percentile(cents(estimates,f0),5)) if len(estimates)>1 else None,
                harmonic_count=len(parts),has_fundamental=bool(any(n==1 for n in h[valid])),
                accepted=bool(f0 and coverage[best]>.75 and gcd[best]==1))

folder=Path(sys.argv[1] if len(sys.argv)>1 else str(Path(tempfile.gettempdir())/'reference-calibration-renders'))
root=Path(__file__).resolve().parents[1];cache={};results=[]
for meta in sorted(folder.glob('*.json')):
 r=json.loads(meta.read_text());y=np.fromfile(meta.with_suffix('.f32'),dtype='<f4').reshape(-1,2).astype(float)
 path=root/'src'/r['path']
 if str(path) not in cache:cache[str(path)]=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ac','2','-ar','48000','-f','f32le','pipe:1']),dtype='<f4').reshape(-1,2).astype(float)
 source=cache[str(path)];rate=float(r['rate']);duration=float(r['duration']);out=[];original=[]
 for t in np.linspace(.25,min(duration-.15,3.6),21):
  for signal,time,destination in [(y,t,out),(source,t*rate,original)]:
   pair=[spectral(signal[:,ch],round(time*SR-N/2-D/2)) for ch in [0,1]]
   values=[f['hz'] for f in pair if f and f['accepted']]
   if values:destination.append(2**np.median(np.log2(values)))
 if min(len(out),len(original))<8:raise RuntimeError('Insufficient reliable pitch frames: '+str(meta))
 hz=float(2**np.median(np.log2(out)));src=float(2**np.median(np.log2(original)))
 results.append(dict(**r,measured_output_hz=hz,matched_source_hz=src,transfer_error_cents=float(cents(hz,src*rate)),target_residual_cents=float(cents(hz,float(r['target']))),peak=float(np.max(abs(y)))))
with (folder/'pitch-results.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(results[0]));w.writeheader();w.writerows(results)
print('Rendered files',len(results),'maximum correction-transfer error cents',max(abs(x['transfer_error_cents']) for x in results),'maximum target residual cents',max(abs(x['target_residual_cents']) for x in results))
assert len(results)==52
assert max(abs(x['transfer_error_cents']) for x in results)<5
