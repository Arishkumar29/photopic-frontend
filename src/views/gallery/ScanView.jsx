import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { stepMotion } from './utils';
import { Mascot } from '../../components/Mascot';

const SCAN_STEPS = [
  { id: 'prepare', label: 'Preparing selfie' },
  { id: 'search', label: 'Finding your photos' },
];

// The server answers in about a second, but upload time depends on the network, so
// the bar eases toward 92% and only completes when the real answer arrives.
function useEasedProgress(active, expectedMs = 2500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    setValue(0);
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = (now - start) / expectedMs;
      setValue(92 * (1 - Math.exp(-2.2 * t)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, expectedMs]);
  return value;
}

// The GWC kid zooms back and forth past the print while we search.
function FlyingRocket({ say }) {
  return (
    <motion.div
      aria-hidden
      className="absolute -top-14 sm:-top-16 left-1/2 w-24 sm:w-32 pointer-events-none z-10"
      animate={{ x: ['10%', '70%', '10%'], y: [0, -10, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Mascot pose="rocket" say={say} bubble="left" follow={false} />
    </motion.div>
  );
}

// The selfie "develops" like a print in a tray: blurred and washed out, then sharp.
function DevelopingPrint({ selfie, progress, caption }) {
  const t = progress / 100;
  return (
    <div className="relative w-52 sm:w-60 mx-auto bg-card p-3 pb-10 shadow-[0_25px_50px_-20px_rgba(29,26,23,.45)] rotate-[-2deg]">
      <div className="aspect-square overflow-hidden bg-paper-2 relative">
        {selfie && (
          <img
            src={selfie}
            alt="Your selfie"
            className="w-full h-full object-cover -scale-x-100"
            style={{ filter: `blur(${(1 - t) * 10}px) sepia(${(1 - t) * 80}%) brightness(${100 + (1 - t) * 40}%)` }}
          />
        )}
        <motion.div
          className="absolute inset-x-0 h-0.5 bg-coral shadow-[0_0_14px_rgba(218,119,86,1)]"
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span className="absolute bottom-2.5 inset-x-0 text-center display-italic text-ink-2">{caption}</span>
    </div>
  );
}

export function ScanView({ selfie, stage, photoCount, onCancel }) {
  const progress = useEasedProgress(true);
  const stepIndex = SCAN_STEPS.findIndex((s) => s.id === stage);
  return (
    <motion.div {...stepMotion} className="max-w-md mx-auto text-center space-y-8 pt-16 sm:pt-20" role="status" aria-live="polite">
      <div className="relative">
        <FlyingRocket say="On it! Searching…" />
        <DevelopingPrint selfie={selfie} progress={progress} caption="developing…" />
      </div>

      <div className="space-y-2">
        <h2 className="display text-3xl font-medium">Finding <span className="display-italic text-plum">you</span>…</h2>
        <p className="text-ink-2 text-sm">
          {photoCount > 0
            ? `Comparing your face with ${photoCount.toLocaleString()} event photos.`
            : 'Comparing your face with the event photos.'}
        </p>
      </div>

      <div className="space-y-4">
        <div className="h-1 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-plum transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <ol className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase">
          {SCAN_STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-2">
                {i > 0 && <span className={`h-px w-5 ${done || active ? 'bg-coral' : 'bg-line'}`} />}
                <span className={`inline-flex items-center gap-1 ${active ? 'text-plum' : done ? 'text-sage' : 'text-ink-3'}`}>
                  {done && <Check className="w-3 h-3" />}
                  {active && <Loader2 className="w-3 h-3 animate-spin" />}
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <button onClick={onCancel} className="btn-quiet">Cancel</button>
    </motion.div>
  );
}

// Shown when the guest scans while the host's photos are still being processed.
export function PreparingView({ selfie, indexing, onCancel }) {
  const pct = indexing?.total ? Math.round((indexing.done / indexing.total) * 100) : 0;
  return (
    <motion.div {...stepMotion} className="max-w-md mx-auto text-center space-y-8 pt-16 sm:pt-20" role="status" aria-live="polite">
      <div className="relative">
        <FlyingRocket say="Warming up the photos!" />
        <DevelopingPrint selfie={selfie} progress={Math.max(pct, 10)} caption="almost ready" />
      </div>
      <div className="space-y-2">
        <h2 className="display text-3xl font-medium">Getting the photos ready</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          The host just added these photos. Your matches will appear here by themselves. Keep this page open.
        </p>
      </div>
      <div className="space-y-2">
        <div className="h-1 bg-line rounded-full overflow-hidden">
          <motion.div className="h-full bg-plum" animate={{ width: `${Math.max(pct, 3)}%` }} transition={{ duration: 0.6 }} />
        </div>
        <p className="text-xs font-semibold text-ink-3 tabular-nums">
          {indexing?.total ? `${indexing.done} of ${indexing.total} photos processed` : 'Starting…'}
        </p>
      </div>
      <button onClick={onCancel} className="btn-quiet">Cancel</button>
    </motion.div>
  );
}
