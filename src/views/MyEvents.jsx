import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, ArrowUpRight, Image as ImageIcon, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

const SORTS = [
  { value: 'Newest', label: 'Newest first' },
  { value: 'Oldest', label: 'Oldest first' },
  { value: 'Name', label: 'A to Z' },
];

function formatDate(event) {
  const raw = event.eventDate || event.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const photoCount = (e) => e.indexStatus?.total || e.driveFiles?.length || e.photos?.length || 0;

// Real index state from the server, phrased for guests.
function StatusPill({ status, onDark }) {
  const state = status?.state;
  const map = {
    ready: ['Ready to search', 'bg-sage'],
    partial: ['Ready to search', 'bg-sage'],
    indexing: ['Adding photos', 'bg-amber animate-pulse'],
    pending: ['Opening soon', 'bg-ink-3'],
  };
  const [label, dot] = map[state] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${onDark ? 'text-white/90' : 'text-ink-2'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}

function Cover({ event, className }) {
  return event.coverImage ? (
    <img src={event.coverImage} alt="" className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${className || ''}`} />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-paper-2"><ImageIcon className="w-8 h-8 text-ink-3" /></div>
  );
}

function CoverStory({ event, onOpen }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(event)}
      className="group w-full text-left grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center"
    >
      <div className="lg:col-span-7 relative aspect-[16/10] overflow-hidden rounded-sm bg-paper-2">
        <Cover event={event} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4"><StatusPill status={event.indexStatus} onDark /></div>
      </div>
      <div className="lg:col-span-5 space-y-4">
        <p className="eyebrow text-coral">Cover story</p>
        <h2 className="display text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.02]">
          <span className="ink-underline">{event.eventName}</span>
        </h2>
        <p className="text-ink-2">
          by <span className="font-semibold text-ink">{event.orgName || 'Organizer'}</span>
          {formatDate(event) && <> · {formatDate(event)}</>}
        </p>
        {event.eventLocation && <p className="text-sm text-ink-3 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {event.eventLocation}</p>}
        {event.description && <p className="text-ink-2 leading-relaxed line-clamp-3">{event.description}</p>}
        <div className="flex items-center gap-5 pt-2">
          <span className="btn-plum px-6 py-3">Find my photos <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
          <span className="text-sm text-ink-3 tabular-nums">{photoCount(event).toLocaleString()} photos</span>
        </div>
      </div>
    </motion.button>
  );
}

function EventCard({ event, index, onOpen }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', bounce: 0.15, delay: Math.min(index, 8) * 0.05 }}
      onClick={() => onOpen(event)}
      className="group text-left"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-paper-2">
        <Cover event={event} />
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/45 transition-colors duration-300 flex items-end p-4">
          <span className="text-white font-bold text-sm flex items-center gap-1 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            Find my photos <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>
      </div>
      <div className="pt-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={event.indexStatus} />
          <span className="text-xs text-ink-3 tabular-nums">{photoCount(event).toLocaleString()} photos</span>
        </div>
        <h3 className="display text-2xl font-medium leading-tight"><span className="ink-underline">{event.eventName}</span></h3>
        <p className="text-sm text-ink-3">by {event.orgName || 'Organizer'}{formatDate(event) && ` · ${formatDate(event)}`}</p>
      </div>
    </motion.button>
  );
}

export function MyEvents({ onSelectEvent }) {
  const [events, setEvents] = useState(null);
  const [failed, setFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('Newest');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    apiFetch('/api/events')
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => { setFailed(true); setEvents([]); });
  }, []);

  useEffect(() => {
    if (!sortOpen) return;
    const close = (e) => { if (!sortRef.current?.contains(e.target)) setSortOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [sortOpen]);

  const q = searchTerm.trim().toLowerCase();
  const filtered = (events || [])
    .filter((e) => !q || (e.eventName || '').toLowerCase().includes(q) || (e.orgName || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const da = a.createdAt || a.eventId;
      const db = b.createdAt || b.eventId;
      if (sortBy === 'Newest') return db.localeCompare(da);
      if (sortBy === 'Oldest') return da.localeCompare(db);
      return (a.eventName || '').localeCompare(b.eventName || '');
    });

  const [featured, ...rest] = filtered;
  const showFeatured = featured && !q;
  const grid = showFeatured ? rest : filtered;

  return (
    <div className="space-y-12">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-y border-line py-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search events or organizers"
            aria-label="Search events"
            className="w-full bg-transparent pl-7 pr-2 py-2 text-[15px] placeholder:text-ink-3 focus:outline-none"
          />
        </div>
        <div className="relative" ref={sortRef}>
          <button onClick={() => setSortOpen((v) => !v)} aria-expanded={sortOpen} className="btn-quiet">
            Sort: <span className="text-ink">{SORTS.find((s) => s.value === sortBy)?.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute right-0 mt-2 w-48 card shadow-xl p-1.5 z-50"
              >
                {SORTS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSortBy(o.value); setSortOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${sortBy === o.value ? 'bg-plum-soft text-plum font-semibold' : 'hover:bg-paper-2'}`}
                  >
                    {o.label} {sortBy === o.value && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {events === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] bg-paper-2 animate-pulse rounded-sm" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 max-w-md mx-auto">
          <h3 className="display text-3xl font-medium mb-2">{failed ? "Can't reach the server" : 'Nothing here yet'}</h3>
          <p className="text-ink-2">
            {failed ? 'Check your connection and refresh the page.'
              : q ? `No events match "${searchTerm}".` : 'No event galleries are published yet. Use the link or QR code from your host.'}
          </p>
        </div>
      ) : (
        <>
          {showFeatured && <CoverStory event={featured} onOpen={onSelectEvent} />}
          {grid.length > 0 && (
            <section className="space-y-6">
              {showFeatured && (
                <div className="flex items-baseline justify-between border-b border-ink pb-2">
                  <h2 className="display text-2xl font-medium">More events</h2>
                  <span className="text-xs text-ink-3">{grid.length} galleries</span>
                </div>
              )}
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                <AnimatePresence mode="popLayout">
                  {grid.map((e, i) => <EventCard key={e.eventId} event={e} index={i} onOpen={onSelectEvent} />)}
                </AnimatePresence>
              </motion.div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
