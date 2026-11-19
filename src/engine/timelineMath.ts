import type {
  AspectRatio,
  AudioConfig,
  AudioKeyframe,
  ChromaKeyConfig,
  ClipMaskShape,
  ClipTransform,
  ColorGrade,
  EasingType,
  Keyframe,
  SpeedRampPreset,
  TimelineClip,
  TimelineTrack,
  VfxConfig,
} from '../types/editor';

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipH: false,
  flipV: false,
};

export const DEFAULT_COLOR_GRADE: ColorGrade = {
  lutId: 'natural',
  exposure: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  vignette: 0,
  sharpness: 0,
  grain: 0,
};

export const DEFAULT_VFX: VfxConfig = {
  glitch: 0,
  blur: 0,
  distortion: 0,
  bloom: 0,
  pixelate: 0,
  vhsScanlines: 0,
  cinemaBars: 0,
  mirror: 0,
  duotone: 0,
  shake: 0,
};

export const DEFAULT_CHROMA_KEY: ChromaKeyConfig = {
  enabled: false,
  color: '#00d924',
  similarity: 42,
  smoothness: 18,
  spill: 35,
};

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  volume: 100,
  pan: 0,
  muted: false,
  fadeIn: 0.2,
  fadeOut: 0.2,
  eqBass: 0,
  eqMid: 0,
  eqTreble: 0,
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function formatTimecode(seconds: number, fps = 30): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalFrames = Math.floor(safe * fps + 1e-6);
  const ff = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function formatShortTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe - Math.floor(safe)) * 10);
  if (mins > 0) {
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  return `${secs}.${tenths}s`;
}

export function getProjectDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), 0);
}

export function applyEasing(t: number, easing: EasingType): number {
  const u = clamp(t, 0, 1);
  switch (easing) {
    case 'easeIn':
      return u * u * u;
    case 'easeOut':
      return 1 - Math.pow(1 - u, 3);
    case 'easeInOut':
      return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    case 'linear':
    default:
      return u;
  }
}

export function evaluateKeyframes(clip: TimelineClip, localTime: number): ClipTransform {
  const base = { ...clip.transform };
  if (!clip.keyframes || clip.keyframes.length === 0) {
    return base;
  }

  const sorted = [...clip.keyframes].sort((a, b) => a.time - b.time);
  const t = clamp(localTime, 0, clip.duration);

  if (t <= sorted[0].time) {
    const k = sorted[0];
    return { ...base, x: k.x, y: k.y, scale: k.scale, rotation: k.rotation, opacity: k.opacity };
  }

  const last = sorted[sorted.length - 1];
  if (t >= last.time) {
    return { ...base, x: last.x, y: last.y, scale: last.scale, rotation: last.rotation, opacity: last.opacity };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = Math.max(1e-5, b.time - a.time);
      const progress = applyEasing((t - a.time) / span, b.easing);
      const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * progress;
      return {
        ...base,
        x: lerp(a.x, b.x),
        y: lerp(a.y, b.y),
        scale: lerp(a.scale, b.scale),
        rotation: lerp(a.rotation, b.rotation),
        opacity: lerp(a.opacity, b.opacity),
      };
    }
  }

  return base;
}

export function evaluateAudioKeyframes(
  clip: TimelineClip,
  localTime: number
): { volume: number; pan: number } {
  const base = {
    volume: clip.audio.volume,
    pan: clip.audio.pan ?? 0,
  };
  if (!clip.audioKeyframes || clip.audioKeyframes.length === 0) {
    return base;
  }

  const sorted = [...clip.audioKeyframes].sort((a, b) => a.time - b.time);
  const t = clamp(localTime, 0, clip.duration);

  if (t <= sorted[0].time) {
    return { volume: sorted[0].volume, pan: sorted[0].pan };
  }
  const last = sorted[sorted.length - 1];
  if (t >= last.time) {
    return { volume: last.volume, pan: last.pan };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = Math.max(1e-5, b.time - a.time);
      const progress = applyEasing((t - a.time) / span, b.easing);
      return {
        volume: a.volume + (b.volume - a.volume) * progress,
        pan: a.pan + (b.pan - a.pan) * progress,
      };
    }
  }
  return base;
}

