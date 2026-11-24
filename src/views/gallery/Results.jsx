import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate } from 'motion/react';
import { Camera, Download, FolderArchive, Loader2, RefreshCcw, Rows3, LayoutGrid, Grid3x3, Maximize2, X, Lightbulb } from 'lucide-react';
import { stepMotion, thumbFor, scanErrorCopy, coachTips } from './utils';
import { Mascot, Confetti } from '../../components/Mascot';

function PhotoCard({ photoUrl, index, onOpen, onDownload }) {
  const [loaded, setLoaded] = useState(false);
  const thumb = thumbFor(photoUrl);
  const tilt = ((index * 37) % 5) - 2; // a little hand-laid irregularity on hover
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotate: tilt * 0.6 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      // Cap the stagger so photo #40 doesn't wait seconds to appear.
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay: Math.min(index % 12, 8) * 0.05 }}
      whileHover={{ y: -6, rotate: tilt * 0.4 }}
      whileTap={{ scale: 0.97 }}
      className="break-inside-avoid mb-3 sm:mb-5 relative group cursor-zoom-in"
      onClick={(e) => onOpen(index, e.currentTarget.getBoundingClientRect())}
    >
      <div className="bg-card p-1.5 sm:p-2 pb-7 sm:pb-9 border border-line shadow-[0_10px_24px_-18px_rgba(29,26,23,.5)] group-hover:shadow-[0_24px_40px_-20px_rgba(29,26,23,.55)] transition-shadow duration-300">
        <div className="relative overflow-hidden bg-paper-2">
          {!loaded && <div className="aspect-[4/3] w-full animate-pulse bg-paper-2" />}
          <img
            src={thumb}
            alt={`Photo ${index + 1} of you`}
            className={`w-full h-auto object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              const target = e.currentTarget;
              // CDN refused (rate limit / blocked): fall back to our backend proxy once.
              if (target.src === thumb && thumb !== photoUrl) {
                target.src = `${photoUrl}?w=600`;
                return;
              }
              setLoaded(true);
            }}
          />
          <div className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-ink/20 pointer-events-none">
            <span className="bg-card/95 text-ink text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300"><Maximize2 className="w-3.5 h-3.5" /> View &amp; edit</span>
          </div>
        </div>
        <div className="absolute bottom-1.5 sm:bottom-2.5 left-2.5 right-1.5 flex items-center justify-between">
          <span className="display-italic text-xs sm:text-sm text-ink-3 tabular-nums">no. {index + 1}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(photoUrl); }}
            className="p-1.5 rounded-full text-ink-2 hover:text-plum hover:bg-plum-soft active:scale-90 transition-all"
            title="Download photo"
            aria-label={`Download photo ${index + 1}`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const DENSITIES = [
  { id: 2, icon: Rows3, cls: 'columns-2', label: 'Large' },
  { id: 3, icon: LayoutGrid, cls: 'columns-2 sm:columns-3', label: 'Medium' },
  { id: 4, icon: Grid3x3, cls: 'columns-3 sm:columns-4', label: 'Small' },
];

// Counts up from 0 by writing to the DOM directly (no re-render per frame).
function CountUp({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: Math.min(1.4, 0.5 + value / 60),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = Math.round(v).toLocaleString(); },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{value.toLocaleString()}</span>;
}

// No matches, no face, or a server problem: the sad kid explains and coaches.
function CoachPanel({ photo, scanError, quality, onRetake }) {
  const issues = quality?.issues || [];
  const serverProblem = scanError && scanError !== 'no_face';
  const copy = scanError
    ? scanErrorCopy(scanError)
    : { title: 'No matches yet', body: "We looked through the whole album but didn't spot you this time. A clearer selfie usually fixes it." };
  const tips = serverProblem ? [] : coachTips(issues);
  const say = serverProblem
    ? 'Oops, something went wrong.'
    : issues[0]?.message || (scanError === 'no_face' ? "I can't see your face!" : "Hmm, I couldn't find you…");

  return (
    <motion.div {...stepMotion} className="max-w-3xl mx-auto pt-2">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 md:gap-12 items-center">
        <div className="relative mx-auto w-full max-w-[16rem] sm:max-w-xs pt-20">
          <Mascot pose="sad" say={say} bubble="top" className="w-36 sm:w-48 mx-auto" />
          {photo && (
            <motion.div
              initial={{ opacity: 0, rotate: 0, x: 20 }}
              animate={{ opacity: 1, rotate: 8, x: 0 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute bottom-2 right-0 w-20 sm:w-24 bg-card p-1.5 pb-5 shadow-lg border border-line"
            >
              <img src={photo} alt="Your selfie" className="w-full aspect-square object-cover -scale-x-100 grayscale-[40%]" />
              <span className="absolute bottom-0.5 inset-x-0 text-center display-italic text-[11px] text-ink-3">your selfie</span>
            </motion.div>
          )}
        </div>

        <div className="text-center md:text-left">
          <h2 className="display text-3xl sm:text-4xl font-medium mb-3">{copy.title}</h2>
          <p className="text-ink-2 leading-relaxed mb-6">{copy.body}</p>

          {tips.length > 0 && (
            <ul className="text-left space-y-2.5 mb-8">
              {tips.map((t, i) => (
                <motion.li
                  key={t.code}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className={`flex gap-3 items-start p-3 rounded-xl border ${t.flagged ? 'bg-coral-soft border-coral/30' : 'bg-card border-line'}`}
                >
                  <span className="text-xl leading-none mt-0.5" aria-hidden>{t.emoji}</span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{t.title}</span>
                    <span className="block text-sm text-ink-2">{t.body}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <button onClick={onRetake} className="btn-plum sheen px-7 py-3.5"><Camera className="w-4 h-4" /> Take another selfie</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Matches found, but the selfie could be better: a small dismissible nudge.
function QualityTip({ quality, onRetake }) {
  const [open, setOpen] = useState(true);
  const issue = quality?.issues?.[0];
  return (
    <AnimatePresence>
      {open && issue && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ delay: 0.6 }}
          className="overflow-hidden"
          role="status"
        >
          <div className="mb-6 flex items-center gap-3 p-2.5 pr-2 rounded-2xl bg-amber-soft border border-amber/25">
            <motion.img
              src="/welcome_mascot.webp"
              alt=""
              className="w-10 h-12 object-contain shrink-0"
              animate={{ rotate: [0, -8, 0, -8, 0] }}
              transition={{ delay: 1, duration: 1.2 }}
            />
            <p className="flex-1 text-sm text-[#6b4710]">
              <Lightbulb className="inline w-4 h-4 -mt-0.5 mr-1" />
              <b>Tip:</b> {issue.message}{' '}
              <button onClick={onRetake} className="underline font-semibold">Retake</button> for even more photos.
            </p>
            <button onClick={() => setOpen(false)} className="p-2 rounded-full text-[#6b4710]/70 hover:bg-amber/10" aria-label="Dismiss tip">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Results({ photo, matchedPhotos, scanError, quality, indexing, isZipping, zipProgress, onZip, onRetake, onOpen, onDownload }) {
  const [density, setDensity] = useState(() => (window.innerWidth >= 1024 ? 4 : 2));
  const cols = DENSITIES.find((d) => d.id === density)?.cls;

  if (scanError || matchedPhotos?.length === 0) {
    return <CoachPanel photo={photo} scanError={scanError} quality={quality} onRetake={onRetake} />;
  }

  const n = matchedPhotos.length;
  return (
    <motion.div {...stepMotion}>
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-6 sm:pr-48 lg:pr-56">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.6, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-card p-1 border border-line shadow-md"
          >
            <img src={photo} alt="Your selfie" className="w-full h-full object-cover -scale-x-100" />
            <Confetti />
          </motion.div>
          <div>
            <p className="eyebrow">Your photos</p>
            <h2 className="display text-3xl sm:text-5xl font-medium leading-tight">
              We found you in <span className="display-italic text-plum tabular-nums"><CountUp value={n} /></span> photo{n !== 1 ? 's' : ''}.
            </h2>
            {indexing && (
              <p className="mt-1 text-xs font-semibold text-plum flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Still processing ({indexing.done}/{indexing.total}). More may appear.
              </p>
            )}
          </div>
        </div>
        <Mascot
          pose="handshake"
          say={n > 1 ? 'Yay, here you are! 🎉' : 'Found you! 🎉'}
          bubble="left"
          delay={0.2}
          className="hidden sm:block absolute right-0 -top-6 w-44 lg:w-52"
        />
      </div>

      <QualityTip quality={quality} onRetake={onRetake} />

      {/* sticky toolbar */}
      <div className="sticky top-16 z-30 -mx-4 sm:mx-0 px-4 sm:px-3 py-2.5 mb-6 bg-paper/90 backdrop-blur-md border-y sm:border border-line sm:rounded-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Grid size">
          {DENSITIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDensity(d.id)}
              aria-pressed={density === d.id}
              title={d.label}
              className={`relative p-2 rounded-full transition-colors ${density === d.id ? 'text-paper' : 'text-ink-3 hover:text-ink hover:bg-paper-2'}`}
            >
              {density === d.id && <motion.span layoutId="density-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              <d.icon className="relative w-4 h-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRetake} className="btn-quiet !px-3"><RefreshCcw className="w-4 h-4" /><span className="hidden sm:inline">Retake</span></button>
          <button onClick={onZip} disabled={isZipping} className="btn-ink sheen !px-4">
            {isZipping ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span className="tabular-nums">{zipProgress ? `${zipProgress.current}/${zipProgress.total}` : '…'}</span></>
            ) : (
              <><FolderArchive className="w-4 h-4" /> Save all ({n})</>
            )}
          </button>
        </div>
      </div>

      <div className={`${cols} gap-3 sm:gap-5`}>
        {matchedPhotos.map((url, i) => (
          <PhotoCard key={url} photoUrl={url} index={i} onOpen={onOpen} onDownload={onDownload} />
        ))}
      </div>
    </motion.div>
  );
}
