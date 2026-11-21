import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Grid,
  Maximize2,
  Minimize2,
  Pause,
  Pipette,
  Play,
  Repeat,
  RotateCcw,
  Scissors,
  SkipBack,
} from 'lucide-react';
import type {
  AspectRatio,
  MediaAsset,
  TimelineClip,
  TimelineTrack,
  TransitionType,
} from '../types/editor';
import { MediaElementCache, renderCompositeFrame } from '../engine/compositor';
import { rgbToHex, type HistogramData } from '../engine/colorEngine';
import { clamp, evaluateKeyframes, formatTimecode, getCanvasDimensions } from '../engine/timelineMath';
import {
  computeGizmoDragUpdate,
  getClipCanvasBox,
  hitTestPreviewPoint,
} from '../engine/previewGizmo';
import type { LiveAudioLevelSnapshot } from '../engine/audioEngine';
import { HistogramScope } from './HistogramScope';

interface PreviewStageProps {
  playhead: number;
  totalDuration: number;
  isPlaying: boolean;
  playbackRate: number;
  loopEnabled: boolean;
  aspectRatio: AspectRatio;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAsset[];
  cache: MediaElementCache;
  selectedClip: TimelineClip | null;
  eyedropperActive: boolean;
  showSafeMargins: boolean;
  showScopes: boolean;
  getLiveAudioLevels?: () => LiveAudioLevelSnapshot;
  onTogglePlay: () => void;
  onChangePlaybackRate: (rate: number) => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  onToggleSafeMargins: () => void;
  onToggleScopes: () => void;
  onSplitAtPlayhead: () => void;
  onSelectClip: (clipId: string) => void;
  onOpenTextEditor?: (clipId: string) => void;
  onOpenEmojiEditor?: (clipId: string) => void;
  onTransformSelectedClip: (
    clipId: string,
    patch: { x?: number; y?: number; scale?: number; rotation?: number }
  ) => void;
  onCommitClipHistory?: (preDragClips: TimelineClip[]) => void;
  onPickChromaColor: (hex: string) => void;
  onCancelEyedropper: () => void;
  previewLutOverride?: { clipId: string; lutId: string } | null;
  previewTransitionOverride?: { clipId: string; type: TransitionType; progress: number } | null;
  preferProxy?: boolean;
}

const SHUTTLE_RATES = [0.5, 1, 1.5, 2] as const;

