import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
} from './timelineMath';

export const SAMPLE_IMAGES = {
  mountain: '/src/assets/images/sample_mountain_dawn_1795007791113.jpg',
  city: '/src/assets/images/sample_city_night_1795007791739.jpg',
  greenscreen: '/src/assets/images/sample_greenscreen_subject_1795007792243.jpg',
};

export function generateWaveform(seed: number, bars = 48): number[] {
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    const env = Math.sin(t * Math.PI);
    const wave =
      0.45 +
      0.32 * Math.sin(i * 0.85 + seed) +
      0.22 * Math.cos(i * 1.9 + seed * 2.1);
    out.push(Number(Math.max(0.12, Math.min(1, wave * (0.4 + 0.6 * env))).toFixed(2)));
  }
  return out;
}

function encodeMonoWav(samples: Float32Array, sampleRate = 22050): string {
  if (typeof window === 'undefined' || typeof Blob === 'undefined') {
    return '';
  }
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  writeStr(36, 'data');
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export function createAmbientScoreWavUrl(durationSec = 12, sampleRate = 22050): string {
  const numSamples = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(numSamples);
  const chords = [
    [146.83, 220.0, 261.63, 329.63],
    [116.54, 174.61, 220.0, 293.66],
    [130.81, 196.0, 220.0, 261.63],
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(2, Math.floor((t / durationSec) * 3));
    const freqs = chords[chordIdx];
    let s = 0;
    for (let k = 0; k < freqs.length; k++) {
      s += Math.sin(2 * Math.PI * freqs[k] * t) * (0.16 / (k * 0.4 + 1));
    }
    const pulse = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.5 * t);
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, (durationSec - t) / 1.2);
    samples[i] = s * pulse * fadeIn * fadeOut * 0.42;
  }
  return encodeMonoWav(samples, sampleRate);
}

export function createSfxWavUrl(kind: 'whoosh' | 'subdrop' | 'shutter', sampleRate = 22050): string {
  const dur = kind === 'shutter' ? 0.45 : 1.6;
  const numSamples = Math.floor(dur * sampleRate);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const u = t / dur;
    if (kind === 'whoosh') {
      const noise = Math.sin(i * 0.13) * Math.cos(i * 0.37) + Math.sin(i * 0.71) * 0.5;
      const sweep = Math.sin(2 * Math.PI * (90 + 480 * Math.sin(u * Math.PI)) * t);
      const env = Math.sin(u * Math.PI);
      samples[i] = (noise * 0.35 + sweep * 0.25) * env * 0.65;
    } else if (kind === 'subdrop') {
      const freq = 115 * Math.pow(0.28, u);
      const env = Math.exp(-u * 2.8) * Math.min(1, t / 0.02);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.85;
    } else {
      const env = Math.exp(-u * 18);
      const click = Math.sin(2 * Math.PI * 1400 * t) + Math.sin(2 * Math.PI * 320 * t) * 0.5;
      samples[i] = click * env * 0.7;
    }
  }
  return encodeMonoWav(samples, sampleRate);
}

export const INITIAL_TRACKS: TimelineTrack[] = [
  { id: 'track_t1', type: 'text', role: 'titles', label: 'T1 Titles', muted: false, locked: false, hidden: false },
  { id: 'track_v2', type: 'overlay', role: 'overlay', label: 'V2 Overlay', muted: false, locked: false, hidden: false },
  { id: 'track_v1', type: 'video', role: 'main', label: 'V1 Main', muted: false, locked: false, hidden: false },
  { id: 'track_a1', type: 'audio', role: 'music', label: 'A1 Music', muted: false, locked: false, hidden: false },
  { id: 'track_a2', type: 'audio', role: 'sfx', label: 'A2 SFX', muted: false, locked: false, hidden: false },
];

