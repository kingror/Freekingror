import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNormalizeGain,
  extractWaveformFromChannels,
  measurePcmLoudness,
} from './audioNormalizer';

function makeSineBuffer(amplitude: number, freqHz = 440, durationSec = 1.2, sampleRate = 48000): Float32Array {
  const len = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

test('measurePcmLoudness measures calibrated sine waves accurately and handles silence', () => {
  const quiet = makeSineBuffer(0.05, 1000, 1.2, 48000);
  const loud = makeSineBuffer(0.5, 1000, 1.2, 48000);
  const silent = new Float32Array(48000);

  const mQuiet = measurePcmLoudness([quiet], 48000);
  const mLoud = measurePcmLoudness([loud], 48000);
  const mSilent = measurePcmLoudness([silent], 48000);

  // 10x amplitude difference = +20 dB loudness delta
  const delta = mLoud.integratedLufs - mQuiet.integratedLufs;
  assert.ok(Math.abs(delta - 20) < 0.8, `Expected ~20 LUFS difference, got ${delta}`);
  assert.ok(mLoud.truePeakDb > -6.5 && mLoud.truePeakDb < -5.8);
  assert.equal(mSilent.integratedLufs, -70);
});

test('computeNormalizeGain calculates exact gain to target LUFS and respects anti-clip ceiling', () => {
  // Quiet audio at -20 LUFS, peak -14 dBFS -> normalizing to -14 LUFS needs +6 dB (~200%)
  const res = computeNormalizeGain(-20, -14, -14, true);
  assert.equal(res.volumePercent, 200);
  assert.ok(Math.abs(res.gainDb - 6.0) <= 0.2);
  assert.equal(res.peakLimited, false);

  // Dynamic audio with high peak (-2 dBFS) but quiet average (-20 LUFS): peak limiter caps gain at +1.5 dB
  const limited = computeNormalizeGain(-20, -14, -2, true, -0.5);
  assert.equal(limited.peakLimited, true);
  assert.ok(limited.gainDb <= 1.6);
  assert.ok(limited.volumePercent < 130);

  // Too loud (-9 LUFS) normalized down to -16 LUFS (-7 dB -> ~45%)
  const attenuated = computeNormalizeGain(-9, -16, -1, true);
  assert.ok(attenuated.volumePercent >= 43 && attenuated.volumePercent <= 47);
  assert.ok(Math.abs(attenuated.projectedLufs - -16) < 0.4);

  // Quiet -26 LUFS audio with headroom (-15 dBFS peak) reaches -14 LUFS (+12 dB -> ~398%)
  const boosted = computeNormalizeGain(-26, -14, -15, true, -0.5);
  assert.equal(boosted.peakLimited, false);
  assert.ok(boosted.volumePercent >= 390 && boosted.volumePercent <= 405);
  assert.ok(Math.abs(boosted.projectedLufs - -14) < 0.3);
});

test('extractWaveformFromChannels produces bounded normalized bars', () => {
  const buf = makeSineBuffer(0.7, 220, 0.5, 16000);
  const bars = extractWaveformFromChannels([buf], 24);
  assert.equal(bars.length, 24);
  for (const b of bars) {
    assert.ok(b >= 0.12 && b <= 0.98);
  }
});
