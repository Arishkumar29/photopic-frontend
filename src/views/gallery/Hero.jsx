import { useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Camera, ScanFace } from 'lucide-react';
import { eventThumb } from './utils';
import { Mascot } from '../../components/Mascot';

const RISE = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 140, damping: 18 } } };

const STEPS = [
  { n: '01', title: 'Snap a selfie', body: 'Face the camera in good light, nothing covering your face.' },
  { n: '02', title: 'We look for you', body: 'Your face is compared with every photo from the event.' },
  { n: '03', title: 'Keep your photos', body: 'Save them one by one or all at once as a ZIP.' },
];

// A tilting "contact sheet" of the event's photos. Blurred and desaturated on purpose:
// guests shouldn't see other people's photos before they scan.
function ContactSheet({ event }) {
  const tiles = useMemo(() => {
    const photos = (event?.photos || []).filter(Boolean);
    if (photos.length === 0) return [];
    const step = Math.max(1, Math.floor(photos.length / 12));
    return Array.from({ length: 12 }, (_, i) => eventThumb(photos[(i * step) % photos.length], 300));
  }, [event?.photos]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 140, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 140, damping: 18 });

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  const count = event?.indexStatus?.total || event?.photos?.length || 0;

  return (
    <div className="relative" style={{ perspective: 1100 }} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        className="relative bg-[#1d1a17] rounded-[6px] p-3 sm:p-4 shadow-[0_40px_80px_-30px_rgba(29,26,23,.55)]"
      >
        {/* sprocket holes */}
        <div className="flex justify-between px-1 mb-2.5" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="w-2.5 h-1.5 rounded-[2px] bg-paper/15" />)}
        </div>

        <div className="relative grid grid-cols-4 gap-1.5 sm:gap-2">
          {(tiles.length ? tiles : Array.from({ length: 12 }, () => event?.coverImage)).map((src, i) => (
            <div key={i} className="aspect-[4/5] overflow-hidden rounded-[2px] bg-[#2b2622]">
              {src && (
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover blur-[5px] grayscale-[70%] opacity-80 scale-110"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              )}
            </div>
          ))}

          {/* face-finder reticle sweeping the sheet */}
          <motion.div
            aria-hidden
            className="absolute w-[25%] aspect-[4/5] pointer-events-none"
            animate={{ left: ['0%', '50%', '25%', '75%', '0%'], top: ['0%', '34%', '67%', '0%', '0%'] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            style={{ translateZ: 30 }}
          >
            <div className="absolute inset-0 border border-coral/80 rounded-[3px] bg-coral/10" />
            {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((c) => (
              <span key={c} className={`absolute w-3 h-3 border-coral ${c}`} />
            ))}
            <span className="absolute -top-6 left-0 text-[9px] font-bold tracking-[0.2em] text-coral uppercase whitespace-nowrap">Looking…</span>
          </motion.div>
        </div>

        <div className="flex items-center justify-between mt-3 px-1 text-[10px] font-bold tracking-[0.2em] uppercase text-paper/50">
          <span>{event?.eventName || 'Event'}</span>
          <span className="tabular-nums">{count ? `${count} frames` : 'Roll 01'}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ rotate: -8, y: 10, opacity: 0 }}
        animate={{ rotate: -6, y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', bounce: 0.4 }}
        className="absolute -bottom-5 -left-3 sm:-left-6 bg-card border border-line px-4 py-2.5 rounded-sm shadow-lg"
      >
        <span className="display-italic text-lg text-plum">you're in here somewhere.</span>
      </motion.div>
    </div>
  );
}

export function Hero({ event, cameraError, onTakeSelfie }) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center pt-4 sm:pt-10">
        <motion.div
          className="lg:col-span-6 space-y-7"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.p variants={RISE} className="eyebrow flex items-center gap-2"><ScanFace className="w-3.5 h-3.5 text-coral" /> Selfie photo finder</motion.p>
          <motion.h1 variants={RISE} className="display text-[2.75rem] leading-[0.98] sm:text-6xl lg:text-7xl font-medium text-ink">
            Find every photo <span className="display-italic text-plum">you're</span> in.
          </motion.h1>
          <motion.p variants={RISE} className="text-ink-2 text-base sm:text-lg leading-relaxed max-w-md">
            Take one selfie and we'll pull your photos out of{' '}
            <span className="font-semibold text-ink">{event?.eventName || 'the event gallery'}</span> in seconds.
          </motion.p>

          {cameraError && (
            <div role="alert" className="p-4 rounded-xl bg-amber-soft border border-amber/30 text-sm text-[#6b4710] max-w-md">
              <p className="font-semibold">{cameraError}</p>
              <p className="mt-1">Tap the camera icon in your browser's address bar, allow access, then try again.</p>
            </div>
          )}

          <motion.div variants={RISE} className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button onClick={onTakeSelfie} className="btn-plum sheen text-base px-8 py-4 group">
              <Camera className="w-5 h-5 transition-transform group-hover:-rotate-12" /> Take a selfie
            </button>
          </motion.div>
          <p className="text-xs text-ink-3">Your selfie is only used to find your photos.</p>
        </motion.div>

        <div className="lg:col-span-6 px-2 sm:px-6 relative pt-10 sm:pt-0">
          <ContactSheet event={event} />
          {/* the GWC kid flies in over the contact sheet */}
          <Mascot
            pose="rocket"
            say="Ready? Let's find you! 🚀"
            bubble="left"
            delay={0.35}
            className="absolute z-20 -top-6 right-0 sm:-top-14 sm:-right-6 w-32 sm:w-44 lg:w-52"
          />
        </div>
      </div>

      <ol className="mt-20 sm:mt-24 grid grid-cols-1 sm:grid-cols-3 border-t border-line">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`py-6 sm:px-6 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-line' : 'sm:pl-0'}`}
          >
            <span className="display text-3xl text-coral">{s.n}</span>
            <h3 className="mt-2 font-bold text-ink">{s.title}</h3>
            <p className="mt-1 text-sm text-ink-2 leading-relaxed">{s.body}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
