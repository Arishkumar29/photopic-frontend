import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Timer, ImageUp, Sun, SunDim, Check } from 'lucide-react';
import { stepMotion } from './utils';

// Cheap live lighting check: every 500 ms, average the luminance of the centre of
// the frame (where the face oval is) on a 48x48 canvas. No per-frame React state.
function useLightHint(videoRef) {
  const [hint, setHint] = useState(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!ctx || !v || v.readyState < 2 || !v.videoWidth) return;
      const side = Math.min(v.videoWidth, v.videoHeight) * 0.6;
      ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2.3, side, side, 0, 0, 48, 48);
      const px = ctx.getImageData(0, 0, 48, 48).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const luma = sum / (px.length / 4);
      setHint(luma < 60 ? 'dark' : luma > 205 ? 'bright' : 'good');
    }, 500);
    return () => clearInterval(timer);
  }, [videoRef]);
  return hint;
}

const HINTS = {
  dark: { icon: SunDim, text: 'Too dark: face a light', cls: 'bg-amber text-white' },
  bright: { icon: Sun, text: 'Too bright: step out of the glare', cls: 'bg-amber text-white' },
  good: { icon: Check, text: 'Lighting looks good', cls: 'bg-sage text-white' },
};

export function CameraView({ stream, videoRef, onCapture, onClose, onUpload }) {
  const hint = useLightHint(videoRef);
  const Hint = hint ? HINTS[hint] : null;
  const [useTimer, setUseTimer] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { setCountdown(null); onCapture(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const shoot = () => {
    if (countdown !== null) return;
    if (useTimer) setCountdown(3); else onCapture();
  };

  return (
    <motion.div {...stepMotion} className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow">Viewfinder</p>
          <h2 className="display text-2xl font-medium">Line up your face</h2>
        </div>
        <button onClick={onClose} className="btn-quiet rounded-full !p-2.5" aria-label="Close camera"><X className="w-5 h-5" /></button>
      </div>

      <div className="relative bg-[#1d1a17] p-2.5 rounded-[1.75rem] shadow-[0_30px_60px_-25px_rgba(29,26,23,.6)]">
        <div className="relative aspect-[3/4] rounded-[1.25rem] overflow-hidden bg-black">
          <video
            ref={(node) => {
              videoRef.current = node;
              if (node && stream) node.srcObject = stream;
            }}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* viewfinder overlay: darkened surround + oval guide */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 34% 30% at 50% 45%, transparent 98%, rgba(20,18,16,.55) 100%)' }} />
            <motion.div
              className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-[68%] aspect-[4/5] rounded-[50%] border-2 border-dashed border-paper/70"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {['top-4 left-4 border-t-2 border-l-2', 'top-4 right-4 border-t-2 border-r-2', 'bottom-4 left-4 border-b-2 border-l-2', 'bottom-4 right-4 border-b-2 border-r-2'].map((c) => (
              <span key={c} className={`absolute w-6 h-6 border-paper/80 ${c}`} />
            ))}
            <div className="absolute top-5 inset-x-0 flex justify-center">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-paper uppercase bg-black/40 backdrop-blur px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse" /> Live
              </span>
            </div>
          </div>

          <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none" aria-live="polite">
            <AnimatePresence mode="wait">
              {Hint && (
                <motion.span
                  key={hint}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ${Hint.cls}`}
                >
                  <Hint.icon className="w-3.5 h-3.5" /> {Hint.text}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {countdown !== null && countdown > 0 && (
              <motion.div
                key={countdown}
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span className="display text-[9rem] leading-none text-paper drop-shadow-[0_4px_20px_rgba(0,0,0,.5)]">{countdown}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={() => setUseTimer((v) => !v)}
            aria-pressed={useTimer}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full transition-colors ${useTimer ? 'bg-coral text-white' : 'text-paper/70 hover:text-paper'}`}
          >
            <Timer className="w-4 h-4" /> 3s
          </button>
          <button
            onClick={shoot}
            aria-label="Take photo"
            className="w-[72px] h-[72px] rounded-full border-4 border-paper/80 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="w-[54px] h-[54px] rounded-full bg-paper" />
          </button>
          <button onClick={onUpload} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full text-paper/70 hover:text-paper">
            <ImageUp className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>
      <p className="text-center text-sm text-ink-3 mt-5">Look straight at the camera. No sunglasses or masks.</p>
    </motion.div>
  );
}
