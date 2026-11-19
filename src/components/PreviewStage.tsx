import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  Grid,
  Maximize2,
  Pause,
  Pipette,
  Play,
  Repeat,
  Scissors,
  SkipBack,
} from 'lucide-react';
import type { AspectRatio, MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import { MediaElementCache, renderCompositeFrame } from '../engine/compositor';
import { rgbToHex, type HistogramData } from '../engine/colorEngine';
import { clamp, formatTimecode, getCanvasDimensions } from '../engine/timelineMath';
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
  onTogglePlay: () => void;
  onChangePlaybackRate: (rate: number) => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  onToggleSafeMargins: () => void;
  onToggleScopes: () => void;
  onSplitAtPlayhead: () => void;
  onTransformSelectedClip: (
    clipId: string,
    patch: { x?: number; y?: number; scale?: number }
  ) => void;
  onPickChromaColor: (hex: string) => void;
  onCancelEyedropper: () => void;
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
  onTogglePlay,
  onChangePlaybackRate,
  onToggleLoop,
  onSeek,
  onToggleSafeMargins,
  onToggleScopes,
  onSplitAtPlayhead,
  onTransformSelectedClip,
  onPickChromaColor,
  onCancelEyedropper,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [canvasDrag, setCanvasDrag] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const dims = getCanvasDimensions(aspectRatio, 960);

  const isSelectedVisualActive =
    Boolean(selectedClip) &&
    selectedClip!.kind !== 'audio' &&
    playhead >= selectedClip!.startTime &&
    playhead <= selectedClip!.startTime + selectedClip!.duration;

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
    dims.width,
    dims.height,
    renderTick,
  ]);

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
    const rect = canvas.getBoundingClientRect();

    if (eyedropperActive) {
      const cx = clamp(Math.floor(((e.clientX - rect.left) / rect.width) * dims.width), 0, dims.width - 1);
      const cy = clamp(Math.floor(((e.clientY - rect.top) / rect.height) * dims.height), 0, dims.height - 1);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        try {
          const px = ctx.getImageData(cx, cy, 1, 1).data;
          onPickChromaColor(rgbToHex(px[0], px[1], px[2]));
        } catch {
          onCancelEyedropper();
        }
      }
      return;
    }

    if (!isPlaying && selectedClip && isSelectedVisualActive) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setCanvasDrag({
        clipId: selectedClip.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: selectedClip.transform.x,
        origY: selectedClip.transform.y,
      });
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasDrag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - canvasDrag.startX) / Math.max(100, rect.width);
    const dy = (e.clientY - canvasDrag.startY) / Math.max(100, rect.height);
    onTransformSelectedClip(canvasDrag.clipId, {
      x: Number(clamp(canvasDrag.origX + dx, -1, 1).toFixed(3)),
      y: Number(clamp(canvasDrag.origY + dy, -1, 1).toFixed(3)),
    });
  };

  const handleCanvasPointerUp = () => {
    setCanvasDrag(null);
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
            onWheel={handleCanvasWheel}
            className={`w-full h-full object-contain block touch-none ${
              eyedropperActive
                ? 'cursor-crosshair'
                : !isPlaying && isSelectedVisualActive
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

      {/* Transport & Timecode Bar */}
      <div className="shrink-0 border-t border-white/10 bg-[#0D0F14] px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
        {/* Timecode readout */}
        <div className="flex items-center gap-1.5 text-xs font-mono-tabular shrink-0">
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
