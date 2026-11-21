import React, { useEffect, useMemo, useState } from 'react';
import { GripVertical, Search, Sparkles, X } from 'lucide-react';
import type { MediaAsset, TimelineClip, TransitionType } from '../types/editor';
import type { TimelineClipSeam } from '../engine/timelineMath';
import {
  TRANSITION_CATEGORIES,
  filterTransitions,
  type TransitionCategory,
} from '../engine/transitionsLibrary';
import { TransitionLiveThumb } from './TransitionLiveThumb';
import { formatShortTime } from '../engine/timelineMath';

interface TransitionLibraryModalProps {
  open: boolean;
  onClose: () => void;
  seams: TimelineClipSeam[];
  activeSeamId: string | null;
  onSelectSeamId: (seamId: string) => void;
  selectedClip: TimelineClip | null;
  assets: MediaAsset[];
  clips: TimelineClip[];
  onApplyTransitionToSeam: (seam: TimelineClipSeam, type: TransitionType, duration: number) => void;
  onApplyTransitionToClip: (clipId: string, type: TransitionType, duration: number) => void;
  onPreviewTransitionHover?: (type: TransitionType | null) => void;
  onDragTransitionChange?: (dragging: boolean) => void;
}

export const TransitionLibraryModal: React.FC<TransitionLibraryModalProps> = ({
  open,
  onClose,
  seams,
  activeSeamId,
  onSelectSeamId,
  selectedClip,
  assets,
  clips,
  onApplyTransitionToSeam,
  onApplyTransitionToClip,
  onPreviewTransitionHover,
  onDragTransitionChange,
}) => {
  const [category, setCategory] = useState<'All' | TransitionCategory>('All');
  const [query, setQuery] = useState('');
  const [duration, setDuration] = useState<number>(0.7);
  const [loopPhase, setLoopPhase] = useState<number>(0);
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  // Single shared 30fps loop driving all live transition previews cleanly
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let lastDraw = 0;
    const startTs = performance.now();
    const loop = (now: number) => {
      if (now - lastDraw >= 33) {
        lastDraw = now;
        const cycle = ((now - startTs) % 1400) / 1400;
        // Ease hold slightly at 0 and 1 so user sees both Clip A and Clip B clearly
        const p = cycle < 0.12 ? 0 : cycle > 0.88 ? 1 : (cycle - 0.12) / 0.76;
        setLoopPhase(p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const activeSeam = useMemo(
    () => seams.find((s) => s.id === activeSeamId) ?? seams[0] ?? null,
    [seams, activeSeamId]
  );

  // Resolve real Frame A & Frame B images from the active seam (or fallback project images)
  const { imageA, imageB } = useMemo(() => {
    const imageAssets = assets.filter((a) => a.kind === 'image');
    const fallbackA = imageAssets[0]?.src ?? '';
    const fallbackB = imageAssets[1]?.src ?? imageAssets[0]?.src ?? '';
    if (!activeSeam) return { imageA: fallbackA, imageB: fallbackB };

    const leftClip = clips.find((c) => c.id === activeSeam.leftClipId);
    const rightClip = clips.find((c) => c.id === activeSeam.rightClipId);
    const leftAsset = leftClip ? assets.find((a) => a.id === leftClip.assetId) : undefined;
    const rightAsset = rightClip ? assets.find((a) => a.id === rightClip.assetId) : undefined;

    return {
      imageA: leftAsset?.kind === 'image' ? leftAsset.src : fallbackA,
      imageB: rightAsset?.kind === 'image' ? rightAsset.src : fallbackB,
    };
  }, [activeSeam, assets, clips]);

  const visibleTransitions = useMemo(
    () => filterTransitions(category, query),
    [category, query]
  );

  useEffect(() => {
    if (!open) {
      setIsDraggingCard(false);
      onDragTransitionChange?.(false);
      onPreviewTransitionHover?.(null);
    }
  }, [open, onDragTransitionChange, onPreviewTransitionHover]);

  if (!open) return null;

  const activeTargetType = activeSeam
    ? activeSeam.transition.type
    : selectedClip?.transitionIn.type ?? 'none';

  const handleCardApply = (type: TransitionType, suggestedDur: number) => {
    const dur = duration || suggestedDur;
    if (activeSeam) {
      onApplyTransitionToSeam(activeSeam, type, dur);
    } else if (selectedClip && selectedClip.kind !== 'audio') {
      onApplyTransitionToClip(selectedClip.id, type, dur);
    }
  };

  return (
    <div
      className="fixed inset-x-2 sm:inset-x-6 top-14 bottom-[235px] sm:bottom-[260px] z-50 pointer-events-none flex items-start justify-center"
      aria-live="polite"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Transition Library"
        data-testid="transition-library-modal"
        className={`w-full max-w-4xl max-h-full flex flex-col rounded-2xl border border-white/20 bg-[#0A0E17]/78 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.72)] overflow-hidden transition-opacity ${
          isDraggingCard ? 'pointer-events-none opacity-45' : 'pointer-events-auto opacity-100'
        }`}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/12 bg-white/[0.04] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/35 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight truncate">
                Transition Library
              </h2>
              <p className="text-[11px] text-zinc-300 truncate">
                Drag any transition directly between two clips on the timeline below, or click to apply
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Transition Library"
            data-testid="close-transition-library-btn"
            className="min-h-[38px] min-w-[38px] rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Seam + Duration + Filter Controls */}
        <div className="shrink-0 px-4 py-2.5 border-b border-white/10 bg-white/[0.02] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Target Cut Seam Selector */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-zinc-400 shrink-0">
                Target Cut:
              </span>
              {seams.length > 0 ? (
                <select
                  aria-label="Target timeline seam"
                  value={activeSeam?.id ?? ''}
                  onChange={(e) => onSelectSeamId(e.target.value)}
                  className="min-w-[180px] max-w-xs rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  {seams.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#0E131E] text-white">
                      {s.leftClipName} ↔ {s.rightClipName} ({formatShortTime(s.time)})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-amber-300">
                  {selectedClip
                    ? `Selected clip: ${selectedClip.name}`
                    : 'Place two clips back-to-back on a track to create a seam'}
                </span>
              )}
            </div>

            {/* Duration Presets */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 mr-1">Duration</span>
              {[0.4, 0.7, 1.0, 1.5].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDuration(sec)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono-tabular font-semibold border transition-colors ${
                    Math.abs(duration - sec) < 0.05
                      ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Search & Categories */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Dissolve, Wipe, Push, Zoom..."
                aria-label="Search transition library"
                className="w-full rounded-lg border border-white/15 bg-white/[0.06] pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {TRANSITION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                    category === cat
                      ? 'border-amber-400 bg-amber-500 text-zinc-950'
                      : 'border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.12]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transparent Glassmorphic Live-Preview Grid */}
        <div
          className="flex-1 overflow-y-auto studio-scroll p-3.5"
          onMouseLeave={() => onPreviewTransitionHover?.(null)}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {visibleTransitions.map((tr) => {
              const isApplied = activeTargetType === tr.type;
              return (
                <div
                  key={tr.type}
                  role="button"
                  tabIndex={0}
                  draggable
                  data-testid={`transition-library-card-${tr.type}`}
                  aria-label={`${tr.label} transition`}
                  onMouseEnter={() => onPreviewTransitionHover?.(tr.type)}
                  onMouseLeave={() => onPreviewTransitionHover?.(null)}
                  onClick={() => handleCardApply(tr.type, tr.defaultDuration)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardApply(tr.type, tr.defaultDuration);
                    }
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/x-rorn-transition',
                      JSON.stringify({
                        type: tr.type,
                        duration,
                        label: tr.label,
                      })
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                    setIsDraggingCard(true);
                    onDragTransitionChange?.(true);
                  }}
                  onDragEnd={() => {
                    setIsDraggingCard(false);
                    onDragTransitionChange?.(false);
                  }}
                  className={`group rounded-xl border p-2 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing backdrop-blur-md transition-all select-none ${
                    isApplied
                      ? 'border-cyan-400 bg-cyan-500/18 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                      : 'border-white/12 bg-white/[0.05] hover:bg-white/[0.11] hover:border-white/25'
                  }`}
                >
                  <div className="relative">
                    <TransitionLiveThumb
                      type={tr.type}
                      progress={loopPhase}
                      accent={tr.accent}
                      imageA={imageA}
                      imageB={imageB}
                    />
                    <span
                      title="Drag onto timeline cut seam"
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/55 border border-white/15 text-zinc-200 opacity-75 group-hover:opacity-100"
                    >
                      <GripVertical className="w-3 h-3" />
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-white truncate">
                        {tr.label}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: tr.accent }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate">{tr.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleTransitions.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-8">
              No transitions matched &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
