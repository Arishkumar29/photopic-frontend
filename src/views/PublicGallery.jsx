import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { apiFetch, resolveMediaUrl } from '../lib/api';
import { downloadPhotosAsZip } from '../lib/zipHelper';
import { Masthead, OrganizerLink } from '../components/Masthead';
import { Hero } from './gallery/Hero';
import { CameraView } from './gallery/CameraView';
import { ScanView, PreparingView } from './gallery/ScanView';
import { Results } from './gallery/Results';
import { Lightbox } from './gallery/Lightbox';
import { INDEX_POLL_MS, loadImageToCanvas, filterString, DEFAULT_FILTERS, triggerDownload } from './gallery/utils';

// Restores the selfie + matches saved for this event (only when it was the last one scanned).
function restoreSaved(eventId, key) {
  try {
    if (!eventId || localStorage.getItem('photopic_active_event_id') !== eventId) return null;
    const savedMatches = localStorage.getItem(`photopic_matched_photos_${eventId}`);
    const savedSelfie = localStorage.getItem(`photopic_selfie_${eventId}`);
    if (savedSelfie && savedMatches) {
      const parsed = JSON.parse(savedMatches);
      if (Array.isArray(parsed) && parsed.length > 0) return key === 'selfie' ? savedSelfie : parsed;
    }
  } catch {}
  return null;
}

function rememberSelfie(eventId, dataUrl) {
  try {
    localStorage.setItem('photopic_active_event_id', eventId);
    localStorage.setItem(`photopic_selfie_${eventId}`, dataUrl);
  } catch {}
}

