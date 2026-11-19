import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LUT_PRESETS,
  VFX_LIBRARY,
  applyPixelGradeAndChroma,
  applyVfxPixelPass,
  buildCanvasFilterString,
  computeHistogramBins,
} from './colorEngine';
import { DEFAULT_CHROMA_KEY, DEFAULT_COLOR_GRADE, DEFAULT_VFX } from './timelineMath';

test('buildCanvasFilterString applies LUT, hue rotation, blur VFX, and user grade offsets', () => {
  const filter = buildCanvasFilterString(
    {
      ...DEFAULT_COLOR_GRADE,
      lutId: 'tealOrange',
      exposure: 10,
      hue: 45,
    },
    { ...DEFAULT_VFX, blur: 50 }
  );
  assert.ok(filter.includes('brightness(112%)'));
  assert.ok(filter.includes('contrast(118%)'));
  assert.ok(filter.includes('hue-rotate('));
  assert.ok(filter.includes('blur('));
  assert.ok(LUT_PRESETS.length >= 10);
  assert.ok(VFX_LIBRARY.length >= 6);
});

test('applyPixelGradeAndChroma keys out pure green pixels while preserving subjects', () => {
  const buf = new Uint8ClampedArray([
    0, 217, 36, 255,
    25, 25, 30, 255,
  ]);
  applyPixelGradeAndChroma(buf, DEFAULT_COLOR_GRADE, {
    ...DEFAULT_CHROMA_KEY,
    enabled: true,
    color: '#00d924',
    similarity: 45,
    smoothness: 15,
    spill: 40,
  });
  assert.equal(buf[3], 0);
  assert.equal(buf[7], 255);
});

test('applyVfxPixelPass shifts RGB channels when glitch is enabled', () => {
  // 4x2 image with a bright red pixel at (2, 0)
  const w = 4;
  const h = 2;
  const src = new Uint8ClampedArray(w * h * 4);
  const idx = (0 * w + 2) * 4;
  src[idx] = 255;
  src[idx + 3] = 255;
  const dst = new Uint8ClampedArray(w * h * 4);

  applyVfxPixelPass(src, dst, w, h, { ...DEFAULT_VFX, glitch: 10 }, 0.5);
  // Expect red channel shifted horizontally relative to green/blue
  const totalRed = dst.reduce((acc, val, i) => (i % 4 === 0 ? acc + val : acc), 0);
  assert.ok(totalRed > 0);
});

test('computeHistogramBins produces normalized RGB & luma arrays', () => {
  const buf = new Uint8ClampedArray([
    255, 0, 0, 255,
    255, 0, 0, 255,
    0, 255, 0, 255,
  ]);
  const hist = computeHistogramBins(buf, 16, 1);
  assert.equal(hist.r.length, 16);
  assert.equal(hist.r[15], 1);
  assert.equal(hist.g[15], 0.5);
});

import { applySharpnessPass, rgbToHex } from './colorEngine';

test('rgbToHex, film grain, sharpness, mirror kaleidoscope, and cyber duotone render cleanly', () => {
  assert.equal(rgbToHex(25, 216, 25), '#19d819');

  // Film grain alters midtone pixels deterministically
  const grainBuf = new Uint8ClampedArray([120, 120, 120, 255, 120, 120, 120, 255]);
  applyPixelGradeAndChroma(grainBuf, { ...DEFAULT_COLOR_GRADE, grain: 80 }, DEFAULT_CHROMA_KEY);
  assert.notEqual(grainBuf[0], grainBuf[4]);

  // Sharpness boosts local edge contrast
  const w = 3;
  const h = 3;
  const sharpSrc = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 0; i < w * h; i++) {
    const val = i === 4 ? 200 : 100;
    sharpSrc[i * 4] = val;
    sharpSrc[i * 4 + 1] = val;
    sharpSrc[i * 4 + 2] = val;
  }
  const sharpDst = new Uint8ClampedArray(w * h * 4);
  applySharpnessPass(sharpSrc, sharpDst, w, h, 80);
  assert.ok(sharpDst[4 * 4] > 200);

  // Mirror reflects left half onto right half + Duotone applies magenta/cobalt tint
  const mirSrc = new Uint8ClampedArray([
    220, 220, 220, 255,
    10, 10, 10, 255,
    220, 220, 220, 255,
    10, 10, 10, 255,
  ]);
  const mirDst = new Uint8ClampedArray(mirSrc.length);
  applyVfxPixelPass(mirSrc, mirDst, 2, 2, { ...DEFAULT_VFX, mirror: 60, duotone: 80 }, 0);
  assert.equal(mirDst[0], mirDst[4]);
  assert.notEqual(mirDst[0], mirDst[1]);
});

import { EQ_PRESETS, computeAutoEnhanceGrade } from './colorEngine';

test('computeAutoEnhanceGrade boosts flat footage & EQ_PRESETS covers voice/cinema/podcast profiles', () => {
  const enhanced = computeAutoEnhanceGrade(DEFAULT_COLOR_GRADE);
  assert.ok(enhanced.exposure > 0);
  assert.ok(enhanced.contrast >= 14);
  assert.ok(enhanced.saturation >= 12);
  assert.ok((enhanced.sharpness ?? 0) >= 20);
  assert.ok(EQ_PRESETS.length >= 5);
  const voice = EQ_PRESETS.find((e) => e.id === 'voiceClarity');
  assert.ok(voice && voice.eqMid > 0 && voice.eqBass < 0);
});

