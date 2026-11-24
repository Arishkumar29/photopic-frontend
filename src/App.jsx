import { useState, useEffect } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'motion/react';
import { PublicGallery } from './views/PublicGallery';
import { MyEvents } from './views/MyEvents';
import { Masthead, OrganizerLink } from './components/Masthead';
import { Mascot } from './components/Mascot';

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

const eventFromUrl = () => {
  const id = new URLSearchParams(window.location.search).get('event');
  return id ? { eventId: id, orgName: 'Event Guest', eventName: 'Photo Gallery' } : null;
};

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function App() {
  const [publicData, setPublicData] = useState(() => {
    const fromUrl = eventFromUrl();
    if (fromUrl) return fromUrl;
    if (window.location.hash === '#public') {
      try {
        const saved = localStorage.getItem('photopic_public_data');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const activeTab = publicData ? 'public' : 'events';

  // Browser Back/Forward between the catalog and an event.
  useEffect(() => {
    const onPop = () => setPublicData(eventFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openEvent = (event) => {
    try { localStorage.setItem('photopic_public_data', JSON.stringify(event)); } catch {}
    if (!window.location.search.includes(`event=${event.eventId}`)) {
      window.history.pushState(null, '', `/?event=${event.eventId}`);
    }
    setPublicData(event);
    window.scrollTo({ top: 0 });
  };

  const backToEvents = () => {
    if (window.location.search) window.history.pushState(null, '', '/');
    setPublicData(null);
    window.scrollTo({ top: 0 });
  };

  // An event restored from #public still gets a proper shareable URL.
  useEffect(() => {
    if (publicData?.eventId && !window.location.search.includes(`event=${publicData.eventId}`)) {
      window.history.replaceState(null, '', `/?event=${publicData.eventId}`);
    }
  }, [publicData?.eventId]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-paper paper-grain text-ink overflow-x-hidden">
        <AnimatePresence mode="wait">
        {activeTab === 'public' ? (
          <motion.div key={`event-${publicData.eventId}`} {...PAGE}>
            <PublicGallery eventData={publicData} onBack={backToEvents} />
          </motion.div>
        ) : (
          <motion.div key="catalog" {...PAGE} className="min-h-screen flex flex-col">
            <Masthead onLogo={backToEvents} right={<OrganizerLink />} />

            <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6">
              {/* issue masthead */}
              <section className="relative pt-10 sm:pt-16 pb-10 text-center">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3 border-b border-ink pb-2">
                  <span>{today}</span>
                  <span className="hidden sm:inline">Event photos, found by face</span>
                  <span>Free for guests</span>
                </div>
                <h1 className="display text-[3.2rem] leading-[0.95] sm:text-8xl lg:text-[8.5rem] font-medium tracking-tight py-6 sm:py-8">
                  The PhotoPic <span className="display-italic text-plum">Edition</span>
                </h1>
                {/* the GWC kid greets guests: inline with the tagline on phones, beside the title on desktop */}
                <div className="border-t border-line pt-4 max-w-xl mx-auto flex items-center justify-center gap-3 text-left lg:text-center">
                  <Mascot pose="welcome" className="w-16 sm:w-20 shrink-0 lg:hidden" />
                  <p className="text-ink-2 text-sm sm:text-base">
                    <span className="lg:hidden font-semibold text-ink">Vanakkam! 👋 </span>
                    Pick your event, take a selfie, and get every photo you're in. No sign-up needed.
                  </p>
                </div>
                <Mascot
                  pose="welcome"
                  say="Vanakkam! Pick your event 👋"
                  bubble="left-low"
                  delay={0.3}
                  className="hidden lg:block absolute right-0 bottom-0 w-32 xl:w-36"
                />
              </section>

              <MyEvents onSelectEvent={openEvent} />
            </main>

            <footer className="border-t border-line mt-20">
              <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-3">
                <span>PhotoPic by GWC DATA.AI · Solution matters</span>
                <OrganizerLink />
              </div>
            </footer>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
