import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import { clamp, computeAudioGainAtTime, evaluateAudioKeyframes } from './timelineMath';

interface AudioNodeGraph {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  bass: BiquadFilterNode;
  mid: BiquadFilterNode;
  treble: BiquadFilterNode;
  panner: StereoPannerNode | null;
  gain: GainNode;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private graphs = new Map<string, AudioNodeGraph>();
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

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
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
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

    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    if (panner) {
      treble.connect(panner);
      panner.connect(gain);
    } else {
      treble.connect(gain);
    }
    gain.connect(this.masterGain);

    const graph: AudioNodeGraph = { element, source, bass, mid, treble, panner, gain };
    this.graphs.set(clipId, graph);
    return graph;
  }

  syncPlayback(
    isPlaying: boolean,
    playhead: number,
    clips: TimelineClip[],
    tracks: TimelineTrack[],
    assets: MediaAsset[],
    globalPlaybackRate = 1
  ): void {
    if (!isPlaying) {
      this.pauseAll();
      return;
    }
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const assetMap = new Map(assets.map((a) => [a.id, a]));
    const hasSoloAudio = tracks.some((t) => t.type === 'audio' && t.solo);
    const activeIds = new Set<string>();

    for (const clip of clips) {
      if (clip.kind !== 'audio' && clip.kind !== 'video') continue;
      const track = trackMap.get(clip.trackId);
      if (!track || track.muted || clip.audio.muted) continue;
      if (hasSoloAudio && !track.solo) continue;

      const asset = assetMap.get(clip.assetId);
      if (!asset || !asset.src || (asset.kind !== 'audio' && asset.kind !== 'video')) continue;

      const inWindow = playhead >= clip.startTime && playhead <= clip.startTime + clip.duration;
      if (!inWindow) continue;

      activeIds.add(clip.id);
      const graph = this.getOrCreateGraph(clip.id, asset.src);
      if (!graph || !this.ctx) continue;

      const localTime = playhead - clip.startTime;
      const targetSrcTime = clip.sourceOffset + localTime * clip.speed;
      const gainVal = computeAudioGainAtTime(clip, localTime);
      const { pan } = evaluateAudioKeyframes(clip, localTime);

      graph.gain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.02);
      if (graph.panner) {
        graph.panner.pan.setTargetAtTime(clamp(pan / 100, -1, 1), this.ctx.currentTime, 0.02);
      }
      graph.bass.gain.setTargetAtTime(clip.audio.eqBass, this.ctx.currentTime, 0.03);
      graph.mid.gain.setTargetAtTime(clip.audio.eqMid, this.ctx.currentTime, 0.03);
      graph.treble.gain.setTargetAtTime(clip.audio.eqTreble, this.ctx.currentTime, 0.03);

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

    for (const [id, graph] of this.graphs.entries()) {
      if (!activeIds.has(id) && !graph.element.paused) {
        graph.element.pause();
      }
    }
  }

  pauseAll(): void {
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
