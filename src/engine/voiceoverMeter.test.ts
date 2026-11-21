import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendWaveformSample,
  computeMicWaveformBarLevel,
  createInitialWaveformBars,
  formatVoiceoverTimer,
} from './voiceoverMeter';

test('computeMicWaveformBarLevel returns quiet baseline for silent centered buffer', () => {
  const silence = new Uint8Array(128).fill(128);
  const res = computeMicWaveformBarLevel(silence);
  assert.equal(res.level, 0.04);
  assert.equal(res.peakDb, -60);
  assert.equal(res.clipping, false);
});

test('computeMicWaveformBarLevel responds proportionally to voice amplitude and detects clipping', () => {
  const soft = new Uint8Array(128);
  const loud = new Uint8Array(128);
  const clip = new Uint8Array(128);

  for (let i = 0; i < 128; i++) {
    const wave = Math.sin((i / 128) * Math.PI * 4);
    soft[i] = Math.round(128 + wave * 12);
    loud[i] = Math.round(128 + wave * 64);
    clip[i] = Math.round(128 + wave * 126);
  }

  const s = computeMicWaveformBarLevel(soft);
  const l = computeMicWaveformBarLevel(loud);
  const c = computeMicWaveformBarLevel(clip);

  assert.ok(l.level > s.level, `expected loud (${l.level}) > soft (${s.level})`);
  assert.ok(l.peakDb > s.peakDb);
  assert.equal(l.clipping, false);
  assert.equal(c.clipping, true);
});

test('appendWaveformSample preserves sliding window length and clamps bounds', () => {
  let bars = createInitialWaveformBars(8);
  assert.equal(bars.length, 8);
  bars = appendWaveformSample(bars, 1.5, 8);
  bars = appendWaveformSample(bars, -0.2, 8);
  assert.equal(bars.length, 8);
  assert.equal(bars[bars.length - 2], 1);
  assert.equal(bars[bars.length - 1], 0.04);
});

test('formatVoiceoverTimer formats mm:ss cleanly', () => {
  assert.equal(formatVoiceoverTimer(0), '00:00');
  assert.equal(formatVoiceoverTimer(9), '00:09');
  assert.equal(formatVoiceoverTimer(75), '01:15');
});
