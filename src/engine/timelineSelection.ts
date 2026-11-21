import type { TimelineClip, TimelineTrack } from '../types/editor';
import { moveClipToTrackAndTime, rippleDeleteClip } from './timelineMath';

export interface LassoTimeTrackRect {
  startTime: number;
  endTime: number;
  minTrackIdx: number;
  maxTrackIdx: number;
}

/**
 * Computes next multi-selection set and primary clip id on clip pointer selection.
 */
export function toggleClipInSelection(
  currentIds: string[],
  clipId: string,
  multiKey: boolean
): { selectedIds: string[]; primaryId: string | null } {
  if (!multiKey) {
    return { selectedIds: [clipId], primaryId: clipId };
  }

  if (currentIds.includes(clipId)) {
    const next = currentIds.filter((id) => id !== clipId);
    return {
      selectedIds: next,
      primaryId: next.length > 0 ? next[next.length - 1] : null,
    };
  }

  const next = [...currentIds, clipId];
  return { selectedIds: next, primaryId: clipId };
}

/**
 * Returns IDs of all clips whose time range and track index intersect the lasso marquee.
 */
export function findClipsInLassoRect(
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  rect: LassoTimeTrackRect
): string[] {
  const tMin = Math.min(rect.startTime, rect.endTime);
  const tMax = Math.max(rect.startTime, rect.endTime);
  const rMin = Math.min(rect.minTrackIdx, rect.maxTrackIdx);
  const rMax = Math.max(rect.minTrackIdx, rect.maxTrackIdx);

  const trackIndexById = new Map(tracks.map((t, i) => [t.id, i]));
  const selected: string[] = [];

  for (const c of clips) {
    const idx = trackIndexById.get(c.trackId);
    if (idx === undefined) continue;
    if (idx < rMin || idx > rMax) continue;
    const cEnd = c.startTime + c.duration;
    if (cEnd >= tMin && c.startTime <= tMax) {
      selected.push(c.id);
    }
  }
  return selected;
}

/**
 * Shifts all selected clips together by the exact delta applied to anchorClipId,
 * clamping delta so no clip in the group crosses below 0.000s.
 */
export function moveSelectedClipsGroup(params: {
  clips: TimelineClip[];
  selectedIds: string[];
  anchorClipId: string;
  targetAnchorStart: number;
  origStartsById: Record<string, number>;
  anchorTargetTrack?: TimelineTrack;
}): TimelineClip[] {
  const {
    clips,
    selectedIds,
    anchorClipId,
    targetAnchorStart,
    origStartsById,
    anchorTargetTrack,
  } = params;

  const idSet = new Set(selectedIds.length > 0 ? selectedIds : [anchorClipId]);
  if (!idSet.has(anchorClipId)) idSet.add(anchorClipId);

  const anchorOrigStart = origStartsById[anchorClipId] ?? 0;
  let delta = targetAnchorStart - anchorOrigStart;

  // Prevent any clip in the selected group from sliding below 0s
  for (const id of idSet) {
    const orig = origStartsById[id];
    if (orig !== undefined && orig + delta < 0) {
      delta = -orig;
    }
  }

  return clips.map((c) => {
    if (!idSet.has(c.id)) return c;
    const orig = origStartsById[c.id] ?? c.startTime;
    const nextStart = Math.max(0, Number((orig + delta).toFixed(3)));
    if (c.id === anchorClipId && anchorTargetTrack && idSet.size === 1) {
      return moveClipToTrackAndTime(c, anchorTargetTrack, nextStart);
    }
    return { ...c, startTime: nextStart };
  });
}

/**
 * Removes all selected clips cleanly (using ripple delete for single selection
 * when ripple is active, and deterministic right-to-left ripple or clean removal for multi-select).
 */
export function deleteSelectedClips(
  clips: TimelineClip[],
  selectedIds: string[],
  ripple: boolean
): TimelineClip[] {
  const uniqueIds = Array.from(new Set(selectedIds));
  if (uniqueIds.length === 0) return clips;
  if (uniqueIds.length === 1) {
    return ripple
      ? rippleDeleteClip(clips, uniqueIds[0])
      : clips.filter((c) => c.id !== uniqueIds[0]);
  }

  if (!ripple) {
    const idSet = new Set(uniqueIds);
    return clips.filter((c) => !idSet.has(c.id));
  }

  // Delete right-to-left by startTime so earlier indices stay valid during ripple shifts
  const orderedToDelete = [...uniqueIds]
    .map((id) => clips.find((c) => c.id === id))
    .filter((c): c is TimelineClip => Boolean(c))
    .sort((a, b) => b.startTime - a.startTime);

  let next = clips;
  for (const target of orderedToDelete) {
    next = rippleDeleteClip(next, target.id);
  }
  return next;
}
