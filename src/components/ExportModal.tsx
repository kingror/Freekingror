import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Film, FolderOpen, Loader2, Share2, X, Zap } from 'lucide-react';
import type {
  AspectRatio,
  ExportFormat,
  ExportResolution,
  ExportSettings,
  MediaAsset,
  SavedGalleryItem,
  TimelineClip,
  TimelineTrack,
} from '../types/editor';
import {
  estimateExportSizeMB,
  getRealExportCapabilities,
  renderProjectExport,
  type ExportResult,
} from '../engine/exporter';
import {
  SOCIAL_EXPORT_PRESETS,
  findMatchingSocialPresetId,
  type SocialExportPreset,
} from '../engine/exportPresets';
import { getProjectDuration } from '../engine/timelineMath';
import {
  consumeAdFreePassExport,
  formatAdPassRemaining,
  getAdPassStatus,
  saveExportToDeviceGallery,
  shareExportedMedia,
} from '../engine/googleAds';
import { GoogleVideoAdGate } from './GoogleVideoAdGate';
import { GalleryExportSuccessView } from './GalleryExportSuccessView';

const EXPORT_ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:5', '21:9'];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  projectTitle: string;
  aspectRatio: AspectRatio;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAsset[];
  savedGallery: SavedGalleryItem[];
  onSaveToGallery: (
    result: ExportResult,
    adUnitId: string,
    renderedAspectRatio?: AspectRatio
  ) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  projectTitle,
  aspectRatio,
  clips,
  tracks,
  assets,
  savedGallery,
  onSaveToGallery,
}) => {
  const [activeView, setActiveView] = useState<'export' | 'gallery'>('export');
  const [exportAspectRatio, setExportAspectRatio] = useState<AspectRatio>(aspectRatio);
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    bitrateMbps: 16,
  });
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [adUnlocked, setAdUnlocked] = useState(false);
  const [verifiedAdUnitId, setVerifiedAdUnitId] = useState('');
  const [adPassBadge, setAdPassBadge] = useState<string | null>(null);
  const [galleryMsg, setGalleryMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setExportAspectRatio(aspectRatio);
    }
  }, [open, aspectRatio]);

  const handleAdUnlock = useCallback((adUnitId: string, passLabel?: string) => {
    setVerifiedAdUnitId(adUnitId);
    setAdUnlocked(true);
    setAdPassBadge(passLabel || 'Ad-Free Pro Pass Activated');
  }, []);

  if (!open) return null;

  const durationSec = Math.max(1, getProjectDuration(clips));
  const estMB = estimateExportSizeMB(durationSec, settings.bitrateMbps, settings.format);
  const capabilities = getRealExportCapabilities(settings.format);
  const livePass = getAdPassStatus();
  const activePresetId = findMatchingSocialPresetId(exportAspectRatio, settings);

  const handleStartExport = async (
    overrideSettings?: ExportSettings,
    overrideAspectRatio?: AspectRatio
  ) => {
    const activeSettings = overrideSettings ?? settings;
    const activeAr = overrideAspectRatio ?? exportAspectRatio;
    if (overrideSettings) setSettings(overrideSettings);
    if (overrideAspectRatio) setExportAspectRatio(overrideAspectRatio);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus('rendering');
    setProgress(0);
    setErrorMsg('');
    setResult(null);

    const activePass = getAdPassStatus();
    if (activePass.hasActivePass) {
      const nextPass = consumeAdFreePassExport();
      setAdUnlocked(true);
      setVerifiedAdUnitId(activePass.lastAdUnitId);
      setAdPassBadge(
        `Ad-Free Pass Active · ${nextPass.remainingExports} exports / ${formatAdPassRemaining(activePass.remainingMs)} left`
      );
    } else {
      setAdUnlocked(false);
      setVerifiedAdUnitId('');
      setAdPassBadge(null);
    }

    try {
      const res = await renderProjectExport({
        clips,
        tracks,
        assets,
        aspectRatio: activeAr,
        settings: activeSettings,
        projectTitle,
        onProgress: setProgress,
        signal: ctrl.signal,
      });
      setResult(res);
      setStatus('done');
    } catch (err) {
      if ((err as Error).message === 'Export cancelled') {
        setStatus('idle');
      } else {
        setErrorMsg((err as Error).message || 'Export failed');
        setStatus('error');
      }
    }
  };

  const applySocialPreset = (preset: SocialExportPreset, renderImmediately: boolean) => {
    const nextSettings: ExportSettings = {
      format: preset.format,
      resolution: preset.resolution,
      fps: preset.fps,
      bitrateMbps: preset.bitrateMbps,
    };
    setExportAspectRatio(preset.aspectRatio);
    setSettings(nextSettings);
    if (renderImmediately) {
      void handleStartExport(nextSettings, preset.aspectRatio);
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setStatus('idle');
    onClose();
  };

  const handleGalleryDownload = async (item: SavedGalleryItem) => {
    if (!item.blob) return;
    const res = await saveExportToDeviceGallery({
      blob: item.blob,
      blobUrl: item.blobUrl,
      filename: item.filename,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
    });
    setGalleryMsg(res.message);
  };

  const handleGalleryShare = async (item: SavedGalleryItem) => {
    if (!item.blob) return;
    const res = await shareExportedMedia(
      {
        blob: item.blob,
        blobUrl: item.blobUrl,
        filename: item.filename,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
      },
      projectTitle
    );
    setGalleryMsg(res.message);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Export Video Studio"
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-white/10 bg-[#11141C] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Film className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">Export & Gallery Studio</h2>
              <p
                data-testid="export-modal-summary"
                className="text-[11px] font-mono-tabular text-zinc-400"
              >
                {exportAspectRatio} · {durationSec.toFixed(1)}s · Est. {estMB} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Export Dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Switcher: Export Master vs Saved Gallery */}
        <div className="shrink-0 px-5 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0B0D12] border border-white/10">
            <button
              type="button"
              onClick={() => setActiveView('export')}
              className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                activeView === 'export'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Export Master
            </button>
            <button
              type="button"
              onClick={() => setActiveView('gallery')}
              className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                activeView === 'gallery'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Saved Gallery ({savedGallery.length})</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-4">
          {activeView === 'gallery' ? (
            <div className="space-y-3" data-testid="studio-gallery-list">
              {galleryMsg && (
                <p className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
                  {galleryMsg}
                </p>
              )}
              {savedGallery.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0B0D12] p-6 text-center space-y-2">
                  <FolderOpen className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-medium text-zinc-300">No Saved Exports Yet</p>
                  <p className="text-xs text-zinc-500">
                    Render your timeline, complete the Google Test Video Ad verification, and tap Save to Gallery.
                  </p>
                </div>
              ) : (
                savedGallery.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-[#0D1017] p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{item.filename}</p>
                        <p className="text-[11px] font-mono-tabular text-zinc-400">
                          {item.aspectRatio} · {(item.sizeBytes / 1024).toFixed(0)} KB · Ad Verified
                        </p>
                      </div>
                      <span className="text-[10px] font-mono-tabular text-zinc-500 shrink-0">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {item.mimeType.startsWith('video/') ? (
                      <video
                        src={item.blobUrl}
                        controls
                        playsInline
                        className="w-full max-h-[130px] rounded-lg bg-black border border-white/10"
                      />
                    ) : (
                      <audio src={item.blobUrl} controls className="w-full h-9" />
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleGalleryDownload(item)}
                        className="min-h-[38px] rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save Again</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGalleryShare(item)}
                        className="min-h-[38px] rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-200 hover:bg-sky-500/30 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* One-Tap Social Media & Codec Presets */}
              <div className="space-y-2" data-testid="export-social-presets">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Social Media & Codec Presets
                  </span>
                  <span className="text-[10px] font-mono-tabular text-amber-300/90">
                    Tap preset or quick-render
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {SOCIAL_EXPORT_PRESETS.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        role="group"
                        aria-label={`${preset.label} preset`}
                        className={`rounded-xl border transition-colors flex flex-col justify-between p-2 gap-1.5 ${
                          isActive
                            ? 'border-amber-400 bg-amber-500/15'
                            : 'border-white/10 bg-[#161A24] hover:border-white/25'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={status === 'rendering'}
                          data-testid={`export-preset-${preset.id}`}
                          aria-pressed={isActive}
                          onClick={() => applySocialPreset(preset, false)}
                          className="text-left focus:outline-none disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-white truncate">
                              {preset.label}
                            </span>
                            <span className="text-[10px] font-mono-tabular text-amber-300 shrink-0">
                              {preset.aspectRatio}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono-tabular text-zinc-400 mt-0.5 truncate">
                            {preset.codecBadge}
                          </p>
                        </button>
                        <button
                          type="button"
                          disabled={status === 'rendering'}
                          data-testid={`export-preset-render-${preset.id}`}
                          aria-label={`One-tap render ${preset.label}`}
                          onClick={() => applySocialPreset(preset, true)}
                          className="w-full min-h-[28px] rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-45"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Render</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aspect Ratio Quick Selector */}
              {settings.format !== 'wav' && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300 block">
                    Export Aspect Ratio
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {EXPORT_ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        disabled={status === 'rendering'}
                        data-testid={`export-ar-${ar.replace(':', 'x')}`}
                        aria-pressed={exportAspectRatio === ar}
                        onClick={() => setExportAspectRatio(ar)}
                        className={`min-h-[34px] rounded-lg border text-xs font-mono-tabular font-semibold transition-colors ${
                          exportAspectRatio === ar
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-white/10 bg-[#161A24] text-zinc-300 hover:bg-[#1E2330]'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Format */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300 block">Container Format</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['mp4', 'webm', 'mov', 'gif', 'wav'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      disabled={status === 'rendering'}
                      onClick={() => setSettings((s) => ({ ...s, format: fmt }))}
                      className={`min-h-[38px] rounded-lg border text-xs font-mono-tabular font-semibold uppercase transition-colors ${
                        settings.format === fmt
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-white/10 bg-[#161A24] text-zinc-300 hover:bg-[#1E2330]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] font-mono-tabular text-zinc-400">
                  Encoder: {capabilities.activeCodecLabel} ·{' '}
                  {capabilities.offlineAudioMixdown ? '44.1kHz Offline Audio DSP' : 'Audio Direct'}
                  {capabilities.webCodecsVideoEncoder ? ' · WebCodecs Ready' : ''}
                </p>
              </div>

              {/* Resolution */}
              {settings.format !== 'wav' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="export-res-select"
                      className="text-xs font-medium text-zinc-300 block"
                    >
                      Resolution
                    </label>
                    <select
                      id="export-res-select"
                      disabled={status === 'rendering'}
                      value={settings.resolution}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          resolution: e.target.value as ExportResolution,
                        }))
                      }
                      className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#161A24] px-3 text-xs text-white"
                    >
                      <option value="2160p">4K Ultra HD (2160p)</option>
                      <option value="1080p">Full HD (1080p)</option>
                      <option value="720p">HD Ready (720p)</option>
                      <option value="480p">Compact (480p)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="export-fps-select"
                      className="text-xs font-medium text-zinc-300 block"
                    >
                      Frame Rate
                    </label>
                    <select
                      id="export-fps-select"
                      disabled={status === 'rendering'}
                      value={settings.fps}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fps: Number(e.target.value) as 24 | 30 | 60 }))
                      }
                      className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#161A24] px-3 text-xs font-mono-tabular text-white"
                    >
                      <option value={24}>24 fps (Cinema)</option>
                      <option value={30}>30 fps (Standard)</option>
                      <option value={60}>60 fps (Ultra Smooth)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Bitrate */}
              {settings.format !== 'wav' && settings.format !== 'gif' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">Encoding Bitrate</span>
                    <span className="font-mono-tabular text-amber-300">
                      {settings.bitrateMbps} Mbps
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={50}
                    step={2}
                    disabled={status === 'rendering'}
                    value={settings.bitrateMbps}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, bitrateMbps: Number(e.target.value) }))
                    }
                    aria-label="Encoding Bitrate"
                    className="w-full studio-slider"
                  />
                </div>
              )}

              {/* Render Progress */}
              {status === 'rendering' && (
                <div className="rounded-xl border border-white/10 bg-[#0B0D12] p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200 flex items-center gap-2 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      Compositing & Encoding Frames...
                    </span>
                    <span className="font-mono-tabular text-amber-300">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full bg-amber-500 transition-all duration-150"
                    />
                  </div>
                </div>
              )}

              {livePass.hasActivePass && status === 'idle' && (
                <div
                  data-testid="ad-pass-status-banner"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200 flex items-center justify-between gap-2"
                >
                  <span>Ad-Free Export Pass Active (No Waiting)</span>
                  <span className="font-mono-tabular text-emerald-300">
                    {livePass.remainingExports} exports · {formatAdPassRemaining(livePass.remainingMs)}
                  </span>
                </div>
              )}

              {/* Step 2: Non-intrusive Google Video Ad Pass Gate (skipped automatically when pass is active) */}
              {status === 'done' && result && !adUnlocked && (
                <GoogleVideoAdGate filename={result.filename} onUnlock={handleAdUnlock} />
              )}

              {/* Step 3: Unlocked Save to Gallery + Native Share Panel */}
              {status === 'done' && result && adUnlocked && (
                <div className="space-y-2">
                  {adPassBadge && (
                    <div
                      data-testid="export-ad-pass-badge"
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200"
                    >
                      {adPassBadge}
                    </div>
                  )}
                  <GalleryExportSuccessView
                    result={result}
                    projectTitle={projectTitle}
                    verifiedAdUnitId={verifiedAdUnitId}
                    onSavedToGallery={(res, adId) => onSaveToGallery(res, adId, exportAspectRatio)}
                  />
                </div>
              )}

              {status === 'error' && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="pt-1 flex items-center gap-2">
                {status === 'rendering' ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="w-full min-h-[44px] rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-zinc-200 hover:bg-white/10"
                  >
                    Cancel Render
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleStartExport()}
                    className="w-full min-h-[44px] rounded-xl bg-amber-500 text-sm font-semibold text-zinc-950 hover:bg-amber-400 active:scale-[0.99] transition-all"
                  >
                    {status === 'done' ? 'Render New Version' : 'Render & Export'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