export function createInitialAssets(audioUrl: string): MediaAsset[] {
  const whooshUrl = createSfxWavUrl('whoosh');
  const subDropUrl = createSfxWavUrl('subdrop');
  const shutterUrl = createSfxWavUrl('shutter');

  return [
    {
      id: 'asset_alpine',
      name: 'Alpine_Dawn_4K.jpg',
      src: SAMPLE_IMAGES.mountain,
      kind: 'image',
      duration: 6,
      width: 1920,
      height: 1080,
      sizeBytes: 2_450_000,
      formatInfo: {
        container: 'JPEG / Cinema Still',
        extension: 'jpg',
        codecLabel: '10-bit Photo Frame',
        mimeType: 'image/jpeg',
        category: 'image',
        nativePlayable: true,
        strategy: 'image-sequence',
        notes: 'High-resolution aerial mountain dawn plate.',
      },
    },
    {
      id: 'asset_city',
      name: 'Rain_Street_35mm.jpg',
      src: SAMPLE_IMAGES.city,
      kind: 'image',
      duration: 6,
      width: 1920,
      height: 1080,
      sizeBytes: 2_180_000,
      formatInfo: {
        container: 'JPEG / Cinema Still',
        extension: 'jpg',
        codecLabel: 'Leica 35mm Grade',
        mimeType: 'image/jpeg',
        category: 'image',
        nativePlayable: true,
        strategy: 'image-sequence',
        notes: 'Atmospheric wet cobblestone twilight plate.',
      },
    },
    {
      id: 'asset_chroma_rig',
      name: 'Cinema_Rig_GreenScreen.jpg',
      src: SAMPLE_IMAGES.greenscreen,
      kind: 'image',
      duration: 5,
      width: 1920,
      height: 1080,
      sizeBytes: 1_840_000,
      formatInfo: {
        container: 'JPEG / Studio Chroma',
        extension: 'jpg',
        codecLabel: 'Chroma Key Ready',
        mimeType: 'image/jpeg',
        category: 'image',
        nativePlayable: true,
        strategy: 'image-sequence',
        notes: 'Studio camera rig on pure chroma green backdrop.',
      },
    },
    {
      id: 'asset_score',
      name: 'Horizon_Ambient_Score.wav',
      src: audioUrl,
      kind: 'audio',
      audioSubType: 'music',
      duration: 12,
      width: 0,
      height: 0,
      sizeBytes: 529_244,
      waveform: generateWaveform(3, 56),
      isSyntheticAudio: true,
      formatInfo: {
        container: 'RIFF WAVE PCM',
        extension: 'wav',
        codecLabel: 'Uncompressed LPCM',
        mimeType: 'audio/wav',
        category: 'audio',
        nativePlayable: true,
        strategy: 'audio-pcm',
        notes: 'Synthesized 12s ambient cinema chord stem.',
      },
    },
    {
      id: 'asset_sfx_whoosh',
      name: 'Cinematic_Whoosh_SFX.wav',
      src: whooshUrl,
      kind: 'audio',
      audioSubType: 'sfx',
      duration: 1.6,
      width: 0,
      height: 0,
      sizeBytes: 70_560,
      waveform: generateWaveform(9, 28),
      isSyntheticAudio: true,
      formatInfo: {
        container: 'RIFF WAVE PCM',
        extension: 'wav',
        codecLabel: 'Transition SFX',
        mimeType: 'audio/wav',
        category: 'audio',
        nativePlayable: true,
        strategy: 'audio-pcm',
        notes: 'Stereo-pannable transition whoosh stem.',
      },
    },
    {
      id: 'asset_sfx_subdrop',
      name: 'Sub_Bass_Impact_SFX.wav',
      src: subDropUrl,
      kind: 'audio',
      audioSubType: 'sfx',
      duration: 1.6,
      width: 0,
      height: 0,
      sizeBytes: 70_560,
      waveform: generateWaveform(17, 28),
      isSyntheticAudio: true,
      formatInfo: {
        container: 'RIFF WAVE PCM',
        extension: 'wav',
        codecLabel: 'Cinema Impact SFX',
        mimeType: 'audio/wav',
        category: 'audio',
        nativePlayable: true,
        strategy: 'audio-pcm',
        notes: 'Low-end cinematic impact boom.',
      },
    },
    {
      id: 'asset_sfx_shutter',
      name: 'Camera_Shutter_SFX.wav',
      src: shutterUrl,
      kind: 'audio',
      audioSubType: 'sfx',
      duration: 0.45,
      width: 0,
      height: 0,
      sizeBytes: 19_845,
      waveform: generateWaveform(25, 18),
      isSyntheticAudio: true,
      formatInfo: {
        container: 'RIFF WAVE PCM',
        extension: 'wav',
        codecLabel: 'Foley SFX',
        mimeType: 'audio/wav',
        category: 'audio',
        nativePlayable: true,
        strategy: 'audio-pcm',
        notes: 'Crisp mechanical shutter snap.',
      },
    },
  ];
}

