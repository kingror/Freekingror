import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import { clamp } from './timelineMath';
import {
  computeEffectiveAudioPan,
  computeEffectiveTrackAndClipGain,
  isTrackAudible,
  volumePctToLinearGain,
} from './audioMixer';

interface AudioNodeGraph {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  dehum: BiquadFilterNode;
  mudCut: BiquadFilterNode;
  voicePresence: BiquadFilterNode;
  bass: BiquadFilterNode;
  mid: BiquadFilterNode;
  treble: BiquadFilterNode;
  panner: StereoPannerNode | null;
  gain: GainNode;
}

export interface LiveAudioLevelSnapshot {
  rms: number;
  peak: number;
  peakDb: number;
  clipping: boolean;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private graphs = new Map<string, AudioNodeGraph>();
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeDomainBuf: Float32Array<ArrayBuffer> | null = null;
  private playingActive = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -3;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 10;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.72;
      this.timeDomainBuf = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOrCreateGraph(clipId: string, src: string): AudioNodeGraph | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !src) return null;
    const existing = this.graphs.get(clipId);
    if (existing) return existing;

    const element = document.createElement('audio');
    element.crossOrigin = 'anonymous';
    element.preload = 'auto';
    element.src = src;

    const source = ctx.createMediaElementSource(element);

    // 2026 Broadcast DSP Stage: High-pass De-Hum + Voice Mud Attenuation + Presence Boost
    const dehum = ctx.createBiquadFilter();
    dehum.type = 'highpass';
    dehum.frequency.value = 20;
    dehum.Q.value = 0.7;

    const mudCut = ctx.createBiquadFilter();
    mudCut.type = 'peaking';
    mudCut.frequency.value = 300;
    mudCut.Q.value = 1.2;
    mudCut.gain.value = 0;

    const voicePresence = ctx.createBiquadFilter();
    voicePresence.type = 'peaking';
    voicePresence.frequency.value = 2800;
    voicePresence.Q.value = 1.1;
    voicePresence.gain.value = 0;

    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 120;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1.0;

    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 6000;

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    const gain = ctx.createGain();

    source.connect(dehum);
    dehum.connect(mudCut);
    mudCut.connect(voicePresence);
    voicePresence.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    if (panner) {
      treble.connect(panner);
      panner.connect(gain);
    } else {
      treble.connect(gain);
    }
    gain.connect(this.masterGain);

    const graph: AudioNodeGraph = {
      element,
      source,
      dehum,
      mudCut,
      voicePresence,
      bass,
      mid,
      treble,
      panner,
      gain,
    };
    this.graphs.set(clipId, graph);
    return graph;
  }

  getLiveAudioLevels(): LiveAudioLevelSnapshot {
    if (!this.playingActive || !this.analyser || !this.timeDomainBuf) {
      return { rms: 0, peak: 0, peakDb: -Infinity, clipping: false };
    }
    this.analyser.getFloatTimeDomainData(this.timeDomainBuf);
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < this.timeDomainBuf.length; i++) {
      const v = Math.abs(this.timeDomainBuf[i]);
      sumSq += v * v;
      if (v > peak) peak = v;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, this.timeDomainBuf.length));
    const peakDb = peak > 1e-6 ? Number((20 * Math.log10(peak)).toFixed(1)) : -Infinity;
    return {
      rms: clamp(rms, 0, 1),
      peak: clamp(peak, 0, 1.5),
      peakDb,
      clipping: peak >= 0.99,
    };
  }

  syncPlayback(
    isPlaying: boolean,
    playhead: number,
    clips: TimelineClip[],
    tracks: TimelineTrack[],
    assets: MediaAsset[],
    globalPlaybackRate = 1,
    masterVolumePct = 100
  ): void {
    this.playingActive = isPlaying;
    if (!isPlaying) {
      this.pauseAll();
      return;
    }
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const assetMap = new Map(assets.map((a) => [a.id, a]));
    const activeIds = new Set<string>();
    let anyLimiterActive = false;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        volumePctToLinearGain(masterVolumePct),
        this.ctx.currentTime,
        0.02
      );
    }

    for (const clip of clips) {
      if (clip.kind !== 'audio' && clip.kind !== 'video') continue;
      const track = trackMap.get(clip.trackId);
      if (!track || clip.audio.muted || !isTrackAudible(track, tracks)) continue;

      const asset = assetMap.get(clip.assetId);
      if (!asset || !asset.src || (asset.kind !== 'audio' && asset.kind !== 'video')) continue;

      const inWindow = playhead >= clip.startTime && playhead <= clip.startTime + clip.duration;
      if (!inWindow) continue;

      activeIds.add(clip.id);
      if (clip.audio.compressorEnabled !== false) {
        anyLimiterActive = true;
      }
      const graph = this.getOrCreateGraph(clip.id, asset.src);
      if (!graph || !this.ctx) continue;

      const localTime = playhead - clip.startTime;
      const targetSrcTime = clip.sourceOffset + localTime * clip.speed;
      const gainVal = computeEffectiveTrackAndClipGain(clip, track, tracks, localTime, 100);
      const panVal = computeEffectiveAudioPan(clip, track, localTime);
      const now = this.ctx.currentTime;

      graph.gain.gain.setTargetAtTime(gainVal, now, 0.02);
      if (graph.panner) {
        graph.panner.pan.setTargetAtTime(panVal, now, 0.02);
      }

      const voiceIso = Boolean(clip.audio.voiceIsolation);
      const hpHz =
        clip.audio.highPassHz && clip.audio.highPassHz > 20
          ? clip.audio.highPassHz
          : voiceIso
          ? 100
          : 20;
      graph.dehum.frequency.setTargetAtTime(hpHz, now, 0.03);
      graph.mudCut.gain.setTargetAtTime(voiceIso ? -4.5 : 0, now, 0.03);
      graph.voicePresence.gain.setTargetAtTime(voiceIso ? 4.5 : 0, now, 0.03);

      graph.bass.gain.setTargetAtTime(clip.audio.eqBass, now, 0.03);
      graph.mid.gain.setTargetAtTime(clip.audio.eqMid, now, 0.03);
      graph.treble.gain.setTargetAtTime(clip.audio.eqTreble, now, 0.03);

      const effRate = clamp(clip.speed * globalPlaybackRate, 0.25, 4);
      if (Math.abs(graph.element.playbackRate - effRate) > 0.05) {
        try {
          graph.element.playbackRate = effRate;
        } catch {
          // Ignore playbackRate range errors
        }
      }

      if (Math.abs(graph.element.currentTime - targetSrcTime) > 0.3) {
        graph.element.currentTime = Math.max(0, targetSrcTime);
      }
      if (graph.element.paused) {
        graph.element.play().catch(() => {});
      }
    }

    if (this.compressor && this.ctx) {
      this.compressor.ratio.setTargetAtTime(anyLimiterActive ? 10 : 1.0, this.ctx.currentTime, 0.03);
    }

    for (const [id, graph] of this.graphs.entries()) {
      if (!activeIds.has(id) && !graph.element.paused) {
        graph.element.pause();
      }
    }
  }

  pauseAll(): void {
    this.playingActive = false;
    for (const graph of this.graphs.values()) {
      if (!graph.element.paused) {
        graph.element.pause();
      }
    }
  }

  dispose(): void {
    this.pauseAll();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.graphs.clear();
  }
}
