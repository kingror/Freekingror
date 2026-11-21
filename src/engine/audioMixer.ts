import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import { clamp, computeAudioGainAtTime, evaluateAudioKeyframes } from './timelineMath';

export const DEFAULT_TRACK_VOLUME = 100;
export const MIN_TRACK_VOLUME = 0;
export const MAX_TRACK_VOLUME = 200;
export const DEFAULT_TRACK_PAN = 0;

export interface TrackMeterSnapshot {
  trackId: string;
  level01: number;
  peakDb: number;
  clipping: boolean;
  activeClipCount: number;
}

export function getTrackVolumePct(track?: Pick<TimelineTrack, 'volume'> | null): number {
  if (!track || typeof track.volume !== 'number' || !Number.isFinite(track.volume)) {
    return DEFAULT_TRACK_VOLUME;
  }
  return Math.round(clamp(track.volume, MIN_TRACK_VOLUME, MAX_TRACK_VOLUME));
}

export function getTrackPan(track?: Pick<TimelineTrack, 'pan'> | null): number {
  if (!track || typeof track.pan !== 'number' || !Number.isFinite(track.pan)) {
    return DEFAULT_TRACK_PAN;
  }
  return Math.round(clamp(track.pan, -100, 100));
}

export function volumePctToLinearGain(volumePct: number): number {
  return clamp(volumePct / 100, 0, 2.5);
}

export function volumePctToDbLabel(volumePct: number): string {
  const safe = clamp(volumePct, 0, 500);
  if (safe <= 0.4) return '-∞ dB';
  const db = 20 * Math.log10(safe / 100);
  const rounded = Math.abs(db) < 0.05 ? 0 : db;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} dB`;
}

export function formatPanLabel(pan: number): string {
  const safe = Math.round(clamp(pan, -100, 100));
  if (Math.abs(safe) <= 2) return 'C';
  return safe < 0 ? `L${Math.abs(safe)}` : `R${safe}`;
}

export function hasAnySoloAudioTrack(allTracks: TimelineTrack[]): boolean {
  return allTracks.some(
    (t) => Boolean(t.solo) && (t.type === 'audio' || t.type === 'video' || t.type === 'overlay')
  );
}

export function isTrackAudible(track: TimelineTrack, allTracks: TimelineTrack[]): boolean {
  if (track.muted) return false;
  if (hasAnySoloAudioTrack(allTracks)) {
    return Boolean(track.solo);
  }
  return true;
}

export function computeEffectiveTrackAndClipGain(
  clip: TimelineClip,
  track: TimelineTrack,
  allTracks: TimelineTrack[],
  localTime: number,
  masterVolumePct = 100
): number {
  if (!isTrackAudible(track, allTracks) || clip.audio.muted) return 0;
  const clipGain = computeAudioGainAtTime(clip, localTime);
  const trackGain = volumePctToLinearGain(getTrackVolumePct(track));
  const masterGain = volumePctToLinearGain(clamp(masterVolumePct, 0, 200));
  return clamp(clipGain * trackGain * masterGain, 0, 6);
}

export function computeEffectiveAudioPan(
  clip: TimelineClip,
  track: TimelineTrack,
  localTime: number
): number {
  const { pan: clipPan } = evaluateAudioKeyframes(clip, localTime);
  const trackPan = getTrackPan(track);
  return clamp((clipPan + trackPan) / 100, -1, 1);
}

/**
 * Returns tracks eligible for the Multi-Track Audio Mixer overlay:
 * - All 'audio' tracks in timeline order (A1 Music, A2 SFX, A3 Voiceover, ...)
 * - Any 'video' or 'overlay' track that contains at least one video clip (with audio stream)
 */
export function getMixerTracks(
  tracks: TimelineTrack[],
  clips: TimelineClip[]
): TimelineTrack[] {
  const videoTracksWithVideoClip = new Set(
    clips.filter((c) => c.kind === 'video').map((c) => c.trackId)
  );
  const audioTracks = tracks.filter((t) => t.type === 'audio');
  const videoAudioTracks = tracks.filter(
    (t) => (t.type === 'video' || t.type === 'overlay') && videoTracksWithVideoClip.has(t.id)
  );
  return [...audioTracks, ...videoAudioTracks];
}

export function updateTrackVolumeInList(
  tracks: TimelineTrack[],
  trackId: string,
  volumePct: number
): TimelineTrack[] {
  const nextVol = Math.round(clamp(volumePct, MIN_TRACK_VOLUME, MAX_TRACK_VOLUME));
  return tracks.map((t) => (t.id === trackId ? { ...t, volume: nextVol } : t));
}

export function updateTrackPanInList(
  tracks: TimelineTrack[],
  trackId: string,
  pan: number
): TimelineTrack[] {
  const nextPan = Math.round(clamp(pan, -100, 100));
  return tracks.map((t) => (t.id === trackId ? { ...t, pan: nextPan } : t));
}

export function resetMixerTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks.map((t) => ({
    ...t,
    volume: DEFAULT_TRACK_VOLUME,
    pan: DEFAULT_TRACK_PAN,
    muted: false,
    solo: false,
  }));
}

export function estimateTrackLiveMeterLevel(
  track: TimelineTrack,
  allTracks: TimelineTrack[],
  clips: TimelineClip[],
  assets: MediaAsset[],
  playhead: number,
  isPlaying: boolean,
  masterVolumePct = 100
): TrackMeterSnapshot {
  const audible = isTrackAudible(track, allTracks);
  const activeClips = clips.filter(
    (c) =>
      c.trackId === track.id &&
      (c.kind === 'audio' || c.kind === 'video') &&
      playhead >= c.startTime &&
      playhead <= c.startTime + c.duration
  );

  if (!audible || activeClips.length === 0) {
    return {
      trackId: track.id,
      level01: 0,
      peakDb: -Infinity,
      clipping: false,
      activeClipCount: activeClips.length,
    };
  }

  const assetMap = new Map(assets.map((a) => [a.id, a]));
  let combinedLinear = 0;

  for (const clip of activeClips) {
    const localTime = clamp(playhead - clip.startTime, 0, clip.duration);
    const gain = computeEffectiveTrackAndClipGain(
      clip,
      track,
      allTracks,
      localTime,
      masterVolumePct
    );
    if (gain <= 0) continue;

    const asset = assetMap.get(clip.assetId);
    let baseSample = 0.48;
    if (asset?.waveform && asset.waveform.length > 0) {
      const progress = clamp(localTime / Math.max(0.05, clip.duration), 0, 0.999);
      const idx = Math.min(
        asset.waveform.length - 1,
        Math.floor(progress * asset.waveform.length)
      );
      baseSample = asset.waveform[idx] ?? 0.45;
    }

    // Add gentle live motion shimmer during active playback
    const activityMod = isPlaying ? 0.85 + 0.15 * Math.sin(playhead * 18 + clip.startTime) : 0.72;
    combinedLinear += baseSample * gain * activityMod;
  }

  const normalized = clamp(combinedLinear, 0, 1.35);
  const level01 = clamp(normalized / 1.15, 0, 1);
  const peakDb =
    normalized > 1e-4 ? Number((20 * Math.log10(normalized)).toFixed(1)) : -Infinity;

  return {
    trackId: track.id,
    level01,
    peakDb,
    clipping: normalized >= 1.0,
    activeClipCount: activeClips.length,
  };
}