export function createInitialClips(): TimelineClip[] {
  return [
    {
      id: 'clip_v1_alpine',
      assetId: 'asset_alpine',
      trackId: 'track_v1',
      name: 'Alpine Dawn Aerial',
      kind: 'image',
      startTime: 0,
      duration: 5.5,
      sourceOffset: 0,
      speed: 1,
      speedRamp: 'none',
      reversed: false,
      freezeFrame: false,
      blendMode: 'source-over',
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: [
        { id: 'kf_1', time: 0, easing: 'easeOut', x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1 },
        { id: 'kf_2', time: 5.5, easing: 'easeInOut', x: -0.04, y: -0.02, scale: 1.16, rotation: 0, opacity: 1 },
      ],
      audioKeyframes: [],
      colorGrade: {
        ...DEFAULT_COLOR_GRADE,
        lutId: 'goldenHour',
        contrast: 8,
        vignette: 22,
      },
      vfx: { ...DEFAULT_VFX },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      transitionIn: { type: 'dipBlack', duration: 0.6 },
      audio: { ...DEFAULT_AUDIO_CONFIG },
    },
    {
      id: 'clip_v1_city',
      assetId: 'asset_city',
      trackId: 'track_v1',
      name: 'Rain Street Twilight',
      kind: 'image',
      startTime: 5.5,
      duration: 5.5,
      sourceOffset: 0,
      speed: 1,
      speedRamp: 'none',
      reversed: false,
      freezeFrame: false,
      blendMode: 'source-over',
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: [
        { id: 'kf_3', time: 0, easing: 'easeInOut', x: 0.03, y: 0, scale: 1.14, rotation: 0, opacity: 1 },
        { id: 'kf_4', time: 5.5, easing: 'easeOut', x: -0.02, y: 0.02, scale: 1.02, rotation: 0, opacity: 1 },
      ],
      audioKeyframes: [],
      colorGrade: {
        ...DEFAULT_COLOR_GRADE,
        lutId: 'tealOrange',
        contrast: 10,
        vignette: 28,
      },
      vfx: { ...DEFAULT_VFX, bloom: 20 },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      transitionIn: { type: 'crossDissolve', duration: 0.8 },
      audio: { ...DEFAULT_AUDIO_CONFIG },
    },
    {
      id: 'clip_v2_chroma',
      assetId: 'asset_chroma_rig',
      trackId: 'track_v2',
      name: 'Camera Rig (Chroma Key)',
      kind: 'image',
      startTime: 6.2,
      duration: 4.2,
      sourceOffset: 0,
      speed: 1,
      speedRamp: 'none',
      reversed: false,
      freezeFrame: false,
      blendMode: 'source-over',
      transform: {
        ...DEFAULT_TRANSFORM,
        x: 0.25,
        y: 0.14,
        scale: 0.56,
      },
      keyframes: [
        { id: 'kf_c1', time: 0, easing: 'easeOut', x: 0.34, y: 0.18, scale: 0.52, rotation: 0, opacity: 0 },
        { id: 'kf_c2', time: 0.6, easing: 'easeOut', x: 0.24, y: 0.14, scale: 0.56, rotation: 0, opacity: 1 },
        { id: 'kf_c3', time: 3.6, easing: 'easeIn', x: 0.22, y: 0.14, scale: 0.58, rotation: 0, opacity: 1 },
      ],
      audioKeyframes: [],
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      vfx: { ...DEFAULT_VFX },
      chromaKey: {
        enabled: true,
        color: '#19d819',
        similarity: 54,
        smoothness: 20,
        spill: 45,
      },
      transitionIn: { type: 'none', duration: 0.4 },
      audio: { ...DEFAULT_AUDIO_CONFIG },
    },
    {
      id: 'clip_t1_title',
      assetId: 'text_builtin',
      trackId: 'track_t1',
      name: 'Title: Golden Horizon',
      kind: 'text',
      startTime: 0.4,
      duration: 4.2,
      sourceOffset: 0,
      speed: 1,
      speedRamp: 'none',
      reversed: false,
      freezeFrame: false,
      blendMode: 'source-over',
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: 0.26, scale: 1 },
      keyframes: [],
      audioKeyframes: [],
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      vfx: { ...DEFAULT_VFX },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      transitionIn: { type: 'none', duration: 0.3 },
      audio: { ...DEFAULT_AUDIO_CONFIG },
      textConfig: {
        text: 'GOLDEN HORIZON',
        subtitle: 'Shot on Mobile · 4K 60fps Cinema Grade',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 54,
        color: '#F9FAFB',
        bgColor: '#090A0D',
        bgOpacity: 0.45,
        strokeColor: '#000000',
        animation: 'slideUp',
        preset: 'lowerThird',
      },
    },
    {
      id: 'clip_a1_score',
      assetId: 'asset_score',
      trackId: 'track_a1',
      name: 'Horizon Ambient Score',
      kind: 'audio',
      startTime: 0,
      duration: 11.0,
      sourceOffset: 0,
      speed: 1,
      speedRamp: 'none',
      reversed: false,
      freezeFrame: false,
      blendMode: 'source-over',
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: [],
      audioKeyframes: [
        { id: 'akf_1', time: 0, easing: 'easeOut', volume: 75, pan: 0 },
        { id: 'akf_2', time: 5.5, easing: 'easeInOut', volume: 95, pan: 0 },
        { id: 'akf_3', time: 11.0, easing: 'easeIn', volume: 65, pan: 0 },
      ],
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      vfx: { ...DEFAULT_VFX },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      transitionIn: { type: 'none', duration: 0 },
      audio: {
        ...DEFAULT_AUDIO_CONFIG,
        volume: 85,
        pan: 0,
        fadeIn: 0.8,
        fadeOut: 1.2,
      },
    },
    {
      id: 'clip_a2_whoosh',
      assetId: 'asset_sfx_whoosh',
      trackId: 'track_a2',
      name: 'Transition Whoosh SFX',
      kind: 'audio',
      startTime: 4.9,
      duration: 1.6,
      sourceOffset: 0,
      speed: 1,
      speedRamp: 'none',
      reversed: false,
      freezeFrame: false,
      blendMode: 'source-over',
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: [],
      audioKeyframes: [
        { id: 'akf_s1', time: 0, easing: 'linear', volume: 90, pan: -70 },
        { id: 'akf_s2', time: 1.6, easing: 'linear', volume: 90, pan: 70 },
      ],
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      vfx: { ...DEFAULT_VFX },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      transitionIn: { type: 'none', duration: 0 },
      audio: {
        ...DEFAULT_AUDIO_CONFIG,
        volume: 90,
        pan: 0,
        fadeIn: 0.1,
        fadeOut: 0.2,
      },
    },
  ];
}
