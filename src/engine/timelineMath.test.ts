import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
  adjustClipDuration,
  appendClipAtBack,
  clampTrimEdit,
  compactTrackGaps,
  computeAudioGainAtTime,
  computeAutoDuckKeyframes,
  computeSnapResult,
  evaluateAudioKeyframes,
  evaluateKeyframes,
  findSnapTime,
  formatTimecode,
  getCanvasDimensions,
  getEffectiveSpeedAtTime,
  getProjectDuration,
  insertClipAtFront,
  insertClipAtTime,
  moveClipToTrackAndTime,
  nudgeClipStart,
  rippleDeleteClip,
  splitClipAtTime,
} from './timelineMath';
import type { TimelineClip, TimelineTrack } from '../types/editor';

function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip_1',
    assetId: 'asset_1',
    trackId: 'track_v1',
    name: 'Test Clip',
    kind: 'video',
    startTime: 2,
    duration: 6,
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
    ...overrides,
  };
}

test('formatTimecode renders SMPTE HH:MM:SS:FF accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00:00');
  assert.equal(formatTimecode(1.5, 30), '00:00:01:15');
  assert.equal(formatTimecode(65.25, 24), '00:01:05:06');
  assert.equal(formatTimecode(-4, 30), '00:00:00:00');
});

test('getProjectDuration computes maximum end timestamp', () => {
  const c1 = makeClip({ startTime: 0, duration: 4 });
  const c2 = makeClip({ id: 'c2', startTime: 3.5, duration: 5 });
  assert.equal(getProjectDuration([c1, c2]), 8.5);
  assert.equal(getProjectDuration([]), 0);
});

