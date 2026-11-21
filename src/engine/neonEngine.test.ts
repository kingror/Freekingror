import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NEON_CONFIG,
  NEON_COLOR_PALETTE,
  NEON_MODES,
  NEON_PRESETS,
  buildNeonPreviewStyle,
  evaluateNeonPulseFactor,
  renderNeonClipEffect,
  resolveNeonConfig,
} from './neonEngine';
import type { ClipCanvasBox } from './previewGizmo';

test('NEON_PRESETS and palette provide complete distinct modes & valid colors', () => {
  assert.ok(NEON_PRESETS.length >= 12);
  assert.equal(NEON_MODES.length, 6);
  assert.ok(NEON_COLOR_PALETTE.length >= 8);

  const ids = new Set(NEON_PRESETS.map((p) => p.id));
  assert.equal(ids.size, NEON_PRESETS.length);

  for (const preset of NEON_PRESETS) {
    assert.equal(preset.config.enabled, true);
    assert.ok(preset.config.color.startsWith('#'));
    assert.ok(preset.config.secondaryColor.startsWith('#'));
    const style = buildNeonPreviewStyle(preset.config);
    assert.ok(style.boxShadow.includes(preset.config.color));
  }
});

test('resolveNeonConfig clamps ranges & evaluateNeonPulseFactor oscillates smoothly', () => {
  const resolved = resolveNeonConfig({
    enabled: true,
    intensity: 200,
    blurRadius: 1,
    borderWidth: 99,
    pulseSpeed: 10,
  });
  assert.equal(resolved.intensity, 100);
  assert.equal(resolved.blurRadius, 4);
  assert.equal(resolved.borderWidth, 24);
  assert.equal(resolved.pulseSpeed, 5);

  const offResolved = resolveNeonConfig(undefined);
  assert.equal(offResolved.enabled, DEFAULT_NEON_CONFIG.enabled);

  // Steady pulse returns 1
  assert.equal(evaluateNeonPulseFactor(0, 1.25, true), 1);
  // Active pulse oscillates within [0.58, 1.0]
  const pPeak = evaluateNeonPulseFactor(1, 0.25, true);
  const pTrough = evaluateNeonPulseFactor(1, 0.75, true);
  assert.ok(Math.abs(pPeak - 1) < 0.01);
  assert.ok(Math.abs(pTrough - 0.58) < 0.01);
});

test('renderNeonClipEffect draws strokes across every NeonMode without throwing', () => {
  const ops: string[] = [];
  const fakeGrad = { addColorStop: () => {} };
  const fakeCtx = {
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    translate: () => ops.push('translate'),
    rotate: () => ops.push('rotate'),
    beginPath: () => ops.push('beginPath'),
    roundRect: () => ops.push('roundRect'),
    moveTo: () => ops.push('moveTo'),
    lineTo: () => ops.push('lineTo'),
    clip: () => ops.push('clip'),
    stroke: () => ops.push('stroke'),
    fill: () => ops.push('fill'),
    createRadialGradient: () => fakeGrad,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  } as unknown as CanvasRenderingContext2D;

  const box: ClipCanvasBox = {
    clipId: 'clip_test_1',
    cx: 640,
    cy: 360,
    boxW: 1280,
    boxH: 720,
    scale: 1,
    rotationDeg: 0,
    corners: [
      { id: 'nw', x: 0, y: 0 },
      { id: 'ne', x: 1280, y: 0 },
      { id: 'se', x: 1280, y: 720 },
      { id: 'sw', x: 0, y: 720 },
    ],
    rotateHandle: { id: 'rotate', x: 640, y: -36 },
  };

  for (const mode of NEON_MODES) {
    ops.length = 0;
    renderNeonClipEffect(
      fakeCtx,
      1280,
      720,
      box,
      { ...DEFAULT_NEON_CONFIG, enabled: true, mode: mode.id },
      0.6,
      true
    );
    assert.ok(ops.includes('stroke'), `Expected stroke draw for mode ${mode.id}`);
  }
});
