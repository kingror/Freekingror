import type { AspectRatio, ExportSettings, MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import { MediaElementCache, renderCompositeFrame } from './compositor';
import {
  clamp,
  computeAudioGainAtTime,
  evaluateAudioKeyframes,
  getCanvasDimensions,
  getProjectDuration,
} from './timelineMath';

export interface ExportResult {
  blobUrl: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export function pickSupportedMimeType(format: ExportSettings['format']): {
  mimeType: string;
  ext: string;
} {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', ext: 'webm' };
  }

  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];

  if (format === 'mp4' || format === 'mov') {
    for (const candidate of mp4Candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return { mimeType: candidate, ext: format };
      }
    }
  }

  for (const candidate of webmCandidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return { mimeType: candidate, ext: format === 'mp4' || format === 'mov' ? 'webm' : format };
    }
  }

  return { mimeType: 'video/webm', ext: 'webm' };
}

export function estimateExportSizeMB(
  durationSec: number,
  bitrateMbps: number,
  format: ExportSettings['format']
): number {
  const safeDur = Math.max(1, durationSec);
  if (format === 'wav') {
    // 44.1kHz stereo 16-bit PCM = ~176.4 KB/sec
    return Number(((safeDur * 176.4) / 1024).toFixed(2));
  }
  if (format === 'gif') {
    return Number((safeDur * 1.4).toFixed(1));
  }
  return Number(((safeDur * bitrateMbps) / 8).toFixed(1));
}

function encodeStereoWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = clamp(left[i], -1, 1);
    view.setInt16(offset, Math.round(l * 32767), true);
    offset += 2;
    if (numChannels > 1) {
      const r = clamp(right[i], -1, 1);
      view.setInt16(offset, Math.round(r * 32767), true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function renderMixedAudioBuffer(
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  assets: MediaAsset[],
  totalDuration: number
): Promise<AudioBuffer | null> {
  if (typeof window === 'undefined' || typeof OfflineAudioContext === 'undefined') {
    return null;
  }

  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const hasSoloAudio = tracks.some((t) => t.type === 'audio' && t.solo);

  const audioClips = clips.filter((c) => {
    if (c.kind !== 'audio' && c.kind !== 'video') return false;
    const track = trackMap.get(c.trackId);
    if (!track || track.muted || c.audio.muted) return false;
    if (hasSoloAudio && !track.solo) return false;
    const asset = assetMap.get(c.assetId);
    return Boolean(asset && asset.src && (asset.kind === 'audio' || asset.kind === 'video'));
  });

  if (audioClips.length === 0) return null;

  const sampleRate = 44100;
  const totalSamples = Math.max(sampleRate, Math.ceil(totalDuration * sampleRate));
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -3;
  compressor.knee.value = 12;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;
  compressor.connect(offline.destination);

  const decodedCache = new Map<string, AudioBuffer | null>();
  let scheduledCount = 0;

  for (const clip of audioClips) {
    const asset = assetMap.get(clip.assetId);
    if (!asset?.src) continue;

    let decoded = decodedCache.get(asset.id);
    if (decoded === undefined) {
      try {
        const res = await fetch(asset.src);
        const arr = await res.arrayBuffer();
        decoded = await offline.decodeAudioData(arr.slice(0));
      } catch {
        decoded = null;
      }
      decodedCache.set(asset.id, decoded);
    }
    if (!decoded) continue;

    const srcNode = offline.createBufferSource();
    srcNode.buffer = decoded;
    srcNode.playbackRate.value = clamp(clip.speed, 0.25, 4);

    const bass = offline.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 120;
    bass.gain.value = clip.audio.eqBass;

    const mid = offline.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1.0;
    mid.gain.value = clip.audio.eqMid;

    const treble = offline.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 6000;
    treble.gain.value = clip.audio.eqTreble;

    const panner = offline.createStereoPanner();
    const gainNode = offline.createGain();

    // Sample gain & pan envelope accurately across the clip window
    const step = 0.08;
    const steps = Math.max(2, Math.ceil(clip.duration / step));
    for (let s = 0; s <= steps; s++) {
      const localT = Math.min(clip.duration, (s / steps) * clip.duration);
      const absT = clip.startTime + localT;
      const g = computeAudioGainAtTime(clip, localT);
      const { pan } = evaluateAudioKeyframes(clip, localT);
      if (s === 0) {
        gainNode.gain.setValueAtTime(g, absT);
        panner.pan.setValueAtTime(clamp(pan / 100, -1, 1), absT);
      } else {
        gainNode.gain.linearRampToValueAtTime(g, absT);
        panner.pan.linearRampToValueAtTime(clamp(pan / 100, -1, 1), absT);
      }
    }

    srcNode.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(compressor);

    const safeOffset = clamp(clip.sourceOffset, 0, Math.max(0, decoded.duration - 0.05));
    srcNode.start(clip.startTime, safeOffset, clip.duration);
    scheduledCount += 1;
  }

  if (scheduledCount === 0) return null;
  return offline.startRendering();
}

export async function renderProjectExport(params: {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAsset[];
  aspectRatio: AspectRatio;
  settings: ExportSettings;
  projectTitle: string;
  onProgress: (pct: number) => void;
  signal: AbortSignal;
}): Promise<ExportResult> {
  const { clips, tracks, assets, aspectRatio, settings, projectTitle, onProgress, signal } = params;
  const totalDuration = Math.max(1, getProjectDuration(clips));
  const safeSlug = (projectTitle || 'rorn_export')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');

  // Multi-track stereo WAV mixdown path
  if (settings.format === 'wav') {
    onProgress(20);
    const mixedBuffer = await renderMixedAudioBuffer(clips, tracks, assets, totalDuration);
    if (mixedBuffer) {
      onProgress(85);
      const wavBlob = encodeStereoWavBlob(mixedBuffer);
      onProgress(100);
      return {
        blobUrl: URL.createObjectURL(wavBlob),
        blob: wavBlob,
        filename: `${safeSlug}_master.wav`,
        mimeType: 'audio/wav',
        sizeBytes: wavBlob.size,
      };
    }
    const fallbackAudio = assets.find((a) => a.kind === 'audio' && a.src);
    if (fallbackAudio) {
      onProgress(50);
      const res = await fetch(fallbackAudio.src);
      const blob = await res.blob();
      onProgress(100);
      return {
        blobUrl: URL.createObjectURL(blob),
        blob,
        filename: `${safeSlug}.wav`,
        mimeType: 'audio/wav',
        sizeBytes: blob.size,
      };
    }
  }

  const maxEdge =
    settings.resolution === '2160p'
      ? 1920
      : settings.resolution === '1080p'
      ? 1280
      : settings.resolution === '720p'
      ? 960
      : 640;

  const { width, height } = getCanvasDimensions(aspectRatio, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize 2D export canvas');

  const cache = new MediaElementCache();
  const { mimeType, ext } = pickSupportedMimeType(settings.format);
  const videoStream = canvas.captureStream(settings.fps);

  // Mix multi-track audio alongside video stream if browser supports live AudioContext destination
  let liveAudioCtx: AudioContext | null = null;
  let liveAudioSrc: AudioBufferSourceNode | null = null;
  const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  if (settings.format !== 'gif') {
    try {
      const mixedBuffer = await renderMixedAudioBuffer(clips, tracks, assets, totalDuration);
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (mixedBuffer && AudioCtx) {
        liveAudioCtx = new AudioCtx();
        const dest = liveAudioCtx.createMediaStreamDestination();
        const src = liveAudioCtx.createBufferSource();
        src.buffer = mixedBuffer;
        const simSpeed = Math.max(1, totalDuration / 6);
        src.playbackRate.value = simSpeed;
        src.connect(dest);
        liveAudioSrc = src;
        for (const track of dest.stream.getAudioTracks()) {
          combinedTracks.push(track);
        }
      }
    } catch {
      // Fallback cleanly to video-only stream if headless AudioContext refuses capture
    }
  }

  const stream = new MediaStream(combinedTracks);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: settings.bitrateMbps * 1_000_000,
  });

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  const stopPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('MediaRecorder encoding failed'));
  });

  recorder.start(200);
  if (liveAudioSrc) {
    try {
      liveAudioSrc.start();
    } catch {
      // Ignore if AudioContext not started
    }
  }

  const frameIntervalMs = 1000 / Math.min(30, settings.fps);
  const simSpeed = Math.max(1, totalDuration / 6);
  let t = 0;

  while (t <= totalDuration) {
    if (signal.aborted) {
      recorder.stop();
      liveAudioSrc?.stop();
      liveAudioCtx?.close().catch(() => {});
      throw new Error('Export cancelled');
    }
    renderCompositeFrame({
      ctx,
      width,
      height,
      playhead: t,
      clips,
      tracks,
      assets,
      cache,
      isPlaying: false,
      showSafeMargins: false,
      computeHistogram: false,
    });
    onProgress(Math.min(98, Math.round((t / totalDuration) * 100)));
    await new Promise((r) => setTimeout(r, frameIntervalMs));
    t += (frameIntervalMs / 1000) * simSpeed;
  }

  recorder.stop();
  liveAudioSrc?.stop();
  liveAudioCtx?.close().catch(() => {});
  const finalBlob = await stopPromise;
  onProgress(100);

  return {
    blobUrl: URL.createObjectURL(finalBlob),
    blob: finalBlob,
    filename: `${safeSlug}_${settings.resolution}.${ext}`,
    mimeType,
    sizeBytes: finalBlob.size,
  };
}