test('evaluateKeyframes interpolates linear and eased curves', () => {
  const clip = makeClip({
    keyframes: [
      { id: 'k1', time: 0, easing: 'linear', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      { id: 'k2', time: 4, easing: 'linear', x: 0.4, y: -0.2, scale: 1.5, rotation: 90, opacity: 0.5 },
    ],
  });
  const mid = evaluateKeyframes(clip, 2);
  assert.ok(Math.abs(mid.x - 0.2) < 1e-6);
  assert.ok(Math.abs(mid.scale - 1.25) < 1e-6);
  assert.ok(Math.abs(mid.rotation - 45) < 1e-6);
  assert.ok(Math.abs(mid.opacity - 0.75) < 1e-6);
});

test('evaluateAudioKeyframes interpolates stereo pan and volume smoothly', () => {
  const clip = makeClip({
    kind: 'audio',
    duration: 4,
    audioKeyframes: [
      { id: 'a1', time: 0, easing: 'linear', volume: 50, pan: -100 },
      { id: 'a2', time: 4, easing: 'linear', volume: 150, pan: 100 },
    ],
  });
  const mid = evaluateAudioKeyframes(clip, 2);
  assert.ok(Math.abs(mid.volume - 100) < 1e-6);
  assert.ok(Math.abs(mid.pan - 0) < 1e-6);
});

test('splitClipAtTime splits clip, video keyframes, audio keyframes, and sourceOffset cleanly', () => {
  const clip = makeClip({
    startTime: 2,
    duration: 6,
    sourceOffset: 1,
    speed: 1.5,
    keyframes: [
      { id: 'k1', time: 1, easing: 'linear', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      { id: 'k2', time: 5, easing: 'linear', x: 0.5, y: 0, scale: 1.2, rotation: 0, opacity: 1 },
    ],
    audioKeyframes: [
      { id: 'ak1', time: 4.5, easing: 'linear', volume: 80, pan: -25 },
    ],
  });
  const res = splitClipAtTime(clip, 5);
  assert.ok(res !== null);
  const [left, right] = res;
  assert.equal(left.duration, 3);
  assert.equal(left.keyframes.length, 1);
  assert.equal(right.startTime, 5);
  assert.equal(right.duration, 3);
  assert.equal(right.sourceOffset, 5.5);
  assert.equal(right.keyframes.length, 1);
  assert.equal(right.keyframes[0].time, 2);
  assert.equal(right.audioKeyframes.length, 1);
  assert.equal(right.audioKeyframes[0].time, 1.5);
  assert.equal(splitClipAtTime(clip, 2.05), null);
});

test('moveClipToTrackAndTime, adjustClipDuration, and nudgeClipStart enforce track rules', () => {
  const v2: TimelineTrack = { id: 'track_v2', type: 'overlay', role: 'overlay', label: 'V2', muted: false, locked: false, hidden: false };
  const a1: TimelineTrack = { id: 'track_a1', type: 'audio', role: 'music', label: 'A1', muted: false, locked: false, hidden: false };
  const clip = makeClip({ trackId: 'track_v1', startTime: 2, duration: 5 });

  const movedOverlay = moveClipToTrackAndTime(clip, v2, 3.5);
  assert.equal(movedOverlay.trackId, 'track_v2');
  assert.equal(movedOverlay.startTime, 3.5);

  // Should refuse moving video clip onto audio track
  const refused = moveClipToTrackAndTime(clip, a1, 4);
  assert.equal(refused.trackId, 'track_v1');

  const resized = adjustClipDuration(clip, 12.345);
  assert.equal(resized.duration, 12.345);

  const nudged = nudgeClipStart(clip, 15, 30);
  assert.equal(nudged.startTime, 2.5);
});

test('findSnapTime snaps near playhead and clip boundaries', () => {
  const c1 = makeClip({ id: 'c1', startTime: 0, duration: 4 });
  const c2 = makeClip({ id: 'c2', startTime: 6, duration: 3 });
  assert.equal(findSnapTime(3.92, [c1, c2], 'c2', 10, 0.15), 4);
  assert.equal(findSnapTime(9.95, [c1, c2], 'c2', 10, 0.15), 10);
  assert.equal(findSnapTime(5.0, [c1, c2], 'c2', 10, 0.15), 5.0);
});

test('getEffectiveSpeedAtTime computes speed ramps and getCanvasDimensions keeps even pixels', () => {
  assert.ok(getEffectiveSpeedAtTime(1, 'hero', 0.5) < 0.6);
  assert.ok(getEffectiveSpeedAtTime(1, 'hero', 0.1) > 1.8);
  const portrait = getCanvasDimensions('9:16', 1280);
  assert.equal(portrait.width % 2, 0);
  assert.equal(portrait.height, 1280);
});

test('computeAudioGainAtTime applies fadeIn and fadeOut envelopes with audio keyframes', () => {
  const clip = makeClip({
    duration: 4,
    audio: { ...DEFAULT_AUDIO_CONFIG, volume: 100, fadeIn: 1, fadeOut: 1 },
  });
  assert.ok(Math.abs(computeAudioGainAtTime(clip, 0.5) - 0.5) < 1e-6);
  assert.ok(Math.abs(computeAudioGainAtTime(clip, 2.0) - 1.0) < 1e-6);
  assert.ok(Math.abs(computeAudioGainAtTime(clip, 3.75) - 0.25) < 1e-6);
});

test('insertClipAtFront, appendClipAtBack, insertClipAtTime, and rippleDeleteClip manage track order cleanly', () => {
  const existing1 = makeClip({ id: 'v1_a', trackId: 'track_v1', startTime: 0, duration: 4 });
  const existing2 = makeClip({ id: 'v1_b', trackId: 'track_v1', startTime: 4, duration: 5 });
  const otherTrack = makeClip({ id: 'a1_a', trackId: 'track_a1', startTime: 0, duration: 9 });

  const frontNew = makeClip({ id: 'v_front', duration: 3 });
  const afterFront = insertClipAtFront([existing1, existing2, otherTrack], frontNew, 'track_v1');
  assert.equal(afterFront.find((c) => c.id === 'v_front')?.startTime, 0);
  assert.equal(afterFront.find((c) => c.id === 'v1_a')?.startTime, 3);
  assert.equal(afterFront.find((c) => c.id === 'v1_b')?.startTime, 7);
  // Unrelated audio track untouched
  assert.equal(afterFront.find((c) => c.id === 'a1_a')?.startTime, 0);

  const backNew = makeClip({ id: 'v_back', duration: 2.5 });
  const afterBack = appendClipAtBack(afterFront, backNew, 'track_v1');
  assert.equal(afterBack.find((c) => c.id === 'v_back')?.startTime, 12);

  const midNew = makeClip({ id: 'v_mid', duration: 2 });
  const afterMid = insertClipAtTime([existing1, existing2], midNew, 'track_v1', 4, true);
  assert.equal(afterMid.find((c) => c.id === 'v_mid')?.startTime, 4);
  assert.equal(afterMid.find((c) => c.id === 'v1_b')?.startTime, 6);

  const afterRippleDel = rippleDeleteClip(afterMid, 'v_mid');
  assert.equal(afterRippleDel.length, 2);
  assert.equal(afterRippleDel.find((c) => c.id === 'v1_b')?.startTime, 4);
});

test('computeSnapResult and clampTrimEdit clamp source offsets and media ceilings', () => {
  const c1 = makeClip({ id: 'c1', startTime: 0, duration: 5 });
  const snap = computeSnapResult(4.92, [c1], 'c2', 12, 0.15);
  assert.equal(snap.time, 5);
  assert.equal(snap.snappedTo, 5);

  const leftTrim = clampTrimEdit(2, 6, 1, 'trimLeft', 1.5, 0.3, 10);
  assert.equal(leftTrim.startTime, 3.5);
  assert.equal(leftTrim.duration, 4.5);
  assert.equal(leftTrim.sourceOffset, 2.5);

  // Right trim capped by asset duration (10s - 1s offset = 9s max duration)
  const rightTrim = clampTrimEdit(2, 6, 1, 'trimRight', 8, 0.3, 10);
  assert.equal(rightTrim.duration, 9);
});

test('compactTrackGaps closes lane gaps sequentially and computeSnapResult honors marker targets', () => {
  const c1 = makeClip({ id: 'c1', trackId: 'track_v1', startTime: 2, duration: 3 });
  const c2 = makeClip({ id: 'c2', trackId: 'track_v1', startTime: 8.5, duration: 4 });
  const other = makeClip({ id: 'a1', trackId: 'track_a1', startTime: 3, duration: 5 });

  const compacted = compactTrackGaps([c1, c2, other], 'track_v1');
  assert.equal(compacted.find((c) => c.id === 'c1')?.startTime, 0);
  assert.equal(compacted.find((c) => c.id === 'c2')?.startTime, 3);
  assert.equal(compacted.find((c) => c.id === 'a1')?.startTime, 3);

  const markerSnap = computeSnapResult(4.42, [c1], 'c2', 10, 0.15, [4.5]);
  assert.equal(markerSnap.time, 4.5);
  assert.equal(markerSnap.snappedTo, 4.5);
});

test('computeAutoDuckKeyframes generates smooth ducking dips under overlapping voice/SFX', () => {
  const music = makeClip({
    id: 'music_1',
    kind: 'audio',
    trackId: 'track_a1',
    startTime: 0,
    duration: 10,
    audio: { ...DEFAULT_AUDIO_CONFIG, volume: 100 },
  });
  const voice = makeClip({
    id: 'vo_1',
    kind: 'audio',
    trackId: 'track_a3',
    startTime: 3,
    duration: 2,
  });

  const kfs = computeAutoDuckKeyframes(music, [voice], 30);
  assert.ok(kfs.length >= 4);
  const midDuck = evaluateAudioKeyframes({ ...music, audioKeyframes: kfs }, 4.0);
  const beforeDuck = evaluateAudioKeyframes({ ...music, audioKeyframes: kfs }, 0.5);
  assert.ok(midDuck.volume <= 35);
  assert.ok(beforeDuck.volume >= 95);
});

import { getPipPresetPatch } from './timelineMath';

test('getPipPresetPatch positions PiP/split clips and splitClipAtTime preserves mask shape', () => {
  const pip = getPipPresetPatch('topRight');
  assert.equal(pip.mask, 'rounded');
  assert.ok((pip.transform.x ?? 0) > 0);
  assert.ok((pip.transform.y ?? 0) < 0);
  assert.ok((pip.transform.scale ?? 1) < 0.5);

  const splitL = getPipPresetPatch('splitLeft');
  assert.equal(splitL.mask, 'splitLeft');

  const maskedClip = makeClip({ mask: 'circle' });
  const parts = splitClipAtTime(maskedClip, 5);
  assert.ok(parts !== null);
  assert.equal(parts[0].mask, 'circle');
  assert.equal(parts[1].mask, 'circle');
});


