import type {
  AspectRatio,
  TimelineClip,
  TimelineMarker,
  TimelineTrack,
} from '../types/editor';
import {
  INITIAL_TRACKS,
  SAMPLE_IMAGES,
  createInitialClips,
} from './sampleProject';
import { getProjectDuration } from './timelineMath';

export const PROJECTS_STORAGE_KEY = 'rorn.projects.v1';

export interface SavedProjectRecord {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
  playhead: number;
  durationSec: number;
  progressPct: number;
  createdAt: number;
  updatedAt: number;
  thumbnailSrc?: string;
  clipCount: number;
  exportedCount: number;
}

export function computeProjectProgress(params: {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  playhead: number;
  exportedCount?: number;
}): number {
  const { clips, exportedCount = 0 } = params;
  if (clips.length === 0) {
    return 10;
  }

  let score = 25; // Has clips on timeline
  const hasAudio = clips.some((c) => c.kind === 'audio');
  const hasVisual = clips.some((c) => c.kind === 'video' || c.kind === 'image');
  const hasOverlayOrText = clips.some((c) => c.kind === 'text' || c.trackId === 'track_v2');

  if (clips.length >= 2 || (hasAudio && hasVisual)) {
    score += 20;
  }
  if (hasOverlayOrText) {
    score += 10;
  }

  const hasColorOrVfx = clips.some(
    (c) =>
      c.colorGrade.lutId !== 'none' ||
      c.colorGrade.contrast !== 0 ||
      c.colorGrade.vignette > 0 ||
      c.chromaKey.enabled ||
      Object.values(c.vfx ?? {}).some((v) => v > 0)
  );
  if (hasColorOrVfx) {
    score += 15;
  }

  const hasMotionOrTransitions = clips.some(
    (c) =>
      c.keyframes.length > 0 ||
      (c.audioKeyframes?.length ?? 0) > 0 ||
      c.transitionIn.type !== 'none'
  );
  if (hasMotionOrTransitions) {
    score += 15;
  }

  const duration = getProjectDuration(clips);
  if (duration >= 4) {
    score += 5;
  }

  if (exportedCount > 0) {
    score += 10;
  }

  return Math.min(100, Math.max(10, score));
}

export function formatProjectDateTime(timestampMs: number): string {
  try {
    const d = new Date(timestampMs);
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return 'Just now';
  }
}

export function createSeedDemoProject(nowMs: number = Date.now()): SavedProjectRecord {
  const tracks = INITIAL_TRACKS.map((t) => ({ ...t }));
  const clips = createInitialClips();
  const markers: TimelineMarker[] = [
    { id: 'mk_intro', time: 0, label: 'Intro', color: '#22d3ee' },
    { id: 'mk_drop', time: 5.5, label: 'Scene Cut', color: '#22d3ee' },
  ];
  const durationSec = Number(getProjectDuration(clips).toFixed(1));
  return {
    id: 'proj_golden_horizon',
    title: 'Golden Horizon Reel',
    aspectRatio: '16:9',
    tracks,
    clips,
    markers,
    playhead: 1.2,
    durationSec,
    progressPct: computeProjectProgress({ clips, tracks, playhead: 1.2, exportedCount: 0 }),
    createdAt: nowMs - 1000 * 60 * 42,
    updatedAt: nowMs - 1000 * 60 * 12,
    thumbnailSrc: SAMPLE_IMAGES.mountain,
    clipCount: clips.length,
    exportedCount: 0,
  };
}

export function createNewBlankProjectRecord(
  existingProjects: SavedProjectRecord[],
  nowMs: number = Date.now()
): SavedProjectRecord {
  const nextNumber = existingProjects.length + 1;
  const tracks = INITIAL_TRACKS.map((t) => ({ ...t }));
  return {
    id: `proj_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    title: `Untitled Project ${nextNumber}`,
    aspectRatio: '16:9',
    tracks,
    clips: [],
    markers: [],
    playhead: 0,
    durationSec: 0,
    progressPct: 10,
    createdAt: nowMs,
    updatedAt: nowMs,
    thumbnailSrc: undefined,
    clipCount: 0,
    exportedCount: 0,
  };
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadSavedProjects(): SavedProjectRecord[] {
  const storage = getSafeStorage();
  if (!storage) {
    return [createSeedDemoProject()];
  }
  try {
    const raw = storage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) {
      const seeded = [createSeedDemoProject()];
      storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = [createSeedDemoProject()];
      storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return [...parsed].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [createSeedDemoProject()];
  }
}

export function saveAllProjects(projects: SavedProjectRecord[]): SavedProjectRecord[] {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }
  return sorted;
}

export function upsertSavedProject(
  record: SavedProjectRecord,
  currentList?: SavedProjectRecord[]
): SavedProjectRecord[] {
  const existing = currentList ?? loadSavedProjects();
  const idx = existing.findIndex((p) => p.id === record.id);
  const next =
    idx >= 0
      ? existing.map((p) => (p.id === record.id ? record : p))
      : [record, ...existing];
  return saveAllProjects(next);
}

export function deleteSavedProject(
  projectId: string,
  currentList?: SavedProjectRecord[]
): SavedProjectRecord[] {
  const existing = currentList ?? loadSavedProjects();
  const next = existing.filter((p) => p.id !== projectId);
  return saveAllProjects(next);
}
