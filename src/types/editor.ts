export type TrackType = 'video' | 'overlay' | 'text' | 'audio';

export type TrackRole = 'main' | 'overlay' | 'titles' | 'music' | 'voiceover' | 'sfx';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export type BlendMode = 'source-over' | 'screen' | 'multiply' | 'overlay' | 'lighten' | 'darken';

export type TransitionType =
  | 'none'
  | 'crossDissolve'
  | 'dipBlack'
  | 'dipWhite'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'zoomIn'
  | 'zoomOut'
  | 'whipPan'
  | 'glitchCut'
  | 'radialWipe'
  | 'spin';

export type SpeedRampPreset = 'none' | 'ease' | 'hero' | 'bullet' | 'montage';

export type TextAnimationType = 'none' | 'fade' | 'slideUp' | 'pop' | 'typewriter';

export type TextPresetType = 'title' | 'lowerThird' | 'subtitle' | 'kinetic';

export interface MediaFormatInfo {
  container: string;
  extension: string;
  codecLabel: string;
  mimeType: string;
  category: 'video' | 'audio' | 'image';
  nativePlayable: boolean;
  strategy: 'hardware-direct' | 'remux-compatible' | 'image-sequence' | 'audio-pcm';
  notes: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  src: string;
  kind: 'video' | 'image' | 'audio';
  audioSubType?: 'music' | 'voiceover' | 'sfx';
  duration: number;
  width: number;
  height: number;
  sizeBytes: number;
  formatInfo: MediaFormatInfo;
  waveform?: number[];
  isSyntheticAudio?: boolean;
}

export interface ClipTransform {
  x: number; // normalized -1 to 1 offset from center
  y: number; // normalized -1 to 1 offset from center
  scale: number; // 0.1 to 4.0
  rotation: number; // degrees -180 to 180
  opacity: number; // 0 to 1
  flipH: boolean;
  flipV: boolean;
}

export interface Keyframe {
  id: string;
  time: number; // seconds relative to clip start
  easing: EasingType;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface AudioKeyframe {
  id: string;
  time: number; // seconds relative to clip start
  easing: EasingType;
  volume: number; // 0 to 200 (%)
  pan: number; // -100 (Left) to +100 (Right)
}

export interface ColorGrade {
  lutId: string;
  exposure: number; // -100 to 100 (brightness)
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  hue: number; // -180 to 180 degrees
  temperature: number; // -100 to 100
  tint: number; // -100 to 100
  vignette: number; // 0 to 100
  sharpness: number; // 0 to 100
  grain: number; // 0 to 100
}

export interface VfxConfig {
  glitch: number; // 0 to 100
  blur: number; // 0 to 100
  distortion: number; // 0 to 100 (wave/lens warp)
  bloom: number; // 0 to 100 (cinematic glow)
  pixelate: number; // 0 to 100
  vhsScanlines: number; // 0 to 100
  cinemaBars: number; // 0 to 100 (2.39:1 letterbox)
  mirror: number; // 0 to 100 (symmetrical kaleidoscope)
  duotone: number; // 0 to 100 (cyber gradient map)
  shake: number; // 0 to 100 (camera impact jitter)
}

export interface ChromaKeyConfig {
  enabled: boolean;
  color: string;
  similarity: number;
  smoothness: number;
  spill: number;
}

export interface TransitionConfig {
  type: TransitionType;
  duration: number;
}

export interface AudioConfig {
  volume: number; // 0 to 500 (%)
  pan: number; // -100 to +100
  muted: boolean;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  eqBass: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqTreble: number; // -12 to +12 dB
  highPassHz?: number; // 0 (off) or 80..120 Hz rumble/hum cut
  voiceIsolation?: boolean; // vocal presence & mud attenuation DSP
  compressorEnabled?: boolean; // broadcast soft limiter
  measuredLufs?: number; // integrated loudness before normalization
  targetLufs?: number; // normalized target LUFS (e.g. -14, -16, -23)
  peakDb?: number; // true peak in dBFS
}

export type InsertPlacement = 'front' | 'back' | 'time';

export type TextStyleType = 'clean' | 'outline' | 'neon' | 'cinema' | 'badge';

export interface TextOverlayConfig {
  text: string;
  subtitle?: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  bgOpacity: number;
  strokeColor: string;
  animation: TextAnimationType;
  preset: TextPresetType;
  textStyle?: TextStyleType;
  fontWeight?: '500' | '700' | '900';
  letterSpacing?: number;
}

export type ClipMaskShape = 'none' | 'circle' | 'rounded' | 'splitLeft' | 'splitRight' | 'cinema';

export interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  name: string;
  kind: 'video' | 'image' | 'audio' | 'text';
  startTime: number;
  duration: number;
  sourceOffset: number;
  speed: number;
  speedRamp: SpeedRampPreset;
  reversed: boolean;
  freezeFrame: boolean;
  blendMode: BlendMode;
  mask?: ClipMaskShape;
  transform: ClipTransform;
  keyframes: Keyframe[];
  audioKeyframes: AudioKeyframe[];
  colorGrade: ColorGrade;
  vfx: VfxConfig;
  chromaKey: ChromaKeyConfig;
  transitionIn: TransitionConfig;
  audio: AudioConfig;
  textConfig?: TextOverlayConfig;
}

export interface SavedGalleryItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  blobUrl: string;
  blob?: Blob;
  createdAt: number;
  aspectRatio: AspectRatio;
  adUnitId: string;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  role: TrackRole;
  label: string;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  solo?: boolean;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export type ExportFormat = 'mp4' | 'webm' | 'mov' | 'gif' | 'wav';
export type ExportResolution = '2160p' | '1080p' | '720p' | '480p';

export interface ExportSettings {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: 24 | 30 | 60;
  bitrateMbps: number;
}

export type InspectorTab =
  | 'color'
  | 'vfx'
  | 'motion'
  | 'speed'
  | 'chroma'
  | 'transition'
  | 'text'
  | 'audio';

export type LeftVaultTab = 'media' | 'luts' | 'vfx' | 'transitions' | 'titles' | 'audio';
