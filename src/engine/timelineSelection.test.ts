import test from 'node:test';
import assert from 'node:assert/strict';
import type { TimelineClip, TimelineTrack } from '../types/editor';
import {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
} from './timelineMath';
import {
  deleteSelectedClips,
  findClipsInLassoRect,
  moveSelectedClipsGroup,
  toggleClipInSelection,
} from './timelineSelection';

function makeClip(id: string, trackId: string, startTime: number, duration: number): TimelineClip {
  return {
    id,
    assetId: 'asset_1',
    trackId,
    name: id,
    kind: 'image',
    startTime,
    duration,
    sourceOffset: 0,
    speed: 1,
    speedRamp: 'none',
    reversed: false,
    freezeFrame: false,
    blendMode: 'source-over',
    transform: { ...DEFAULT_TRANSFORM },
    keyframes: [],
    audioKeyframes: [],
    colorGrade: { ...DEFAULT_COLOR_GRADE },
    vfx: { ...DEFAULT_VFX },
    chromaKey: { ...DEFAULT_CHROMA_KEY },
    transitionIn: { type: 'none', duration: 0.5 },
    audio: { ...DEFAULT_AUDIO_CONFIG },
  };
}

const TRACKS: TimelineTrack[] = [
  { id: 't1', type: 'text', role: 'titles', label: 'T1', muted: false, locked: false, hidden: false },
  { id: 'v1', type: 'video', role: 'main', label: 'V1', muted: false, locked: false, hidden: false },
  { id: 'a1', type: 'audio', role: 'music', label: 'A1', muted: false, locked: false, hidden: false },
];

test('toggleClipInSelection handles single click and Ctrl+Click add/remove', () => {
  const s1 = toggleClipInSelection(['c1'], 'c2', false);
  assert.deepEqual(s1.selectedIds, ['c2']);
  assert.equal(s1.primaryId, 'c2');

  const s2 = toggleClipInSelection(['c1'], 'c2', true);
  assert.deepEqual(s2.selectedIds, ['c1', 'c2']);
  assert.equal(s2.primaryId, 'c2');

  const s3 = toggleClipInSelection(['c1', 'c2'], 'c1', true);
  assert.deepEqual(s3.selectedIds, ['c2']);
  assert.equal(s3.primaryId, 'c2');
});

test('findClipsInLassoRect captures all intersecting clips across tracks', () => {
  const clips = [
    makeClip('c_text', 't1', 1.0, 2.5),
    makeClip('c_vid1', 'v1', 0.0, 4.0),
    makeClip('c_vid2', 'v1', 6.0, 3.0),
    makeClip('c_aud', 'a1', 2.0, 5.0),
  ];

  const found = findClipsInLassoRect(clips, TRACKS, {
    startTime: 1.5,
    endTime: 3.5,
    minTrackIdx: 0,
    maxTrackIdx: 1,
  });
  assert.deepEqual(found, ['c_text', 'c_vid1']);
});

test('moveSelectedClipsGroup moves multi-selection together and clamps to 0s floor', () => {
  const clips = [
    makeClip('c1', 'v1', 1.0, 2.0),
    makeClip('c2', 't1', 3.0, 2.0),
    makeClip('c3', 'v1', 8.0, 2.0),
  ];

  const movedRight = moveSelectedClipsGroup({
    clips,
    selectedIds: ['c1', 'c2'],
    anchorClipId: 'c2',
    targetAnchorStart: 4.5,
    origStartsById: { c1: 1.0, c2: 3.0 },
  });
  assert.equal(movedRight.find((c) => c.id === 'c1')?.startTime, 2.5);
  assert.equal(movedRight.find((c) => c.id === 'c2')?.startTime, 4.5);
  assert.equal(movedRight.find((c) => c.id === 'c3')?.startTime, 8.0);

  // Attempting to push anchor c2 to 0s (delta = -3) clamps at delta = -1 because c1 starts at 1.0
  const clamped = moveSelectedClipsGroup({
    clips,
    selectedIds: ['c1', 'c2'],
    anchorClipId: 'c2',
    targetAnchorStart: 0.0,
    origStartsById: { c1: 1.0, c2: 3.0 },
  });
  assert.equal(clamped.find((c) => c.id === 'c1')?.startTime, 0);
  assert.equal(clamped.find((c) => c.id === 'c2')?.startTime, 2);
});

test('deleteSelectedClips deletes multiple selected clips with or without ripple', () => {
  const clips = [
    makeClip('c1', 'v1', 0, 2),
    makeClip('c2', 'v1', 2, 3),
    makeClip('c3', 'v1', 5, 4),
    makeClip('c4', 't1', 1, 2),
  ];

  const nonRipple = deleteSelectedClips(clips, ['c1', 'c4'], false);
  assert.deepEqual(
    nonRipple.map((c) => c.id),
    ['c2', 'c3']
  );

  const rippled = deleteSelectedClips(clips, ['c1', 'c2'], true);
  assert.equal(rippled.find((c) => c.id === 'c3')?.startTime, 0);
  assert.equal(rippled.find((c) => c.id === 'c4')?.startTime, 1);
});