export const PreviewStage: React.FC<PreviewStageProps> = ({
  playhead,
  totalDuration,
  isPlaying,
  playbackRate,
  loopEnabled,
  aspectRatio,
  clips,
  tracks,
  assets,
  cache,
  selectedClip,
  eyedropperActive,
  showSafeMargins,
  showScopes,
  getLiveAudioLevels,
  onTogglePlay,
  onChangePlaybackRate,
  onToggleLoop,
  onSeek,
  onToggleSafeMargins,
  onToggleScopes,
  onSplitAtPlayhead,
  onSelectClip,
  onOpenTextEditor,
  onOpenEmojiEditor,
  onTransformSelectedClip,
  onCommitClipHistory,
  onPickChromaColor,
  onCancelEyedropper,
  previewLutOverride = null,
  previewTransitionOverride = null,
  preferProxy = true,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [snapGuides, setSnapGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [vuLevel, setVuLevel] = useState<LiveAudioLevelSnapshot>({
    rms: 0,
    peak: 0,
    peakDb: -Infinity,
    clipping: false,
  });

  const [canvasDrag, setCanvasDrag] = useState<{
    clipId: string;
    mode: 'move' | 'resize' | 'rotate';
    startCanvasX: number;
    startCanvasY: number;
    origTransform: { x: number; y: number; scale: number; rotation: number };
    origCenterX: number;
    origCenterY: number;
    preDragClips: TimelineClip[];
    didMutate: boolean;
  } | null>(null);

  const dims = getCanvasDimensions(aspectRatio, 960);

  // Ordered bottom-to-top compositing visual clips active at current playhead
  const activeVisualClips = useMemo(() => {
    const trackIndexMap = new Map(
      tracks.map((t, idx) => [t.id, { track: t, order: tracks.length - idx }])
    );
    const hasSoloVisual = tracks.some((t) => t.type !== 'audio' && t.solo);
    return clips
      .filter((c) => {
        const info = trackIndexMap.get(c.trackId);
        if (!info || info.track.hidden || info.track.type === 'audio') return false;
        if (hasSoloVisual && !info.track.solo) return false;
        return playhead >= c.startTime && playhead <= c.startTime + c.duration;
      })
      .sort((a, b) => {
        const oa = trackIndexMap.get(a.trackId)?.order ?? 0;
        const ob = trackIndexMap.get(b.trackId)?.order ?? 0;
        return oa - ob;
      });
  }, [clips, tracks, playhead]);

  const isSelectedVisualActive =
    Boolean(selectedClip) &&
    selectedClip!.kind !== 'audio' &&
    playhead >= selectedClip!.startTime &&
    playhead <= selectedClip!.startTime + selectedClip!.duration;

  // Real Web Audio Analyser VU telemetry
  useEffect(() => {
    if (!isPlaying || !getLiveAudioLevels) {
      setVuLevel({ rms: 0, peak: 0, peakDb: -Infinity, clipping: false });
      return;
    }
    let raf = 0;
    const poll = () => {
      setVuLevel(getLiveAudioLevels());
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, getLiveAudioLevels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: showScopes || eyedropperActive });
    if (!ctx) return;

    const hist = renderCompositeFrame({
      ctx,
      width: dims.width,
      height: dims.height,
      playhead,
      clips,
      tracks,
      assets,
      cache,
      isPlaying,
      showSafeMargins,
      computeHistogram: showScopes,
      selectedClipId: selectedClip?.id ?? null,
      showSelectionBox: !isPlaying && !eyedropperActive && isSelectedVisualActive,
      snapGuides,
      previewLutOverride,
      previewTransitionOverride,
      preferProxy,
      onAssetLoad: () => setRenderTick((n) => n + 1),
    });

    if (showScopes && hist) {
      setHistogram(hist);
    }
  }, [
    playhead,
    clips,
    tracks,
    assets,
    cache,
    isPlaying,
    showSafeMargins,
    showScopes,
    selectedClip?.id,
    isSelectedVisualActive,
    eyedropperActive,
    snapGuides,
    previewLutOverride,
    previewTransitionOverride,
    preferProxy,
    dims.width,
    dims.height,
    renderTick,
  ]);

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { px: 0, py: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      px: ((clientX - rect.left) / Math.max(1, rect.width)) * dims.width,
      py: ((clientY - rect.top) / Math.max(1, rect.height)) * dims.height,
    };
  };

  const handleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleSnapshotFrame = () => {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = dims.width;
    snapCanvas.height = dims.height;
    const snapCtx = snapCanvas.getContext('2d');
    if (!snapCtx) return;

    renderCompositeFrame({
      ctx: snapCtx,
      width: dims.width,
      height: dims.height,
      playhead,
      clips,
      tracks,
      assets,
      cache,
      isPlaying: false,
      preferProxy: false,
      showSafeMargins: false,
      computeHistogram: false,
      showSelectionBox: false,
    });

    snapCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rorn_frame_${Math.round(playhead * 1000)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { px, py } = toCanvasCoords(e.clientX, e.clientY);

    if (eyedropperActive) {
      const cx = clamp(Math.floor(px), 0, dims.width - 1);
      const cy = clamp(Math.floor(py), 0, dims.height - 1);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        try {
          const sample = ctx.getImageData(cx, cy, 1, 1).data;
          onPickChromaColor(rgbToHex(sample[0], sample[1], sample[2]));
        } catch {
          onCancelEyedropper();
        }
      }
      return;
    }

    if (isPlaying) return;

    const hit = hitTestPreviewPoint({
      px,
      py,
      width: dims.width,
      height: dims.height,
      playhead,
      activeClipsBottomToTop: activeVisualClips,
      selectedClipId: selectedClip?.id ?? null,
      handleRadius: 24,
    });

    const targetClip = hit
      ? clips.find((c) => c.id === hit.clipId) ?? selectedClip
      : selectedClip && isSelectedVisualActive
      ? selectedClip
      : null;

    if (!targetClip) return;

    if (targetClip.id !== selectedClip?.id) {
      onSelectClip(targetClip.id);
    }

    const mode: 'move' | 'resize' | 'rotate' = hit ? hit.type : 'move';
    const localT = clamp(playhead - targetClip.startTime, 0, targetClip.duration);
    const box = getClipCanvasBox(targetClip, localT, dims.width, dims.height);
    const tf = evaluateKeyframes(targetClip, localT);

    e.currentTarget.setPointerCapture(e.pointerId);
    setCanvasDrag({
      clipId: targetClip.id,
      mode,
      startCanvasX: px,
      startCanvasY: py,
      origTransform: {
        x: tf.x,
        y: tf.y,
        scale: tf.scale,
        rotation: tf.rotation,
      },
      origCenterX: box.cx,
      origCenterY: box.cy,
      preDragClips: clips,
      didMutate: false,
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasDrag || !canvasRef.current) return;
    const { px, py } = toCanvasCoords(e.clientX, e.clientY);
    const update = computeGizmoDragUpdate({
      mode: canvasDrag.mode,
      origTransform: canvasDrag.origTransform,
      origCenterX: canvasDrag.origCenterX,
      origCenterY: canvasDrag.origCenterY,
      startCanvasX: canvasDrag.startCanvasX,
      startCanvasY: canvasDrag.startCanvasY,
      currCanvasX: px,
      currCanvasY: py,
      width: dims.width,
      height: dims.height,
      snapToCenter: true,
    });
    setSnapGuides({ x: update.snapX, y: update.snapY });
    setCanvasDrag((prev) => (prev ? { ...prev, didMutate: true } : null));
    onTransformSelectedClip(canvasDrag.clipId, update.patch);
  };

  const handleCanvasPointerUp = () => {
    if (canvasDrag?.didMutate && onCommitClipHistory) {
      onCommitClipHistory(canvasDrag.preDragClips);
    }
    setCanvasDrag(null);
    setSnapGuides({ x: false, y: false });
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying || eyedropperActive) return;
    const { px, py } = toCanvasCoords(e.clientX, e.clientY);
    const hit = hitTestPreviewPoint({
      px,
      py,
      width: dims.width,
      height: dims.height,
      playhead,
      activeClipsBottomToTop: activeVisualClips,
      selectedClipId: selectedClip?.id ?? null,
    });
    if (!hit) return;
    const target = clips.find((c) => c.id === hit.clipId);
    if (target?.kind === 'text' && onOpenTextEditor) {
      onSelectClip(target.id);
      onOpenTextEditor(target.id);
    } else if (target?.kind === 'emoji' && onOpenEmojiEditor) {
      onSelectClip(target.id);
      onOpenEmojiEditor(target.id);
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (isPlaying || !selectedClip || !isSelectedVisualActive) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.05 : -0.05;
    onTransformSelectedClip(selectedClip.id, {
      scale: Number(clamp(selectedClip.transform.scale + step, 0.2, 3.0).toFixed(2)),
    });
  };

  const cyclePlaybackRate = () => {
    const idx = SHUTTLE_RATES.indexOf(playbackRate as (typeof SHUTTLE_RATES)[number]);
    const next = SHUTTLE_RATES[(idx + 1) % SHUTTLE_RATES.length];
    onChangePlaybackRate(next);
  };

  const vuPct = Math.min(100, Math.round(vuLevel.peak * 100));

  return (
    <section
      ref={stageRef}
      className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#07080B] relative"
      aria-label="Video Preview Stage"
    >
      {/* Canvas Viewport */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 relative overflow-hidden">
        <div
          className="relative max-w-full max-h-full flex items-center justify-center rounded-lg overflow-hidden border border-white/10 bg-black shadow-2xl"
          style={{
            aspectRatio: `${dims.width} / ${dims.height}`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={dims.width}
            height={dims.height}
            data-testid="preview-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onDoubleClick={handleCanvasDoubleClick}
            onWheel={handleCanvasWheel}
            className={`w-full h-full object-contain block touch-none ${
              eyedropperActive
                ? 'cursor-crosshair'
                : !isPlaying && activeVisualClips.length > 0
                ? 'cursor-move'
                : ''
            }`}
          />

          {eyedropperActive && (
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 rounded-lg bg-zinc-950/90 border border-emerald-400/60 px-2.5 py-1 text-[11px] font-medium text-emerald-200 shadow-lg">
              <Pipette className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tap video frame to pick Chroma Key color</span>
              <button
                type="button"
                onClick={onCancelEyedropper}
                className="text-zinc-400 hover:text-white ml-1 font-semibold"
              >
                Cancel
              </button>
            </div>
          )}

          {showScopes && (
            <div className="absolute top-2.5 right-2.5 z-20 pointer-events-auto">
              <HistogramScope data={histogram} />
            </div>
          )}
        </div>
      </div>

      {/* Compact 2026 Quick Transform & Gizmo Bar (cleanly below video frame so it never covers subtitles) */}
      {!isPlaying && !eyedropperActive && selectedClip && isSelectedVisualActive && (
        <div
          data-testid="preview-quick-transform"
          className="shrink-0 border-t border-white/5 bg-[#0A0C11] px-2.5 py-1 flex items-center justify-center gap-1.5 text-[10px] font-mono-tabular text-zinc-200 overflow-x-auto no-scrollbar"
        >
          <span
            data-testid="preview-transform-telemetry"
            className="text-amber-300 font-semibold whitespace-nowrap pr-2 border-r border-white/10"
          >
            {Math.round(selectedClip.transform.scale * 100)}% · X
            {Math.round(selectedClip.transform.x * 100)} Y
            {Math.round(selectedClip.transform.y * 100)} · {selectedClip.transform.rotation}°
          </span>
          <button
            type="button"
            onClick={() =>
              onTransformSelectedClip(selectedClip.id, { x: 0, y: 0, scale: 1, rotation: 0 })
            }
            title="Fit 100% Center"
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1 whitespace-nowrap"
          >
            <Maximize2 className="w-2.5 h-2.5 text-cyan-300" /> Fit
          </button>
          <button
            type="button"
            onClick={() => onTransformSelectedClip(selectedClip.id, { scale: 0.5 })}
            title="50% PiP Size"
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1 whitespace-nowrap"
          >
            <Minimize2 className="w-2.5 h-2.5 text-violet-300" /> 50%
          </button>
          <button
            type="button"
            onClick={() => onTransformSelectedClip(selectedClip.id, { x: 0, y: 0 })}
            title="Snap to Center"
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1 whitespace-nowrap"
          >
            <Crosshair className="w-2.5 h-2.5 text-emerald-300" /> Center
          </button>
          <button
            type="button"
            onClick={() => onTransformSelectedClip(selectedClip.id, { rotation: 0 })}
            title="Reset Rotation"
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1 whitespace-nowrap"
          >
            <RotateCcw className="w-2.5 h-2.5 text-amber-300" /> 0°
          </button>
        </div>
      )}

      {/* Transport & Timecode Bar */}
      <div className="shrink-0 border-t border-white/10 bg-[#0D0F14] px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
        {/* Timecode readout + real live VU meter */}
        <div className="flex items-center gap-2 text-xs font-mono-tabular shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              data-testid="smpte-playhead"
              className="text-amber-400 font-semibold tracking-tight whitespace-nowrap"
            >
              {formatTimecode(playhead, 30)}
            </span>
            <span className="text-zinc-600 hidden sm:inline">/</span>
            <span className="text-zinc-400 hidden sm:inline whitespace-nowrap">
              {formatTimecode(totalDuration, 30)}
            </span>
          </div>

          <div
            data-testid="master-audio-vu"
            title="Live Master Audio Peak Meter"
            className="hidden md:flex items-center gap-1.5 pl-2 border-l border-white/10"
          >
            <div className="w-14 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                style={{ width: `${vuPct}%` }}
                className={`h-full transition-[width] duration-75 ${
                  vuLevel.clipping
                    ? 'bg-rose-500'
                    : vuPct > 75
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
            </div>
            <span className="text-[10px] text-zinc-400 w-9">
              {Number.isFinite(vuLevel.peakDb) ? `${vuLevel.peakDb}dB` : '-∞'}
            </span>
          </div>
        </div>

        {/* Center Transport Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSeek(0)}
            aria-label="Jump to Start"
            title="Jump to Start"
            className="min-h-[38px] min-w-[36px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, playhead - 1 / 30))}
            aria-label="Previous Frame"
            title="Previous Frame"
            className="hidden sm:flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="min-h-[38px] min-w-[42px] sm:min-h-[36px] sm:min-w-[44px] flex items-center justify-center rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-[0.97] transition-all"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(totalDuration, playhead + 1 / 30))}
            aria-label="Next Frame"
            title="Next Frame"
            className="hidden sm:flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={cyclePlaybackRate}
            aria-label="Playback Speed Shuttle"
            title="Cycle Playback Speed (0.5x / 1x / 1.5x / 2x)"
            className={`min-h-[34px] px-2 flex items-center justify-center rounded-lg text-[11px] font-mono-tabular font-semibold whitespace-nowrap transition-colors ${
              playbackRate !== 1
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-zinc-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            {playbackRate}x
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            aria-label="Toggle Loop Playback"
            aria-pressed={loopEnabled}
            title="Loop Playback"
            className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg transition-colors ${
              loopEnabled
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Stage Toggles */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            aria-label="Split Clip at Playhead"
            title="Split Clip at Playhead (S)"
            className="min-h-[38px] min-w-[36px] sm:min-h-[34px] sm:px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Scissors className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Split</span>
          </button>
          <button
            type="button"
            onClick={handleSnapshotFrame}
            aria-label="Capture Frame PNG"
            title="Capture Graded Frame as PNG"
            className="hidden sm:flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleSafeMargins}
            aria-label="Toggle Safe Margins"
            aria-pressed={showSafeMargins}
            title="Broadcast Safe Margins"
            className={`min-h-[38px] min-w-[36px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg transition-colors ${
              showSafeMargins ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleScopes}
            aria-label="Toggle RGB Scopes"
            aria-pressed={showScopes}
            title="Live RGB Histogram"
            className={`min-h-[38px] min-w-[36px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg transition-colors ${
              showScopes ? 'bg-sky-500/20 text-sky-300' : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label="Toggle Fullscreen Preview"
            title="Fullscreen"
            className="hidden sm:flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
