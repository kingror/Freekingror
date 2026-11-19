export const SPLASH_DURATION_MS = 1800;
export const SPLASH_EXIT_FADE_MS = 320;
export const APP_DISPLAY_NAME = 'RORN';
export const APP_PACKAGE_NAME = 'com.rorn.pro';

/**
 * Computes an integer loading percentage in [1, 100] from elapsed milliseconds.
 * Uses an ease-out-cubic curve so progress starts briskly at 1% and finishes cleanly at 100%.
 */
export function computeSplashProgress(
  elapsedMs: number,
  durationMs: number = SPLASH_DURATION_MS
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || durationMs <= 0) {
    return 1;
  }
  if (elapsedMs >= durationMs) {
    return 100;
  }
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  // Smooth ease-out-quad/cubic blend, strictly monotonic from 1 to 100
  const eased = 1 - Math.pow(1 - t, 2.2);
  const pct = Math.round(1 + eased * 99);
  return Math.min(100, Math.max(1, pct));
}

export function getSplashStageLabel(progress: number): string {
  if (progress < 25) return 'Booting RORN Core';
  if (progress < 55) return 'Loading Timeline & Color Engine';
  if (progress < 85) return 'Calibrating Audio Mixer & Scopes';
  if (progress < 100) return 'Preparing Studio Workspace';
  return 'Ready';
}

export function shouldSkipSplashFromSearch(search: string): boolean {
  if (!search) return false;
  try {
    const params = new URLSearchParams(search);
    return params.get('autostart') === '1';
  } catch {
    return false;
  }
}
