import type { AspectRatio, ExportSettings, MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import { MediaElementCache, renderCompositeFrame } from './compositor';
import {
  clamp,
  getCanvasDimensions,
  getProjectDuration,
} from './timelineMath';
import {
  computeEffectiveAudioPan,
  computeEffectiveTrackAndClipGain,
  isTrackAudible,
} from './audioMixer';

export interface ExportResult {
  blobUrl: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RealExportCapabilities {
  webCodecsVideoEncoder: boolean;
  offlineAudioMixdown: boolean;
  mp4Supported: boolean;
  webmVp9Supported: boolean;
  activeCodecLabel: string;
}

export function getRealExportCapabilities(format: ExportSettings['format']): RealExportCapabilities {
  const webCodecsVideoEncoder = typeof VideoEncoder !== 'undefined';
  const offlineAudioMixdown =
    typeof window !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  const mp4Supported =
    hasRecorder &&
    (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2') ||
      MediaRecorder.isTypeSupported('video/mp4'));
  const webmVp9Supported =
    hasRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus');
  const picked = pickSupportedMimeType(format);
  return {
    webCodecsVideoEncoder,
    offlineAudioMixdown,
    mp4Supported,
    webmVp9Supported,
    activeCodecLabel: format === 'wav' ? 'PCM 16-bit WAV (44.1kHz Stereo)' : picked.mimeType,
  };
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
    'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
    'video/webm;codecs=vp9,opus',
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

  const audioClips = clips.filter((c) => {
    if (c.kind !== 'audio' && c.kind !== 'video') return false;
    const track = trackMap.get(c.trackId);
    if (!track || c.audio.muted || !isTrackAudible(track, tracks)) return false;
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
    const track = trackMap.get(clip.trackId);
    if (!asset?.src || !track) continue;

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

    const voiceIso = Boolean(clip.audio.voiceIsolation);
    const hpHz =
      clip.audio.highPassHz && clip.audio.highPassHz > 20
        ? clip.audio.highPassHz
        : voiceIso
        ? 100
        : 20;

    const dehum = offline.createBiquadFilter();
    dehum.type = 'highpass';
    dehum.frequency.value = hpHz;
    dehum.Q.value = 0.7;

    const mudCut = offline.createBiquadFilter();
    mudCut.type = 'peaking';
    mudCut.frequency.value = 300;
    mudCut.Q.value = 1.2;
    mudCut.gain.value = voiceIso ? -4.5 : 0;

    const voicePresence = offline.createBiquadFilter();
    voicePresence.type = 'peaking';
    voicePresence.frequency.value = 2800;
    voicePresence.Q.value = 1.1;
    voicePresence.gain.value = voiceIso ? 4.5 : 0;

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
      const g = computeEffectiveTrackAndClipGain(clip, track, tracks, localT, 100);
      const panVal = computeEffectiveAudioPan(clip, track, localT);
      if (s === 0) {
        gainNode.gain.setValueAtTime(g, absT);
        panner.pan.setValueAtTime(panVal, absT);
      } else {
        gainNode.gain.linearRampToValueAtTime(g, absT);
        panner.pan.linearRampToValueAtTime(panVal, absT);
      }
    }

    srcNode.connect(dehum);
    dehum.connect(mudCut);
    mudCut.connect(voicePresence);
    voicePresence.connect(bass);
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
  canvas.style.cssText =
    'position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0.001;pointer-events:none;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    throw new Error('Unable to initialize 2D export canvas');
  }

  try {
    const cache = new MediaElementCache();
    const runCapturePass = async (
      withAudio: boolean
    ): Promise<{ blob: Blob; mimeType: string; ext: string }> => {
      const picked = withAudio
        ? pickSupportedMimeType(settings.format)
        : {
            mimeType:
              typeof MediaRecorder !== 'undefined' &&
              MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8'
                : 'video/webm',
            ext: settings.format === 'mp4' || settings.format === 'mov' ? 'webm' : settings.format,
          };
      const videoStream = canvas.captureStream(settings.fps);
      const primaryVideoTrack = videoStream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;

      let liveAudioCtx: AudioContext | null = null;
      let liveAudioSrc: AudioBufferSourceNode | null = null;
      const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      const targetExportWallSec = 2.6;
      const simSpeed = Math.max(1, totalDuration / targetExportWallSec);

      if (withAudio && settings.format !== 'gif') {
        try {
          const mixedBuffer = await renderMixedAudioBuffer(clips, tracks, assets, totalDuration);
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (mixedBuffer && AudioCtx) {
            liveAudioCtx = new AudioCtx();
            if (liveAudioCtx.state === 'suspended') {
              await liveAudioCtx.resume().catch(() => {});
            }
            const dest = liveAudioCtx.createMediaStreamDestination();
            const src = liveAudioCtx.createBufferSource();
            src.buffer = mixedBuffer;
            src.playbackRate.value = clamp(simSpeed, 0.5, 4);
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
        mimeType: picked.mimeType,
        videoBitsPerSecond: settings.bitrateMbps * 1_000_000,
      });

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      const stopPromise = new Promise<Blob>((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve(new Blob(chunks, { type: picked.mimeType }));
        };
        recorder.onstop = finish;
        recorder.onerror = () => {
          if (settled) return;
          settled = true;
          reject(new Error('MediaRecorder encoding failed'));
        };
      });

      recorder.start(200);
      if (liveAudioSrc) {
        try {
          liveAudioSrc.start();
        } catch {
          // Ignore if AudioContext not started
        }
      }

      const frameIntervalMs = 1000 / Math.min(24, settings.fps);
      let t = 0;

      while (t <= totalDuration) {
        if (signal.aborted) {
          if (recorder.state !== 'inactive') recorder.stop();
          try {
            liveAudioSrc?.stop();
          } catch {
            // Ignore
          }
          liveAudioCtx?.close().catch(() => {});
          throw new Error('Export cancelled');
        }
        const frameStart = performance.now();
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
          animateEffects: true,
          preferProxy: false,
          showSafeMargins: false,
          computeHistogram: false,
        });
        primaryVideoTrack?.requestFrame?.();
        onProgress(Math.min(98, Math.round((t / totalDuration) * 100)));
        const elapsed = performance.now() - frameStart;
        await new Promise((r) => setTimeout(r, Math.max(4, frameIntervalMs - elapsed)));
        t += (frameIntervalMs / 1000) * simSpeed;
      }

      if (recorder.state !== 'inactive') {
        try {
          recorder.requestData?.();
        } catch {
          // Ignore requestData if unsupported
        }
        recorder.stop();
      }
      const blob = await stopPromise;
      try {
        liveAudioSrc?.stop();
      } catch {
        // Ignore
      }
      liveAudioCtx?.close().catch(() => {});
      return { blob, mimeType: picked.mimeType, ext: picked.ext };
    };

    let captured = await runCapturePass(true);
    if (captured.blob.size === 0) {
      captured = await runCapturePass(false);
    }
    if (!captured.blob || captured.blob.size === 0) {
      throw new Error('Video encoder produced an empty stream. Try switching format to WEBM.');
    }
    onProgress(100);

    return {
      blobUrl: URL.createObjectURL(captured.blob),
      blob: captured.blob,
      filename: `${safeSlug}_${settings.resolution}.${captured.ext}`,
      mimeType: captured.mimeType,
      sizeBytes: captured.blob.size,
    };
  } finally {
    canvas.remove();
  }
}
