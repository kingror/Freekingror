import type { ExportResult } from './exporter';

/**
 * Official Google AdMob & Google IMA Test Ad Unit IDs (safe for development/testing).
 * Reference: https://developers.google.com/admob/android/test-ads
 */
export const GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID = 'ca-app-pub-3940256099942544/5224354917';
export const GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID = 'ca-app-pub-3940256099942544/8691691433';
export const GOOGLE_IMA_VAST_TEST_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=';

export type GoogleAdFormat = 'rewarded' | 'interstitial';

export function getGoogleTestAdUnit(format: GoogleAdFormat = 'rewarded'): {
  adUnitId: string;
  vastTagUrl: string;
  label: string;
  skipAfterSec: number;
} {
  if (format === 'interstitial') {
    return {
      adUnitId: GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
      vastTagUrl: GOOGLE_IMA_VAST_TEST_TAG,
      label: 'Google Interstitial Video (Test ID)',
      skipAfterSec: 4,
    };
  }
  return {
    adUnitId: GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
    vastTagUrl: GOOGLE_IMA_VAST_TEST_TAG,
    label: 'Google Rewarded Video (Test ID)',
    skipAfterSec: 5,
  };
}

let imaLoadPromise: Promise<boolean> | null = null;

/**
 * Dynamically loads Google's IMA HTML5 SDK (`ima3.js`) with a bounded timeout
 * so offline PWAs and hermetic environments never deadlock.
 */
export function loadGoogleImaSdk(timeoutMs = 3200): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  const win = window as unknown as { google?: { ima?: unknown } };
  if (win.google?.ima) {
    return Promise.resolve(true);
  }
  if (imaLoadPromise) return imaLoadPromise;

  imaLoadPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-ima-sdk="true"]'
    );
    if (existing) {
      existing.addEventListener('load', () => {
        clearTimeout(timer);
        finish(Boolean((window as unknown as { google?: { ima?: unknown } }).google?.ima));
      });
      existing.addEventListener('error', () => {
        clearTimeout(timer);
        finish(false);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
    script.async = true;
    script.dataset.googleImaSdk = 'true';
    script.onload = () => {
      clearTimeout(timer);
      finish(Boolean((window as unknown as { google?: { ima?: unknown } }).google?.ima));
    };
    script.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    document.head.appendChild(script);
  });

  return imaLoadPromise;
}

/**
 * Saves an exported video/audio file to the user's device gallery / Downloads folder
 * cleanly without blocking in cross-origin iframes or Android WebViews.
 */
export async function saveExportToDeviceGallery(
  result: ExportResult
): Promise<{ method: 'download'; message: string }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { method: 'download', message: 'Prepared export file.' };
  }

  const a = document.createElement('a');
  a.href = result.blobUrl;
  a.download = result.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return {
    method: 'download',
    message: `Saved "${result.filename}" to device gallery & Studio Gallery.`,
  };
}

/**
 * Invokes the native Android/Mobile Web Share Sheet with the exported media file
 * (`navigator.share({ files })`), or gracefully falls back to clipboard + download.
 */
export async function shareExportedMedia(
  result: ExportResult,
  projectTitle: string
): Promise<{ mode: 'native-file' | 'native-text' | 'clipboard'; message: string }> {
  if (typeof navigator === 'undefined') {
    return { mode: 'clipboard', message: 'Share ready.' };
  }

  const cleanMime = result.mimeType.split(';')[0] || 'video/webm';
  const file = result.blob ? new File([result.blob], result.filename, { type: cleanMime }) : null;
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({
      files: [file],
      title: `${projectTitle} · KineForge Studio`,
      text: `Edited with KineForge Studio (${result.filename})`,
    });
    return {
      mode: 'native-file',
      message: `Shared "${result.filename}" via native share sheet.`,
    };
  }

  if (nav.share) {
    try {
      await nav.share({
        title: `${projectTitle} · KineForge Studio`,
        text: `Check out "${result.filename}" rendered in KineForge Studio.`,
      });
      return {
        mode: 'native-text',
        message: `Shared project details for "${result.filename}".`,
      };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
    }
  }

  const summary = `${projectTitle} — ${result.filename} (${Math.max(1, Math.round(result.sizeBytes / 1024))} KB)`;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(summary).catch(() => {});
  }
  return {
    mode: 'clipboard',
    message: `Share summary copied (${result.filename}). Use Save to Gallery to transfer or attach the video file.`,
  };
}
