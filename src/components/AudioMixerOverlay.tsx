import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RotateCcw, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import type { LiveAudioLevelSnapshot } from '../engine/audioEngine';
import {
  DEFAULT_TRACK_PAN,
  DEFAULT_TRACK_VOLUME,
  MAX_TRACK_VOLUME,
  MIN_TRACK_VOLUME,
  estimateTrackLiveMeterLevel,
  formatPanLabel,
  getMixerTracks,
  getTrackPan,
  getTrackVolumePct,
  hasAnySoloAudioTrack,
  isTrackAudible,
  volumePctToDbLabel,
} from '../engine/audioMixer';
import { clamp } from '../engine/timelineMath';

interface AudioMixerOverlayProps {
  open: boolean;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: MediaAsset[];
  playhead: number;
  isPlaying: boolean;
  masterVolumePct: number;
  masterMuted: boolean;
  getLiveAudioLevels?: () => LiveAudioLevelSnapshot;
  onChangeTrackVolume: (trackId: string, volumePct: number) => void;
  onChangeTrackPan: (trackId: string, pan: number) => void;
  onStartTrackDrag?: () => void;
  onCommitTrackDrag?: () => void;
  onToggleTrackFlag: (trackId: string, flag: 'muted' | 'locked' | 'hidden' | 'solo') => void;
  onChangeMasterVolume: (volumePct: number) => void;
  onToggleMasterMute: () => void;
  onAddAudioTrack: () => void;
  onResetMix: () => void;
  onClose: () => void;
}

interface VerticalFaderProps {
  trackId: string;
  label: string;
  valuePct: number;
  muted: boolean;
  accent: 'emerald' | 'sky' | 'amber';
  onStartDrag?: () => void;
  onChange: (nextPct: number) => void;
  onEndDrag?: () => void;
}

const ACCENT_FILL: Record<VerticalFaderProps['accent'], string> = {
  emerald: 'from-emerald-500/80 to-emerald-300/90',
  sky: 'from-sky-500/80 to-cyan-300/90',
  amber: 'from-amber-500/85 to-amber-300/95',
};

