import React, { useRef, useState } from 'react';
import {
  Activity,
  AlignHorizontalJustifyStart,
  ArrowRightLeft,
  BoxSelect,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Flag,
  Grid3X3,
  Lock,
  Magnet,
  Plus,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  InsertPlacement,
  MediaAsset,
  TimelineClip,
  TimelineMarker,
  TimelineTrack,
  TransitionType,
} from '../types/editor';
import {
  clampTrimEdit,
  computeGridAwareSnapResult,
  findTimelineClipSeams,
  formatShortTime,
  getTimelineGridStep,
  isClipCompatibleWithTrack,
  type TimelineClipSeam,
} from '../engine/timelineMath';
import {
  findClipsInLassoRect,
  toggleClipInSelection,
} from '../engine/timelineSelection';
import { TRANSITION_LIBRARY } from '../engine/transitionsLibrary';
import { getTrackVolumePct } from '../engine/audioMixer';
import type { LiveAudioLevelSnapshot } from '../engine/audioEngine';
import { AudioMixerOverlay } from './AudioMixerOverlay';

interface TimelinePanelProps {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: MediaAsset[];
  markers: TimelineMarker[];
  selectedClipId: string | null;
  selectedClipIds: string[];
  playhead: number;
  totalDuration: number;
  zoomPxPerSec: number;
  snapEnabled: boolean;
  gridSnapEnabled: boolean;
  rippleEnabled: boolean;
  onSelectClip: (clipId: string) => void;
  onSelectClips: (clipIds: string[], primaryId: string | null) => void;
  onSeek: (time: number) => void;
  onZoomChange: (pxPerSec: number) => void;
  onToggleSnap: () => void;
  onToggleGridSnap: () => void;
  onToggleRipple: () => void;
  onToggleTrackFlag: (trackId: string, flag: 'muted' | 'locked' | 'hidden' | 'solo') => void;
  onOpenAddMedia: (kind: 'video' | 'audio') => void;
  onDeleteTrack: (trackId: string) => void;
  onAddMarker: () => void;
  onAutoBeatMarkers?: () => void;
  onRemoveMarker: (markerId: string) => void;
  onCompactGaps: () => void;
  onMoveClip: (clipId: string, newStartTime: number, targetTrackId?: string) => void;
  onMoveSelectedClips: (
    anchorClipId: string,
    targetAnchorStart: number,
    origStartsById: Record<string, number>
  ) => void;
  onTrimClip: (clipId: string, newStartTime: number, newDuration: number, newSourceOffset: number) => void;
  onCommitDragHistory?: (preDragClips: TimelineClip[]) => void;
  onNudgeClip: (deltaFrames: number) => void;
  onSplitClip: () => void;
  onDuplicateClip: () => void;
  onDeleteClip: () => void;
  onDropAsset: (
    assetId: string,
    trackId: string,
    placement: InsertPlacement,
    startTime: number
  ) => void;
  onDropFiles: (files: FileList, trackId: string, startTime: number) => void;
  onDropTransitionOnSeam?: (
    seam: TimelineClipSeam,
    type: TransitionType,
    duration: number
  ) => void;
  onOpenTransitionLibraryForSeam?: (seam: TimelineClipSeam) => void;
  isDraggingTransitionFromLibrary?: boolean;
  mixerOpen?: boolean;
  onToggleMixer?: () => void;
  masterVolumePct?: number;
  masterMuted?: boolean;
  isPlaying?: boolean;
  getLiveAudioLevels?: () => LiveAudioLevelSnapshot;
  onChangeTrackVolume?: (trackId: string, volumePct: number) => void;
  onChangeTrackPan?: (trackId: string, pan: number) => void;
  onCommitTracksHistory?: (preDragTracks: TimelineTrack[]) => void;
  onChangeMasterVolume?: (volumePct: number) => void;
  onToggleMasterMute?: () => void;
  onAddAudioTrack?: () => void;
  onResetMix?: () => void;
}

const TRACK_COLORS: Record<string, string> = {
  text: 'bg-pink-500/20 border-pink-400/50 text-pink-100',
  overlay: 'bg-violet-500/20 border-violet-400/50 text-violet-100',
  video: 'bg-sky-500/20 border-sky-400/50 text-sky-100',
  audio: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100',
};