export function getEffectiveSpeedAtTime(
  baseSpeed: number,
  ramp: SpeedRampPreset,
  progress01: number
): number {
  const p = clamp(progress01, 0, 1);
  let multiplier = 1;
  switch (ramp) {
    case 'ease':
      multiplier = 0.6 + 0.8 * Math.sin(p * Math.PI);
      break;
    case 'hero':
      multiplier = p < 0.25 ? 2.2 : p < 0.72 ? 0.45 : 2.0;
      break;
    case 'bullet':
      multiplier = p > 0.3 && p < 0.7 ? 0.3 : 1.8;
      break;
    case 'montage':
      multiplier = 0.75 + 2.5 * Math.pow(p, 2);
      break;
    case 'none':
    default:
      multiplier = 1;
      break;
  }
  return clamp(baseSpeed * multiplier, 0.15, 16);
}

export function splitClipAtTime(
  clip: TimelineClip,
  timelineTime: number,
  minClipDuration = 0.2
): [TimelineClip, TimelineClip] | null {
  const localSplit = timelineTime - clip.startTime;
  if (localSplit <= minClipDuration || localSplit >= clip.duration - minClipDuration) {
    return null;
  }

  const leftDuration = Number(localSplit.toFixed(3));
  const rightDuration = Number((clip.duration - leftDuration).toFixed(3));

  const leftKeyframes: Keyframe[] = [];
  const rightKeyframes: Keyframe[] = [];
  for (const kf of clip.keyframes) {
    if (kf.time <= leftDuration) {
      leftKeyframes.push({ ...kf });
    } else {
      rightKeyframes.push({ ...kf, time: Number((kf.time - leftDuration).toFixed(3)) });
    }
  }

  const leftAudioKf: AudioKeyframe[] = [];
  const rightAudioKf: AudioKeyframe[] = [];
  for (const akf of clip.audioKeyframes ?? []) {
    if (akf.time <= leftDuration) {
      leftAudioKf.push({ ...akf });
    } else {
      rightAudioKf.push({ ...akf, time: Number((akf.time - leftDuration).toFixed(3)) });
    }
  }

  const leftClip: TimelineClip = {
    ...clip,
    duration: leftDuration,
    keyframes: leftKeyframes,
    audioKeyframes: leftAudioKf,
    audio: { ...clip.audio },
    transform: { ...clip.transform },
    colorGrade: { ...clip.colorGrade },
    vfx: { ...clip.vfx },
    chromaKey: { ...clip.chromaKey },
    transitionIn: { ...clip.transitionIn },
  };

  const rightClip: TimelineClip = {
    ...clip,
    id: `${clip.id}_part_${Math.random().toString(36).slice(2, 7)}`,
    name: `${clip.name} (2)`,
    startTime: Number((clip.startTime + leftDuration).toFixed(3)),
    duration: rightDuration,
    sourceOffset: Number((clip.sourceOffset + leftDuration * clip.speed).toFixed(3)),
    keyframes: rightKeyframes,
    audioKeyframes: rightAudioKf,
    audio: { ...clip.audio },
    transform: { ...clip.transform },
    colorGrade: { ...clip.colorGrade },
    vfx: { ...clip.vfx },
    chromaKey: { ...clip.chromaKey },
    transitionIn: { type: 'none', duration: 0.5 },
  };

  return [leftClip, rightClip];
}

export function isClipCompatibleWithTrack(
  clip: TimelineClip,
  track: TimelineTrack
): boolean {
  if (clip.kind === 'audio') return track.type === 'audio';
  if (clip.kind === 'text') return track.type === 'text';
  return track.type === 'video' || track.type === 'overlay';
}

