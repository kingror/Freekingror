import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TimelineClip } from '../types/editor';
import {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
} from './timelineMath';
import {
  computeGizmoDragUpdate,
  getClipCanvasBox,
  hitTestPreviewPoint,
} from './previewGizmo';

function makeClip(overrides: Partial<TimelineClip>): TimelineClip {
  return {
    id: 'clip_1',
    assetId: 'asset_1',
    trackId: 'track_v1',
    name: 'Clip',
    kind: 'image',
    startTime: 0,
    duration: 5,
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

describe('previewGizmo', () => {
  it('selects top-most overlay/text clip when overlapping a base video clip', () => {
    const baseClip = makeClip({
      id: 'base',
      trackId: 'track_v1',
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: 0, scale: 1 },
    });
    const pipOverlay = makeClip({
      id: 'pip',
      trackId: 'track_v2',
      transform: { ...DEFAULT_TRANSFORM, x: 0.2, y: 0.15, scale: 0.4 },
    });
    const textClip = makeClip({
      id: 'title',
      kind: 'text',
      trackId: 'track_t1',
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: -0.2, scale: 1 },
    });

    // Click inside title box -> selects title
    const hitTitle = hitTestPreviewPoint({
      px: 480,
      py: 270 - 0.2 * 540,
      width: 960,
      height: 540,
      playhead: 1,
      activeClipsBottomToTop: [baseClip, pipOverlay, textClip],
      selectedClipId: 'base',
    });
    assert.deepEqual(hitTitle, { type: 'move', clipId: 'title' });

    // Click inside PiP overlay -> selects pip rather than base
    const hitPip = hitTestPreviewPoint({
      px: 480 + 0.2 * 960,
      py: 270 + 0.15 * 540,
      width: 960,
      height: 540,
      playhead: 1,
      activeClipsBottomToTop: [baseClip, pipOverlay, textClip],
      selectedClipId: 'base',
    });
    assert.deepEqual(hitPip, { type: 'move', clipId: 'pip' });
  });

  it('prioritizes selected clip corner resize and rotate handles before move', () => {
    const pip = makeClip({
      id: 'pip',
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: 0, scale: 0.5 },
    });
    const box = getClipCanvasBox(pip, 0, 960, 540);

    const cornerHit = hitTestPreviewPoint({
      px: box.corners[3].x,
      py: box.corners[3].y,
      width: 960,
      height: 540,
      playhead: 1,
      activeClipsBottomToTop: [pip],
      selectedClipId: 'pip',
    });
    assert.deepEqual(cornerHit, { type: 'resize', clipId: 'pip', corner: 'se' });

    const rotateHit = hitTestPreviewPoint({
      px: box.rotateHandle.x,
      py: box.rotateHandle.y,
      width: 960,
      height: 540,
      playhead: 1,
      activeClipsBottomToTop: [pip],
      selectedClipId: 'pip',
    });
    assert.deepEqual(rotateHit, { type: 'rotate', clipId: 'pip' });
  });

  it('computes snapped move, scale resize, and rotation angle updates', () => {
    const moveRes = computeGizmoDragUpdate({
      mode: 'move',
      origTransform: { x: 0.1, y: 0.1, scale: 1, rotation: 0 },
      origCenterX: 480,
      origCenterY: 270,
      startCanvasX: 480,
      startCanvasY: 270,
      currCanvasX: 480 - 0.095 * 960,
      currCanvasY: 270 + 0.1 * 540,
      width: 960,
      height: 540,
      snapToCenter: true,
    });
    assert.equal(moveRes.snapX, true);
    assert.equal(moveRes.patch.x, 0);
    assert.equal(moveRes.patch.y, 0.2);

    const resizeRes = computeGizmoDragUpdate({
      mode: 'resize',
      origTransform: { x: 0, y: 0, scale: 0.5, rotation: 0 },
      origCenterX: 480,
      origCenterY: 270,
      startCanvasX: 580,
      startCanvasY: 270,
      currCanvasX: 680,
      currCanvasY: 270,
      width: 960,
      height: 540,
    });
    assert.equal(resizeRes.patch.scale, 1);

    const rotRes = computeGizmoDragUpdate({
      mode: 'rotate',
      origTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
      origCenterX: 480,
      origCenterY: 270,
      startCanvasX: 480,
      startCanvasY: 170,
      currCanvasX: 580,
      currCanvasY: 270,
      width: 960,
      height: 540,
    });
    assert.equal(rotRes.patch.rotation, 90);
  });
});
