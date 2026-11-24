// Shared helpers for the selfie → results flow.

// Enter/exit for each step (hero → camera → scanning → results) so AnimatePresence cross-fades.
export const stepMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
};

// Phone selfies can be 12MP+. Matching is just as accurate at 1280px, and the
// upload shrinks from several MB to ~200 KB, which is most of the scan time on 4G.
export const MAX_SELFIE_SIDE = 1280;
export const INDEX_POLL_MS = 4000;

export function loadImageToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SELFIE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Could not read that image. Please try a different photo.'));
    img.src = dataUrl;
  });
}

export function scanErrorCopy(type) {
  if (type === 'no_face') {
    return {
      title: "We couldn't see your face",
      body: 'Make sure your whole face is in the frame, facing the camera, in good light, then try again.',
    };
  }
  if (type === 'not_found') {
    return {
      title: 'This event link has expired',
      body: "We couldn't find this event. Double-check your QR code or ask the host for a new link.",
    };
  }
  if (type === 'rate_limited') {
    return { title: 'Too many scans at once', body: 'Please wait a minute, then try again.' };
  }
  return {
    title: 'Something went wrong',
    body: "We couldn't reach the photo server. Check your connection and try again.",
  };
}

const driveId = (url) => url?.split('/api/drive-proxy/')[1]?.split(/[?#/]/)[0];

// Grid tiles only need ~600px. Load them straight from Google's image CDN instead
// of streaming 1600px originals through our backend; the lightbox and downloads
// still use the full-size proxied photo.
export function thumbFor(photoUrl, width = 600) {
  const id = driveId(photoUrl);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w${width}` : photoUrl;
}

// event.photos holds Drive thumbnail URLs (…/thumbnail?id=… or lh3 links); pull out the id.
export function eventThumb(url, width = 300) {
  if (!url) return '';
  const m = url.match(/[?&]id=([A-Za-z0-9_-]+)/) || url.match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? `https://lh3.googleusercontent.com/d/${m[1]}=w${width}` : url;
}

export function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const PRESETS = [
  { id: 'original', label: 'Original' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'noir', label: 'Noir' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'vivid', label: 'Vivid' },
];

export const DEFAULT_FILTERS = { brightness: 100, contrast: 100, saturation: 100, sepia: 0, hue: 0 };

export function filterString(preset, f) {
  if (preset === 'warm') return 'brightness(105%) contrast(102%) saturate(120%) sepia(20%)';
  if (preset === 'cool') return 'brightness(102%) contrast(105%) saturate(110%) hue-rotate(15deg)';
  if (preset === 'noir') return 'grayscale(100%) contrast(120%)';
  if (preset === 'vintage') return 'sepia(60%) contrast(90%) brightness(105%)';
  if (preset === 'vivid') return 'saturate(150%) contrast(110%)';
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) sepia(${f.sepia}%) hue-rotate(${f.hue}deg)`;
}

// Selfie coaching: the server's quality issues (POST /api/scan-faces → quality.issues)
// turned into friendly, actionable tips. Flagged tips come first; the generic ones
// fill in so a guest with no flagged issue still gets help.
const TIPS = {
  dark: { emoji: '💡', title: 'Find better light', body: 'Face a window or a lamp so your face is evenly lit.' },
  bright: { emoji: '😎', title: 'Too much light', body: 'Step out of direct sun or away from a bright background.' },
  blurry: { emoji: '✋', title: 'Hold still', body: 'Keep the phone steady for a sharp photo, and wipe the lens.' },
  small: { emoji: '🔍', title: 'Come closer', body: 'Your face should fill most of the oval in the viewfinder.' },
  angle: { emoji: '🙂', title: 'Look straight ahead', body: 'Face the camera directly, chin level.' },
  multiple: { emoji: '👤', title: 'Just you, please', body: 'Take the selfie alone so we search for the right person.' },
  partial: { emoji: '🖼️', title: 'Whole face in frame', body: 'Make sure your forehead and chin are both visible.' },
  cover: { emoji: '🕶️', title: 'Nothing covering your face', body: 'Remove sunglasses, masks or hats for the selfie.' },
};

export function coachTips(issues = []) {
  const flagged = issues
    .filter((i) => TIPS[i.code])
    .map((i) => ({ code: i.code, ...TIPS[i.code], body: i.message || TIPS[i.code].body, flagged: true }));
  const generic = ['dark', 'angle', 'small', 'cover']
    .filter((c) => !flagged.some((f) => f.code === c))
    .map((c) => ({ code: c, ...TIPS[c], flagged: false }));
  return [...flagged, ...generic].slice(0, Math.max(3, flagged.length));
}