const BASE_TRACK_IDS = new Set([
  'track_t1',
  'track_v2',
  'track_v1',
  'track_a1',
  'track_a2',
]);

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  tracks,
  clips,
  assets,
  markers,
  selectedClipId,
  selectedClipIds,
  playhead,
  totalDuration,
  zoomPxPerSec,
  snapEnabled,
  gridSnapEnabled,
  rippleEnabled,
  onSelectClip,
  onSelectClips,
  onSeek,
  onZoomChange,
  onToggleSnap,
  onToggleGridSnap,
  onToggleRipple,
  onToggleTrackFlag,
  onOpenAddMedia,
  onDeleteTrack,
  onAddMarker,
  onAutoBeatMarkers,
  onRemoveMarker,
  onCompactGaps,
  onMoveClip,
  onMoveSelectedClips,
  onTrimClip,
  onCommitDragHistory,
  onNudgeClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onDropAsset,
  onDropFiles,
  onDropTransitionOnSeam,
  onOpenTransitionLibraryForSeam,
  isDraggingTransitionFromLibrary = false,
  mixerOpen = false,
  onToggleMixer,
  masterVolumePct = 100,
  masterMuted = false,
  isPlaying = false,
  getLiveAudioLevels,
  onChangeTrackVolume,
  onChangeTrackPan,
  onCommitTracksHistory,
  onChangeMasterVolume,
  onToggleMasterMute,
  onAddAudioTrack,
  onResetMix,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const preDragTracksRef = useRef<TimelineTrack[] | null>(null);
  const trackRowHeight = 40;
  const [lassoMode, setLassoMode] = useState(false);
  const [lassoRect, setLassoRect] = useState<{
    startX: number;
    startY: number;
    currX: number;
    currY: number;
    additive: boolean;
    baseIds: string[];
    moved: boolean;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    clipId: string;
    mode: 'move' | 'trimLeft' | 'trimRight';
    startClientX: number;
    startClientY: number;
    origStart: number;
    origDuration: number;
    origOffset: number;
    origTrackIndex: number;
    liveStart: number;
    liveDuration: number;
    liveTrackId: string;
    hoverTrackId: string | null;
    hoverTrackCompatible: boolean;
    selectedIds: string[];
    origStartsById: Record<string, number>;
    preDragClips: TimelineClip[];
    didMutate: boolean;
  } | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [hoveredSeamId, setHoveredSeamId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    trackId: string;
    startTime: number;
    placement: InsertPlacement;
    label: string;
  } | null>(null);

  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const transitionLabelMap = new Map(TRANSITION_LIBRARY.map((t) => [t.type, t]));
  const markerTimes = markers.map((m) => m.time);
  const timelineSpan = Math.max(20, totalDuration + 6);
  const timelineWidthPx = Math.round(timelineSpan * zoomPxPerSec);
  const gridStepSec = getTimelineGridStep(zoomPxPerSec);

  const tickStep = zoomPxPerSec >= 75 ? 1 : zoomPxPerSec >= 40 ? 2 : 5;
  const rulerTicks: number[] = [];
  for (let t = 0; t <= timelineSpan; t += tickStep) {
    rulerTicks.push(t);
  }

  const gridLines: number[] = [];
  if (gridSnapEnabled) {
    const count = Math.floor(timelineSpan / gridStepSec);
    for (let i = 1; i <= count; i++) {
      gridLines.push(Number((i * gridStepSec).toFixed(3)));
    }
  }

  const clientXToTime = (clientX: number): number => {
    const container = scrollRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + container.scrollLeft;
    return Math.max(0, Number((x / zoomPxPerSec).toFixed(3)));
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(clientXToTime(e.clientX));
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.pointerType === 'mouse') return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      onSeek(clientXToTime(e.clientX));
    }
  };

  const startClipDrag = (
    e: React.PointerEvent,
    clip: TimelineClip,
    mode: 'move' | 'trimLeft' | 'trimRight'
  ) => {
    const trIdx = tracks.findIndex((t) => t.id === clip.trackId);
    if (trIdx >= 0 && tracks[trIdx].locked) return;
    if (lassoMode && mode === 'move' && !e.ctrlKey && !e.metaKey) {
      return;
    }
    e.stopPropagation();

    if (mode === 'move' && (e.ctrlKey || e.metaKey)) {
      const nextSel = toggleClipInSelection(selectedClipIds, clip.id, true);
      onSelectClips(nextSel.selectedIds, nextSel.primaryId);
      return;
    }

    const activeIds =
      mode === 'move' && selectedClipIds.includes(clip.id) && selectedClipIds.length > 1
        ? selectedClipIds
        : [clip.id];
    if (activeIds.length === 1) {
      onSelectClips([clip.id], clip.id);
    }

    const origStartsById: Record<string, number> = {};
    for (const c of clips) {
      if (activeIds.includes(c.id)) {
        origStartsById[c.id] = c.startTime;
      }
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({
      clipId: clip.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStart: clip.startTime,
      origDuration: clip.duration,
      origOffset: clip.sourceOffset,
      origTrackIndex: Math.max(0, trIdx),
      liveStart: clip.startTime,
      liveDuration: clip.duration,
      liveTrackId: clip.trackId,
      hoverTrackId: clip.trackId,
      hoverTrackCompatible: true,
      selectedIds: activeIds,
      origStartsById,
      preDragClips: clips,
      didMutate: false,
    });
  };

  const resolveHoveredTrackFromY = (clientY: number): TimelineTrack | undefined => {
    const laneEls = document.querySelectorAll<HTMLElement>('[data-track-row-id]');
    for (const el of laneEls) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const id = el.dataset.trackRowId;
        const found = tracks.find((t) => t.id === id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const moveClipDrag = (e: React.PointerEvent) => {
    if (!dragState) return;
    const deltaSec = (e.clientX - dragState.startClientX) / zoomPxPerSec;
    const snapThreshold = 10 / zoomPxPerSec;
    const clipObj = clips.find((c) => c.id === dragState.clipId);
    const asset = clipObj ? assetMap.get(clipObj.assetId) : undefined;
    const maxAssetDur =
      asset && (asset.kind === 'video' || asset.kind === 'audio') ? asset.duration : undefined;

    if (dragState.mode === 'move') {
      let nextStart = Math.max(0, dragState.origStart + deltaSec);
      let guide: number | null = null;
      if (snapEnabled || gridSnapEnabled) {
        const res = computeGridAwareSnapResult({
          candidateTime: nextStart,
          clips,
          excludeClipIds: dragState.selectedIds,
          playhead,
          thresholdSeconds: snapThreshold,
          markerTimes,
          snapEnabled,
          gridSnapEnabled,
          gridStepSec,
          fps: 30,
        });
        nextStart = res.time;
        guide = res.snappedTo;
      }

      let nextTrackId: string | undefined;
      let hoverTrackId: string | null = dragState.liveTrackId;
      let hoverTrackCompatible = true;
      if (clipObj && dragState.selectedIds.length <= 1) {
        const domHovered = resolveHoveredTrackFromY(e.clientY);
        const laneDelta = Math.round((e.clientY - dragState.startClientY) / trackRowHeight);
        const fallbackTrack =
          tracks[Math.max(0, Math.min(tracks.length - 1, dragState.origTrackIndex + laneDelta))];
        const candTrack = domHovered ?? fallbackTrack;
        if (candTrack) {
          hoverTrackId = candTrack.id;
          const compatible = !candTrack.locked && isClipCompatibleWithTrack(clipObj, candTrack);
          hoverTrackCompatible = compatible;
          if (compatible) {
            nextTrackId = candTrack.id;
          }
        }
      }

      setSnapGuideTime(guide);
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              liveStart: nextStart,
              liveTrackId: nextTrackId ?? prev.liveTrackId,
              hoverTrackId,
              hoverTrackCompatible,
              didMutate: true,
            }
          : null
      );
      if (dragState.selectedIds.length > 1) {
        onMoveSelectedClips(dragState.clipId, Number(nextStart.toFixed(3)), dragState.origStartsById);
      } else {
        onMoveClip(dragState.clipId, Number(nextStart.toFixed(3)), nextTrackId);
      }
    } else if (dragState.mode === 'trimLeft') {
      let effectiveDelta = deltaSec;
      let guide: number | null = null;
      if (snapEnabled || gridSnapEnabled) {
        const candStart = Math.max(0, dragState.origStart + deltaSec);
        const res = computeGridAwareSnapResult({
          candidateTime: candStart,
          clips,
          excludeClipIds: [dragState.clipId],
          playhead,
          thresholdSeconds: snapThreshold,
          markerTimes,
          snapEnabled,
          gridSnapEnabled,
          gridStepSec,
          fps: 30,
        });
        if (res.snapKind !== null) {
          effectiveDelta = res.time - dragState.origStart;
          guide = res.snappedTo;
        }
      }
      const trimmed = clampTrimEdit(
        dragState.origStart,
        dragState.origDuration,
        dragState.origOffset,
        'trimLeft',
        effectiveDelta,
        0.3,
        maxAssetDur
      );
      setSnapGuideTime(guide);
      setDragState((prev) =>
        prev
          ? { ...prev, liveStart: trimmed.startTime, liveDuration: trimmed.duration, didMutate: true }
          : null
      );
      onTrimClip(dragState.clipId, trimmed.startTime, trimmed.duration, trimmed.sourceOffset);
    } else if (dragState.mode === 'trimRight') {
      let effectiveDelta = deltaSec;
      let guide: number | null = null;
      if (snapEnabled || gridSnapEnabled) {
        const candEnd = dragState.origStart + Math.max(0.3, dragState.origDuration + deltaSec);
        const res = computeGridAwareSnapResult({
          candidateTime: candEnd,
          clips,
          excludeClipIds: [dragState.clipId],
          playhead,
          thresholdSeconds: snapThreshold,
          markerTimes,
          snapEnabled,
          gridSnapEnabled,
          gridStepSec,
          fps: 30,
        });
        if (res.snapKind !== null) {
          effectiveDelta = res.time - dragState.origStart - dragState.origDuration;
          guide = res.snappedTo;
        }
      }
      const trimmed = clampTrimEdit(
        dragState.origStart,
        dragState.origDuration,
        dragState.origOffset,
        'trimRight',
        effectiveDelta,
        0.3,
        maxAssetDur
      );
      setSnapGuideTime(guide);
      setDragState((prev) =>
        prev
          ? { ...prev, liveStart: trimmed.startTime, liveDuration: trimmed.duration, didMutate: true }
          : null
      );
      onTrimClip(dragState.clipId, trimmed.startTime, trimmed.duration, trimmed.sourceOffset);
    }
  };

  const endClipDrag = () => {
    if (dragState?.didMutate && onCommitDragHistory) {
      onCommitDragHistory(dragState.preDragClips);
    }
    setDragState(null);
    setSnapGuideTime(null);
  };

  const getRelativeLanePoint = (clientX: number, clientY: number) => {
    const el = lanesRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const maxH = Math.max(trackRowHeight, tracks.length * trackRowHeight);
    return {
      x: Math.max(0, Math.min(timelineWidthPx, clientX - rect.left)),
      y: Math.max(0, Math.min(maxH, clientY - rect.top)),
    };
  };

  const startLassoDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pt = getRelativeLanePoint(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    setLassoRect({
      startX: pt.x,
      startY: pt.y,
      currX: pt.x,
      currY: pt.y,
      additive: e.ctrlKey || e.metaKey || e.shiftKey,
      baseIds: e.ctrlKey || e.metaKey || e.shiftKey ? selectedClipIds : [],
      moved: false,
    });
  };

  const moveLassoDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lassoRect) return;
    const pt = getRelativeLanePoint(e.clientX, e.clientY);
    const dist = Math.hypot(pt.x - lassoRect.startX, pt.y - lassoRect.startY);
    const hasMoved = lassoRect.moved || dist > 4;
    const nextState = {
      ...lassoRect,
      currX: pt.x,
      currY: pt.y,
      moved: hasMoved,
    };
    setLassoRect(nextState);

    if (hasMoved) {
      const tStart = Math.min(nextState.startX, nextState.currX) / zoomPxPerSec;
      const tEnd = Math.max(nextState.startX, nextState.currX) / zoomPxPerSec;
      const minTrackIdx = Math.max(
        0,
        Math.floor(Math.min(nextState.startY, nextState.currY) / trackRowHeight)
      );
      const maxTrackIdx = Math.min(
        Math.max(0, tracks.length - 1),
        Math.floor(Math.max(nextState.startY, nextState.currY) / trackRowHeight)
      );
      const hits = findClipsInLassoRect(clips, tracks, {
        startTime: tStart,
        endTime: tEnd,
        minTrackIdx,
        maxTrackIdx,
      });
      const merged = nextState.additive
        ? Array.from(new Set([...nextState.baseIds, ...hits]))
        : hits;
      onSelectClips(merged, merged[merged.length - 1] ?? null);
    }
  };

  const endLassoDrag = () => {
    if (!lassoRect) return;
    if (!lassoRect.moved && !lassoRect.additive) {
      onSelectClips([], null);
    }
    setLassoRect(null);
  };

  const computeDropSlot = (track: TimelineTrack, cursorTime: number) => {
    const laneClips = clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.startTime - b.startTime);
    const laneEnd = laneClips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);

    if (track.type === 'video' && laneClips.length > 0) {
      const firstClip = laneClips[0];
      if (cursorTime <= Math.max(0.85, firstClip.startTime + firstClip.duration * 0.28)) {
        return {
          trackId: track.id,
          startTime: 0,
          placement: 'front' as InsertPlacement,
          label: `Front ${track.label.split(' ')[0]} (Ripple)`,
        };
      }
      if (cursorTime >= Math.max(0, laneEnd - 0.65)) {
        return {
          trackId: track.id,
          startTime: Number(laneEnd.toFixed(2)),
          placement: 'back' as InsertPlacement,
          label: `Back ${track.label.split(' ')[0]} (${formatShortTime(laneEnd)})`,
        };
      }
    }

    const snapped =
      snapEnabled || gridSnapEnabled
        ? computeGridAwareSnapResult({
            candidateTime: cursorTime,
            clips,
            excludeClipIds: [],
            playhead,
            thresholdSeconds: 12 / zoomPxPerSec,
            markerTimes,
            snapEnabled,
            gridSnapEnabled,
            gridStepSec,
            fps: 30,
          }).time
        : cursorTime;
    return {
      trackId: track.id,
      startTime: Number(snapped.toFixed(2)),
      placement: 'time' as InsertPlacement,
      label: `${track.label.split(' ')[0]} @ ${formatShortTime(snapped)}`,
    };
  };

  const findNearestTrackSeam = (
    track: TimelineTrack,
    cursorTime: number
  ): TimelineClipSeam | null => {
    const trackSeams = findTimelineClipSeams(clips, [track]);
    if (trackSeams.length === 0) return null;
    let best: TimelineClipSeam | null = null;
    let bestDist = Infinity;
    for (const seam of trackSeams) {
      const dist = Math.abs(seam.time - cursorTime);
      if (dist < bestDist) {
        bestDist = dist;
        best = seam;
      }
    }
    return best;
  };

  const handleTrackDragOver = (e: React.DragEvent, track: TimelineTrack) => {
    if (track.locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const cursorTime = clientXToTime(e.clientX);

    if (e.dataTransfer.types.includes('application/x-rorn-transition')) {
      const nearestSeam = findNearestTrackSeam(track, cursorTime);
      if (nearestSeam) {
        setHoveredSeamId(nearestSeam.id);
      }
      setDropPreview(null);
      return;
    }

    const slot = computeDropSlot(track, cursorTime);
    setDropPreview(slot);
  };

  const handleTrackDrop = (e: React.DragEvent, track: TimelineTrack) => {
    e.preventDefault();
    setDropPreview(null);
    setHoveredSeamId(null);
    if (track.locked) return;

    const cursorTime = clientXToTime(e.clientX);

    const transPayload = e.dataTransfer.getData('application/x-rorn-transition');
    if (transPayload) {
      try {
        const parsed = JSON.parse(transPayload) as {
          type?: TransitionType;
          duration?: number;
        };
        if (parsed.type) {
          const nearestSeam = findNearestTrackSeam(track, cursorTime);
          if (nearestSeam && onDropTransitionOnSeam) {
            onDropTransitionOnSeam(nearestSeam, parsed.type, parsed.duration ?? 0.7);
            return;
          }
        }
      } catch {
        // Ignore malformed transition payload
      }
      return;
    }

    const slot = computeDropSlot(track, cursorTime);

    const payload = e.dataTransfer.getData('application/x-rorn-asset');
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { assetId?: string };
        if (parsed.assetId) {
          onDropAsset(parsed.assetId, track.id, slot.placement, slot.startTime);
          return;
        }
      } catch {
        // Ignore malformed drag payload
      }
    }

    if (e.dataTransfer.files?.length) {
      onDropFiles(e.dataTransfer.files, track.id, slot.startTime);
    }
  };

  return (
    <section
      className="relative h-[248px] sm:h-[268px] lg:h-[284px] shrink-0 border-t border-white/10 bg-[#0D0F14] flex flex-col select-none"
      aria-label="Multi-Track Timeline"
    >
      {/* Timeline Action Toolbar */}
      <div className="h-10 shrink-0 border-b border-white/10 px-2 lg:px-4 flex items-center justify-between gap-1.5 bg-[#11141B] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={onSplitClip}
            disabled={!selectedClipId}
            aria-label="Split Selected Clip"
            title="Split Selected Clip at Playhead"
            className="min-h-[34px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            type="button"
            onClick={onDuplicateClip}
            disabled={!selectedClipId}
            aria-label="Duplicate Clip"
            title="Duplicate Clip"
            className="min-h-[34px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Duplicate</span>
          </button>
          <button
            type="button"
            onClick={onDeleteClip}
            disabled={selectedClipIds.length === 0 && !selectedClipId}
            aria-label={
              selectedClipIds.length > 1
                ? `Delete ${selectedClipIds.length} Selected Clips`
                : 'Delete Clip'
            }
            title={
              selectedClipIds.length > 1
                ? `Delete ${selectedClipIds.length} Selected Clips`
                : rippleEnabled
                ? 'Ripple Delete Clip'
                : 'Delete Selected Clip'
            }
            className="min-h-[34px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium text-rose-300 hover:bg-rose-500/15 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {selectedClipIds.length > 1 ? `Delete (${selectedClipIds.length})` : 'Delete'}
            </span>
          </button>

          {selectedClipIds.length > 1 && (
            <span
              data-testid="timeline-selection-count"
              className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[10px] font-mono-tabular font-semibold text-amber-200 whitespace-nowrap"
            >
              {selectedClipIds.length} selected
            </span>
          )}

          <div className="hidden sm:flex items-center gap-0.5 border-l border-white/10 pl-1.5 ml-0.5">
            <button
              type="button"
              onClick={() => onNudgeClip(-1)}
              disabled={!selectedClipId}
              aria-label="Nudge Clip Left 1 Frame"
              title="Nudge -1 Frame"
              className="min-h-[32px] px-1.5 flex items-center rounded text-[11px] font-mono-tabular text-zinc-300 hover:bg-white/10 disabled:opacity-35"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              1f
            </button>
            <button
              type="button"
              onClick={() => onNudgeClip(1)}
              disabled={!selectedClipId}
              aria-label="Nudge Clip Right 1 Frame"
              title="Nudge +1 Frame"
              className="min-h-[32px] px-1.5 flex items-center rounded text-[11px] font-mono-tabular text-zinc-300 hover:bg-white/10 disabled:opacity-35"
            >
              1f
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAddMarker}
            aria-label="Add Timeline Marker"
            title="Add Beat / Chapter Marker at Playhead (M)"
            className="min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md border border-cyan-500/35 bg-cyan-500/10 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 whitespace-nowrap"
          >
            <Flag className="w-3 h-3" />
            <span className="hidden sm:inline">Marker</span>
          </button>
          {onAutoBeatMarkers && (
            <button
              type="button"
              onClick={onAutoBeatMarkers}
              data-testid="timeline-beat-markers-btn"
              aria-label="Auto-Detect Audio Beats"
              title="Auto-Detect Audio Beat Markers from Waveform"
              className="min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md border border-orange-500/35 bg-orange-500/10 text-[11px] font-medium text-orange-200 hover:bg-orange-500/20 whitespace-nowrap"
            >
              <Activity className="w-3 h-3 text-orange-300" />
              <span className="hidden sm:inline">Beats</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCompactGaps}
            aria-label="Close Track Gaps"
            title="Close All Empty Gaps on Selected Track"
            className="min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md border border-white/15 bg-white/5 text-[11px] font-medium text-zinc-200 hover:bg-white/10 whitespace-nowrap"
          >
            <AlignHorizontalJustifyStart className="w-3 h-3 text-amber-300" />
            <span className="hidden lg:inline">Close Gaps</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAddMedia('video')}
            aria-label="Add Video to Timeline"
            data-testid="timeline-add-video-btn"
            className="min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md border border-violet-500/35 bg-violet-500/10 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20 whitespace-nowrap"
          >
            <Plus className="w-3 h-3" /> Video
          </button>
          <button
            type="button"
            onClick={() => onOpenAddMedia('audio')}
            aria-label="Add Audio to Timeline"
            data-testid="timeline-add-audio-btn"
            className="min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 whitespace-nowrap"
          >
            <Plus className="w-3 h-3" /> Audio
          </button>

          {onToggleMixer && (
            <button
              type="button"
              onClick={onToggleMixer}
              aria-label="Toggle Multi-Track Audio Mixer"
              aria-pressed={mixerOpen}
              data-testid="toggle-audio-mixer-btn"
              title="Overlay Multi-Track Audio Mixer over Timeline"
              className={`min-h-[30px] px-2 flex items-center gap-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap ${
                mixerOpen
                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100 shadow-sm'
                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Mixer</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleRipple}
            aria-label="Toggle Ripple Edit"
            aria-pressed={rippleEnabled}
            title="Ripple Edit (auto-shift clips on insert or delete)"
            className={`min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              rippleEnabled
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-zinc-400 hover:bg-white/10'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ripple</span>
          </button>

          <button
            type="button"
            onClick={() => setLassoMode((m) => !m)}
            data-testid="timeline-lasso-toggle"
            aria-label="Toggle Lasso Multi-Select"
            aria-pressed={lassoMode}
            title="Lasso Multi-Select (or drag empty lane space / Ctrl+Click clips)"
            className={`min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              lassoMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:bg-white/10'
            }`}
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lasso</span>
          </button>

          <button
            type="button"
            onClick={onToggleSnap}
            aria-label="Toggle Magnetic Snap"
            aria-pressed={snapEnabled}
            title="Magnetic Snapping (clip edges, markers & playhead)"
            className={`min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              snapEnabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Snap</span>
          </button>

          <button
            type="button"
            onClick={onToggleGridSnap}
            data-testid="timeline-grid-toggle"
            aria-label="Toggle Visual Snap-to-Grid"
            aria-pressed={gridSnapEnabled}
            title={`Visual Snap-to-Grid (${gridStepSec}s grid + frame boundaries)`}
            className={`min-h-[30px] px-1.5 sm:px-2 flex items-center gap-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              gridSnapEnabled
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                : 'text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0B0D12] px-0.5 sm:px-1">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(24, zoomPxPerSec - 14))}
              aria-label="Zoom Out Timeline"
              className="min-h-[28px] min-w-[26px] flex items-center justify-center text-zinc-300 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] sm:text-[11px] font-mono-tabular text-zinc-400 w-8 sm:w-9 text-center">
              {Math.round((zoomPxPerSec / 64) * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(180, zoomPxPerSec + 14))}
              aria-label="Zoom In Timeline"
              className="min-h-[28px] min-w-[26px] flex items-center justify-center text-zinc-300 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Headers + Scrollable Lanes */}
      <div className="flex-1 min-h-0 flex overflow-y-auto overflow-x-hidden studio-scroll">
        {/* Track Left Headers */}
        <div className="w-[98px] sm:w-[156px] shrink-0 border-r border-white/10 bg-[#0E1117] flex flex-col">
          <div className="h-7 shrink-0 border-b border-white/10 px-2 flex items-center text-[10px] font-mono-tabular text-zinc-500 sticky top-0 bg-[#0E1117] z-10">
            TRACKS ({tracks.length})
          </div>
          <div className="divide-y divide-white/5">
            {tracks.map((tr) => (
              <div
                key={tr.id}
                style={{ height: `${trackRowHeight}px` }}
                className="px-1.5 sm:px-2 flex items-center justify-between gap-1"
              >
                <div className="min-w-[20px] flex items-center gap-1 truncate">
                  <span className="text-[11px] font-medium text-zinc-200 truncate">
                    <span className="sm:hidden font-mono-tabular">{tr.label.split(' ')[0]}</span>
                    <span className="hidden sm:inline">{tr.label}</span>
                  </span>
                  {(tr.type === 'audio' || getTrackVolumePct(tr) !== 100) && (
                    <span
                      data-testid={`track-volume-badge-${tr.id}`}
                      className="hidden sm:inline text-[9px] font-mono-tabular text-emerald-300/85 shrink-0"
                    >
                      {getTrackVolumePct(tr)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleTrackFlag(tr.id, 'solo')}
                    aria-label={`Solo ${tr.label}`}
                    aria-pressed={Boolean(tr.solo)}
                    title={`Solo ${tr.label}`}
                    className={`px-1 py-0.5 rounded text-[10px] font-mono-tabular font-bold hover:bg-white/10 ${
                      tr.solo ? 'bg-amber-500 text-zinc-950' : 'text-zinc-500'
                    }`}
                  >
                    S
                  </button>
                  {tr.type === 'audio' || tr.type === 'video' ? (
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(tr.id, 'muted')}
                      aria-label={`Mute ${tr.label}`}
                      aria-pressed={tr.muted}
                      className={`p-1 rounded hover:bg-white/10 ${
                        tr.muted ? 'text-rose-400' : 'text-zinc-500'
                      }`}
                    >
                      {tr.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(tr.id, 'hidden')}
                      aria-label={`Hide ${tr.label}`}
                      aria-pressed={tr.hidden}
                      className={`p-1 rounded hover:bg-white/10 ${
                        tr.hidden ? 'text-rose-400' : 'text-zinc-500'
                      }`}
                    >
                      {tr.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleTrackFlag(tr.id, 'locked')}
                    aria-label={`Lock ${tr.label}`}
                    aria-pressed={tr.locked}
                    className={`p-1 rounded hover:bg-white/10 ${
                      tr.locked ? 'text-amber-400' : 'text-zinc-500'
                    }`}
                  >
                    {tr.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  {!BASE_TRACK_IDS.has(tr.id) && (
                    <button
                      type="button"
                      onClick={() => onDeleteTrack(tr.id)}
                      aria-label={`Delete ${tr.label}`}
                      title={`Remove ${tr.label}`}
                      className="p-0.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Ruler & Tracks */}
        <div
          ref={scrollRef}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropPreview(null);
              setHoveredSeamId(null);
            }
          }}
          className="flex-1 overflow-x-auto overflow-y-visible studio-scroll relative bg-[#090B0F]"
        >
          <div style={{ width: `${timelineWidthPx}px` }} className="relative flex flex-col">
            {/* Sticky Time Ruler */}
            <div
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              className="h-7 shrink-0 border-b border-white/10 bg-[#11141C] relative cursor-ew-resize sticky top-0 z-20"
              role="slider"
              aria-label="Timeline Playhead Scrubber"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalDuration)}
              aria-valuenow={Number(playhead.toFixed(1))}
              tabIndex={0}
            >
              {rulerTicks.map((t) => (
                <div
                  key={t}
                  style={{ left: `${t * zoomPxPerSec}px` }}
                  className="absolute top-0 bottom-0 border-l border-white/15 pl-1 flex items-end pb-0.5"
                >
                  <span className="text-[9px] font-mono-tabular text-zinc-500 leading-none">
                    {formatShortTime(t)}
                  </span>
                </div>
              ))}

              {/* Timeline Beat / Chapter Markers */}
              {markers.map((m) => (
                <div
                  key={m.id}
                  style={{ left: `${m.time * zoomPxPerSec}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSeek(m.time);
                  }}
                  title={`${m.label} (${formatShortTime(m.time)}) — click to jump`}
                  className="absolute top-0.5 z-30 flex items-center gap-1 pl-1 pr-1 py-[1px] rounded-r bg-cyan-500/90 border-l-2 border-cyan-200 text-zinc-950 text-[9px] font-bold shadow-sm cursor-pointer hover:bg-cyan-400 leading-tight"
                >
                  <span className="whitespace-nowrap">{m.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove marker ${m.label}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onRemoveMarker(m.id);
                    }}
                    className="hover:text-rose-800"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Track Lanes (Drop Targets + Grid Overlay + Lasso + Clips) */}
            <div
              ref={lanesRef}
              data-testid="timeline-lanes-surface"
              onPointerDown={startLassoDrag}
              onPointerMove={moveLassoDrag}
              onPointerUp={endLassoDrag}
              onPointerCancel={endLassoDrag}
              className={`divide-y divide-white/5 relative touch-none ${
                lassoMode ? 'cursor-crosshair' : ''
              }`}
            >
              {/* Visual Snap-to-Grid Vertical Lines */}
              {gridSnapEnabled && (
                <div
                  data-testid="timeline-grid-overlay"
                  className="absolute inset-0 pointer-events-none z-0"
                >
                  {gridLines.map((t) => {
                    const isMajor = Math.abs(t - Math.round(t)) < 1e-4;
                    return (
                      <div
                        key={t}
                        style={{ left: `${t * zoomPxPerSec}px` }}
                        className={`absolute top-0 bottom-0 border-l ${
                          isMajor ? 'border-cyan-400/20' : 'border-white/[0.06]'
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Lasso Selection Marquee Rectangle */}
              {lassoRect && lassoRect.moved && (
                <div
                  data-testid="timeline-lasso-rect"
                  style={{
                    left: `${Math.min(lassoRect.startX, lassoRect.currX)}px`,
                    top: `${Math.min(lassoRect.startY, lassoRect.currY)}px`,
                    width: `${Math.max(2, Math.abs(lassoRect.currX - lassoRect.startX))}px`,
                    height: `${Math.max(2, Math.abs(lassoRect.currY - lassoRect.startY))}px`,
                  }}
                  className="absolute border border-amber-400 bg-amber-400/15 rounded-xs pointer-events-none z-35"
                />
              )}

              {tracks.map((tr) => {
                const trackClips = clips.filter((c) => c.trackId === tr.id);
                const trackSeams = findTimelineClipSeams(clips, [tr]);
                const isDropTarget = dropPreview?.trackId === tr.id;
                const isDragHovered = dragState?.hoverTrackId === tr.id;
                return (
                  <div
                    key={tr.id}
                    style={{ height: `${trackRowHeight}px` }}
                    onDragOver={(e) => handleTrackDragOver(e, tr)}
                    onDrop={(e) => handleTrackDrop(e, tr)}
                    data-track-row-id={tr.id}
                    data-testid={`track-lane-${tr.id}`}
                    className={`relative transition-colors ${
                      tr.locked ? 'opacity-65' : ''
                    } ${
                      isDropTarget
                        ? 'bg-amber-500/10'
                        : isDragHovered
                        ? dragState?.hoverTrackCompatible
                          ? 'bg-sky-500/12 ring-1 ring-inset ring-sky-400/40'
                          : 'bg-rose-500/10'
                        : ''
                    }`}
                  >
                    {/* Drag & Drop Ghost Preview Bar */}
                    {isDropTarget && dropPreview && (
                      <div
                        style={{
                          left: `${dropPreview.startTime * zoomPxPerSec}px`,
                          width: `${Math.max(76, 3.5 * zoomPxPerSec)}px`,
                        }}
                        className="absolute top-1 bottom-1 rounded-md border-2 border-dashed border-amber-400 bg-amber-500/20 pointer-events-none z-20 flex items-center px-2"
                      >
                        <span className="text-[10px] font-semibold text-amber-200 whitespace-nowrap">
                          {dropPreview.label}
                        </span>
                      </div>
                    )}

                    {trackClips.map((clip) => {
                      const leftPx = clip.startTime * zoomPxPerSec;
                      const widthPx = Math.max(28, clip.duration * zoomPxPerSec);
                      const isSelected =
                        clip.id === selectedClipId || selectedClipIds.includes(clip.id);
                      const isDraggingThis = dragState?.clipId === clip.id;
                      const asset = assetMap.get(clip.assetId);
                      const colorCls =
                        clip.kind === 'emoji'
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-100'
                          : TRACK_COLORS[tr.type] ?? TRACK_COLORS.video;
                      const totalKfCount =
                        clip.keyframes.length + (clip.audioKeyframes?.length ?? 0);

                      return (
                        <div
                          key={clip.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Select clip ${clip.name}`}
                          aria-pressed={isSelected}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (e.ctrlKey || e.metaKey) {
                                const next = toggleClipInSelection(
                                  selectedClipIds,
                                  clip.id,
                                  true
                                );
                                onSelectClips(next.selectedIds, next.primaryId);
                              } else {
                                onSelectClip(clip.id);
                              }
                            }
                          }}
                          style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                          onPointerDown={(e) => startClipDrag(e, clip, 'move')}
                          onPointerMove={moveClipDrag}
                          onPointerUp={endClipDrag}
                          onPointerCancel={endClipDrag}
                          data-testid={`timeline-clip-${clip.id}`}
                          className={`group absolute top-1 bottom-1 rounded-md border overflow-visible cursor-grab active:cursor-grabbing touch-none transition-shadow ${colorCls} ${
                            isSelected ? 'ring-2 ring-amber-400 shadow-lg z-10' : 'hover:brightness-110'
                          }`}
                        >
                          {/* Live Floating Trim / Move Telemetry Pill */}
                          {isDraggingThis && dragState && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-950/95 border border-amber-400/60 text-[10px] font-mono-tabular text-amber-200 whitespace-nowrap z-40 pointer-events-none shadow-md">
                              {tr.label.split(' ')[0]} · In {formatShortTime(dragState.liveStart)} · Dur{' '}
                              {formatShortTime(dragState.liveDuration)}
                            </div>
                          )}

                          <div className="relative w-full h-full rounded-md overflow-hidden">
                            {/* Left tactile trim handle */}
                            <button
                              type="button"
                              aria-label={`Trim start of ${clip.name}`}
                              onPointerDown={(e) => startClipDrag(e, clip, 'trimLeft')}
                              onPointerMove={moveClipDrag}
                              onPointerUp={endClipDrag}
                              onPointerCancel={endClipDrag}
                              className={`absolute left-0 top-0 bottom-0 w-3 sm:w-2.5 flex items-center justify-center cursor-ew-resize touch-none z-20 transition-colors ${
                                isSelected
                                  ? 'bg-amber-400/35 hover:bg-amber-400/75'
                                  : 'bg-white/10 hover:bg-amber-400/70'
                              }`}
                            >
                              <span className="w-[2px] h-3.5 rounded-full bg-white/75 pointer-events-none" />
                            </button>

                            {/* Waveform background for audio */}
                            {asset?.waveform && (
                              <div className="absolute inset-0 flex items-center gap-[1px] px-3 opacity-45 pointer-events-none">
                                {asset.waveform.map((val, idx) => (
                                  <div
                                    key={idx}
                                    style={{ height: `${Math.round(val * 75)}%` }}
                                    className="flex-1 bg-emerald-300 rounded-full min-w-[1px]"
                                  />
                                ))}
                              </div>
                            )}

                            {/* Audio keyframe envelope dots */}
                            {(clip.audioKeyframes ?? []).map((akf) => {
                              const pct = Math.max(
                                4,
                                Math.min(96, (akf.time / Math.max(0.1, clip.duration)) * 100)
                              );
                              const yPct = Math.max(
                                12,
                                Math.min(88, 100 - (akf.volume / 200) * 100)
                              );
                              return (
                                <div
                                  key={akf.id}
                                  style={{ left: `${pct}%`, top: `${yPct}%` }}
                                  className="absolute w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber-300 pointer-events-none z-10"
                                />
                              );
                            })}

                            {/* Clip label & indicators */}
                            <div className="relative z-10 px-3.5 h-full flex items-center justify-between gap-1.5 pointer-events-none">
                              <span className="text-[11px] font-medium truncate drop-shadow-xs">
                                {clip.emojiConfig ? `${clip.emojiConfig.emoji} ${clip.name}` : clip.name}
                              </span>
                              {(clip.audio.targetLufs !== undefined || clip.speed !== 1 || totalKfCount > 0) && (
                                <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono-tabular bg-[#090B0F]/75 px-1.5 py-0.5 rounded">
                                  {clip.audio.targetLufs !== undefined && (
                                    <span className="text-emerald-300">{clip.audio.targetLufs}LU</span>
                                  )}
                                  {clip.speed !== 1 && <span>{clip.speed}x</span>}
                                  {totalKfCount > 0 && (
                                    <span className="text-amber-300" title="Keyframed">
                                      ◆{totalKfCount}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right tactile trim handle */}
                            <button
                              type="button"
                              aria-label={`Trim end of ${clip.name}`}
                              onPointerDown={(e) => startClipDrag(e, clip, 'trimRight')}
                              onPointerMove={moveClipDrag}
                              onPointerUp={endClipDrag}
                              onPointerCancel={endClipDrag}
                              className={`absolute right-0 top-0 bottom-0 w-3 sm:w-2.5 flex items-center justify-center cursor-ew-resize touch-none z-20 transition-colors ${
                                isSelected
                                  ? 'bg-amber-400/35 hover:bg-amber-400/75'
                                  : 'bg-white/10 hover:bg-amber-400/70'
                              }`}
                            >
                              <span className="w-[2px] h-3.5 rounded-full bg-white/75 pointer-events-none" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Between-Clip Transition Cut Seams (Drag & Drop or Click) */}
                    {trackSeams.map((seam) => {
                      const hasTrans = seam.transition.type !== 'none';
                      const transDef = transitionLabelMap.get(seam.transition.type);
                      const isSeamHovered = hoveredSeamId === seam.id;
                      const seamX = seam.time * zoomPxPerSec;

                      return (
                        <button
                          key={seam.id}
                          type="button"
                          data-testid={`timeline-seam-${seam.id}`}
                          data-transition-type={seam.transition.type}
                          aria-label={`Transition cut between ${seam.leftClipName} and ${seam.rightClipName}: ${
                            hasTrans ? transDef?.label ?? seam.transition.type : 'Hard Cut'
                          }`}
                          title={
                            hasTrans
                              ? `${transDef?.label ?? seam.transition.type} (${seam.transition.duration}s) — drop transition or click to change`
                              : 'Drop transition here or click to open Transition Library'
                          }
                          style={{ left: `${seamX}px` }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTransitionLibraryForSeam?.(seam);
                          }}
                          onDragOver={(e) => {
                            if (!e.dataTransfer.types.includes('application/x-rorn-transition')) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'copy';
                            setHoveredSeamId(seam.id);
                          }}
                          onDragLeave={(e) => {
                            e.stopPropagation();
                            if (hoveredSeamId === seam.id) setHoveredSeamId(null);
                          }}
                          onDrop={(e) => {
                            const payload = e.dataTransfer.getData('application/x-rorn-transition');
                            if (!payload) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setHoveredSeamId(null);
                            try {
                              const parsed = JSON.parse(payload) as {
                                type?: TransitionType;
                                duration?: number;
                              };
                              if (parsed.type && onDropTransitionOnSeam) {
                                onDropTransitionOnSeam(seam, parsed.type, parsed.duration ?? 0.7);
                              }
                            } catch {
                              // Ignore malformed transition drag payload
                            }
                          }}
                          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center gap-1 rounded-full border backdrop-blur-md transition-all cursor-pointer ${
                            isSeamHovered
                              ? 'h-8 px-2.5 scale-110 border-amber-300 bg-amber-500/85 text-zinc-950 font-bold shadow-[0_0_20px_rgba(245,158,11,0.75)]'
                              : isDraggingTransitionFromLibrary
                              ? 'h-7 px-2 border-cyan-300 bg-cyan-500/35 text-white animate-pulse shadow-[0_0_16px_rgba(34,211,238,0.55)]'
                              : hasTrans
                              ? 'h-5 px-1.5 border-cyan-400/70 bg-[#0B1220]/85 text-cyan-200 hover:bg-cyan-500/30 hover:scale-105 shadow-md'
                              : 'w-5 h-5 border-white/25 bg-[#0B0F17]/80 text-zinc-300 hover:border-cyan-400 hover:text-cyan-200 hover:scale-110'
                          }`}
                        >
                          <Sparkles className="w-2.5 h-2.5 shrink-0" />
                          {(hasTrans || isSeamHovered || isDraggingTransitionFromLibrary) && (
                            <span className="text-[9px] font-semibold whitespace-nowrap leading-none max-w-[66px] truncate">
                              {isSeamHovered
                                ? 'Drop Here'
                                : hasTrans
                                ? transDef?.label ?? seam.transition.type
                                : 'Drop'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Magnetic Snap Hairline Guide */}
            {snapGuideTime !== null && (
              <div
                style={{ transform: `translateX(${snapGuideTime * zoomPxPerSec}px)` }}
                className="absolute top-0 bottom-0 left-0 w-[1.5px] bg-sky-400/90 pointer-events-none z-25"
              />
            )}

            {/* Playhead Needle */}
            <div
              style={{ transform: `translateX(${playhead * zoomPxPerSec}px)` }}
              className="absolute top-0 bottom-0 left-0 w-[2px] bg-amber-400 pointer-events-none z-30"
            >
              <div className="w-3 h-3 -ml-[5px] bg-amber-400 rotate-45 -mt-0.5 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Translucent Multi-Track Audio Mixer Overlay */}
      <AudioMixerOverlay
        open={mixerOpen}
        tracks={tracks}
        clips={clips}
        assets={assets}
        playhead={playhead}
        isPlaying={isPlaying}
        masterVolumePct={masterVolumePct}
        masterMuted={masterMuted}
        getLiveAudioLevels={getLiveAudioLevels}
        onChangeTrackVolume={(trackId, vol) => onChangeTrackVolume?.(trackId, vol)}
        onChangeTrackPan={(trackId, pan) => onChangeTrackPan?.(trackId, pan)}
        onStartTrackDrag={() => {
          if (!preDragTracksRef.current) {
            preDragTracksRef.current = tracks.map((t) => ({ ...t }));
          }
        }}
        onCommitTrackDrag={() => {
          if (preDragTracksRef.current && onCommitTracksHistory) {
            onCommitTracksHistory(preDragTracksRef.current);
          }
          preDragTracksRef.current = null;
        }}
        onToggleTrackFlag={onToggleTrackFlag}
        onChangeMasterVolume={(vol) => onChangeMasterVolume?.(vol)}
        onToggleMasterMute={() => onToggleMasterMute?.()}
        onAddAudioTrack={() => onAddAudioTrack?.()}
        onResetMix={() => onResetMix?.()}
        onClose={() => onToggleMixer?.()}
      />
    </section>
  );
};
