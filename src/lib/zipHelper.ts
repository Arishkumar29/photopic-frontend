import JSZip from 'jszip';
import { resolveMediaUrl } from './api';

export type PhotoItem = string | { url: string; name?: string };

/**
 * Downloads an array of image URLs or photo objects as a packaged .zip file directly in the browser.
 * Supports batch concurrency to prevent socket exhaustion and preserves original filenames.
 */
export async function downloadPhotosAsZip(
  photos: PhotoItem[],
  zipFilename: string = 'event_photos.zip',
  onProgress?: (current: number, total: number, name?: string) => void
): Promise<void> {
  if (!photos || photos.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder('photos') || zip;

  let completed = 0;
  const total = photos.length;
  const usedNames = new Set<string>();

  // Helper to sanitize and deduplicate filenames
  const getUniqueName = (desiredName: string, index: number, ext: string): string => {
    let clean = (desiredName || `photo_${String(index + 1).padStart(3, '0')}.${ext}`)
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim();

    // Ensure it has an extension
    if (!clean.toLowerCase().endsWith(`.${ext.toLowerCase()}`) && !clean.includes('.')) {
      clean = `${clean}.${ext}`;
    }

    let unique = clean;
    let counter = 1;
    while (usedNames.has(unique.toLowerCase())) {
      const dotIndex = clean.lastIndexOf('.');
      const base = dotIndex !== -1 ? clean.substring(0, dotIndex) : clean;
      const fileExt = dotIndex !== -1 ? clean.substring(dotIndex) : `.${ext}`;
      unique = `${base} (${counter})${fileExt}`;
      counter++;
    }
    usedNames.add(unique.toLowerCase());
    return unique;
  };

  // Helper to fetch an image blob with Google Drive fallback if needed
  const fetchBlob = async (rawUrl: string): Promise<Blob | null> => {
    let cleanUrl = rawUrl;
    if (cleanUrl.includes('=s')) {
      cleanUrl = cleanUrl.replace(/=s\d+$/, '=s1200');
    }
    const url = resolveMediaUrl(cleanUrl);

    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.blob();
      }
    } catch (e) {
      console.warn(`[zipHelper] Direct fetch failed for ${url}:`, e);
    }

    // Try extracting fileId for Drive proxy or Google CDN fallback
    let fileId: string | null = null;
    if (url.includes('/api/drive-proxy/')) {
      fileId = url.split('/api/drive-proxy/')[1]?.split(/[?#/]/)[0] || null;
    } else if (url.includes('/d/')) {
      fileId = url.split('/d/')[1]?.split(/[=?/]/)[0] || null;
    } else if (url.includes('id=')) {
      fileId = url.split('id=')[1]?.split(/[&#]/)[0] || null;
    }

    if (fileId) {
      // 1. Try local drive-proxy
      try {
        const proxyUrl = resolveMediaUrl(`/api/drive-proxy/${fileId}`);
        const pRes = await fetch(proxyUrl);
        if (pRes.ok) return await pRes.blob();
      } catch (e) {}

      // 2. Try Google CDN fallback
      try {
        const fallbackUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
        const fbRes = await fetch(fallbackUrl);
        if (fbRes.ok) return await fbRes.blob();
      } catch (e) {
        console.warn(`[zipHelper] Google CDN fallback failed for ${fileId}:`, e);
      }
    }

    return null;
  };

  // Process in batches of 5 to avoid socket exhaustion
  const BATCH_SIZE = 5;
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (item, batchIdx) => {
        const index = i + batchIdx;
        const url = typeof item === 'string' ? item : item.url;
        const originalName = typeof item === 'object' && item.name ? item.name : undefined;

        try {
          const blob = await fetchBlob(url);
          if (blob) {
            let ext = 'jpg';
            if (blob.type.includes('png')) ext = 'png';
            else if (blob.type.includes('webp')) ext = 'webp';
            else if (blob.type.includes('jpeg')) ext = 'jpg';

            const fileName = getUniqueName(originalName || '', index, ext);
            folder.file(fileName, blob);
          }
        } catch (err) {
          console.warn(`[zipHelper] Failed to include photo in zip (${url}):`, err);
        } finally {
          completed++;
          if (onProgress) {
            onProgress(completed, total, originalName);
          }
        }
      })
    );
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
}