const VerticalFader: React.FC<VerticalFaderProps> = ({
  trackId,
  label,
  valuePct,
  muted,
  accent,
  onStartDrag,
  onChange,
  onEndDrag,
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const ratio = clamp((valuePct - MIN_TRACK_VOLUME) / (MAX_TRACK_VOLUME - MIN_TRACK_VOLUME), 0, 1);

  const updateFromClientY = (clientY: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const usableHeight = Math.max(24, rect.height - 16);
    const localY = clamp(clientY - (rect.top + 8), 0, usableHeight);
    const norm = 1 - localY / usableHeight;
    const next = Math.round(MIN_TRACK_VOLUME + norm * (MAX_TRACK_VOLUME - MIN_TRACK_VOLUME));
    onChange(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onStartDrag?.();
    updateFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateFromClientY(e.clientY);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerIdRef.current = null;
    setIsDragging(false);
    onEndDrag?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 15 : 5;
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = clamp(valuePct + step, 0, 200);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = clamp(valuePct - step, 0, 200);
    else if (e.key === 'PageUp') next = clamp(valuePct + 25, 0, 200);
    else if (e.key === 'PageDown') next = clamp(valuePct - 25, 0, 200);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 200;
    if (next !== null) {
      e.preventDefault();
      onStartDrag?.();
      onChange(next);
      onEndDrag?.();
    }
  };

  return (
    <div
      ref={railRef}
      role="slider"
      tabIndex={0}
      aria-label={`Volume for ${label}`}
      aria-valuemin={MIN_TRACK_VOLUME}
      aria-valuemax={MAX_TRACK_VOLUME}
      aria-valuenow={valuePct}
      aria-valuetext={`${valuePct}% (${volumePctToDbLabel(valuePct)})`}
      data-testid={`mixer-fader-${trackId}`}
      data-volume={valuePct}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onKeyDown={handleKeyDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartDrag?.();
        onChange(DEFAULT_TRACK_VOLUME);
        onEndDrag?.();
      }}
      title="Drag vertically to adjust volume · Double-click to reset to 0 dB"
      className={`relative w-11 h-full min-h-[76px] flex items-center justify-center cursor-ns-resize touch-none select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        isDragging ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
      }`}
    >
      {/* Fader Groove */}
      <div className="relative w-1.5 h-[calc(100%-16px)] rounded-full bg-white/12 overflow-hidden">
        {/* Unity 0dB (100%) center tick */}
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/40 z-10 pointer-events-none" />
        {/* Active level fill */}
        <div
          style={{ height: `${ratio * 100}%` }}
          className={`absolute bottom-0 left-0 right-0 rounded-full transition-opacity ${
            muted ? 'bg-zinc-600/50' : `bg-gradient-to-t ${ACCENT_FILL[accent]}`
          }`}
        />
      </div>

      {/* Unity side ticks */}
      <div className="absolute left-1 right-1 top-1/2 flex justify-between pointer-events-none">
        <span className="w-1.5 h-[1px] bg-white/30" />
        <span className="w-1.5 h-[1px] bg-white/30" />
      </div>

      {/* Tactile Fader Cap */}
      <div
        style={{ bottom: `calc(${ratio} * (100% - 22px) + 4px)` }}
        className={`absolute left-1/2 -translate-x-1/2 w-7 h-3.5 rounded border shadow-md flex items-center justify-center pointer-events-none transition-transform ${
          isDragging
            ? 'scale-110 border-amber-300 bg-zinc-100'
            : muted
            ? 'border-zinc-500 bg-zinc-700'
            : 'border-white/50 bg-zinc-200'
        }`}
      >
        <span className="w-4 h-[1.5px] rounded-full bg-zinc-900/80" />
      </div>
    </div>
  );
};

const SegmentMeter: React.FC<{ level01: number; clipping: boolean; muted: boolean }> = ({
  level01,
  clipping,
  muted,
}) => {
  const segments = 10;
  const activeCount = muted ? 0 : Math.round(clamp(level01, 0, 1) * segments);
  return (
    <div
      aria-hidden="true"
      className="w-2.5 h-[calc(100%-12px)] my-auto flex flex-col-reverse gap-[2px] py-1 px-0.5 rounded bg-black/35 border border-white/10"
    >
      {Array.from({ length: segments }).map((_, idx) => {
        const lit = idx < activeCount;
        const colorCls =
          idx >= 8
            ? clipping || lit
              ? 'bg-rose-400'
              : 'bg-white/10'
            : idx >= 6
            ? lit
              ? 'bg-amber-400'
              : 'bg-white/10'
            : lit
            ? 'bg-emerald-400'
            : 'bg-white/10';
        return <span key={idx} className={`flex-1 rounded-[1px] ${colorCls}`} />;
      })}
    </div>
  );
};

export const AudioMixerOverlay: React.FC<AudioMixerOverlayProps> = ({
  open,
  tracks,
  clips,
  assets,
  playhead,
  isPlaying,
  masterVolumePct,
  masterMuted,
  getLiveAudioLevels,
  onChangeTrackVolume,
  onChangeTrackPan,
  onStartTrackDrag,
  onCommitTrackDrag,
  onToggleTrackFlag,
  onChangeMasterVolume,
  onToggleMasterMute,
  onAddAudioTrack,
  onResetMix,
  onClose,
}) => {
  const [liveMasterSnap, setLiveMasterSnap] = useState<LiveAudioLevelSnapshot>({
    rms: 0,
    peak: 0,
    peakDb: -Infinity,
    clipping: false,
  });

  useEffect(() => {
    if (!open || !isPlaying || !getLiveAudioLevels) {
      setLiveMasterSnap({ rms: 0, peak: 0, peakDb: -Infinity, clipping: false });
      return;
    }
    let raf = 0;
    const poll = () => {
      setLiveMasterSnap(getLiveAudioLevels());
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [open, isPlaying, getLiveAudioLevels]);

  const mixerTracks = useMemo(() => getMixerTracks(tracks, clips), [tracks, clips]);
  const anySolo = useMemo(() => hasAnySoloAudioTrack(tracks), [tracks]);

  const trackMeters = useMemo(() => {
    const map = new Map<string, ReturnType<typeof estimateTrackLiveMeterLevel>>();
    const effectiveMaster = masterMuted ? 0 : masterVolumePct;
    for (const tr of mixerTracks) {
      map.set(
        tr.id,
        estimateTrackLiveMeterLevel(
          tr,
          tracks,
          clips,
          assets,
          playhead,
          isPlaying,
          effectiveMaster
        )
      );
    }
    return map;
  }, [mixerTracks, tracks, clips, assets, playhead, isPlaying, masterVolumePct, masterMuted]);

  const masterMeterLevel01 = useMemo(() => {
    if (masterMuted) return 0;
    if (isPlaying && liveMasterSnap.peak > 0.005) {
      return clamp(liveMasterSnap.peak, 0, 1);
    }
    let maxVal = 0;
    for (const m of trackMeters.values()) {
      maxVal = Math.max(maxVal, m.level01);
    }
    return maxVal;
  }, [masterMuted, isPlaying, liveMasterSnap.peak, trackMeters]);

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Multi-Track Audio Mixer"
      data-testid="audio-mixer-overlay"
      className="absolute inset-x-0 top-10 bottom-0 z-40 border-t border-white/15 bg-[#090C13]/82 backdrop-blur-xl flex flex-col overflow-hidden shadow-[0_-16px_48px_rgba(0,0,0,0.6)]"
    >
      {/* Compact Mixer Overlay Bar */}
      <div className="h-8 shrink-0 px-3 border-b border-white/10 bg-white/[0.04] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-white whitespace-nowrap">Audio Mixer</span>
          <span className="hidden sm:inline text-[11px] text-zinc-400 truncate">
            {mixerTracks.length} {mixerTracks.length === 1 ? 'track' : 'tracks'} · Multi-track simultaneous bus
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAddAudioTrack}
            data-testid="mixer-add-track-btn"
            className="min-h-[26px] px-2 flex items-center gap-1 rounded-md border border-emerald-400/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-[11px] font-semibold text-emerald-200 whitespace-nowrap transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add Track</span>
          </button>
          <button
            type="button"
            onClick={onResetMix}
            data-testid="mixer-reset-btn"
            aria-label="Reset All Track Volumes"
            className="min-h-[26px] px-2 flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] text-[11px] font-medium text-zinc-200 whitespace-nowrap transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="mixer-close-btn"
            aria-label="Close Audio Mixer"
            className="min-h-[26px] min-w-[26px] px-1.5 flex items-center justify-center rounded-md border border-white/15 bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Channel Strips + Master Output Strip */}
      <div className="flex-1 min-h-0 flex items-stretch overflow-hidden">
        <div className="flex-1 min-w-0 flex items-stretch gap-2 px-2.5 py-1.5 overflow-x-auto overflow-y-hidden studio-scroll">
          {mixerTracks.map((tr) => {
            const vol = getTrackVolumePct(tr);
            const pan = getTrackPan(tr);
            const audible = isTrackAudible(tr, tracks);
            const meter = trackMeters.get(tr.id);
            const clipCount = clips.filter((c) => c.trackId === tr.id).length;

            return (
              <div
                key={tr.id}
                data-testid={`mixer-channel-${tr.id}`}
                className={`w-[126px] sm:w-[136px] shrink-0 rounded-xl border p-1.5 flex flex-col justify-between backdrop-blur-md transition-colors ${
                  tr.solo
                    ? 'border-amber-400/55 bg-amber-500/[0.09]'
                    : !audible
                    ? 'border-white/10 bg-white/[0.02] opacity-75'
                    : 'border-white/12 bg-white/[0.05]'
                }`}
              >
                {/* Strip Top Header: Track Name + Mute/Solo */}
                <div className="flex items-center justify-between gap-1 shrink-0">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate leading-tight">
                      {tr.label}
                    </div>
                    <div className="text-[9px] text-zinc-400 truncate leading-tight">
                      {tr.role} · {clipCount}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(tr.id, 'muted')}
                      aria-label={`Mute ${tr.label}`}
                      aria-pressed={tr.muted}
                      data-testid={`mixer-mute-${tr.id}`}
                      className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${
                        tr.muted
                          ? 'bg-rose-500/80 text-white'
                          : 'bg-white/[0.07] text-zinc-300 hover:bg-white/[0.15]'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(tr.id, 'solo')}
                      aria-label={`Solo ${tr.label}`}
                      aria-pressed={Boolean(tr.solo)}
                      data-testid={`mixer-solo-${tr.id}`}
                      className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${
                        tr.solo
                          ? 'bg-amber-400 text-zinc-950'
                          : anySolo
                          ? 'bg-white/[0.04] text-zinc-500 hover:bg-white/[0.12]'
                          : 'bg-white/[0.07] text-zinc-300 hover:bg-white/[0.15]'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>

                {/* Vertical Fader + Live Signal Meter */}
                <div className="flex-1 min-h-0 flex items-stretch justify-center gap-2 py-0.5">
                  <VerticalFader
                    trackId={tr.id}
                    label={tr.label}
                    valuePct={vol}
                    muted={!audible}
                    accent={tr.type === 'audio' ? 'emerald' : 'sky'}
                    onStartDrag={onStartTrackDrag}
                    onChange={(nextVol) => onChangeTrackVolume(tr.id, nextVol)}
                    onEndDrag={onCommitTrackDrag}
                  />
                  <SegmentMeter
                    level01={meter?.level01 ?? 0}
                    clipping={Boolean(meter?.clipping)}
                    muted={!audible || masterMuted}
                  />
                </div>

                {/* Gain Readout + Pan Slider */}
                <div className="shrink-0 space-y-1">
                  <div
                    data-testid={`mixer-readout-${tr.id}`}
                    className="flex items-center justify-between text-[10px] font-mono-tabular px-0.5"
                  >
                    <span className={vol > 100 ? 'text-amber-300 font-semibold' : 'text-zinc-200'}>
                      {vol}%
                    </span>
                    <span className="text-zinc-400">{volumePctToDbLabel(vol)}</span>
                  </div>
                  <div className="flex items-center gap-1 px-0.5">
                    <span className="text-[9px] font-mono-tabular text-zinc-400 w-6 shrink-0">
                      {formatPanLabel(pan)}
                    </span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={5}
                      value={pan}
                      aria-label={`Pan for ${tr.label}`}
                      data-testid={`mixer-pan-${tr.id}`}
                      onMouseDown={onStartTrackDrag}
                      onTouchStart={onStartTrackDrag}
                      onChange={(e) => onChangeTrackPan(tr.id, Number(e.target.value))}
                      onMouseUp={onCommitTrackDrag}
                      onTouchEnd={onCommitTrackDrag}
                      onDoubleClick={() => {
                        onStartTrackDrag?.();
                        onChangeTrackPan(tr.id, DEFAULT_TRACK_PAN);
                        onCommitTrackDrag?.();
                      }}
                      className="w-full h-1 accent-emerald-400 cursor-ew-resize"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pinned Master Bus Output Strip */}
        <div
          data-testid="mixer-master-strip"
          className="w-[118px] sm:w-[132px] shrink-0 border-l border-white/15 bg-white/[0.04] p-1.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-200 truncate leading-tight">
                Master Bus
              </div>
              <div className="text-[9px] text-zinc-400 truncate leading-tight">
                Stereo Out
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleMasterMute}
              aria-label={masterMuted ? 'Unmute Master Output' : 'Mute Master Output'}
              aria-pressed={masterMuted}
              data-testid="mixer-master-mute"
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                masterMuted
                  ? 'bg-rose-500/85 text-white'
                  : 'bg-white/[0.08] text-amber-300 hover:bg-white/[0.16]'
              }`}
            >
              {masterMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-stretch justify-center gap-2 py-0.5">
            <VerticalFader
              trackId="master"
              label="Master Output"
              valuePct={masterVolumePct}
              muted={masterMuted}
              accent="amber"
              onChange={onChangeMasterVolume}
            />
            <SegmentMeter
              level01={masterMeterLevel01}
              clipping={liveMasterSnap.clipping}
              muted={masterMuted}
            />
          </div>

          <div className="shrink-0 space-y-0.5">
            <div
              data-testid="mixer-master-readout"
              className="flex items-center justify-between text-[10px] font-mono-tabular px-0.5"
            >
              <span className="text-amber-200 font-semibold">{masterVolumePct}%</span>
              <span className="text-zinc-400">{volumePctToDbLabel(masterVolumePct)}</span>
            </div>
            <div className="text-[9px] font-mono-tabular text-zinc-400 px-0.5 truncate">
              Peak{' '}
              {masterMuted
                ? 'Muted'
                : Number.isFinite(liveMasterSnap.peakDb) && isPlaying
                ? `${liveMasterSnap.peakDb} dB`
                : `${volumePctToDbLabel(masterVolumePct)}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
