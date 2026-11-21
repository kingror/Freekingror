import { clamp } from './timelineMath';

export interface MicLevelSample {
  /** Normalized perceptual bar amplitude in range [0.04, 1] */
  level: number;
  /** Peak dBFS in range [-60, 0] */
  peakDb: number;
  /** True when peak reaches or exceeds -0.35 dBFS */
  clipping: boolean;
}

/**
 * Computes normalized RMS waveform bar amplitude and true peak dBFS from
 * an AnalyserNode time-domain buffer (centered around unsigned byte 128).
 */
export function computeMicWaveformBarLevel(timeDomainBytes: Uint8Array): MicLevelSample {
  if (timeDomainBytes.length === 0) {
    return { level: 0.04, peakDb: -60, clipping: false };
  }

  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < timeDomainBytes.length; i++) {
    const centered = (timeDomainBytes[i] - 128) / 128;
    const abs = Math.abs(centered);
    if (abs > peak) peak = abs;
    sumSq += centered * centered;
  }

  const rms = Math.sqrt(sumSq / timeDomainBytes.length);
  const perceptual = rms > 0.0025 ? clamp(Math.pow(rms * 3.4, 0.72), 0.05, 1) : 0.04;
  const rawDb = peak > 1e-4 ? 20 * Math.log10(peak) : -60;
  const peakDb = clamp(Math.round(rawDb * 10) / 10, -60, 0);

  return {
    level: Number(perceptual.toFixed(3)),
    peakDb,
    clipping: peak >= 0.96,
  };
}

/**
 * Appends a single live bar sample to the sliding waveform history buffer.
 */
export function appendWaveformSample(
  history: number[],
  sample: number,
  maxBars = 36
): number[] {
  const safeMax = Math.max(4, Math.floor(maxBars));
  const clamped = clamp(Number.isFinite(sample) ? sample : 0.04, 0.04, 1);
  const next = [...history, clamped];
  if (next.length > safeMax) {
    return next.slice(next.length - safeMax);
  }
  return next;
}

export function createInitialWaveformBars(maxBars = 36): number[] {
  return Array.from({ length: Math.max(4, maxBars) }, () => 0.04);
}

export function formatVoiceoverTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