export function moveClipToTrackAndTime(
  clip: TimelineClip,
  targetTrack: TimelineTrack,
  newStartTime: number
): TimelineClip {
  const safeStart = Math.max(0, Number(newStartTime.toFixed(3)));
  if (!isClipCompatibleWithTrack(clip, targetTrack)) {
    return { ...clip, startTime: safeStart };
  }
  return {
    ...clip,
    trackId: targetTrack.id,
    startTime: safeStart,
  };
}

export function adjustClipDuration(
  clip: TimelineClip,
  newDuration: number,
  minDur = 0.25,
  maxDur = 300
): TimelineClip {
  const clampedDur = Number(clamp(newDuration, minDur, maxDur).toFixed(3));
  return {
    ...clip,
    duration: clampedDur,
    keyframes: clip.keyframes.filter((k) => k.time <= clampedDur + 0.01),
    audioKeyframes: (clip.audioKeyframes ?? []).filter((k) => k.time <= clampedDur + 0.01),
  };
}

export function nudgeClipStart(
  clip: TimelineClip,
  deltaFrames: number,
  fps = 30
): TimelineClip {
  const next = Math.max(0, clip.startTime + deltaFrames / fps);
  return { ...clip, startTime: Number(next.toFixed(3)) };
}

export function insertClipAtFront(
  clips: TimelineClip[],
  newClip: TimelineClip,
  trackId: string
): TimelineClip[] {
  const shift = Number(Math.max(0.25, newClip.duration).toFixed(3));
  const inserted: TimelineClip = { ...newClip, trackId, startTime: 0 };
  const shifted = clips.map((c) =>
    c.trackId === trackId
      ? { ...c, startTime: Number((c.startTime + shift).toFixed(3)) }
      : c
  );
  return [inserted, ...shifted];
}

export function appendClipAtBack(
  clips: TimelineClip[],
  newClip: TimelineClip,
  trackId: string
): TimelineClip[] {
  const laneEnd = clips
    .filter((c) => c.trackId === trackId)
    .reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
  const appended: TimelineClip = {
    ...newClip,
    trackId,
    startTime: Number(laneEnd.toFixed(3)),
  };
  return [...clips, appended];
}

export function insertClipAtTime(
  clips: TimelineClip[],
  newClip: TimelineClip,
  trackId: string,
  startTime: number,
  ripple = false
): TimelineClip[] {
  const safeStart = Math.max(0, Number(startTime.toFixed(3)));
  const inserted: TimelineClip = { ...newClip, trackId, startTime: safeStart };
  if (!ripple) {
    return [...clips, inserted];
  }
  const shift = Number(Math.max(0.25, newClip.duration).toFixed(3));
  const updated = clips.map((c) =>
    c.trackId === trackId && c.startTime >= safeStart - 0.05
      ? { ...c, startTime: Number((c.startTime + shift).toFixed(3)) }
      : c
  );
  return [...updated, inserted];
}

export function rippleDeleteClip(clips: TimelineClip[], clipId: string): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;
  const remaining = clips.filter((c) => c.id !== clipId);
  const gap = target.duration;
  return remaining.map((c) =>
    c.trackId === target.trackId && c.startTime >= target.startTime + target.duration - 0.05
      ? { ...c, startTime: Math.max(0, Number((c.startTime - gap).toFixed(3))) }
      : c
  );
}

export function compactTrackGaps(
  clips: TimelineClip[],
  trackId: string
): TimelineClip[] {
  const laneClips = clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.startTime - b.startTime);
  if (laneClips.length === 0) return clips;

  let cursor = 0;
  const newStartMap = new Map<string, number>();
  for (const c of laneClips) {
    newStartMap.set(c.id, Number(cursor.toFixed(3)));
    cursor += c.duration;
  }

  return clips.map((c) =>
    newStartMap.has(c.id) ? { ...c, startTime: newStartMap.get(c.id)! } : c
  );
}

