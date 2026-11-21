import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MOTION_PRESET_CONFIG,
  MOTION_PRESET_LIBRARY,
  computeMotionBlurTrailOffsets,
  evaluateMotionPresetTransform,
  formatShutterAngleLabel,
} from './motionPresets';

test('MOTION_PRESET_LIBRARY contains complete distinct camera & rhythm presets', () => {
  assert.ok(MOTION_PRESET_LIBRARY.length >= 9);
  const ids = new Set(MOTION_PRESET_LIBRARY.map((p) => p.id));
  assert.equal(ids.size, MOTION_PRESET_LIBRARY.length);
  assert.ok(ids.has('kenBurnsIn'));
  assert.ok(ids.has('beatPulse'));
  assert.ok(ids.has('handheldFloat'));
});

test('evaluateMotionPresetTransform returns identity for none or intensity 0', () => {
  const noneDelta = evaluateMotionPresetTransform(DEFAULT_MOTION_PRESET_CONFIG, 1.5, 4);
  assert.equal(noneDelta.scaleMult, 1);
  assert.equal(noneDelta.dx, 0);
  assert.equal(noneDelta.rotationDeg, 0);

  const zeroIntensity = evaluateMotionPresetTransform(
    { preset: 'kenBurnsIn', intensity: 0, speed: 1 },
    2,
    4
  );
  assert.equal(zeroIntensity.scaleMult, 1);
});

test('kenBurnsIn scales upward monotonically and kenBurnsOut scales downward', () => {
  const inStart = evaluateMotionPresetTransform(
    { preset: 'kenBurnsIn', intensity: 100, speed: 1 },
    0,
    4
  );
  const inEnd = evaluateMotionPresetTransform(
    { preset: 'kenBurnsIn', intensity: 100, speed: 1 },
    4,
    4
  );
  assert.ok(inEnd.scaleMult > inStart.scaleMult);
  assert.equal(inStart.scaleMult, 1);

  const outStart = evaluateMotionPresetTransform(
    { preset: 'kenBurnsOut', intensity: 100, speed: 1 },
    0,
    4
  );
  const outEnd = evaluateMotionPresetTransform(
    { preset: 'kenBurnsOut', intensity: 100, speed: 1 },
    4,
    4
  );
  assert.ok(outStart.scaleMult > outEnd.scaleMult);
  assert.equal(outEnd.scaleMult, 1);
});

test('beatPulse oscillates smoothly at beat boundaries and whipZoom settles to 1x', () => {
  const beatPeak = evaluateMotionPresetTransform(
    { preset: 'beatPulse', intensity: 80, speed: 1 },
    0.01,
    4
  );
  const beatRest = evaluateMotionPresetTransform(
    { preset: 'beatPulse', intensity: 80, speed: 1 },
    0.48,
    4
  );
  assert.ok(beatPeak.scaleMult > beatRest.scaleMult);

  const whipStart = evaluateMotionPresetTransform(
    { preset: 'whipZoom', intensity: 100, speed: 1 },
    0,
    4
  );
  const whipSettled = evaluateMotionPresetTransform(
    { preset: 'whipZoom', intensity: 100, speed: 1 },
    1.5,
    4
  );
  assert.ok(whipStart.scaleMult > 1.3);
  assert.equal(whipSettled.scaleMult, 1);
  assert.equal(whipSettled.opacityMult, 1);
});

test('formatShutterAngleLabel and computeMotionBlurTrailOffsets scale cleanly', () => {
  assert.equal(formatShutterAngleLabel(50), '180° Shutter');
  assert.equal(formatShutterAngleLabel(100), '360° Shutter');
  assert.deepEqual(
    computeMotionBlurTrailOffsets({
      velocityPxX: 20,
      velocityPxY: 0,
      scaleVel: 0,
      intensityPct: 0,
      canvasWidth: 960,
    }),
    []
  );

  const trails = computeMotionBlurTrailOffsets({
    velocityPxX: 48,
    velocityPxY: -12,
    scaleVel: 0.04,
    intensityPct: 75,
    canvasWidth: 960,
    steps: 4,
  });
  assert.equal(trails.length, 4);
  assert.ok(trails[0].offsetX < 0);
  assert.ok(trails[0].offsetY > 0);
  assert.ok(trails[0].alpha > trails[3].alpha);
});

