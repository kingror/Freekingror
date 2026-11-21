import type { ExportResult } from './exporter';

/**
 * Official Google AdMob & Google IMA Test Ad Unit IDs (safe for development/testing).
 * Reference: https://developers.google.com/admob/android/test-ads
 */
export const GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID = 'ca-app-pub-3940256099942544/5224354917';
export const GOOGLE_ADMOB_REWARDED_INTERSTITIAL_TEST_ID = 'ca-app-pub-3940256099942544/5354046379';
export const GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID = 'ca-app-pub-3940256099942544/8691691433';
export const GOOGLE_IMA_VAST_TEST_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=';

export type GoogleAdFormat = 'rewarded' | 'rewardedInterstitial' | 'interstitial';

export const AD_FREE_REWARDED_PASS_MS = 20 * 60 * 1000; // 20 minutes ad-free per single rewarded view
export const AD_FREE_REWARDED_QUOTA = 5; // Up to 5 consecutive exports unlocked without re-watching
export const AD_FREE_INTERSTITIAL_PASS_MS = 8 * 60 * 1000; // 8 minutes quiet cooldown
export const AD_FREE_INTERSTITIAL_QUOTA = 2;
export const AD_PASS_STORAGE_KEY = 'rorn_ad_pass_v1';

export interface AdPacingState {
  passExpiresAt: number;
  remainingFreeExports: number;
  courtesyGraceUsed: boolean;
  lastAdUnitId: string;
  totalAdsWatched: number;
}

const DEFAULT_PACING_STATE: AdPacingState = {
  passExpiresAt: 0,
  remainingFreeExports: 0,
  courtesyGraceUsed: false,
  lastAdUnitId: GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
  totalAdsWatched: 0,
};

let memoryFallbackState: AdPacingState = { ...DEFAULT_PACING_STATE };

function readAdPacingState(): AdPacingState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...memoryFallbackState };
  }
  try {
    const raw = window.localStorage.getItem(AD_PASS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PACING_STATE };
    const parsed = JSON.parse(raw) as Partial<AdPacingState>;
    return {
      passExpiresAt: Number(parsed.passExpiresAt) || 0,
      remainingFreeExports: Math.max(0, Number(parsed.remainingFreeExports) || 0),
      courtesyGraceUsed: Boolean(parsed.courtesyGraceUsed),
      lastAdUnitId:
        typeof parsed.lastAdUnitId === 'string' && parsed.lastAdUnitId
          ? parsed.lastAdUnitId
          : GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
      totalAdsWatched: Math.max(0, Number(parsed.totalAdsWatched) || 0),
    };
  } catch {
    return { ...memoryFallbackState };
  }
}

function writeAdPacingState(state: AdPacingState): void {
  memoryFallbackState = { ...state };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(AD_PASS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota / private-browsing exceptions
    }
  }
}

export function resetAdPacingStateForTests(): void {
  writeAdPacingState({ ...DEFAULT_PACING_STATE });
}

export interface AdPassStatus {
  hasActivePass: boolean;
  remainingMs: number;
  remainingExports: number;
  courtesyGraceAvailable: boolean;
  lastAdUnitId: string;
  totalAdsWatched: number;
}

/**
 * Checks whether the user has an active Ad-Free Export Pass (earned by watching 1 short video ad)
 * so repeated exports never frustrate or nag the creator.
 */
export function getAdPassStatus(nowMs = Date.now()): AdPassStatus {
  const s = readAdPacingState();
  const remainingMs = Math.max(0, s.passExpiresAt - nowMs);
  const hasActivePass = remainingMs > 0 && s.remainingFreeExports > 0;
  return {
    hasActivePass,
    remainingMs,
    remainingExports: hasActivePass ? s.remainingFreeExports : 0,
    courtesyGraceAvailable: !s.courtesyGraceUsed,
    lastAdUnitId: s.lastAdUnitId,
    totalAdsWatched: s.totalAdsWatched,
  };
}

/**
 * Consumes 1 export slot from the active Ad-Free Pass when exporting without an ad wall.
 */
