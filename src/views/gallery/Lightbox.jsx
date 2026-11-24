import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, Sliders, Undo, X } from 'lucide-react';
import { PRESETS, DEFAULT_FILTERS, thumbFor } from './utils';

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150, unit: '%' },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150, unit: '%' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, unit: '%' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100, unit: '%' },
  { key: 'hue', label: 'Hue', min: 0, max: 360, unit: '°' },
];

function FilmStrip({ photos, index, onJump }) {
  const rail = useRef(null);
  useEffect(() => {
    rail.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index]);
  return (
    <div ref={rail} className="flex gap-1.5 overflow-x-auto scrollbar-none px-[45%] py-2" onClick={(e) => e.stopPropagation()}>
      {photos.map((url, i) => (
        <button
          key={url}
          data-i={i}
          onClick={() => onJump(i)}
          aria-label={`Photo ${i + 1}`}
          className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 overflow-hidden rounded-[3px] transition-all ${i === index ? 'ring-2 ring-coral opacity-100 scale-105' : 'opacity-40 hover:opacity-80'}`}
        >
          <img src={thumbFor(url, 160)} alt="" loading="lazy" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// Start the photo where the tapped card was, so it appears to lift out of the grid.
function fromOrigin(origin) {
  if (!origin || typeof window === 'undefined') return { opacity: 0, scale: 0.96 };
  const w = window.innerWidth, h = window.innerHeight;
  return {
    opacity: 0.4,
    x: origin.left + origin.width / 2 - w / 2,
    y: origin.top + origin.height / 2 - h / 2,
    scale: Math.max(0.15, Math.min(0.8, origin.width / Math.min(w * 0.8, 1100))),
  };
}

export function Lightbox({
  photos, index, origin, onClose, onNext, onPrev, onJump,
  isEditing, setIsEditing, activePreset, setActivePreset, editFilters, setEditFilters,
  filter, isDownloading, onDownload, onTouchStart, onTouchEnd,
}) {
  return createPortal(
    <AnimatePresence>
      {index !== null && photos && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-[#141210] text-paper flex flex-col md:flex-row font-sans"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            {/* top bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 h-16 shrink-0">
              <span className="display-italic text-lg text-paper/70 tabular-nums">
                no. {index + 1} <span className="text-paper/30">/ {photos.length}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border transition-colors ${isEditing ? 'bg-paper text-ink border-paper' : 'border-paper/20 text-paper/80 hover:border-paper/50'}`}
                >
                  <Sliders className="w-3.5 h-3.5" /> {isEditing ? 'Editing' : 'Edit colors'}
                </button>
                <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-paper/70 hover:text-paper hover:bg-paper/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* image stage */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center px-2 sm:px-16 cursor-zoom-out" onClick={onClose}>
              <button onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous photo" className="absolute left-3 hidden sm:flex p-3 rounded-full text-paper/50 hover:text-paper hover:bg-paper/10 z-10">
                <ChevronLeft className="w-7 h-7" />
              </button>
              <motion.img
                key={index}
                initial={fromOrigin(origin)}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={origin ? { type: 'spring', stiffness: 220, damping: 26 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                src={photos[index]}
                alt={`Photo ${index + 1}`}
                style={{ filter }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full object-contain cursor-default transition-[filter] duration-150 shadow-2xl"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.includes('/api/drive-proxy/')) {
                    const fileId = target.src.split('/api/drive-proxy/')[1];
                    if (fileId && !target.src.includes('googleusercontent.com')) {
                      target.src = `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
                    }
                  }
                }}
              />
              <button onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next photo" className="absolute right-3 hidden sm:flex p-3 rounded-full text-paper/50 hover:text-paper hover:bg-paper/10 z-10">
                <ChevronRight className="w-7 h-7" />
              </button>
            </div>

            {/* bottom: save + film strip */}
            <div className="shrink-0 pt-3 pb-2 space-y-1">
              {!isEditing && (
                <div className="flex justify-center">
                  <button
                    disabled={isDownloading}
                    onClick={() => onDownload(photos[index])}
                    className="btn bg-paper text-ink hover:bg-white px-6 py-3"
                  >
                    <Download className="w-4 h-4" /> {isDownloading ? 'Saving…' : 'Save full size'}
                  </button>
                </div>
              )}
              <FilmStrip photos={photos} index={index} onJump={onJump} />
            </div>
          </div>

          {/* editor panel */}
          <AnimatePresence>
            {isEditing && (
              <motion.aside
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                className="w-full md:w-80 shrink-0 bg-[#1d1a17] border-t md:border-t-0 md:border-l border-paper/10 p-6 flex flex-col gap-6 overflow-y-auto max-h-[46vh] md:max-h-none"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-paper/40">Darkroom</p>
                  <h3 className="display text-2xl mt-1">Edit colors</h3>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePreset(p.id);
                        if (p.id !== 'original') setEditFilters(DEFAULT_FILTERS);
                      }}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${activePreset === p.id ? 'bg-paper text-ink border-paper' : 'border-paper/15 text-paper/60 hover:border-paper/40'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {activePreset === 'original' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-paper/40">Fine tune</span>
                      <button onClick={() => setEditFilters(DEFAULT_FILTERS)} className="text-xs font-semibold text-paper/70 hover:text-paper flex items-center gap-1">
                        <Undo className="w-3 h-3" /> Reset
                      </button>
                    </div>
                    {SLIDERS.map((s) => (
                      <label key={s.key} className="block space-y-1.5">
                        <span className="flex justify-between text-xs font-semibold text-paper/60">
                          <span>{s.label}</span><span className="tabular-nums">{editFilters[s.key]}{s.unit}</span>
                        </span>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          value={editFilters[s.key]}
                          onChange={(e) => setEditFilters({ ...editFilters, [s.key]: parseInt(e.target.value, 10) })}
                          className="w-full accent-coral"
                        />
                      </label>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => onDownload(photos[index])}
                  disabled={isDownloading}
                  className="btn bg-coral text-white hover:bg-[#c8643f] w-full py-3 mt-auto"
                >
                  <Download className="w-4 h-4" /> {isDownloading ? 'Saving…' : 'Save edited photo'}
                </button>
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