/**
 * Generates smooth AudioKeyframe ducking automation on targetClip
 * whenever any duckTrigger clip (voiceover/SFX) overlaps it on the timeline.
 */
export function computeAutoDuckKeyframes(
  targetClip: TimelineClip,
  duckTriggers: TimelineClip[],
  duckVolume = 32
): AudioKeyframe[] {
  const tStart = targetClip.startTime;
  const tEnd = targetClip.startTime + targetClip.duration;
  const baseVol = Math.round(clamp(targetClip.audio.volume || 100, 10, 500));
  const duckedVol = Math.round(clamp(duckVolume, 5, baseVol));
  const pan = targetClip.audio.pan ?? 0;

  const rawIntervals: [number, number][] = [];
  for (const trig of duckTriggers) {
    if (trig.id === targetClip.id) continue;
    const s = Math.max(tStart, trig.startTime - 0.12);
    const e = Math.min(tEnd, trig.startTime + trig.duration + 0.12);
    if (e - s > 0.08) {
      rawIntervals.push([s - tStart, e - tStart]);
    }
  }

  if (rawIntervals.length === 0) {
    return [];
  }

  rawIntervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [rawIntervals[0]];
  for (let i = 1; i < rawIntervals.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = rawIntervals[i];
    if (curr[0] <= prev[1] + 0.35) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push([...curr]);
    }
  }

  const out: AudioKeyframe[] = [];
  const pushKf = (time: number, vol: number, suffix: string) => {
    const clampedT = Number(clamp(time, 0, targetClip.duration).toFixed(3));
    if (out.length > 0 && Math.abs(out[out.length - 1].time - clampedT) < 0.04) {
      out[out.length - 1].volume = vol;
      return;
    }
    out.push({
      id: `akf_duck_${suffix}_${Math.round(clampedT * 1000)}`,
      time: clampedT,
      easing: 'easeInOut',
      volume: vol,
      pan,
    });
  };

  if (merged[0][0] > 0.25) {
    pushKf(0, baseVol, 'start');
  }

  merged.forEach(([localS, localE], idx) => {
    const rampInStart = Math.max(0, localS - 0.25);
    const rampOutEnd = Math.min(targetClip.duration, localE + 0.35);
    if (rampInStart > 0.05) {
      pushKf(rampInStart, baseVol, `pre_${idx}`);
    }
    pushKf(localS, duckedVol, `in_${idx}`);
    pushKf(localE, duckedVol, `hold_${idx}`);
    if (rampOutEnd < targetClip.duration - 0.05) {
      pushKf(rampOutEnd, baseVol, `post_${idx}`);
    }
  });

  const lastE = merged[merged.length - 1][1];
  if (lastE < targetClip.duration - 0.2) {
    pushKf(targetClip.duration, baseVol, 'end');
  }

  return out;
}

export function computeSnapResult(
  candidateTime: number,
  clips: TimelineClip[],
  excludeClipId: string,
  playhead: number,
  thresholdSeconds: number,
  extraTargets: number[] = []
): { time: number; snappedTo: number | null } {
  const safeCandidate = Math.max(0, candidateTime);
  const targets: number[] = [0, playhead, ...extraTargets];
  for (const c of clips) {
    if (c.id === excludeClipId) continue;
    targets.push(c.startTime, c.startTime + c.duration);
  }

  let best = safeCandidate;
  let bestDist = thresholdSeconds;
  let snappedTo: number | null = null;
  for (const target of targets) {
    const dist = Math.abs(safeCandidate - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
      snappedTo = Number(target.toFixed(3));
    }
  }
  return { time: Number(best.toFixed(3)), snappedTo };
}

export function findSnapTime(
  candidateTime: number,
  clips: TimelineClip[],
  excludeClipId: string,
  playhead: number,
  thresholdSeconds: number,
  extraTargets: number[] = []
): number {
  return computeSnapResult(
    candidateTime,
    clips,
    excludeClipId,
    playhead,
    thresholdSeconds,
    extraTargets
  ).time;
}

