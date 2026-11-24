import { useEffect, useMemo } from 'react';
import { motion, motionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';

// The GWC kid: our guide through the selfie flow. Transparent WebP, ~30 KB each.
const SRC = {
  welcome: '/welcome_mascot.webp',
  rocket: '/mascot_rocket.webp',
  sad: '/mascot_sad.webp',
  handshake: '/mascot_handshake.webp',
};

// One shared pointer position (-1..1) for every mascot on the page: a single
// window listener, no React state, so following the pointer costs nothing per frame.
const pointerX = motionValue(0);
const pointerY = motionValue(0);
let listening = false;
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pointermove', (e) => {
    pointerX.set((e.clientX / window.innerWidth) * 2 - 1);
    pointerY.set((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

// Idle loops per pose: the rocket flies, the sad kid bobs, the others breathe.
const IDLE = {
  welcome: { animate: { y: [0, -6, 0], scale: [1, 1.012, 1] }, transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } },
  handshake: { animate: { y: [0, -8, 0], rotate: [0, 1.5, 0] }, transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } },
  sad: { animate: { y: [0, 4, 0], rotate: [0, -1.5, 0] }, transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } },
  rocket: { animate: { y: [0, -14, 4, 0], x: [0, 6, -4, 0], rotate: [-2, 3, -1, -2] }, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } },
};

const ENTER = {
  welcome: { initial: { opacity: 0, y: 40, scale: 0.85 }, animate: { opacity: 1, y: 0, scale: 1 } },
  handshake: { initial: { opacity: 0, scale: 0.6, rotate: -8 }, animate: { opacity: 1, scale: 1, rotate: 0 } },
  sad: { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } },
  rocket: { initial: { opacity: 0, x: -120, y: 60, rotate: -18 }, animate: { opacity: 1, x: 0, y: 0, rotate: 0 } },
};

/**
 * <Mascot pose="rocket" say="Let's go!" bubble="left" className="w-40" />
 * Decorative by default (alt=""), never captures taps.
 */
export function Mascot({ pose = 'welcome', say, bubble = 'left', className = '', delay = 0, follow = true, idle = true, alt = '' }) {
  useEffect(listen, []);
  const tilt = useSpring(useTransform(pointerX, [-1, 1], [-5, 5]), { stiffness: 60, damping: 14 });
  const lean = useSpring(useTransform(pointerY, [-1, 1], [-4, 4]), { stiffness: 60, damping: 14 });
  const loop = IDLE[pose];
  const enter = ENTER[pose];

  return (
    <motion.div
      // No position class here: callers may place it absolutely. The inner wrapper anchors the bubble.
      className={`pointer-events-none select-none ${className}`}
      initial={enter.initial}
      animate={enter.animate}
      transition={{ type: 'spring', stiffness: 120, damping: 14, delay }}
    >
      <div className="relative">
      <motion.div style={follow ? { rotate: tilt, y: lean } : undefined}>
        <motion.img
          src={SRC[pose]}
          alt={alt}
          draggable={false}
          className="w-full h-auto drop-shadow-[0_18px_22px_rgba(29,26,23,.22)]"
          {...(idle ? { animate: loop.animate, transition: { ...loop.transition, delay: delay + 0.6 } } : {})}
        />
      </motion.div>
      <AnimatePresence>
        {say && <Bubble key={say} side={bubble} delay={delay + 0.45}>{say}</Bubble>}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

const SIDES = {
  left: { box: 'right-[78%] top-[4%]', tail: '-right-1.5 top-5 rotate-45 border-r border-t', origin: 'origin-right' },
  'left-low': { box: 'right-[80%] top-[42%]', tail: '-right-1.5 top-5 rotate-45 border-r border-t', origin: 'origin-right' },
  right: { box: 'left-[78%] top-[4%]', tail: '-left-1.5 top-5 rotate-45 border-l border-b', origin: 'origin-left' },
  top: { box: 'bottom-[92%] left-1/2 -translate-x-1/2', tail: 'left-1/2 -translate-x-1/2 -bottom-1.5 rotate-45 border-r border-b', origin: 'origin-bottom' },
};

export function Bubble({ children, side = 'left', delay = 0, className = '' }) {
  const s = SIDES[side] || SIDES.left;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay }}
      className={`absolute z-10 ${s.box} ${s.origin} ${className}`}
      role="note"
    >
      <div className="relative bg-card border border-line rounded-2xl px-3.5 py-2 shadow-[0_10px_24px_-14px_rgba(29,26,23,.5)] w-max max-w-[11rem] sm:max-w-[14rem]">
        <span className={`absolute w-3 h-3 bg-card border-line ${s.tail}`} />
        <p className="relative text-[13px] sm:text-sm font-semibold leading-snug text-ink">{children}</p>
      </div>
    </motion.div>
  );
}

const CONFETTI_COLORS = ['#6e2b8b', '#da7756', '#a8701c', '#4f7a55', '#c9a2d6'];

// One-shot burst from the centre of its box. Pure motion, no deps, 28 nodes.
export function Confetti({ pieces = 28 }) {
  const bits = useMemo(() => Array.from({ length: pieces }, (_, i) => {
    const angle = (i / pieces) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 120;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.7 - 40,
      r: Math.random() * 540 - 270,
      c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 5 + Math.random() * 5,
      round: i % 3 === 0,
      d: Math.random() * 0.15,
    };
  }), [pieces]);
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-visible">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2"
          style={{ width: b.w, height: b.round ? b.w : b.w * 1.8, background: b.c, borderRadius: b.round ? '50%' : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 160], opacity: [1, 1, 0], rotate: b.r, scale: 1 }}
          transition={{ duration: 1.6, delay: b.d, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