export function PublicGallery({ eventData, onBack }) {
  const [currentEvent, setCurrentEvent] = useState(eventData);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(() => restoreSaved(eventData?.eventId, 'selfie'));
  const [matchedPhotos, setMatchedPhotos] = useState(() => restoreSaved(eventData?.eventId, 'matches'));
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState('prepare');
  // Index progress while the event's photos are still being processed on the server.
  const [indexing, setIndexing] = useState(null);
  const scanAbort = useRef(null);
  const [scanError, setScanError] = useState(null);
  // Selfie quality from the server ({score, faces, issues}) for the coach and tips.
  const [quality, setQuality] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // Where the tapped card sits on screen, so the lightbox can zoom out of it.
  const [lightboxOrigin, setLightboxOrigin] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFilters, setEditFilters] = useState(DEFAULT_FILTERS);
  const [activePreset, setActivePreset] = useState('original');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(null);

  const eventId = currentEvent?.eventId || eventData?.eventId;
  const activeEvent = currentEvent || eventData;

  const handleDownloadAllZip = async () => {
    if (!matchedPhotos || matchedPhotos.length === 0 || isZipping) return;
    setIsZipping(true);
    setZipProgress({ current: 0, total: matchedPhotos.length });
    try {
      const eventTitle = activeEvent?.eventName || 'GWC_PhotoSync';
      const safeName = eventTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadPhotosAsZip(matchedPhotos, `${safeName}_matched_photos.zip`, (current, total) => {
        setZipProgress({ current, total });
      });
    } catch (err) {
      console.error('ZIP download error:', err);
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  // Load full event details (photos, index status) whenever the event changes.
  useEffect(() => {
    if (eventData?.eventId) {
      setCurrentEvent(eventData);
      setStream(null);
      setIsScanning(false);
      setScanError(null);
      setCameraError(null);

      apiFetch(`/api/events/${eventData.eventId}`)
        .then((res) => res.json())
        .then((data) => { if (data.event) setCurrentEvent(data.event); })
        .catch(() => {
          apiFetch('/api/events')
            .then((res) => res.json())
            .then((data) => {
              const matched = data.events?.find((e) => e.eventId === eventData.eventId);
              if (matched) setCurrentEvent(matched);
            })
            .catch(console.error);
        });

      setPhoto(restoreSaved(eventData.eventId, 'selfie'));
      setMatchedPhotos(restoreSaved(eventData.eventId, 'matches'));
    } else {
      apiFetch('/api/events')
        .then((res) => res.json())
        .then((data) => { if (data.events?.length) setCurrentEvent(data.events[0]); })
        .catch(console.error);
    }
  }, [eventData?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count one visit per event opened.
  useEffect(() => {
    if (eventId) apiFetch(`/api/events/${eventId}/track-visit`, { method: 'POST' }).catch(() => {});
  }, [eventId]);

  const getFilterString = () => filterString(activePreset, editFilters);

  const handleDownload = async (url) => {
    setIsDownloading(true);
    try {
      if (eventId) await apiFetch(`/api/events/${eventId}/track-download`, { method: 'POST' }).catch(() => {});
      const response = await fetch(url);
      const blob = await response.blob();
      const hasEdits = isEditing && (activePreset !== 'original'
        || Object.keys(DEFAULT_FILTERS).some((k) => editFilters[k] !== DEFAULT_FILTERS[k]));

      if (hasEdits) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.filter = getFilterString();
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((edited) => {
            if (!edited) return;
            const blobUrl = URL.createObjectURL(edited);
            triggerDownload(blobUrl, `photopic_${eventId || 'event'}_edited.jpg`);
            URL.revokeObjectURL(blobUrl);
          }, 'image/jpeg', 0.95);
        };
        img.src = url;
      } else {
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl, `photopic_${eventId || 'event'}_photo.jpg`);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.error('Blob download failed, falling back to new tab', err);
      window.open(url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  // Clears the previous scan before a new selfie (camera or upload).
  const resetForNewSelfie = () => {
    try {
      if (eventId) {
        localStorage.removeItem(`photopic_matched_photos_${eventId}`);
        localStorage.removeItem(`photopic_selfie_${eventId}`);
      }
    } catch {}
    scanAbort.current?.abort();
    setPhoto(null);
    setMatchedPhotos(null);
    setIndexing(null);
    setScanError(null);
    setQuality(null);
    setCameraError(null);
  };

  const startCamera = async () => {
    resetForNewSelfie();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError("We couldn't open your camera. Allow camera access in your browser and try again.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setPhoto(dataUrl);
    rememberSelfie(eventId || 'evt_sample', dataUrl);
    stopCamera();
    findMyPhotos(dataUrl);
  };

  // Upload path: works without a camera (desktop, the admin's preview iframe).
  const openUpload = () => fileInputRef.current?.click();
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires onChange
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') return;
      stopCamera();
      resetForNewSelfie();
      setPhoto(reader.result);
      rememberSelfie(eventId, reader.result);
      findMyPhotos(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // `silent` re-runs a scan in the background (after indexing finishes) without
  // replacing the results on screen with the scanning animation.
  const findMyPhotos = async (photoDataUrl, { silent = false, final = false } = {}) => {
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    if (!silent) {
      setIsScanning(true);
      setScanStage('prepare');
      setScanError(null);
    }
    const fail = (type) => {
      setScanError(type);
      setMatchedPhotos([]);
      setIndexing(null);
    };
    try {
      const canvas = await loadImageToCanvas(photoDataUrl);
      const referenceImage = canvas.toDataURL('image/jpeg', 0.9);
      setScanStage('search');

      const response = await apiFetch('/api/scan-faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, referenceImage }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (data.quality || !silent) setQuality(data.quality || null);
      if (response.status === 422 && data.error === 'no_face') return fail('no_face');
      if (response.status === 404) return fail('not_found');
      if (response.status === 429) return fail('rate_limited');
      if (!response.ok) throw new Error(data.error || 'Failed to scan photos');

      const list = [...new Set((data.matches || []).map(resolveMediaUrl).filter(Boolean))];
      setScanError(null);
      setMatchedPhotos(list);
      // `final`: we've stopped waiting on the index, so don't start polling again.
      const stillIndexing = final ? null : data.indexing || null;
      setIndexing(stillIndexing);
      try {
        localStorage.setItem('photopic_active_event_id', eventId);
        if (stillIndexing) localStorage.removeItem(`photopic_matched_photos_${eventId}`);
        else localStorage.setItem(`photopic_matched_photos_${eventId}`, JSON.stringify(list));
      } catch {}
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      if (!silent) fail('network');
    } finally {
      if (scanAbort.current === controller) {
        scanAbort.current = null;
        setIsScanning(false);
      }
    }
  };

  const cancelScan = () => {
    scanAbort.current?.abort();
    scanAbort.current = null;
    setIsScanning(false);
    setIndexing(null);
    setMatchedPhotos(null);
    setScanError(null);
    setPhoto(null);
  };

  // While the event is still being indexed, follow its progress and re-scan once
  // it finishes, so the guest gets complete results without doing anything.
  // On serverless hosting nothing indexes in the background, so each poll also
  // advances the index a step (POST index-step; older servers: GET index-status).
  const indexingActive = Boolean(indexing);
  useEffect(() => {
    if (!indexingActive || !photo || !eventId) return;
    let stopped = false;
    let lastDone = -1;
    let stalls = 0;
    let stepSupported = true;
    const finish = () => { stopped = true; findMyPhotos(photo, { silent: true, final: true }); };
    const poll = async () => {
      try {
        let res = stepSupported ? await apiFetch(`/api/events/${eventId}/index-step`, { method: 'POST' }) : null;
        if (!res || res.status === 404 || res.status === 405) {
          stepSupported = false;
          res = await apiFetch(`/api/events/${eventId}/index-status`);
        }
        if (!res.ok) return;
        const status = await res.json();
        if (stopped) return;
        if (status.state === 'ready') return finish();
        if (status.state === 'indexing') { setIndexing(status); stalls = 0; lastDone = status.done; return; }
        // pending / partial: still moving? Some photos may never index (unreadable
        // files), so stop waiting once progress has stalled for a few polls.
        if (status.done > lastDone) { stalls = 0; lastDone = status.done; setIndexing(status); return; }
        if (++stalls >= 3) finish();
      } catch {}
    };
    poll();
    const timer = setInterval(poll, INDEX_POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [indexingActive, photo, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setActivePreset('original');
    setEditFilters(DEFAULT_FILTERS);
  };

  const showPhoto = (i) => {
    setLightboxOrigin(null);
    setLightboxIndex(i);
    setIsEditing(false);
    resetFilters();
  };

  const openLightbox = (i, rect) => {
    showPhoto(i);
    setLightboxOrigin(rect || null);
    if (eventId) apiFetch(`/api/events/${eventId}/track-view`, { method: 'POST' }).catch(() => {});
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setIsEditing(false);
    resetFilters();
  };

  // Lock page scroll while the lightbox is open (cleanup also runs on unmount).
  const lightboxOpen = lightboxIndex !== null;
  useEffect(() => {
    if (!lightboxOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [lightboxOpen]);

  const count = matchedPhotos?.length || 0;
  const nextPhoto = () => { if (lightboxIndex !== null && count) showPhoto((lightboxIndex + 1) % count); };
  const prevPhoto = () => { if (lightboxIndex !== null && count) showPhoto((lightboxIndex - 1 + count) % count); };

  // Swipe left/right between photos on touch screens
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) nextPhoto(); else prevPhoto();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, matchedPhotos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeEvent?.eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
          <p className="eyebrow mb-3">Event not found</p>
          <h2 className="display text-4xl font-medium mb-4">Looking for a party?</h2>
          <p className="text-ink-2 leading-relaxed mb-8">
            This event link has ended or hasn't opened yet. Double-check your QR code or ask the event host.
          </p>
          <button onClick={onBack} className="btn-ink px-7 py-3">See all events</button>
        </motion.div>
      </div>
    );
  }

  const step = stream ? 'camera'
    : isScanning ? 'scanning'
    : (indexing && !matchedPhotos?.length && !scanError) ? 'preparing'
    : (matchedPhotos || scanError) ? 'results'
    : 'hero';
  const eventPhotoCount = activeEvent?.indexStatus?.total || activeEvent?.driveFiles?.length || 0;

  const handleLogoClick = () => {
    stopCamera();
    cancelScan();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col">
        <Masthead
          onBack={onBack}
          onLogo={handleLogoClick}
          title={activeEvent?.eventName || 'Event Gallery'}
          subtitle={`by ${activeEvent?.orgName || 'Organizer'}`}
          right={<OrganizerLink />}
        />

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <AnimatePresence mode="wait">
            {step === 'hero' && (
              <motion.div key="hero">
                <Hero event={activeEvent} cameraError={cameraError} onTakeSelfie={startCamera} onUpload={openUpload} />
              </motion.div>
            )}
            {step === 'camera' && (
              <CameraView key="camera" stream={stream} videoRef={videoRef} onCapture={capturePhoto} onClose={stopCamera} onUpload={openUpload} />
            )}
            {step === 'scanning' && (
              <ScanView key="scanning" selfie={photo} stage={scanStage} photoCount={eventPhotoCount} onCancel={cancelScan} />
            )}
            {step === 'preparing' && (
              <PreparingView key="preparing" selfie={photo} indexing={indexing} onCancel={cancelScan} />
            )}
            {step === 'results' && (
              <Results
                key="results"
                photo={photo}
                matchedPhotos={matchedPhotos}
                scanError={scanError}
                quality={quality}
                indexing={indexing}
                isZipping={isZipping}
                zipProgress={zipProgress}
                onZip={handleDownloadAllZip}
                onRetake={startCamera}
                onUpload={openUpload}
                onOpen={openLightbox}
                onDownload={handleDownload}
              />
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t border-line mt-10">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-4 text-xs text-ink-3">
            <span>PhotoPic by GWC DATA.AI</span>
            <OrganizerLink />
          </div>
        </footer>

        <Lightbox
          photos={matchedPhotos}
          index={lightboxIndex}
          origin={lightboxOrigin}
          onClose={closeLightbox}
          onNext={nextPhoto}
          onPrev={prevPhoto}
          onJump={showPhoto}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          activePreset={activePreset}
          setActivePreset={setActivePreset}
          editFilters={editFilters}
          setEditFilters={setEditFilters}
          filter={getFilterString()}
          isDownloading={isDownloading}
          onDownload={handleDownload}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    </MotionConfig>
  );
}
