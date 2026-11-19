import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Film, Play, ShieldCheck, SkipForward, Volume2, VolumeX } from 'lucide-react';
import {
  GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
  GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
  getGoogleTestAdUnit,
  loadGoogleImaSdk,
  type GoogleAdFormat,
} from '../engine/googleAds';

interface GoogleVideoAdGateProps {
  filename: string;
  onUnlock: (adUnitId: string) => void;
}

export const GoogleVideoAdGate: React.FC<GoogleVideoAdGateProps> = ({ filename, onUnlock }) => {
  const [adFormat, setAdFormat] = useState<GoogleAdFormat>('rewarded');
  const unit = getGoogleTestAdUnit(adFormat);
  const [countdown, setCountdown] = useState<number>(unit.skipAfterSec);
  const [sdkStatus, setSdkStatus] = useState<'initializing' | 'ima-live' | 'vast-preview'>('initializing');
  const [muted, setMuted] = useState<boolean>(true);
  const [unlocked, setUnlocked] = useState<boolean>(false);

  const adContainerRef = useRef<HTMLDivElement | null>(null);
  const videoStubRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Attempt genuine Google IMA HTML5 SDK initialization with safe fallback
  useEffect(() => {
    let cancelled = false;
    setSdkStatus('initializing');
    setCountdown(unit.skipAfterSec);
    setUnlocked(false);

    let adsManager: { destroy?: () => void } | null = null;
    let adsLoader: { destroy?: () => void } | null = null;

    const initIma = async () => {
      const ok = await loadGoogleImaSdk(2800);
      if (cancelled) return;

      const googleObj = (
        window as unknown as {
          google?: {
            ima?: {
              AdDisplayContainer: new (container: HTMLElement, video: HTMLVideoElement) => {
                initialize: () => void;
              };
              AdsLoader: new (container: unknown) => {
                addEventListener: (event: string, cb: (ev: unknown) => void, capture?: boolean) => void;
                requestAds: (req: unknown) => void;
                destroy?: () => void;
              };
              AdsRequest: new () => {
                adTagUrl: string;
                linearAdSlotWidth: number;
                linearAdSlotHeight: number;
              };
              AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
              AdErrorEvent: { Type: { AD_ERROR: string } };
              AdEvent: { Type: { COMPLETE: string; SKIPPED: string; STARTED: string } };
              ViewMode: { NORMAL: number };
            };
          };
        }
      ).google;

      if (!ok || !googleObj?.ima || !adContainerRef.current || !videoStubRef.current) {
        setSdkStatus('vast-preview');
        return;
      }

      try {
        const ima = googleObj.ima;
        const displayContainer = new ima.AdDisplayContainer(adContainerRef.current, videoStubRef.current);
        displayContainer.initialize();
        const loader = new ima.AdsLoader(displayContainer);
        adsLoader = loader;

        loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (ev: unknown) => {
          if (cancelled) return;
          const loadedEv = ev as {
            getAdsManager: (v: HTMLVideoElement) => {
              init: (w: number, h: number, mode: number) => void;
              start: () => void;
              addEventListener: (t: string, cb: () => void) => void;
              destroy?: () => void;
            };
          };
          const mgr = loadedEv.getAdsManager(videoStubRef.current!);
          adsManager = mgr;
          mgr.addEventListener(ima.AdEvent.Type.STARTED, () => {
            if (!cancelled) setSdkStatus('ima-live');
          });
          mgr.addEventListener(ima.AdEvent.Type.COMPLETE, () => {
            if (!cancelled) {
              setUnlocked(true);
              onUnlock(unit.adUnitId);
            }
          });
          mgr.addEventListener(ima.AdEvent.Type.SKIPPED, () => {
            if (!cancelled) {
              setUnlocked(true);
              onUnlock(unit.adUnitId);
            }
          });
          mgr.init(420, 210, ima.ViewMode.NORMAL);
          mgr.start();
          setSdkStatus('ima-live');
        });

        loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => {
          if (!cancelled) setSdkStatus('vast-preview');
        });

        const req = new ima.AdsRequest();
        req.adTagUrl = `${unit.vastTagUrl}${Date.now()}`;
        req.linearAdSlotWidth = 420;
        req.linearAdSlotHeight = 210;
        loader.requestAds(req);
      } catch {
        setSdkStatus('vast-preview');
      }
    };

    initIma();

    return () => {
      cancelled = true;
      try {
        adsManager?.destroy?.();
        adsLoader?.destroy?.();
      } catch {
        // Ignore cleanup exceptions
      }
    };
  }, [adFormat, unit.adUnitId, unit.skipAfterSec, unit.vastTagUrl, onUnlock]);

  // Wall-clock accurate countdown timer for test ad skip / unlock
  useEffect(() => {
    if (unlocked) return;
    const deadline = Date.now() + unit.skipAfterSec * 1000;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(rem);
      if (rem <= 0) {
        window.clearInterval(timer);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [adFormat, unit.skipAfterSec, unlocked]);

  // Smooth animated preview on fallback VAST canvas when IMA slot is offline/blocked
  useEffect(() => {
    if (sdkStatus === 'ima-live') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();
    let lastDraw = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastDraw < 48) return;
      lastDraw = now;
      const t = (now - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.55, '#1e293b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Animated cinematic light wave
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = h * 0.5 + Math.sin(x * 0.025 + t * 2.8) * 24;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Google Video Ads · Official Test Ad', w / 2, h * 0.42);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillText(unit.adUnitId, w / 2, h * 0.56);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `Ad verifies before saving & sharing ${filename}`,
        w / 2,
        h * 0.72
      );
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sdkStatus, unit.adUnitId, filename]);

  return (
    <div
      className="rounded-2xl border border-amber-500/35 bg-[#0C0F16] p-3.5 space-y-3"
      data-testid="google-video-ad-gate"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 min-w-0">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Google Video Ad Required Before Save & Share</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setAdFormat('rewarded')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                adFormat === 'rewarded'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title={GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID}
            >
              Rewarded
            </button>
            <button
              type="button"
              onClick={() => setAdFormat('interstitial')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                adFormat === 'interstitial'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title={GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID}
            >
              Interstitial
            </button>
          </div>
        </div>
        <p className="text-[11px] font-mono-tabular text-zinc-300">
          Test Unit ID: <span className="text-amber-300">{unit.adUnitId}</span>
        </p>
      </div>

      {/* Video Ad Viewport */}
      <div className="relative w-full h-[184px] rounded-xl overflow-hidden border border-white/10 bg-black">
        <video
          ref={videoStubRef}
          playsInline
          muted={muted}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
        />
        <div
          ref={adContainerRef}
          className={`absolute inset-0 ${sdkStatus === 'ima-live' ? 'z-10' : 'pointer-events-none opacity-0'}`}
        />
        {sdkStatus !== 'ima-live' && (
          <canvas
            ref={canvasRef}
            width={480}
            height={210}
            className="w-full h-full block"
          />
        )}

        {/* Ad Overlay Bar */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
          <span className="px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono-tabular text-amber-300 border border-amber-500/30">
            Ad · {unit.label}
          </span>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute Ad Audio' : 'Mute Ad Audio'}
            className="pointer-events-auto min-h-[30px] min-w-[30px] flex items-center justify-center rounded-lg bg-black/70 text-zinc-200 hover:text-white"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono-tabular text-zinc-300 bg-black/70 px-2 py-1 rounded">
            <Film className="w-3 h-3 inline mr-1 text-sky-400" />
            {sdkStatus === 'ima-live' ? 'Google IMA VAST Stream' : 'Google VAST Test Video'}
          </span>

          {countdown > 0 ? (
            <span className="px-2.5 py-1 rounded-lg bg-black/80 text-[11px] font-mono-tabular text-zinc-200 border border-white/15">
              Unlocking in {countdown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setUnlocked(true);
                onUnlock(unit.adUnitId);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-semibold hover:bg-emerald-400 flex items-center gap-1.5 shadow-lg min-h-[36px]"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Unlock Save & Share</span>
            </button>
          )}
        </div>
      </div>

      {/* Explicit action fallback when countdown finishes */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span>
          {countdown > 0
            ? 'Watch the Google Test Video Ad to unlock Gallery Save & Share.'
            : 'Ad verified! Continue to Save to Gallery & Share.'}
        </span>
        {countdown === 0 && (
          <button
            type="button"
            onClick={() => {
              setUnlocked(true);
              onUnlock(unit.adUnitId);
            }}
            className="text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1 shrink-0"
          >
            {unlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            Continue
          </button>
        )}
      </div>
    </div>
  );
};
