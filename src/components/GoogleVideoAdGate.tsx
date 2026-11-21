import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Film,
  Play,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
  GOOGLE_ADMOB_REWARDED_INTERSTITIAL_TEST_ID,
  GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
  consumeCourtesyFreeExport,
  getAdPassStatus,
  getGoogleTestAdUnit,
  loadGoogleImaSdk,
  recordVideoAdRewardCompleted,
  type GoogleAdFormat,
} from '../engine/googleAds';

interface GoogleVideoAdGateProps {
  filename: string;
  onUnlock: (adUnitId: string, passLabel?: string) => void;
}

export const GoogleVideoAdGate: React.FC<GoogleVideoAdGateProps> = ({ filename, onUnlock }) => {
  const [adFormat, setAdFormat] = useState<GoogleAdFormat>('rewarded');
  const unit = getGoogleTestAdUnit(adFormat);
  const [countdown, setCountdown] = useState<number>(unit.skipAfterSec);
  const [sdkStatus, setSdkStatus] = useState<'initializing' | 'ima-live' | 'vast-preview'>(
    'initializing'
  );
  const [muted, setMuted] = useState<boolean>(true);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [courtesyAvailable, setCourtesyAvailable] = useState<boolean>(
    () => getAdPassStatus().courtesyGraceAvailable
  );

  const adContainerRef = useRef<HTMLDivElement | null>(null);
  const videoStubRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onUnlockRef = useRef(onUnlock);
  const rewardClaimedRef = useRef(false);
  onUnlockRef.current = onUnlock;

  const completeWithReward = () => {
    if (rewardClaimedRef.current) return;
    rewardClaimedRef.current = true;
    setUnlocked(true);
    recordVideoAdRewardCompleted(adFormat, unit.adUnitId);
    onUnlockRef.current(unit.adUnitId, unit.passLabel);
  };

  // Attempt genuine Google IMA HTML5 SDK initialization with safe fallback
  useEffect(() => {
    let cancelled = false;
    rewardClaimedRef.current = false;
    setSdkStatus('initializing');
    setCountdown(unit.skipAfterSec);
    setUnlocked(false);
    setCourtesyAvailable(getAdPassStatus().courtesyGraceAvailable);

    let adsManager: { destroy?: () => void } | null = null;
    let adsLoader: { destroy?: () => void } | null = null;

    const initIma = async () => {
      const ok = await loadGoogleImaSdk(2400);
      if (cancelled) return;

      const googleObj = (
        window as unknown as {
          google?: {
            ima?: {
              AdDisplayContainer: new (container: HTMLElement, video: HTMLVideoElement) => {
                initialize: () => void;
              };
              AdsLoader: new (container: unknown) => {
                addEventListener: (
                  event: string,
                  cb: (ev: unknown) => void,
                  capture?: boolean
                ) => void;
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
        const displayContainer = new ima.AdDisplayContainer(
          adContainerRef.current,
          videoStubRef.current
        );
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
            if (!cancelled && !rewardClaimedRef.current) {
              rewardClaimedRef.current = true;
              recordVideoAdRewardCompleted(adFormat, unit.adUnitId);
              setUnlocked(true);
              onUnlockRef.current(unit.adUnitId, unit.passLabel);
            }
          });
          mgr.addEventListener(ima.AdEvent.Type.SKIPPED, () => {
            if (!cancelled && !rewardClaimedRef.current) {
              rewardClaimedRef.current = true;
              recordVideoAdRewardCompleted(adFormat, unit.adUnitId);
              setUnlocked(true);
              onUnlockRef.current(unit.adUnitId, unit.passLabel);
            }
          });
          mgr.init(420, 180, ima.ViewMode.NORMAL);
          mgr.start();
          setSdkStatus('ima-live');
        });

        loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => {
          if (!cancelled) setSdkStatus('vast-preview');
        });

        const req = new ima.AdsRequest();
        req.adTagUrl = `${unit.vastTagUrl}${Date.now()}`;
        req.linearAdSlotWidth = 420;
        req.linearAdSlotHeight = 180;
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
  }, [adFormat, unit.adUnitId, unit.skipAfterSec, unit.vastTagUrl, unit.passLabel]);

  // Short non-intrusive countdown
  useEffect(() => {
    if (unlocked) return;
    const deadline = Date.now() + unit.skipAfterSec * 1000;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(rem);
      if (rem <= 0) {
        window.clearInterval(timer);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [adFormat, unit.skipAfterSec, unlocked]);

  // Smooth animated preview on fallback VAST canvas
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
      grad.addColorStop(0, '#0b1120');
      grad.addColorStop(0.55, '#111c33');
      grad.addColorStop(1, '#070a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = h * 0.5 + Math.sin(x * 0.025 + t * 2.8) * 20;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RORN Sponsor Clip · Ad-Free Pass Reward', w / 2, h * 0.38);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(unit.adUnitId, w / 2, h * 0.53);

      ctx.fillStyle = '#34d399';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${unit.passLabel} · ${filename}`, w / 2, h * 0.69);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sdkStatus, unit.adUnitId, unit.passLabel, filename]);

  return (
    <div
      className="rounded-2xl border border-cyan-500/30 bg-[#0B0F18] p-3.5 space-y-2.5"
      data-testid="google-video-ad-gate"
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 min-w-0">
            <Crown className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">Unlock 20m Ad-Free Pro Export Pass</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setAdFormat('rewarded')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                adFormat === 'rewarded'
                  ? 'bg-cyan-400 text-zinc-950'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title={GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID}
            >
              Rewarded (5x)
            </button>
            <button
              type="button"
              onClick={() => setAdFormat('rewardedInterstitial')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                adFormat === 'rewardedInterstitial'
                  ? 'bg-cyan-400 text-zinc-950'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title={GOOGLE_ADMOB_REWARDED_INTERSTITIAL_TEST_ID}
            >
              Hybrid (3x)
            </button>
            <button
              type="button"
              onClick={() => setAdFormat('interstitial')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                adFormat === 'interstitial'
                  ? 'bg-cyan-400 text-zinc-950'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title={GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID}
            >
              Quick (2s)
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-zinc-400">
          <span className="truncate text-cyan-200/90">{unit.adUnitId}</span>
          <span className="text-emerald-300 font-sans font-medium shrink-0">
            {unit.passLabel}
          </span>
        </div>
      </div>

      {/* Video Ad Viewport */}
      <div className="relative w-full h-[144px] sm:h-[160px] rounded-xl overflow-hidden border border-white/10 bg-black">
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
          <canvas ref={canvasRef} width={480} height={190} className="w-full h-full block" />
        )}

        <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
          <span className="px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono-tabular text-cyan-300 border border-cyan-500/30">
            Google Ads · {unit.label}
          </span>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute Ad Audio' : 'Mute Ad Audio'}
            className="pointer-events-auto min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg bg-black/70 text-zinc-200 hover:text-white"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono-tabular text-zinc-300 bg-black/75 px-2 py-1 rounded">
            <Film className="w-3 h-3 inline mr-1 text-cyan-400" />
            {sdkStatus === 'ima-live' ? 'Google IMA Live' : 'VAST Test Preview'}
          </span>

          {countdown > 0 ? (
            <span className="px-2.5 py-1 rounded-lg bg-black/80 text-[11px] font-mono-tabular text-zinc-200 border border-white/15">
              Ready in {countdown}s
            </span>
          ) : (
            <button
              type="button"
              data-testid="ad-claim-pass-btn"
              onClick={completeWithReward}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-semibold hover:bg-emerald-400 flex items-center gap-1.5 shadow-lg min-h-[34px]"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Claim Ad-Free Pass & Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Zero-frustration creator controls */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 flex-wrap">
        <span className="flex items-center gap-1 text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Watch once = next 5 saves have zero ads.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {courtesyAvailable && countdown > 0 && (
            <button
              type="button"
              data-testid="ad-courtesy-skip-btn"
              onClick={() => {
                if (rewardClaimedRef.current) return;
                rewardClaimedRef.current = true;
                consumeCourtesyFreeExport();
                setCourtesyAvailable(false);
                setUnlocked(true);
                onUnlockRef.current(unit.adUnitId, 'Courtesy Fast Export');
              }}
              className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 font-semibold flex items-center gap-1 text-[11px]"
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Skip Wait (1 Free)</span>
            </button>
          )}
          {countdown === 0 && (
            <button
              type="button"
              onClick={completeWithReward}
              className="text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1"
            >
              {unlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
