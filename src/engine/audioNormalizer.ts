import { clamp } from './timelineMath';

export interface LoudnessMetrics {
  integratedLufs: number;
  rmsDb: number;
  truePeakDb: number;
  waveform: number[];
  durationSec: number;
}

export interface NormalizeResult {
  gainDb: number;
  volumePercent: number;
  projectedLufs: number;
  peakLimited: boolean;
}

export const LUFS_PRESETS: { id: string; label: string; lufs: number; desc: string }[] = [
  { id: 'social', label: '-14 LUFS', lufs: -14, desc: 'YouTube, Reels & Spotify' },
  { id: 'podcast', label: '-16 LUFS', lufs: -16, desc: 'Mobile Stereo & Voiceover' },
  { id: 'cinema', label: '-18 LUFS', lufs: -18, desc: 'Dynamic Film & Music' },
  { id: 'broadcast', label: '-23 LUFS', lufs: -23, desc: 'EBU R128 Broadcast' },
];

/**
 * Applies a simplified ITU-R BS.1770 K-weighting pre-filter (stage 1 high-shelf + stage 2 RLB high-pass)
 * using bilinear biquad coefficients tuned for 44.1kHz-48kHz audio.
 */
export function applyKWeightingFilter(samples: Float32Array, sampleRate: number): Float32Array {
  const n = samples.length;
  if (n === 0) return new Float32Array(0);

  // Stage 1: +4 dB high-shelf around 1681 Hz
  const f0 = 1681.97;
  const gDb = 3.99984;
  const q1 = 0.707175;
  const k1 = Math.tan((Math.PI * f0) / Math.max(8000, sampleRate));
  const vH = Math.pow(10, gDb / 20);
  const vB = Math.pow(vH, 0.4996667);
  const a0_1 = 1 + k1 / q1 + k1 * k1;
  const b0_1 = (vH + (vB * k1) / q1 + k1 * k1) / a0_1;
  const b1_1 = (2 * (k1 * k1 - vH)) / a0_1;
  const b2_1 = (vH - (vB * k1) / q1 + k1 * k1) / a0_1;
  const a1_1 = (2 * (k1 * k1 - 1)) / a0_1;
  const a2_1 = (1 - k1 / q1 + k1 * k1) / a0_1;

  // Stage 2: 2nd-order Butterworth high-pass at ~38 Hz (RLB weighting)
  const fHp = 38.135;
  const q2 = 0.500327;
  const k2 = Math.tan((Math.PI * fHp) / Math.max(8000, sampleRate));
  const a0_2 = 1 + k2 / q2 + k2 * k2;
  const b0_2 = 1 / a0_2;
  const b1_2 = -2 / a0_2;
  const b2_2 = 1 / a0_2;
  const a1_2 = (2 * (k2 * k2 - 1)) / a0_2;
  const a2_2 = (1 - k2 / q2 + k2 * k2) / a0_2;

  const out = new Float32Array(n);
  let x1_1 = 0, x2_1 = 0, y1_1 = 0, y2_1 = 0;
  let x1_2 = 0, x2_2 = 0, y1_2 = 0, y2_2 = 0;

  for (let i = 0; i < n; i++) {
    const x0 = samples[i];
    const y0_1 = b0_1 * x0 + b1_1 * x1_1 + b2_1 * x2_1 - a1_1 * y1_1 - a2_1 * y2_1;
    x2_1 = x1_1;
    x1_1 = x0;
    y2_1 = y1_1;
    y1_1 = y0_1;

    const y0_2 = b0_2 * y0_1 + b1_2 * x1_2 + b2_2 * x2_2 - a1_2 * y1_2 - a2_2 * y2_2;
    x2_2 = x1_2;
    x1_2 = y0_1;
    y2_2 = y1_2;
    y1_2 = y0_2;

    out[i] = y0_2;
  }
  return out;
}

/**
 * Extracts normalized waveform bars (0.12..1.0) from PCM channel data.
 */