export function consumeAdFreePassExport(nowMs = Date.now()): AdPassStatus {
  const s = readAdPacingState();
  if (s.passExpiresAt > nowMs && s.remainingFreeExports > 0) {
    s.remainingFreeExports = Math.max(0, s.remainingFreeExports - 1);
    writeAdPacingState(s);
  }
  return getAdPassStatus(nowMs);
}

/**
 * Records completion of a Google Video Ad and rewards the creator with a generous
 * Ad-Free Pro Pass (5 exports / 20 minutes for Rewarded, 3 exports / 12m for Rewarded Interstitial,
 * or 2 exports / 8m for Interstitial) so they are never interrupted back-to-back.
 */
export function recordVideoAdRewardCompleted(
  format: GoogleAdFormat,
  adUnitId: string,
  nowMs = Date.now()
): AdPassStatus {
  const s = readAdPacingState();
  const bonusMs =
    format === 'rewarded'
      ? AD_FREE_REWARDED_PASS_MS
      : format === 'rewardedInterstitial'
      ? 12 * 60 * 1000
      : AD_FREE_INTERSTITIAL_PASS_MS;
  const bonusQuota =
    format === 'rewarded'
      ? AD_FREE_REWARDED_QUOTA
      : format === 'rewardedInterstitial'
      ? 3
      : AD_FREE_INTERSTITIAL_QUOTA;

  const next: AdPacingState = {
    passExpiresAt: nowMs + bonusMs,
    remainingFreeExports: Math.max(s.remainingFreeExports, bonusQuota),
    courtesyGraceUsed: s.courtesyGraceUsed,
    lastAdUnitId: adUnitId,
    totalAdsWatched: s.totalAdsWatched + 1,
  };
  writeAdPacingState(next);
  return getAdPassStatus(nowMs);
}

/**
 * Lets a busy creator use a 1-time Courtesy Skip ("Export Now, Watch Later")
 * so they never feel locked out during an urgent edit.
 */
export function consumeCourtesyFreeExport(nowMs = Date.now()): AdPassStatus {
  const s = readAdPacingState();
  s.courtesyGraceUsed = true;
  writeAdPacingState(s);
  return getAdPassStatus(nowMs);
}

export function formatAdPassRemaining(remainingMs: number): string {
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${mins}m`;
}

export function getGoogleTestAdUnit(format: GoogleAdFormat = 'rewarded'): {
  adUnitId: string;
  vastTagUrl: string;
  label: string;
  skipAfterSec: number;
  passLabel: string;
} {
  if (format === 'interstitial') {
    return {
      adUnitId: GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
      vastTagUrl: GOOGLE_IMA_VAST_TEST_TAG,
      label: 'Interstitial Video (Test ID)',
      skipAfterSec: 2,
      passLabel: 'Unlocks 2 exports / 8m ad-free',
    };
  }
  if (format === 'rewardedInterstitial') {
    return {
      adUnitId: GOOGLE_ADMOB_REWARDED_INTERSTITIAL_TEST_ID,
      vastTagUrl: GOOGLE_IMA_VAST_TEST_TAG,
      label: 'Rewarded Interstitial (Test ID)',
      skipAfterSec: 3,
      passLabel: 'Unlocks 3 exports / 12m ad-free',
    };
  }
  return {
    adUnitId: GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
    vastTagUrl: GOOGLE_IMA_VAST_TEST_TAG,
    label: 'Rewarded Pro Pass (Test ID)',
    skipAfterSec: 3,
    passLabel: 'Unlocks 5 exports / 20m Ad-Free Pro Pass',
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
      title: `${projectTitle} · RORN`,
      text: `Edited with RORN (${result.filename})`,
    });
    return {
      mode: 'native-file',
      message: `Shared "${result.filename}" via native share sheet.`,
    };
  }

  if (nav.share) {
    try {
      await nav.share({
        title: `${projectTitle} · RORN`,
        text: `Check out "${result.filename}" rendered in RORN.`,
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
