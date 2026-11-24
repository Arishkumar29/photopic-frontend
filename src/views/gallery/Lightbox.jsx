import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, Sliders, Undo, X, ZoomIn, ZoomOut } from 'lucide-react';
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const TAP_ZOOM = 2.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Pinch, double-tap/double-click, wheel and drag-to-pan for the photo. Works with
// mouse and touch through pointer events; `layer` is the element that gets scaled.
function useZoom(resetKey) {
  const layer = useRef(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map());
  const pinch = useRef(null);      // {dist, zoom} when two fingers are down
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const moved = useRef(false);
  const touchToggled = useRef(0); // browsers also fire dblclick after a double-tap: ignore that one
  const [active, setActive] = useState(false); // a finger or mouse is down: follow it without easing

  useEffect(() => { setView({ zoom: 1, x: 0, y: 0 }); }, [resetKey]);

  // Keep the photo covering the stage: no panning past its edges.
  const bounded = (zoom, x, y) => {
    const r = layer.current?.getBoundingClientRect();
    if (!r || zoom <= 1) return { zoom: 1, x: 0, y: 0 };
    const baseW = r.width / viewRef.current.zoom, baseH = r.height / viewRef.current.zoom;
    const mx = (baseW * (zoom - 1)) / 2, my = (baseH * (zoom - 1)) / 2;
    return { zoom, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
  };

  // Zoom keeping the point under (px, py) in place.
  const zoomAt = (target, px, py) => {
    const { zoom, x, y } = viewRef.current;
    const z = clamp(target, MIN_ZOOM, MAX_ZOOM);
    const r = layer.current?.parentElement?.getBoundingClientRect();
    if (!r) return setView(bounded(z, x, y));
    const cx = px - (r.left + r.width / 2), cy = py - (r.top + r.height / 2);
    const k = z / zoom;
    setView(bounded(z, cx - (cx - x) * k, cy - (cy - y) * k));
  };

  const zoomBy = (factor) => {
    const r = layer.current?.parentElement?.getBoundingClientRect();
    if (r) zoomAt(viewRef.current.zoom * factor, r.left + r.width / 2, r.top + r.height / 2);
  };
  const reset = () => setView({ zoom: 1, x: 0, y: 0 });
  const toggleAt = (px, py) => (viewRef.current.zoom > 1 ? reset() : zoomAt(TAP_ZOOM, px, py));

  const handlers = {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved.current = false;
      setActive(true);
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom };
      }
    },
    onPointerMove: (e) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, now);
      if (Math.hypot(now.x - prev.x, now.y - prev.y) > 2) moved.current = true;
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(pinch.current.zoom * (dist / pinch.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      } else if (pointers.current.size === 1 && viewRef.current.zoom > 1) {
        const { zoom, x, y } = viewRef.current;
        setView(bounded(zoom, x + now.x - prev.x, y + now.y - prev.y));
      }
    },
    onPointerUp: (e) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 0) setActive(false);
      // Double-tap on touch screens (mouse uses onDoubleClick).
      if (e.pointerType !== 'mouse' && !moved.current) {
        const t = Date.now(), last = lastTap.current;
        if (t - last.t < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
          toggleAt(e.clientX, e.clientY);
          lastTap.current = { t: 0, x: 0, y: 0 };
          touchToggled.current = t;
        } else {
          lastTap.current = { t, x: e.clientX, y: e.clientY };
        }
      }
    },
    onPointerCancel: (e) => {
      pointers.current.delete(e.pointerId);
      pinch.current = null;
      if (pointers.current.size === 0) setActive(false);
    },
    onDoubleClick: (e) => {
      e.stopPropagation();
      if (Date.now() - touchToggled.current > 600) toggleAt(e.clientX, e.clientY);
    },
    onWheel: (e) => { zoomAt(viewRef.current.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); },
  };

  return { layer, view, active, handlers, zoomBy, reset };
}

function ZoomControls({ zoom, onIn, onOut, onReset }) {
  const btn = 'p-2 rounded-full text-paper/80 hover:text-paper hover:bg-paper/10 disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div
      className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-full bg-[#141210]/80 backdrop-blur border border-paper/15 px-1 py-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onOut} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" className={btn}><ZoomOut className="w-4 h-4" /></button>
      <button onClick={onReset} aria-label="Reset zoom" className="min-w-[3.25rem] text-xs font-bold tabular-nums text-paper/80 hover:text-paper">
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={onIn} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" className={btn}><ZoomIn className="w-4 h-4" /></button>
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
  const { layer, view, active, handlers, zoomBy, reset } = useZoom(index);
  const zoomed = view.zoom > 1;
  // A pinch or a pan must not also count as a swipe to the next photo.
  const gesture = useRef(false);

  useEffect(() => {
    if (index === null) return undefined;
    const onKey = (e) => {
      if (e.key === '+' || e.key === '=') zoomBy(1.5);
      else if (e.key === '-') zoomBy(1 / 1.5);
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  disabled={isDownloading}
                  onClick={() => onDownload(photos[index])}
                  className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full bg-paper text-ink hover:bg-white transition-colors disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloading ? 'Saving…' : isEditing ? 'Save edited' : 'Save'}
                </button>
                <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-paper/70 hover:text-paper hover:bg-paper/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* image stage */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden cursor-zoom-out" onClick={onClose}>
              <button onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous photo" className="absolute left-3 hidden sm:flex p-3 rounded-full text-paper/50 hover:text-paper hover:bg-paper/10 z-10">
                <ChevronLeft className="w-7 h-7" />
              </button>
              <div
                ref={layer}
                {...handlers}
                onClick={(e) => { if (zoomed) e.stopPropagation(); }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  gesture.current = zoomed || e.touches.length > 1;
                  if (!gesture.current) onTouchStart(e);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  if (!gesture.current && !zoomed) onTouchEnd(e);
                  if (e.touches.length === 0) gesture.current = false;
                }}
                style={{
                  transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
                  transition: active ? 'none' : 'transform 120ms ease-out',
                  touchAction: 'none',
                }}
                className={`absolute inset-0 px-2 sm:px-16 flex items-center justify-center will-change-transform ${zoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
              <motion.img
                key={index}
                initial={fromOrigin(origin)}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={origin ? { type: 'spring', stiffness: 220, damping: 26 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                src={photos[index]}
                alt={`Photo ${index + 1}`}
                style={{ filter }}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                className={`max-h-full max-w-full object-contain select-none transition-[filter] duration-150 shadow-2xl ${zoomed ? '' : 'cursor-zoom-in'}`}
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
              </div>
              <ZoomControls zoom={view.zoom} onIn={() => zoomBy(1.5)} onOut={() => zoomBy(1 / 1.5)} onReset={reset} />
              <button onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next photo" className="absolute right-3 hidden sm:flex p-3 rounded-full text-paper/50 hover:text-paper hover:bg-paper/10 z-10">
                <ChevronRight className="w-7 h-7" />
              </button>
            </div>

            {/* bottom: edit colors + film strip */}
            <div className="shrink-0 pt-3 pb-2 space-y-1">
              <div className="flex justify-center">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full border transition-colors ${isEditing ? 'bg-paper text-ink border-paper' : 'border-paper/25 text-paper/85 hover:border-paper/60'}`}
                >
                  <Sliders className="w-4 h-4" /> {isEditing ? 'Done editing' : 'Edit colors'}
                </button>
              </div>
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
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