export function clampTrimEdit(
  origStart: number,
  origDuration: number,
  origOffset: number,
  mode: 'trimLeft' | 'trimRight',
  deltaSec: number,
  minDur = 0.3,
  maxAssetDuration?: number
): { startTime: number; duration: number; sourceOffset: number } {
  if (mode === 'trimLeft') {
    const maxRightShift = origDuration - minDur;
    const minLeftShift = Math.max(-origStart, -origOffset);
    const clampedShift = clamp(deltaSec, minLeftShift, maxRightShift);
    return {
      startTime: Number((origStart + clampedShift).toFixed(3)),
      duration: Number((origDuration - clampedShift).toFixed(3)),
      sourceOffset: Math.max(0, Number((origOffset + clampedShift).toFixed(3))),
    };
  }

  const maxDur =
    maxAssetDuration && maxAssetDuration > 0
      ? Math.max(minDur, maxAssetDuration - origOffset)
      : 300;
  const nextDur = clamp(origDuration + deltaSec, minDur, maxDur);
  return {
    startTime: origStart,
    duration: Number(nextDur.toFixed(3)),
    sourceOffset: origOffset,
  };
}

export function getCanvasDimensions(
  aspectRatio: AspectRatio,
  maxLongEdge = 1280
): { width: number; height: number } {
  const makeEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  switch (aspectRatio) {
    case '9:16':
      return { width: makeEven((maxLongEdge * 9) / 16), height: makeEven(maxLongEdge) };
    case '1:1':
      return { width: makeEven(maxLongEdge * 0.8), height: makeEven(maxLongEdge * 0.8) };
    case '4:5':
      return { width: makeEven(maxLongEdge * 0.72), height: makeEven(maxLongEdge * 0.9) };
    case '21:9':
      return { width: makeEven(maxLongEdge), height: makeEven((maxLongEdge * 9) / 21) };
    case '16:9':
    default:
      return { width: makeEven(maxLongEdge), height: makeEven((maxLongEdge * 9) / 16) };
  }
}

export function computeAudioGainAtTime(clip: TimelineClip, localTime: number): number {
  if (clip.audio.muted) return 0;
  const kfAudio = evaluateAudioKeyframes(clip, localTime);
  const baseGain = clamp(kfAudio.volume / 100, 0, 5);
  let envelope = 1;
  if (clip.audio.fadeIn > 0 && localTime < clip.audio.fadeIn) {
    envelope *= clamp(localTime / clip.audio.fadeIn, 0, 1);
  }
  const timeToEnd = clip.duration - localTime;
  if (clip.audio.fadeOut > 0 && timeToEnd < clip.audio.fadeOut) {
    envelope *= clamp(timeToEnd / clip.audio.fadeOut, 0, 1);
  }
  return baseGain * envelope;
}

export type PipPresetId =
  | 'reset'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'splitLeft'
  | 'splitRight';

export function getPipPresetPatch(preset: PipPresetId): {
  transform: Partial<ClipTransform>;
  mask: ClipMaskShape;
} {
  switch (preset) {
    case 'topLeft':
      return { transform: { x: -0.28, y: -0.26, scale: 0.38 }, mask: 'rounded' };
    case 'topRight':
      return { transform: { x: 0.28, y: -0.26, scale: 0.38 }, mask: 'rounded' };
    case 'bottomLeft':
      return { transform: { x: -0.28, y: 0.26, scale: 0.38 }, mask: 'rounded' };
    case 'bottomRight':
      return { transform: { x: 0.28, y: 0.26, scale: 0.38 }, mask: 'rounded' };
    case 'splitLeft':
      return { transform: { x: -0.25, y: 0, scale: 1 }, mask: 'splitLeft' };
    case 'splitRight':
      return { transform: { x: 0.25, y: 0, scale: 1 }, mask: 'splitRight' };
    case 'reset':
    default:
      return { transform: { x: 0, y: 0, scale: 1, rotation: 0 }, mask: 'none' };
  }
}
