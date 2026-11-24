import { ChevronLeft, LockKeyhole } from 'lucide-react';

export const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174').replace(/\/+$/, '');

export function OrganizerLink({ className = '' }) {
  return (
    <a href={ADMIN_URL} className={`inline-flex items-center gap-1.5 text-xs font-bold text-ink-2 hover:text-plum transition-colors ${className}`}>
      <LockKeyhole className="w-3.5 h-3.5" />
      <span className="ink-underline">Organizer login</span>
    </a>
  );
}

// Sticky magazine-style header. `title`/`subtitle` show the current event in serif.
export function Masthead({ onBack, onLogo, title, subtitle, right }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {onBack && (
            <button onClick={onBack} className="btn-quiet !px-2.5 !py-2 rounded-full" aria-label="Back to all events">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button onClick={onLogo} className="shrink-0" aria-label="GWC PhotoPic home">
            <img src="/gwc_logo.png" alt="GWC DATA.AI" className="h-9 sm:h-10 w-auto" />
          </button>
        </div>
        {title && (
          <div className="min-w-0 text-right sm:text-center sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[40vw]">
            <div className="display text-base sm:text-lg font-medium leading-tight truncate">{title}</div>
            {subtitle && <div className="text-[11px] text-ink-3 truncate">{subtitle}</div>}
          </div>
        )}
        <div className={`${title ? 'hidden sm:flex' : 'flex'} items-center gap-3 shrink-0`}>{right}</div>
      </div>
    </header>
  );
}
