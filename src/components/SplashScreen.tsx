import React, { useEffect, useState } from 'react';
import { APP_DISPLAY_NAME, SPLASH_EXIT_FADE_MS } from '../engine/splashProgress';
import {
  formatBytesRead,
  runRealAppBoot,
  type BootResult,
} from '../engine/appBootLoader';
import type { MediaElementCache } from '../engine/compositor';
import { RornLogo } from './RornLogo';

interface SplashScreenProps {
  mediaCache?: MediaElementCache | null;
  onComplete: (result: BootResult) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ mediaCache, onComplete }) => {
  const [progress, setProgress] = useState<number>(1);
  const [stageLabel, setStageLabel] = useState<string>('Scanning app files...');
  const [bytesInfo, setBytesInfo] = useState<{ read: number; total: number }>({
    read: 0,
    total: 0,
  });
  const [exiting, setExiting] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;
    let mounted = true;

    runRealAppBoot(
      (update) => {
        if (!mounted) return;
        setProgress(update.progress);
        setStageLabel(update.stageLabel);
        setBytesInfo({ read: update.bytesRead, total: update.totalBytes });
      },
      controller.signal,
      mediaCache
    )
      .then((result) => {
        if (!mounted || controller.signal.aborted) return;
        setProgress(100);
        setStageLabel('Ready');
        setBytesInfo((prev) => ({
          read: Math.max(prev.read, result.bytesRead),
          total: Math.max(prev.total, result.bytesRead),
        }));
        rafId = requestAnimationFrame(() => {
          if (!mounted) return;
          setExiting(true);
          exitTimer = setTimeout(() => {
            if (mounted) onComplete(result);
          }, SPLASH_EXIT_FADE_MS);
        });
      })
      .catch(() => {
        if (!mounted || controller.signal.aborted) return;
        setProgress(100);
        onComplete({ ambientWavUrl: '', elapsedMs: 0, bytesRead: 0, filesLoaded: 0 });
      });

    return () => {
      mounted = false;
      controller.abort();
      if (rafId) cancelAnimationFrame(rafId);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [mediaCache, onComplete]);

  return (
    <div
      data-testid="rorn-splash-screen"
      data-progress={progress}
      aria-busy={progress < 100}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070A12] px-6 transition-opacity duration-200 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Cool Arctic Cyan + Indigo studio glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-96 w-96 rounded-full bg-gradient-to-tr from-cyan-500/15 via-sky-500/12 to-indigo-500/15 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-6 rounded-[30px] p-2 shadow-[0_24px_60px_rgba(8,20,40,0.85)] ring-1 ring-cyan-400/20 bg-[#0B111E]">
          <RornLogo size={100} animated />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-[0.28em] pl-[0.28em] rorn-wordmark-cool">
          {APP_DISPLAY_NAME}
        </h1>

        {/* Real file-read 1% to 100% loading bar */}
        <div className="mt-10 w-full">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-sky-100/80 truncate">
              {stageLabel}
            </span>
            <span
              data-testid="rorn-splash-percent"
              className="font-mono-tabular text-xs font-semibold text-cyan-300 shrink-0"
            >
              {progress}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Loading RORN"
            aria-valuemin={1}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80 border border-cyan-400/20"
          >
            <div
              data-testid="rorn-splash-fill"
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-center font-mono-tabular text-[11px] text-slate-400">
            <span>
              {bytesInfo.total > 0
                ? `${formatBytesRead(bytesInfo.read)} / ${formatBytesRead(bytesInfo.total)}`
                : 'Reading device files'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