export function extractWaveformFromChannels(channels: Float32Array[], barCount = 48): number[] {
  if (channels.length === 0 || channels[0].length === 0) {
    return Array.from({ length: barCount }, () => 0.2);
  }
  const len = channels[0].length;
  const step = Math.max(1, Math.floor(len / barCount));
  const bars: number[] = [];
  let maxPeak = 1e-4;

  for (let b = 0; b < barCount; b++) {
    const start = b * step;
    const end = Math.min(len, start + step);
    let peak = 0;
    const stride = Math.max(1, Math.floor((end - start) / 64));
    for (let i = start; i < end; i += stride) {
      for (let c = 0; c < channels.length; c++) {
        const abs = Math.abs(channels[c][i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > maxPeak) maxPeak = peak;
    bars.push(peak);
  }

  return bars.map((p) => Number(clamp(0.12 + (p / maxPeak) * 0.85, 0.12, 0.98).toFixed(2)));
}

/**
 * Measures integrated LUFS (ITU-R BS.1770-4 gated loudness), RMS dBFS, and peak dBFS from PCM channels.
 */
export function measurePcmLoudness(
  channels: Float32Array[],
  sampleRate: number
): LoudnessMetrics {
  if (channels.length === 0 || channels[0].length === 0) {
    return {
      integratedLufs: -70,
      rmsDb: -70,
      truePeakDb: -70,
      waveform: Array.from({ length: 40 }, () => 0.15),
      durationSec: 0,
    };
  }

  const numSamples = channels[0].length;
  const durationSec = numSamples / Math.max(8000, sampleRate);
  const filtered = channels.map((ch) => applyKWeightingFilter(ch, sampleRate));

  let rawSumSq = 0;
  let maxPeak = 0;
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c];
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i];
      const abs = Math.abs(s);
      if (abs > maxPeak) maxPeak = abs;
      rawSumSq += s * s;
    }
  }
  const rawMeanSq = rawSumSq / Math.max(1, numSamples * channels.length);
  const rmsDb = rawMeanSq > 1e-12 ? 10 * Math.log10(rawMeanSq) : -70;
  const truePeakDb = maxPeak > 1e-8 ? 20 * Math.log10(maxPeak) : -70;

  // 400ms gated loudness blocks with 100ms hop (75% overlap per ITU-R BS.1770-4)
  const blockSamples = Math.max(1, Math.round(sampleRate * 0.4));
  const hopSamples = Math.max(1, Math.round(sampleRate * 0.1));
  const blockPowers: number[] = [];

  if (numSamples <= blockSamples) {
    let sumZ = 0;
    for (let c = 0; c < filtered.length; c++) {
      let chSum = 0;
      const f = filtered[c];
      for (let i = 0; i < f.length; i++) chSum += f[i] * f[i];
      sumZ += chSum / Math.max(1, f.length);
    }
    blockPowers.push(sumZ);
  } else {
    for (let start = 0; start + blockSamples <= numSamples; start += hopSamples) {
      let sumZ = 0;
      for (let c = 0; c < filtered.length; c++) {
        let chSum = 0;
        const f = filtered[c];
        for (let i = start; i < start + blockSamples; i++) {
          chSum += f[i] * f[i];
        }
        sumZ += chSum / blockSamples;
      }
      blockPowers.push(sumZ);
    }
  }

  // Absolute threshold (-70 LUFS)
  const absGateLinear = Math.pow(10, (-70 + 0.691) / 10);
  const absGated = blockPowers.filter((p) => p > absGateLinear);
  if (absGated.length === 0) {
    return {
      integratedLufs: -70,
      rmsDb: Number(rmsDb.toFixed(1)),
      truePeakDb: Number(truePeakDb.toFixed(1)),
      waveform: extractWaveformFromChannels(channels, 42),
      durationSec: Number(durationSec.toFixed(2)),
    };
  }

  const ungatedMean = absGated.reduce((a, b) => a + b, 0) / absGated.length;
  const ungatedLufs = -0.691 + 10 * Math.log10(Math.max(1e-12, ungatedMean));

  // Relative threshold (-10 LU below ungated loudness)
  const relGateLinear = Math.pow(10, (ungatedLufs - 10 + 0.691) / 10);
  const relGated = absGated.filter((p) => p > relGateLinear);
  const finalMean =
    relGated.length > 0
      ? relGated.reduce((a, b) => a + b, 0) / relGated.length
      : ungatedMean;

  const integratedLufs = clamp(-0.691 + 10 * Math.log10(Math.max(1e-12, finalMean)), -70, 0);

  return {
    integratedLufs: Number(integratedLufs.toFixed(1)),
    rmsDb: Number(rmsDb.toFixed(1)),
    truePeakDb: Number(truePeakDb.toFixed(1)),
    waveform: extractWaveformFromChannels(channels, 42),
    durationSec: Number(durationSec.toFixed(2)),
  };
}

/**
 * Computes gain dB and volume percentage (0..200%) needed to reach targetLufs,
 * optionally capping gain so peaks do not exceed -0.5 dBFS.
 */
export function computeNormalizeGain(
  measuredLufs: number,
  targetLufs: number,
  truePeakDb: number,
  preventClipping = true,
  peakCeilingDb = -0.5
): NormalizeResult {
  if (measuredLufs <= -65) {
    return {
      gainDb: 0,
      volumePercent: 100,
      projectedLufs: measuredLufs,
      peakLimited: false,
    };
  }

  let gainDb = targetLufs - measuredLufs;
  let peakLimited = false;

  if (preventClipping && truePeakDb + gainDb > peakCeilingDb) {
    const maxAllowedGainDb = peakCeilingDb - truePeakDb;
    if (maxAllowedGainDb < gainDb) {
      gainDb = maxAllowedGainDb;
      peakLimited = true;
    }
  }

  // Allow up to 500% (+14 dB) digital normalization gain; peak limiter prevents clipping
  const rawVolumePercent = 100 * Math.pow(10, gainDb / 20);
  const clampedVol = Math.round(clamp(rawVolumePercent, 5, 500));
  const actualGainDb = 20 * Math.log10(Math.max(0.05, clampedVol / 100));

  return {
    gainDb: Number(actualGainDb.toFixed(1)),
    volumePercent: clampedVol,
    projectedLufs: Number(clamp(measuredLufs + actualGainDb, -70, 0).toFixed(1)),
    peakLimited,
  };
}

/**
 * Browser helper: fetches a media URL (WAV/MP3/WebM/MP4) and decodes PCM buffers via WebAudio.
 */
export async function analyzeMediaAudioLoudness(src: string): Promise<LoudnessMetrics> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error('Unable to read media audio stream.');
  }
  const arrayBuffer = await response.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('WebAudio API is unavailable.');
  }

  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channels: Float32Array[] = [];
    for (let c = 0; c < Math.min(2, audioBuffer.numberOfChannels); c++) {
      channels.push(audioBuffer.getChannelData(c));
    }
    return measurePcmLoudness(channels, audioBuffer.sampleRate);
  } finally {
    ctx.close().catch(() => {});
  }
}
