import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSITION_CATEGORIES,
  TRANSITION_LIBRARY,
  computeTransitionFrameState,
  filterTransitions,
} from './transitionsLibrary';

test('TRANSITION_LIBRARY includes complex categories and Push/Wipe/Zoom/Dissolve transitions', () => {
  const types = new Set(TRANSITION_LIBRARY.map((t) => t.type));
  assert.ok(types.has('crossDissolve'));
  assert.ok(types.has('pushLeft'));
  assert.ok(types.has('pushRight'));
  assert.ok(types.has('wipeLeft'));
  assert.ok(types.has('radialWipe'));
  assert.ok(types.has('zoomIn'));
  assert.ok(types.has('zoomOut'));
  assert.ok(types.has('prismRgb'));

  for (const cat of TRANSITION_CATEGORIES) {
    const filtered = filterTransitions(cat);
    assert.ok(filtered.length > 0, `Category ${cat} should have presets`);
  }
});

test('filterTransitions matches query strings across labels and descriptions', () => {
  const pushMatches = filterTransitions('All', 'Push');
  assert.ok(pushMatches.some((t) => t.type === 'pushLeft'));

  const wipeMatches = filterTransitions('Wipes', 'diagonal');
  assert.equal(wipeMatches.length, 1);
  assert.equal(wipeMatches[0].type, 'diagonalWipe');
});

test('computeTransitionFrameState computes Push, Wipe, Cross Dissolve, and Zoom kinematics', () => {
  const dissolveMid = computeTransitionFrameState('crossDissolve', 0.5, 1280, 720);
  assert.ok(Math.abs(dissolveMid.opacity - 0.5) < 1e-6);

  const pushLeftMid = computeTransitionFrameState('pushLeft', 0.5, 1280, 720);
  assert.ok(pushLeftMid.offsetX > 0 && pushLeftMid.offsetX < 1280);
  assert.ok(pushLeftMid.outgoingOffsetX < 0 && pushLeftMid.outgoingOffsetX > -1280);
  assert.ok(Math.abs(pushLeftMid.offsetX - pushLeftMid.outgoingOffsetX - 1280) < 1e-4);

  const wipeLeftMid = computeTransitionFrameState('wipeLeft', 0.5, 1280, 720);
  assert.ok(wipeLeftMid.wipeXRatio !== null && Math.abs(wipeLeftMid.wipeXRatio - 0.5) < 1e-6);

  const zoomMid = computeTransitionFrameState('zoomIn', 0.5, 1280, 720);
  assert.ok(zoomMid.scale < 1 && zoomMid.opacity < 1);

  const endState = computeTransitionFrameState('pushLeft', 1, 1280, 720);
  assert.equal(endState.offsetX, 0);
  assert.equal(endState.outgoingOffsetX, 0);
  assert.equal(endState.opacity, 1);
});
