import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Clapperboard,
  Cpu,
  Diamond,
  Feather,
  Film,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  Loader2,
  Mic,
  Music,
  Palette,
  Pipette,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Square,
  Type,
  Upload,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';
import type {
  BlendMode,
  ClipMaskShape,
  EasingType,
  EmojiAnimationType,
  EmojiStyleType,
  InsertPlacement,
  LeftVaultTab,
  MediaAsset,
  SpeedRampPreset,
  TextAnimationType,
  TextPresetType,
  TextStyleType,
  TimelineClip,
  TimelineTrack,
  TransitionType,
  VfxConfig,
} from '../types/editor';
import {
  EQ_PRESETS,
  LUT_CATEGORIES,
  LUT_PRESETS,
  VFX_LIBRARY,
  buildCanvasFilterString,
  computeAutoEnhanceGrade,
  type LutCategory,
} from '../engine/colorEngine';
import {
  EMOJI_CATEGORIES,
  filterEmojiStickers,
  type EmojiCategory,
  type EmojiStickerItem,
} from '../engine/emojiLibrary';
import {
  TRANSITION_CATEGORIES,
  filterTransitions,
  type TransitionCategory,
} from '../engine/transitionsLibrary';
import { LUFS_PRESETS } from '../engine/audioNormalizer';
import {
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
  formatShortTime,
  getPipPresetPatch,
  type PipPresetId,
} from '../engine/timelineMath';
import {
  DEFAULT_NEON_CONFIG,
  NEON_COLOR_PALETTE,
  NEON_MODES,
  NEON_PRESETS,
  buildNeonPreviewStyle,
  resolveNeonConfig,
} from '../engine/neonEngine';
import {
  DEFAULT_MOTION_PRESET_CONFIG,
  MOTION_PRESET_CATEGORIES,
  MOTION_PRESET_LIBRARY,
  formatShutterAngleLabel,
  type MotionPresetCategory,
} from '../engine/motionPresets';
import {
  appendWaveformSample,
  computeMicWaveformBarLevel,
  createInitialWaveformBars,
  formatVoiceoverTimer,
} from '../engine/voiceoverMeter';
import { shouldGenerateProxy } from '../engine/proxyGenerator';
import { TransitionLiveThumb } from './TransitionLiveThumb';

interface MediaVaultPanelProps {
  activeTab: LeftVaultTab | null;
  onChangeTab: (tab: LeftVaultTab | null) => void;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
  selectedClip: TimelineClip | null;
  playhead: number;
  onImportFiles: (files: FileList | File[]) => void;
  onAddAssetToTimeline: (
    asset: MediaAsset,
    trackId: string,
    placement?: InsertPlacement,
    startTime?: number
  ) => void;
  onApplyLut: (lutId: string) => void;
  onPreviewLutHover?: (lutId: string | null) => void;
  onApplyVfx: (key: keyof VfxConfig, intensity: number) => void;
  onApplyTransition: (type: TransitionType, duration?: number) => void;
  onPreviewTransitionHover?: (type: TransitionType | null) => void;
  onPlayTransitionPreview?: () => void;
  onOpenTransitionLibrary: () => void;
  onDragTransitionChange?: (dragging: boolean) => void;
  onAddTextClip: (preset: TextPresetType) => void;
  onAddEmojiClip: (
    item: EmojiStickerItem,
    style: EmojiStyleType,
    animation: EmojiAnimationType
  ) => void;
  onVoiceoverRecorded: (blob: Blob, durationSec: number) => void;
  onNormalizeAllAudio: (targetLufs: number) => void;
  onUpdateClip: (clipId: string, updater: (prev: TimelineClip) => TimelineClip) => void;
  onAdjustDuration: (clipId: string, newDuration: number) => void;
  onAddKeyframe: (clipId: string, easing: EasingType) => void;
  onRemoveKeyframe: (clipId: string, keyframeId: string) => void;
  onAddAudioKeyframe: (clipId: string) => void;
  onRemoveAudioKeyframe: (clipId: string, keyframeId: string) => void;
  onFreezeFrame: (clipId: string) => void;
  onNormalizeClipAudio: (clipId: string, targetLufs: number, preventClipping: boolean) => void;
  onNormalizeTrackAudio: (trackId: string, targetLufs: number, preventClipping: boolean) => void;
  onAutoDuckClip?: (clipId: string) => void;
  eyedropperActive?: boolean;
  onToggleEyedropper?: () => void;
  isNormalizingAudio?: boolean;
  normalizeStatusMessage?: string | null;
  audioMixerOpen?: boolean;
  onToggleAudioMixer?: () => void;
  globalMotionBlur?: number;
  onChangeGlobalMotionBlur?: (val: number) => void;
  onApplyGlobalMotionBlurToClip?: (clipId: string) => void;
  proxyPlaybackEnabled?: boolean;
  onToggleProxyPlayback?: () => void;
  onGenerateProxyForAsset?: (assetId: string) => void;
}

const TEXT_PRESETS: {
  preset: TextPresetType;
  label: string;
  sample: string;
  previewClass: string;
}[] = [
  {
    preset: 'title',
    label: 'Cinema Hero',
    sample: 'CHAPTER ONE',
    previewClass: 'tracking-[0.18em] font-bold text-white drop-shadow',
  },
  {
    preset: 'lowerThird',
    label: 'Lower Third',
    sample: 'DIRECTOR CUT',
    previewClass: 'border-l-2 border-amber-400 pl-2 font-semibold text-amber-100',
  },
  {
    preset: 'subtitle',
    label: 'Reel Caption',
    sample: 'Graded live',
    previewClass: 'bg-black/55 px-2 py-0.5 rounded text-zinc-100 font-medium',
  },
  {
    preset: 'kinetic',
    label: 'Kinetic Pop',
    sample: 'ULTRA 60FPS',
    previewClass: 'font-black text-amber-300 tracking-wide',
  },
  {
    preset: 'glassCard',
    label: '2026 Glass',
    sample: 'STUDIO 2026',
    previewClass: 'bg-white/15 border border-white/30 px-2 py-0.5 rounded-lg text-cyan-100 font-bold',
  },
  {
    preset: 'neonCyber',
    label: 'Neon Cyber',
    sample: 'NEON PULSE',
    previewClass: 'font-extrabold text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]',
  },
];

const TEXT_STYLES: { id: TextStyleType; label: string; previewCls: string }[] = [
  { id: 'clean', label: 'Clean', previewCls: 'text-white font-semibold' },
  { id: 'outline', label: 'Outline', previewCls: 'text-white font-black drop-shadow-[0_1px_1px_#000]' },
  { id: 'neon', label: 'Neon', previewCls: 'text-cyan-300 font-bold drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]' },
  { id: 'cinema', label: 'Cinema', previewCls: 'text-amber-100 font-semibold tracking-[0.14em]' },
  { id: 'badge', label: 'Badge', previewCls: 'bg-amber-500 text-zinc-950 font-bold px-1.5 rounded' },
  { id: 'glass', label: 'Glass', previewCls: 'bg-white/15 border border-white/30 text-cyan-100 font-bold px-1.5 rounded' },
  { id: 'gradient', label: 'Gradient', previewCls: 'bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent font-black' },
  { id: 'retro3d', label: 'Retro 3D', previewCls: 'text-amber-300 font-black drop-shadow-[2px_2px_0px_#e11d48]' },
  { id: 'highlight', label: 'Marker', previewCls: 'bg-yellow-300 text-zinc-950 font-extrabold px-1.5 -skew-x-6' },
];

const TEXT_COLOR_SWATCHES = [
  '#F9FAFB',
  '#38BDF8',
  '#F59E0B',
  '#F43F5E',
  '#34D399',
  '#A855F7',
  '#FACC15',
  '#111827',
];

const EMOJI_STYLE_CARDS: { id: EmojiStyleType; label: string; cls: string }[] = [
  { id: 'sticker', label: 'Die-Cut Sticker', cls: 'drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]' },
  { id: 'neon', label: 'Neon Halo', cls: 'drop-shadow-[0_0_10px_rgba(34,211,238,0.95)]' },
  { id: 'badge', label: 'Glass Badge', cls: 'px-2 py-0.5 rounded-lg bg-white/15 border border-white/30' },
  { id: 'native', label: 'Clean Native', cls: '' },
];

const MASK_PREVIEW_CARDS: { id: ClipMaskShape; label: string; clipStyle: React.CSSProperties }[] = [
  { id: 'none', label: 'Full Frame', clipStyle: {} },
  { id: 'circle', label: 'Circle', clipStyle: { clipPath: 'circle(42% at 50% 50%)' } },
  { id: 'rounded', label: 'Rounded', clipStyle: { borderRadius: '10px', transform: 'scale(0.86)' } },
  { id: 'splitLeft', label: 'Split Left', clipStyle: { clipPath: 'inset(0 50% 0 0)' } },
  { id: 'splitRight', label: 'Split Right', clipStyle: { clipPath: 'inset(0 0 0 50%)' } },
  { id: 'cinema', label: '2.39:1 Cut', clipStyle: { clipPath: 'inset(16% 0 16% 0)' } },
];

const PIP_LAYOUT_CARDS: { id: PipPresetId; label: string; boxCls: string }[] = [
  { id: 'topLeft', label: 'TL PiP', boxCls: 'top-1 left-1 w-2/5 h-2/5' },
  { id: 'topRight', label: 'TR PiP', boxCls: 'top-1 right-1 w-2/5 h-2/5' },
  { id: 'bottomLeft', label: 'BL PiP', boxCls: 'bottom-1 left-1 w-2/5 h-2/5' },
  { id: 'bottomRight', label: 'BR PiP', boxCls: 'bottom-1 right-1 w-2/5 h-2/5' },
  { id: 'splitLeft', label: 'Half L', boxCls: 'inset-y-0 left-0 w-1/2' },
  { id: 'splitRight', label: 'Half R', boxCls: 'inset-y-0 right-0 w-1/2' },
  { id: 'reset', label: 'Full', boxCls: 'inset-0' },
];

const SPEED_RAMP_CARDS: { id: SpeedRampPreset; label: string; svgPath: string }[] = [
  { id: 'none', label: 'Linear 1:1', svgPath: 'M4 22 L56 22' },
  { id: 'ease', label: 'Smooth Ease', svgPath: 'M4 24 Q30 4 56 24' },
  { id: 'hero', label: 'Hero Slow-Mo', svgPath: 'M4 8 L16 8 Q30 28 44 8 L56 8' },
  { id: 'bullet', label: 'Bullet Time', svgPath: 'M4 10 L18 26 L42 26 L56 10' },
  { id: 'montage', label: 'Montage Ramp', svgPath: 'M4 25 Q28 24 56 5' },
];

interface GlassSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

const GlassSlider: React.FC<GlassSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-2 space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-zinc-300 font-medium truncate">{label}</span>
      <span className="font-mono-tabular text-amber-300 shrink-0">
        {value > 0 && min < 0 ? `+${value}` : value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full studio-slider"
    />
  </div>
);

export const MediaVaultPanel: React.FC<MediaVaultPanelProps> = ({
  activeTab,
  onChangeTab,
  assets,
  tracks,
  selectedClip,
  playhead,
  onImportFiles,
  onAddAssetToTimeline,
  onApplyLut,
  onPreviewLutHover,
  onApplyVfx,
  onApplyTransition,
  onPreviewTransitionHover,
  onPlayTransitionPreview,
  onOpenTransitionLibrary,
  onDragTransitionChange,
  onAddTextClip,
  onAddEmojiClip,
  onVoiceoverRecorded,
  onNormalizeAllAudio,
  onUpdateClip,
  onAdjustDuration,
  onAddKeyframe,
  onRemoveKeyframe,
  onAddAudioKeyframe,
  onRemoveAudioKeyframe,
  onFreezeFrame,
  onNormalizeClipAudio,
  onNormalizeTrackAudio,
  onAutoDuckClip,
  eyedropperActive = false,
  onToggleEyedropper,
  isNormalizingAudio = false,
  normalizeStatusMessage = null,
  audioMixerOpen = false,
  onToggleAudioMixer,
  globalMotionBlur = 50,
  onChangeGlobalMotionBlur,
  onApplyGlobalMotionBlurToClip,
  proxyPlaybackEnabled = true,
  onToggleProxyPlayback,
  onGenerateProxyForAsset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lutCat, setLutCat] = useState<'All' | LutCategory>('All');
  const [lutSearch, setLutSearch] = useState('');
  const [transCat, setTransCat] = useState<'All' | TransitionCategory>('All');
  const [transSearch, setTransSearch] = useState('');
  const [vfxCat, setVfxCat] = useState<'All' | 'Glitch' | 'Lens' | 'Cinema' | 'Retro'>('All');
  const [animateCat, setAnimateCat] = useState<'All' | MotionPresetCategory>('All');
  const [emojiCat, setEmojiCat] = useState<'All' | EmojiCategory>('All');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [emojiStyle, setEmojiStyle] = useState<EmojiStyleType>('sticker');
  const [emojiAnim, setEmojiAnim] = useState<EmojiAnimationType>('bounce');
  const [keyframeEasing, setKeyframeEasing] = useState<EasingType>('easeInOut');
  const [targetLufs, setTargetLufs] = useState<number>(-14);
  const [preventClipping, setPreventClipping] = useState<boolean>(true);
  const [transLoopPhase, setTransLoopPhase] = useState<number>(0.45);

  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recError, setRecError] = useState('');
  const [liveMicBars, setLiveMicBars] = useState<number[]>(() => createInitialWaveformBars(36));
  const [liveMicDb, setLiveMicDb] = useState<number>(-60);
  const [liveMicClipping, setLiveMicClipping] = useState<boolean>(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const micRafRef = useRef<number | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopMicTelemetry = () => {
    if (micRafRef.current !== null) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore recorder stop errors on unmount
        }
      }
      stopMicTelemetry();
    };
  }, []);

  // Animate miniature transition grid previews only while Trans tab is open
  useEffect(() => {
    if (activeTab !== 'transitions') return;
    let raf = 0;
    let lastDraw = 0;
    const startTs = performance.now();
    const loop = (now: number) => {
      if (now - lastDraw >= 40) {
        lastDraw = now;
        const cycle = ((now - startTs) % 1500) / 1500;
        const p = cycle < 0.12 ? 0 : cycle > 0.88 ? 1 : (cycle - 0.12) / 0.76;
        setTransLoopPhase(p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

  const tabs: { id: LeftVaultTab; label: string; subtitle: string; icon: React.ReactNode }[] = [
    { id: 'media', label: 'Media', subtitle: `${assets.length} files`, icon: <Film className="w-3.5 h-3.5 text-sky-400" /> },
    { id: 'luts', label: 'Filters', subtitle: `${LUT_PRESETS.length} grades`, icon: <Palette className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'neon', label: 'Neon', subtitle: `${NEON_PRESETS.length} glows`, icon: <Zap className="w-3.5 h-3.5 text-cyan-300" /> },
    { id: 'vfx', label: 'VFX', subtitle: `${VFX_LIBRARY.length} effects`, icon: <Wand2 className="w-3.5 h-3.5 text-fuchsia-400" /> },
    { id: 'animate', label: 'Animate', subtitle: 'Ken Burns', icon: <Clapperboard className="w-3.5 h-3.5 text-orange-400" /> },
    { id: 'transitions', label: 'Trans', subtitle: 'A→B cuts', icon: <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> },
    { id: 'titles', label: 'Text', subtitle: 'Titles & styles', icon: <Type className="w-3.5 h-3.5 text-pink-400" /> },
    { id: 'emoji', label: 'Emoji', subtitle: 'Live stickers', icon: <Smile className="w-3.5 h-3.5 text-amber-300" /> },
    { id: 'audio', label: 'Audio', subtitle: 'EQ · Mixer · Mic', icon: <Music className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'motion', label: 'Motion', subtitle: 'Feather · Mask', icon: <Sliders className="w-3.5 h-3.5 text-violet-400" /> },
    { id: 'speed', label: 'Speed', subtitle: 'Ramps · Blend', icon: <Gauge className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'chroma', label: 'Chroma', subtitle: 'Keying · Spill', icon: <Pipette className="w-3.5 h-3.5 text-emerald-400" /> },
  ];
  const activeTabMeta = activeTab ? tabs.find((t) => t.id === activeTab) ?? null : null;

  const primaryVideoTrack = tracks.find((t) => t.type === 'video')?.id ?? 'track_v1';
  const overlayTrack = tracks.find((t) => t.type === 'overlay')?.id ?? primaryVideoTrack;
  const musicTrack = tracks.find((t) => t.type === 'audio')?.id ?? 'track_a1';
  const sfxTrack =
    tracks.find((t) => t.type === 'audio' && t.role === 'sfx')?.id ?? musicTrack;

  const { previewSampleImage, secondSampleImage } = useMemo(() => {
    const imgs = assets.filter((a) => a.kind === 'image');
    const selectedSrc =
      selectedClip && selectedClip.kind === 'image'
        ? assets.find((a) => a.id === selectedClip.assetId)?.src
        : undefined;
    return {
      previewSampleImage: selectedSrc ?? imgs[0]?.src ?? '',
      secondSampleImage: imgs[1]?.src ?? imgs[0]?.src ?? '',
    };
  }, [assets, selectedClip]);

  const handleAssetDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData(
      'application/x-rorn-asset',
      JSON.stringify({ assetId: asset.id, kind: asset.kind })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const toggleVoiceoverRecording = async () => {
    setRecError('');
    if (isRecording) {
      recorderRef.current?.stop();
      stopMicTelemetry();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecError('Microphone recording is unavailable in this browser context.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const chunks: BlobPart[] = [];
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      startTsRef.current = performance.now();
      setRecSeconds(0);
      setLiveMicBars(createInitialWaveformBars(36));
      setLiveMicDb(-60);
      setLiveMicClipping(false);

      // Start real-time Web Audio AnalyserNode telemetry for live waveform visualization
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const micCtx = new AudioCtx();
          if (micCtx.state === 'suspended') {
            await micCtx.resume().catch(() => {});
          }
          const srcNode = micCtx.createMediaStreamSource(stream);
          const analyser = micCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.65;
          srcNode.connect(analyser);
          micCtxRef.current = micCtx;

          const timeData = new Uint8Array(analyser.fftSize);
          let lastSampleAt = 0;
          const sampleLoop = (now: number) => {
            if (now - lastSampleAt >= 36) {
              lastSampleAt = now;
              analyser.getByteTimeDomainData(timeData);
              const meter = computeMicWaveformBarLevel(timeData);
              setLiveMicBars((prev) => appendWaveformSample(prev, meter.level, 36));
              setLiveMicDb(meter.peakDb);
              setLiveMicClipping(meter.clipping);
            }
            micRafRef.current = requestAnimationFrame(sampleLoop);
          };
          micRafRef.current = requestAnimationFrame(sampleLoop);
        }
      } catch {
        // Ignore visualizer setup failures while keeping recording active
      }

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        stopMicTelemetry();
        const dur = Math.max(0.8, (performance.now() - startTsRef.current) / 1000);
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        onVoiceoverRecorded(blob, Number(dur.toFixed(2)));
      };

      mr.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecSeconds(Math.floor((performance.now() - startTsRef.current) / 1000));
      }, 250);
    } catch {
      stopMicTelemetry();
      setRecError('Microphone permission denied or unavailable.');
    }
  };

  const query = lutSearch.trim().toLowerCase();
  const filteredLuts = LUT_PRESETS.filter((l) => {
    if (lutCat !== 'All' && l.category !== lutCat) return false;
    if (!query) return true;
    return (
      l.name.toLowerCase().includes(query) ||
      l.category.toLowerCase().includes(query) ||
      l.description.toLowerCase().includes(query)
    );
  });
  const filteredVfx = VFX_LIBRARY.filter((f) =>
    vfxCat === 'All' ? true : f.category === vfxCat
  );
  const filteredTransitions = filterTransitions(transCat, transSearch);
  const filteredEmojis = filterEmojiStickers(emojiCat, emojiSearch);

  const localTime = selectedClip
    ? Math.max(0, Math.min(selectedClip.duration, playhead - selectedClip.startTime))
    : 0;
  const panVal = selectedClip?.audio.pan ?? 0;
  const panLabel =
    panVal === 0 ? 'Center' : panVal < 0 ? `${Math.abs(panVal)}% L` : `${panVal}% R`;

  const renderVfxLivePreview = (fxId: keyof VfxConfig) => {
    const baseImg = previewSampleImage;
    let imgStyle: React.CSSProperties = {};
    let overlay: React.ReactNode = null;

    switch (fxId) {
      case 'blur':
        imgStyle = { filter: 'blur(3.5px) brightness(1.05)' };
        break;
      case 'glitch':
        imgStyle = { filter: 'contrast(1.25) saturate(1.4)' };
        overlay = (
          <>
            <div
              className="absolute inset-0 bg-cyan-400/25 mix-blend-screen translate-x-1 pointer-events-none"
            />
            <div
              className="absolute inset-0 bg-fuchsia-500/25 mix-blend-screen -translate-x-1 pointer-events-none"
            />
          </>
        );
        break;
      case 'distortion':
        imgStyle = { transform: 'scale(1.16) skewX(-6deg)' };
        break;
      case 'bloom':
        imgStyle = { filter: 'brightness(1.22) contrast(1.12) saturate(1.25)' };
        overlay = (
          <div className="absolute inset-0 bg-amber-300/20 mix-blend-screen pointer-events-none" />
        );
        break;
      case 'pixelate':
        imgStyle = { filter: 'contrast(1.3)', imageRendering: 'pixelated' };
        overlay = (
          <div
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)',
              backgroundSize: '6px 6px',
            }}
            className="absolute inset-0 pointer-events-none"
          />
        );
        break;
      case 'vhsScanlines':
        imgStyle = { filter: 'sepia(0.25) contrast(1.15)' };
        overlay = (
          <div
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 4px)',
            }}
            className="absolute inset-0 pointer-events-none"
          />
        );
        break;
      case 'cinemaBars':
        overlay = (
          <>
            <div className="absolute inset-x-0 top-0 h-2.5 bg-black pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-2.5 bg-black pointer-events-none" />
          </>
        );
        break;
      case 'mirror':
        overlay = (
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden border-l border-cyan-300/50 pointer-events-none">
            {baseImg && (
              <img
                src={baseImg}
                alt=""
                style={{ transform: 'scaleX(-1)' }}
                className="w-[200%] max-w-none h-full object-cover"
              />
            )}
          </div>
        );
        break;
      case 'duotone':
        imgStyle = { filter: 'grayscale(1) contrast(1.3)' };
        overlay = (
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/45 to-fuchsia-500/45 mix-blend-screen pointer-events-none" />
        );
        break;
      case 'shake':
        imgStyle = { transform: 'scale(1.1) rotate(-3deg) translateX(2px)' };
        break;
      case 'filmBurn':
        imgStyle = { filter: 'saturate(1.3) contrast(1.1)' };
        overlay = (
          <div
            style={{
              background:
                'radial-gradient(circle at 22% 28%, rgba(254,215,170,0.85), rgba(249,115,22,0.55) 40%, rgba(225,29,72,0.22) 70%, transparent 90%)',
            }}
            className="absolute inset-0 mix-blend-screen pointer-events-none"
          />
        );
        break;
      case 'prism':
        imgStyle = { filter: 'contrast(1.18) saturate(1.25)' };
        overlay = (
          <>
            <div className="absolute inset-0 border-2 border-cyan-400/55 mix-blend-screen translate-x-1 pointer-events-none" />
            <div className="absolute inset-0 border-2 border-rose-500/55 mix-blend-screen -translate-x-1 pointer-events-none" />
          </>
        );
        break;
      case 'nightVision':
        imgStyle = { filter: 'grayscale(1) contrast(1.35) brightness(1.15)' };
        overlay = (
          <div
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, rgba(16,185,129,0.25) 0px, rgba(16,185,129,0.25) 2px, rgba(5,150,105,0.45) 2px, rgba(5,150,105,0.45) 4px)',
            }}
            className="absolute inset-0 mix-blend-screen pointer-events-none"
          />
        );
        break;
      case 'motionBlur':
        imgStyle = { filter: 'blur(1.2px) contrast(1.08)', transform: 'scale(1.06) translateX(-2px)' };
        overlay = baseImg ? (
          <img
            src={baseImg}
            alt=""
            style={{ transform: 'scale(1.08) translateX(7px)', filter: 'blur(2.5px)' }}
            className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
          />
        ) : null;
        break;
    }

    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/50">
        {baseImg ? (
          <img
            src={baseImg}
            alt=""
            style={imgStyle}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500/30 to-cyan-600/30" />
        )}
        {overlay}
      </div>
    );
  };

  const renderOptionHubPreview = (id: LeftVaultTab) => {
    const img = previewSampleImage;
    const img2 = secondSampleImage;
    switch (id) {
      case 'media':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/40 grid grid-cols-2 gap-0.5">
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="bg-sky-900/40" />
            )}
            {img2 ? (
              <img src={img2} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="bg-amber-900/40" />
            )}
          </div>
        );
      case 'luts':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/40 grid grid-cols-2">
            {img && (
              <img
                src={img}
                alt=""
                style={{ filter: 'saturate(1.25) sepia(0.25) contrast(1.1)' }}
                className="w-full h-full object-cover"
              />
            )}
            {img && (
              <img
                src={img}
                alt=""
                style={{ filter: 'hue-rotate(-18deg) saturate(1.4) contrast(1.2)' }}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        );
      case 'neon':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/60 flex items-center justify-center p-1.5">
            {img && (
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover rounded brightness-90"
              />
            )}
            <div
              style={{
                boxShadow:
                  '0 0 10px #22d3ee, inset 0 0 8px #ec4899',
              }}
              className="absolute inset-1.5 rounded-md border-2 border-cyan-300 pointer-events-none"
            />
            <div className="absolute inset-2.5 rounded border border-pink-400/80 pointer-events-none" />
          </div>
        );
      case 'vfx':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/40">
            {img && (
              <img
                src={img}
                alt=""
                style={{ filter: 'contrast(1.25) saturate(1.35)' }}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-cyan-400/25 mix-blend-screen translate-x-1 pointer-events-none" />
            <div className="absolute inset-0 bg-fuchsia-500/25 mix-blend-screen -translate-x-1 pointer-events-none" />
          </div>
        );
      case 'animate':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/50 flex items-center justify-center">
            {img && (
              <img
                src={img}
                alt=""
                style={{ transform: 'scale(1.14)' }}
                className="w-full h-full object-cover opacity-80"
              />
            )}
            <div className="absolute inset-2 rounded border border-dashed border-orange-300/75 pointer-events-none" />
            <span className="absolute bottom-1 right-1.5 px-1 rounded bg-black/65 text-[8.5px] font-mono-tabular text-orange-300">
              1.0→1.3x
            </span>
          </div>
        );
      case 'transitions':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex">
            {img && <img src={img} alt="" className="w-1/2 h-full object-cover" />}
            {img2 && <img src={img2} alt="" className="w-1/2 h-full object-cover" />}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          </div>
        );
      case 'titles':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/50 flex items-center justify-center">
            {img && <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />}
            <span className="relative text-[11px] font-extrabold tracking-widest text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              CINEMA TITLE
            </span>
          </div>
        );
      case 'emoji':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-gradient-to-br from-amber-500/15 to-pink-500/15 flex items-center justify-center gap-2 text-lg">
            <span>🔥</span>
            <span>🎬</span>
            <span>⚡</span>
          </div>
        );
      case 'audio':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 flex items-end justify-center gap-1 px-3 py-2">
            {[35, 70, 52, 92, 68, 84, 42, 76, 58, 30].map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-full bg-emerald-400/80"
              />
            ))}
          </div>
        );
      case 'motion':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/50 flex items-center justify-center">
            {img && <img src={img} alt="" className="w-full h-full object-cover opacity-50" />}
            <div className="absolute right-2 bottom-1.5 w-8 h-5 rounded border border-amber-300 bg-sky-500/35 shadow-sm" />
          </div>
        );
      case 'speed':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-black/45 flex items-center justify-center px-3">
            <svg viewBox="0 0 80 34" className="w-full h-8">
              <path
                d="M 4 28 C 22 28, 32 6, 40 6 C 48 6, 58 28, 76 28"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      case 'chroma':
        return (
          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10 bg-gradient-to-r from-emerald-500/45 to-sky-500/30 flex items-center justify-center">
            <Pipette className="w-5 h-5 text-emerald-200 drop-shadow" />
          </div>
        );
    }
  };

  return (
    <aside
      data-testid="studio-options-panel"
      className="flex flex-col h-full bg-[#0B0E16]/55 backdrop-blur-xl border-r border-white/10 min-h-0"
      aria-label="Studio Options Grid"
    >
      {/* Focused Single-Option Header (hides all other options when an option is selected) */}
      <div
        data-testid={activeTabMeta ? 'focused-option-header' : 'options-hub-header'}
        className="shrink-0 border-b border-white/10 px-3 py-2 bg-white/[0.03] backdrop-blur-md flex items-center justify-between gap-2"
      >
        {activeTabMeta ? (
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onChangeTab(null)}
              data-testid="studio-options-back-btn"
              aria-label="Back to All Options"
              className="min-h-[32px] px-2.5 flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.14] text-xs font-semibold text-zinc-100 transition-colors shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-amber-300" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              {activeTabMeta.icon}
              <span className="text-xs font-bold text-white truncate">{activeTabMeta.label}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs font-bold text-white tracking-tight">Studio Options</span>
        )}

        {selectedClip && (
          <span className="font-mono-tabular text-[11px] text-zinc-400 truncate max-w-[140px] shrink-0">
            {selectedClip.name}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.mkv,.avi,.flv,.mov,.wmv,.3gp,.ts,.mts,.m4v,.ogv,.webm,.mp4,.gif,.mp3,.wav,.aac,.flac,.ogg"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportFiles(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Transparent Grid Studio Body */}
      <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-3">
        {activeTab === null && (
          <div
            data-testid="studio-options-grid-hub"
            className="grid grid-cols-2 gap-2"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                data-testid={`studio-option-${tab.id}`}
                className="rounded-xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] hover:border-amber-400/50 backdrop-blur-md p-1.5 flex flex-col gap-1.5 text-left transition-all"
              >
                {renderOptionHubPreview(tab.id)}
                <div className="px-0.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {tab.icon}
                    <span className="text-xs font-semibold text-white truncate">
                      {tab.label}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-400 truncate shrink-0">
                    {tab.subtitle}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'media' && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) {
                  onImportFiles(e.dataTransfer.files);
                }
              }}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/[0.04] hover:border-amber-400/60 hover:bg-white/[0.08] backdrop-blur-md p-3 flex flex-col items-center justify-center gap-1 text-center transition-colors min-h-[76px]"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-100">
                Import Video, Overlay or Audio
              </span>
              <span className="text-[10px] text-zinc-400">
                Drag clips to timeline or drop files here
              </span>
            </button>

            {/* Background 720p Mobile Proxy Controls */}
            {(() => {
              const visualAssets = assets.filter((a) => a.kind !== 'audio');
              const highResAssets = visualAssets.filter((a) => shouldGenerateProxy(a));
              const readyCount = highResAssets.filter((a) => a.proxyStatus === 'ready').length;
              const busyCount = highResAssets.filter(
                (a) => a.proxyStatus === 'generating' || a.proxyStatus === 'queued'
              ).length;
              return (
                <div
                  data-testid="media-proxy-toggle"
                  className="rounded-xl border border-cyan-400/25 bg-cyan-500/[0.06] backdrop-blur-md px-2.5 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Cpu className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-zinc-100 truncate">
                        720p Proxy Playback
                      </div>
                      <div className="text-[9.5px] font-mono-tabular text-zinc-400 truncate">
                        {busyCount > 0
                          ? `Building ${busyCount} proxy...`
                          : `${readyCount}/${highResAssets.length} HD proxies ready · Full-res export`}
                      </div>
                    </div>
                  </div>
                  {onToggleProxyPlayback && (
                    <button
                      type="button"
                      onClick={onToggleProxyPlayback}
                      aria-pressed={proxyPlaybackEnabled}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors shrink-0 ${
                        proxyPlaybackEnabled
                          ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                          : 'border-white/15 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                      }`}
                    >
                      {proxyPlaybackEnabled ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2">
              {assets
                .filter((a) => a.kind !== 'audio')
                .map((asset) => {
                  const needsProxy = shouldGenerateProxy(asset);
                  return (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleAssetDragStart(e, asset)}
                      title="Drag onto any timeline lane, or insert Front / Back / V2"
                      className="rounded-xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 backdrop-blur-md p-2 space-y-1.5 cursor-grab active:cursor-grabbing transition-all"
                    >
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                        {asset.kind === 'image' ? (
                          <img
                            src={
                              proxyPlaybackEnabled && asset.proxyStatus === 'ready' && asset.proxySrc
                                ? asset.proxySrc
                                : asset.src
                            }
                            alt={asset.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <Film className="w-5 h-5 text-sky-400" />
                        )}
                        {asset.proxyStatus === 'ready' && (
                          <span
                            data-testid={`asset-proxy-badge-${asset.id}`}
                            className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 border border-cyan-400/50 text-[8.5px] font-mono-tabular text-cyan-200 flex items-center gap-0.5"
                          >
                            <Check className="w-2.5 h-2.5 text-cyan-300" />
                            720p
                          </span>
                        )}
                        {(asset.proxyStatus === 'generating' || asset.proxyStatus === 'queued') && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 border border-amber-400/50 text-[8.5px] font-mono-tabular text-amber-200 flex items-center gap-0.5">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
                            Proxy
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-zinc-100 truncate">
                          {asset.name}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[10px] font-mono-tabular text-zinc-400 truncate">
                            {asset.width > 0 ? `${asset.width}×${asset.height}` : asset.formatInfo.extension.toUpperCase()} · {formatShortTime(asset.duration)}
                          </p>
                          {needsProxy &&
                            asset.proxyStatus !== 'ready' &&
                            asset.proxyStatus !== 'generating' &&
                            onGenerateProxyForAsset && (
                              <button
                                type="button"
                                onClick={() => onGenerateProxyForAsset(asset.id)}
                                className="text-[9px] font-semibold text-cyan-300 hover:text-cyan-200 shrink-0"
                              >
                                +Proxy
                              </button>
                            )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => onAddAssetToTimeline(asset, primaryVideoTrack, 'front')}
                          aria-label={`Insert ${asset.name} to Front of Main Video`}
                          className="px-1 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/35 text-[9.5px] font-semibold flex items-center justify-center whitespace-nowrap"
                        >
                          +Front
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddAssetToTimeline(asset, primaryVideoTrack, 'back')}
                          aria-label={`Add ${asset.name} to Back of Main Video`}
                          className="px-1 py-1 rounded bg-sky-500/20 text-sky-200 hover:bg-sky-500/35 text-[9.5px] font-semibold flex items-center justify-center whitespace-nowrap"
                        >
                          +Back
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddAssetToTimeline(asset, overlayTrack, 'time')}
                          aria-label={`Add ${asset.name} to Overlay`}
                          className="px-1 py-1 rounded bg-violet-500/20 text-violet-200 hover:bg-violet-500/35 text-[9.5px] font-semibold flex items-center justify-center whitespace-nowrap"
                        >
                          +V2
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {activeTab === 'luts' && (
          <div className="space-y-2.5" onMouseLeave={() => onPreviewLutHover?.(null)}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-zinc-200">
                Live Color Filters ({filteredLuts.length})
              </span>
              {selectedClip && selectedClip.kind !== 'audio' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (prev) => ({
                        ...prev,
                        colorGrade: computeAutoEnhanceGrade(prev.colorGrade),
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-200 hover:bg-amber-500/30 text-[10px] font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5" /> Auto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (prev) => ({
                        ...prev,
                        colorGrade: { ...DEFAULT_COLOR_GRADE },
                      }))
                    }
                    className="px-1.5 py-0.5 rounded-md bg-white/[0.05] text-[10px] text-zinc-300 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Reset
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={lutSearch}
                onChange={(e) => setLutSearch(e.target.value)}
                placeholder={`Search ${LUT_PRESETS.length}+ live filters...`}
                aria-label="Search live filters"
                className="w-full rounded-lg border border-white/12 bg-white/[0.05] backdrop-blur-md pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {LUT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLutCat(cat)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium shrink-0 border ${
                    lutCat === cat
                      ? 'border-amber-400 bg-amber-500 text-zinc-950 font-semibold'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filteredLuts.map((lut) => {
                const isSelected = selectedClip?.colorGrade.lutId === lut.id;
                const cssFilter = buildCanvasFilterString({
                  ...DEFAULT_COLOR_GRADE,
                  lutId: lut.id,
                });
                return (
                  <button
                    key={lut.id}
                    type="button"
                    disabled={!selectedClip || selectedClip.kind === 'audio'}
                    onMouseEnter={() => onPreviewLutHover?.(lut.id)}
                    onMouseLeave={() => onPreviewLutHover?.(null)}
                    onClick={() => onApplyLut(lut.id)}
                    className={`text-left rounded-xl border p-1.5 flex flex-col gap-1.5 backdrop-blur-md transition-all disabled:opacity-40 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/18 shadow-sm'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.1] hover:border-white/25'
                    }`}
                  >
                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-black relative border border-white/10">
                      {previewSampleImage ? (
                        <img
                          src={previewSampleImage}
                          alt=""
                          style={{ filter: cssFilter }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div style={{ background: lut.previewGradient }} className="w-full h-full" />
                      )}
                      <span className="absolute top-1 right-1 px-1 rounded bg-black/55 text-[8.5px] font-mono-tabular text-zinc-200">
                        {lut.category}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-zinc-100 truncate px-0.5">
                      {lut.name}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedClip && selectedClip.kind !== 'audio' && (
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                <GlassSlider
                  label="Brightness"
                  value={selectedClip.colorGrade.exposure}
                  min={-60}
                  max={60}
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, exposure: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Contrast"
                  value={selectedClip.colorGrade.contrast}
                  min={-60}
                  max={80}
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, contrast: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Saturation"
                  value={selectedClip.colorGrade.saturation}
                  min={-100}
                  max={100}
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, saturation: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Hue Shift"
                  value={selectedClip.colorGrade.hue ?? 0}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, hue: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Temp"
                  value={selectedClip.colorGrade.temperature}
                  min={-60}
                  max={60}
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, temperature: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Vignette"
                  value={selectedClip.colorGrade.vignette}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, vignette: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Sharpness"
                  value={selectedClip.colorGrade.sharpness ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, sharpness: v },
                    }))
                  }
                />
                <GlassSlider
                  label="35mm Grain"
                  value={selectedClip.colorGrade.grain ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      colorGrade: { ...p.colorGrade, grain: v },
                    }))
                  }
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'neon' && (() => {
          const activeNeon = resolveNeonConfig(selectedClip?.neon);
          const isVisualTarget = Boolean(
            selectedClip && (selectedClip.kind === 'image' || selectedClip.kind === 'video')
          );
          const updateClipNeon = (patch: Partial<typeof activeNeon>) => {
            if (!selectedClip) return;
            onUpdateClip(selectedClip.id, (prev) => ({
              ...prev,
              neon: {
                ...resolveNeonConfig(prev.neon),
                ...patch,
              },
            }));
          };

          return (
            <div className="space-y-3" data-testid="neon-system-panel">
              {/* Neon Master Switch + Reset */}
              <div className="rounded-xl border border-cyan-400/30 bg-white/[0.04] backdrop-blur-md p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Neon System Glow</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {isVisualTarget
                      ? 'Live neon tubes, aura & HUD lighting'
                      : 'Select a Video/Image clip or add Neon overlay'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isVisualTarget && activeNeon.enabled && (
                    <button
                      type="button"
                      onClick={() =>
                        selectedClip &&
                        onUpdateClip(selectedClip.id, (prev) => ({
                          ...prev,
                          neon: { ...DEFAULT_NEON_CONFIG },
                        }))
                      }
                      aria-label="Reset Neon"
                      className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[10px] text-zinc-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Reset
                    </button>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={activeNeon.enabled}
                    disabled={!isVisualTarget}
                    onClick={() => updateClipNeon({ enabled: !activeNeon.enabled })}
                    data-testid="toggle-neon-switch"
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all disabled:opacity-40 ${
                      activeNeon.enabled
                        ? 'bg-cyan-400 text-zinc-950 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
                        : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                    }`}
                  >
                    {activeNeon.enabled ? 'On' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* Quick 1-Tap Neon Overlays */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onAddTextClip('neonCyber')}
                  className="rounded-xl border border-cyan-400/35 bg-cyan-500/12 hover:bg-cyan-500/22 backdrop-blur-md px-2.5 py-2 text-left flex items-center justify-between gap-1.5 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-cyan-200 block truncate">
                      + Neon Title
                    </span>
                    <span className="text-[9.5px] text-zinc-400 block truncate">
                      Glowing cyber text
                    </span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onAddEmojiClip(
                      {
                        id: 'em_bolt',
                        emoji: '⚡',
                        label: 'Neon Bolt',
                        category: 'FX',
                        defaultGlow: activeNeon.color,
                      },
                      'neon',
                      'pulse'
                    )
                  }
                  className="rounded-xl border border-pink-400/35 bg-pink-500/12 hover:bg-pink-500/22 backdrop-blur-md px-2.5 py-2 text-left flex items-center justify-between gap-1.5 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-pink-200 block truncate">
                      + Neon Sticker
                    </span>
                    <span className="text-[9.5px] text-zinc-400 block truncate">
                      Pulsing halo ⚡
                    </span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                </button>
              </div>

              {/* Neon Style Presets Live Grid */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-200 block">
                  Neon Frame Presets ({NEON_PRESETS.length})
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {NEON_PRESETS.map((preset) => {
                    const isSelected =
                      activeNeon.enabled &&
                      activeNeon.mode === preset.config.mode &&
                      activeNeon.color.toLowerCase() === preset.config.color.toLowerCase() &&
                      activeNeon.secondaryColor.toLowerCase() ===
                        preset.config.secondaryColor.toLowerCase();
                    const neonCss = buildNeonPreviewStyle(preset.config);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={!isVisualTarget}
                        data-testid={`neon-preset-${preset.id}`}
                        onClick={() =>
                          selectedClip &&
                          onUpdateClip(selectedClip.id, (prev) => ({
                            ...prev,
                            neon: { ...preset.config, enabled: true },
                          }))
                        }
                        className={`text-left rounded-xl border p-1.5 flex flex-col gap-1.5 backdrop-blur-md transition-all disabled:opacity-40 ${
                          isSelected
                            ? 'border-cyan-300 bg-cyan-500/18 shadow-sm'
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.1] hover:border-white/25'
                        }`}
                      >
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/75 border border-white/10 p-1.5">
                          {previewSampleImage && (
                            <img
                              src={previewSampleImage}
                              alt=""
                              className="w-full h-full object-cover rounded opacity-85"
                            />
                          )}
                          <div
                            style={{
                              borderColor: neonCss.borderColor,
                              boxShadow: neonCss.boxShadow,
                              borderRadius: `${Math.min(10, Math.round(preset.config.cornerRadius / 3))}px`,
                            }}
                            className="absolute inset-1.5 border-2 pointer-events-none"
                          />
                          <span className="absolute top-1.5 right-1.5 px-1 rounded bg-black/65 text-[8.5px] font-mono-tabular text-cyan-200">
                            {preset.tag}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-zinc-100 truncate px-0.5">
                          {preset.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Neon Modes Grid */}
              {isVisualTarget && (
                <>
                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <span className="text-[11px] font-semibold text-zinc-200 block">
                      Neon Geometry Mode
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {NEON_MODES.map((m) => {
                        const active = activeNeon.enabled && activeNeon.mode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateClipNeon({ enabled: true, mode: m.id })}
                            className={`rounded-xl border px-1.5 py-2 text-center backdrop-blur-md transition-colors ${
                              active
                                ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100 font-semibold'
                                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09]'
                            }`}
                          >
                            <span className="text-[10px] block truncate">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dual Tube Color Palette */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[10.5px] text-zinc-300">
                      <span>Primary Tube</span>
                      <span className="font-mono-tabular text-cyan-300">{activeNeon.color}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {NEON_COLOR_PALETTE.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          aria-label={`Primary neon ${c.name}`}
                          onClick={() => updateClipNeon({ enabled: true, color: c.hex })}
                          style={{
                            backgroundColor: c.hex,
                            boxShadow:
                              activeNeon.color.toLowerCase() === c.hex.toLowerCase()
                                ? `0 0 10px ${c.hex}`
                                : 'none',
                          }}
                          className={`w-6 h-6 rounded-full border transition-transform ${
                            activeNeon.color.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white scale-110'
                              : 'border-white/25 hover:scale-105'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom primary neon color"
                        value={activeNeon.color}
                        onChange={(e) => updateClipNeon({ enabled: true, color: e.target.value })}
                        className="w-6 h-6 rounded-full bg-transparent border border-white/25 cursor-pointer p-0"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-zinc-300 pt-1">
                      <span>Accent / Inner Glow</span>
                      <span className="font-mono-tabular text-pink-300">
                        {activeNeon.secondaryColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {NEON_COLOR_PALETTE.map((c) => (
                        <button
                          key={`sec_${c.id}`}
                          type="button"
                          aria-label={`Secondary neon ${c.name}`}
                          onClick={() => updateClipNeon({ enabled: true, secondaryColor: c.hex })}
                          style={{ backgroundColor: c.hex }}
                          className={`w-5 h-5 rounded-full border transition-transform ${
                            activeNeon.secondaryColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white scale-110'
                              : 'border-white/25 hover:scale-105'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom secondary neon color"
                        value={activeNeon.secondaryColor}
                        onChange={(e) =>
                          updateClipNeon({ enabled: true, secondaryColor: e.target.value })
                        }
                        className="w-5 h-5 rounded-full bg-transparent border border-white/25 cursor-pointer p-0"
                      />
                    </div>
                  </div>

                  {/* Fine Tuning Controls */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <GlassSlider
                      label="Glow Intensity"
                      value={activeNeon.intensity}
                      min={10}
                      max={100}
                      unit="%"
                      onChange={(v) => updateClipNeon({ enabled: true, intensity: v })}
                    />
                    <GlassSlider
                      label="Glow Spread"
                      value={activeNeon.blurRadius}
                      min={4}
                      max={64}
                      unit="px"
                      onChange={(v) => updateClipNeon({ enabled: true, blurRadius: v })}
                    />
                    <GlassSlider
                      label="Tube Width"
                      value={activeNeon.borderWidth}
                      min={1}
                      max={20}
                      unit="px"
                      onChange={(v) => updateClipNeon({ enabled: true, borderWidth: v })}
                    />
                    <GlassSlider
                      label="Corner Radius"
                      value={activeNeon.cornerRadius}
                      min={0}
                      max={64}
                      unit="px"
                      onChange={(v) => updateClipNeon({ enabled: true, cornerRadius: v })}
                    />
                    <div className="col-span-2">
                      <GlassSlider
                        label="Beat Pulse Speed"
                        value={activeNeon.pulseSpeed}
                        min={0}
                        max={5}
                        step={0.2}
                        unit="Hz"
                        onChange={(v) => updateClipNeon({ enabled: true, pulseSpeed: v })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {activeTab === 'vfx' && (
          <div className="space-y-2.5">
            {/* Global Cinema Motion Blur Setting (applicable individually per video clip) */}
            <div
              data-testid="vfx-global-motion-blur"
              className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] backdrop-blur-md p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-zinc-100">
                    Global Motion Blur
                  </div>
                  <div className="text-[9.5px] font-mono-tabular text-amber-300">
                    {formatShutterAngleLabel(globalMotionBlur)} ({globalMotionBlur}%)
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="apply-global-motion-blur-btn"
                  disabled={
                    !selectedClip ||
                    selectedClip.kind === 'audio' ||
                    selectedClip.kind === 'text' ||
                    selectedClip.kind === 'emoji'
                  }
                  onClick={() => {
                    if (selectedClip && onApplyGlobalMotionBlurToClip) {
                      onApplyGlobalMotionBlurToClip(selectedClip.id);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-[10px] font-bold transition-colors shrink-0"
                >
                  Apply to Clip
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={globalMotionBlur}
                aria-label="Global Motion Blur Shutter Intensity"
                onChange={(e) => onChangeGlobalMotionBlur?.(Number(e.target.value))}
                className="w-full studio-slider"
              />
              {selectedClip && selectedClip.kind !== 'audio' && (
                <div className="flex items-center justify-between text-[9.5px] text-zinc-400">
                  <span className="truncate">Clip: {selectedClip.name}</span>
                  <span className="font-mono-tabular text-zinc-200 shrink-0">
                    Active: {selectedClip.vfx?.motionBlur ?? 0}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {(['All', 'Glitch', 'Lens', 'Cinema', 'Retro'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setVfxCat(cat)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium shrink-0 border ${
                      vfxCat === cat
                        ? 'border-amber-400 bg-amber-500 text-zinc-950 font-semibold'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {selectedClip && selectedClip.kind !== 'audio' && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({ ...p, vfx: { ...DEFAULT_VFX } }))
                  }
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 shrink-0 ml-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filteredVfx.map((fx) => {
                const currentVal = selectedClip?.vfx?.[fx.id] ?? 0;
                const isActive = currentVal > 0;
                return (
                  <div
                    key={fx.id}
                    className={`rounded-xl border p-1.5 backdrop-blur-md transition-all flex flex-col gap-1.5 ${
                      isActive
                        ? 'border-amber-400 bg-amber-500/18'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={
                        !selectedClip ||
                        selectedClip.kind === 'audio' ||
                        selectedClip.kind === 'text'
                      }
                      onClick={() => onApplyVfx(fx.id, isActive ? 0 : fx.defaultIntensity)}
                      className="text-left space-y-1 disabled:opacity-40"
                    >
                      {renderVfxLivePreview(fx.id)}
                      <div className="flex items-center justify-between gap-1 px-0.5">
                        <span className="text-[11px] font-semibold text-zinc-100 truncate">
                          {fx.name}
                        </span>
                        <span className="text-[9.5px] font-mono-tabular text-amber-300 shrink-0">
                          {isActive ? `${currentVal}%` : 'Off'}
                        </span>
                      </div>
                    </button>
                    {selectedClip && selectedClip.kind !== 'audio' && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={currentVal}
                        aria-label={`${fx.name} intensity`}
                        onChange={(e) => onApplyVfx(fx.id, Number(e.target.value))}
                        className="w-full studio-slider"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'animate' && (
          <div className="space-y-3" data-testid="animate-studio-panel">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {MOTION_PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAnimateCat(cat)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium shrink-0 border ${
                      animateCat === cat
                        ? 'border-orange-400 bg-orange-500 text-zinc-950 font-semibold'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {selectedClip && selectedClip.kind !== 'audio' && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      motionPreset: { ...DEFAULT_MOTION_PRESET_CONFIG },
                    }))
                  }
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
              )}
            </div>

            {(!selectedClip || selectedClip.kind === 'audio') && (
              <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 p-2.5 text-[11px] text-orange-100">
                Select a video, photo, title, or emoji clip to animate it with 1-click Ken Burns or beat motion.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {MOTION_PRESET_LIBRARY.filter((m) =>
                animateCat === 'All' ? true : m.category === animateCat
              ).map((preset) => {
                const active =
                  (selectedClip?.motionPreset?.preset ?? 'none') === preset.id;
                const isVisual = Boolean(selectedClip && selectedClip.kind !== 'audio');
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!isVisual}
                    data-testid={`motion-preset-${preset.id}`}
                    onClick={() =>
                      selectedClip &&
                      onUpdateClip(selectedClip.id, (prev) => ({
                        ...prev,
                        motionPreset: {
                          preset: preset.id,
                          intensity:
                            preset.id === 'none'
                              ? 0
                              : prev.motionPreset?.preset && prev.motionPreset.preset !== 'none'
                              ? prev.motionPreset.intensity
                              : preset.defaultIntensity,
                          speed:
                            prev.motionPreset?.preset && prev.motionPreset.preset !== 'none'
                              ? prev.motionPreset.speed
                              : preset.defaultSpeed,
                        },
                      }))
                    }
                    className={`text-left rounded-xl border p-1.5 backdrop-blur-md transition-all flex flex-col gap-1.5 disabled:opacity-40 ${
                      active
                        ? 'border-orange-400 bg-orange-500/18 shadow-sm'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.09]'
                    }`}
                  >
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/55">
                      {previewSampleImage && (
                        <img
                          src={previewSampleImage}
                          alt=""
                          style={{
                            transform:
                              preset.id === 'kenBurnsIn'
                                ? 'scale(1.18)'
                                : preset.id === 'kenBurnsOut'
                                ? 'scale(1.04)'
                                : preset.id === 'panLeft'
                                ? 'scale(1.15) translateX(-6%)'
                                : preset.id === 'panRight'
                                ? 'scale(1.15) translateX(6%)'
                                : preset.id === 'cinematicTilt'
                                ? 'scale(1.14) rotate(4deg)'
                                : preset.id === 'beatPulse'
                                ? 'scale(1.1)'
                                : preset.id === 'whipZoom'
                                ? 'scale(1.24) rotate(-3deg)'
                                : preset.id === 'handheldFloat'
                                ? 'scale(1.08) translateY(-2px)'
                                : 'scale(1)',
                          }}
                          className="w-full h-full object-cover pointer-events-none transition-transform duration-300"
                        />
                      )}
                      <span
                        style={{ color: preset.accentColor }}
                        className="absolute top-1 right-1 px-1 rounded bg-black/65 text-[8.5px] font-mono-tabular"
                      >
                        {preset.category}
                      </span>
                    </div>
                    <div className="px-0.5">
                      <p className="text-[11px] font-semibold text-zinc-100 truncate">
                        {preset.name}
                      </p>
                      <p className="text-[9.5px] text-zinc-400 truncate">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedClip &&
              selectedClip.kind !== 'audio' &&
              (selectedClip.motionPreset?.preset ?? 'none') !== 'none' && (
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                  <GlassSlider
                    label="Motion Amount"
                    value={selectedClip.motionPreset?.intensity ?? 55}
                    min={10}
                    max={100}
                    unit="%"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        motionPreset: {
                          ...(p.motionPreset ?? DEFAULT_MOTION_PRESET_CONFIG),
                          intensity: v,
                        },
                      }))
                    }
                  />
                  <GlassSlider
                    label="Motion Speed"
                    value={selectedClip.motionPreset?.speed ?? 1}
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    unit="x"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        motionPreset: {
                          ...(p.motionPreset ?? DEFAULT_MOTION_PRESET_CONFIG),
                          speed: v,
                        },
                      }))
                    }
                  />
                </div>
              )}
          </div>
        )}

        {activeTab === 'transitions' && (
          <div className="space-y-2.5" onMouseLeave={() => onPreviewTransitionHover?.(null)}>
            {/* Transition Library Modal Trigger */}
            <button
              type="button"
              onClick={onOpenTransitionLibrary}
              data-testid="open-transition-library-btn"
              className="w-full rounded-xl border border-cyan-400/45 bg-gradient-to-r from-cyan-500/20 via-sky-500/15 to-amber-500/20 hover:from-cyan-500/30 hover:to-amber-500/30 backdrop-blur-md px-3 py-2.5 flex items-center justify-between gap-2 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
                <div className="text-left min-w-0">
                  <span className="text-xs font-bold text-white block truncate">
                    Open Transition Library
                  </span>
                  <span className="text-[10px] text-cyan-200/90 block truncate">
                    Drag &amp; drop Cross-Dissolve, Wipe, Push &amp; Zoom onto seams
                  </span>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg bg-white/10 text-[10px] font-semibold text-white shrink-0">
                Open Grid
              </span>
            </button>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-zinc-200">
                Quick Transitions ({filteredTransitions.length})
              </span>
              {selectedClip && selectedClip.kind !== 'audio' && onPlayTransitionPreview && (
                <button
                  type="button"
                  onClick={onPlayTransitionPreview}
                  className="px-2 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/35 text-cyan-200 hover:bg-cyan-500/30 text-[10px] font-semibold flex items-center gap-1"
                >
                  <Play className="w-2.5 h-2.5 fill-current" /> Preview
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={transSearch}
                onChange={(e) => setTransSearch(e.target.value)}
                placeholder="Search Dissolve, Wipe, Push, Zoom..."
                aria-label="Search transitions"
                className="w-full rounded-lg border border-white/12 bg-white/[0.05] pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {TRANSITION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTransCat(cat)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium shrink-0 border ${
                    transCat === cat
                      ? 'border-amber-400 bg-amber-500 text-zinc-950 font-semibold'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {selectedClip && selectedClip.kind !== 'audio' && (
              <div className="grid grid-cols-4 gap-1">
                {[0.3, 0.5, 0.8, 1.2].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        transitionIn: { ...p.transitionIn, duration: sec },
                      }))
                    }
                    className={`py-1 rounded-lg text-[10px] font-mono-tabular font-semibold border backdrop-blur-md ${
                      Math.abs(selectedClip.transitionIn.duration - sec) < 0.05
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {filteredTransitions.map((tr) => {
                const active = selectedClip?.transitionIn.type === tr.type;
                return (
                  <div
                    key={tr.type}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/x-rorn-transition',
                        JSON.stringify({
                          type: tr.type,
                          duration: tr.defaultDuration,
                          label: tr.label,
                        })
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                      onDragTransitionChange?.(true);
                    }}
                    onDragEnd={() => onDragTransitionChange?.(false)}
                    onMouseEnter={() => onPreviewTransitionHover?.(tr.type)}
                    onMouseLeave={() => onPreviewTransitionHover?.(null)}
                    onClick={() => onApplyTransition(tr.type, tr.defaultDuration)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onApplyTransition(tr.type, tr.defaultDuration);
                      }
                    }}
                    className={`rounded-xl border p-1.5 flex flex-col gap-1.5 backdrop-blur-md cursor-grab active:cursor-grabbing transition-all ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/18'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.1] hover:border-white/25'
                    }`}
                  >
                    <TransitionLiveThumb
                      type={tr.type}
                      progress={transLoopPhase}
                      accent={tr.accent}
                      imageA={previewSampleImage}
                      imageB={secondSampleImage}
                      compact
                    />
                    <div className="min-w-0 px-0.5">
                      <p className="text-[11px] font-semibold text-zinc-100 truncate">{tr.label}</p>
                      <p className="text-[9.5px] text-zinc-400 truncate">{tr.category}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'titles' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {TEXT_PRESETS.map((item) => (
                <button
                  key={item.preset}
                  type="button"
                  onClick={() => onAddTextClip(item.preset)}
                  className="text-left rounded-xl border border-white/12 bg-white/[0.04] hover:border-pink-400/55 hover:bg-white/[0.09] backdrop-blur-md p-2 space-y-1.5 transition-all"
                >
                  <div className="rounded-lg bg-black/45 border border-white/10 px-2 py-2 flex items-center justify-center min-h-[42px]">
                    <span className={`text-[11px] text-center ${item.previewClass}`}>
                      {item.sample}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-zinc-200 truncate">
                      {item.label}
                    </span>
                    <Plus className="w-3 h-3 text-pink-400 shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {selectedClip?.kind === 'text' && selectedClip.textConfig && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    aria-label="Headline Text"
                    value={selectedClip.textConfig.text}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig
                          ? { ...p.textConfig, text: e.target.value }
                          : undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    aria-label="Subtitle Text"
                    placeholder="Optional subtitle..."
                    value={selectedClip.textConfig.subtitle ?? ''}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig
                          ? { ...p.textConfig, subtitle: e.target.value }
                          : undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                {/* Live Style Visual Cards Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {TEXT_STYLES.map((st) => {
                    const active = (selectedClip.textConfig?.textStyle ?? 'clean') === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, (p) => ({
                            ...p,
                            textConfig: p.textConfig
                              ? { ...p.textConfig, textStyle: st.id }
                              : undefined,
                          }))
                        }
                        className={`px-1.5 py-1.5 rounded-xl border text-center backdrop-blur-md transition-colors flex flex-col items-center gap-0.5 ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09]'
                        }`}
                      >
                        <span className={`text-[11px] leading-tight ${st.previewCls}`}>Abc</span>
                        <span className="text-[9.5px] truncate w-full">{st.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    aria-label="Font Family"
                    value={selectedClip.textConfig.fontFamily}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig
                          ? { ...p.textConfig, fontFamily: e.target.value }
                          : undefined,
                      }))
                    }
                    className="rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1.5 text-[11px] text-zinc-100"
                  >
                    <option value="Plus Jakarta Sans" className="bg-[#0E131E]">Plus Jakarta Sans</option>
                    <option value="JetBrains Mono" className="bg-[#0E131E]">JetBrains Mono</option>
                    <option value="Georgia" className="bg-[#0E131E]">Georgia</option>
                    <option value="Impact" className="bg-[#0E131E]">Impact</option>
                    <option value="Arial Black" className="bg-[#0E131E]">Arial Black</option>
                  </select>
                  <select
                    aria-label="Entrance Animation"
                    value={selectedClip.textConfig.animation}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig
                          ? { ...p.textConfig, animation: e.target.value as TextAnimationType }
                          : undefined,
                      }))
                    }
                    className="rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1.5 text-[11px] text-zinc-100"
                  >
                    <option value="none" className="bg-[#0E131E]">None</option>
                    <option value="fade" className="bg-[#0E131E]">Smooth Fade</option>
                    <option value="slideUp" className="bg-[#0E131E]">Slide Up</option>
                    <option value="pop" className="bg-[#0E131E]">Kinetic Pop</option>
                    <option value="typewriter" className="bg-[#0E131E]">Typewriter</option>
                    <option value="bounce" className="bg-[#0E131E]">Elastic Bounce</option>
                    <option value="glitch" className="bg-[#0E131E]">Digital Glitch</option>
                    <option value="zoomBlur" className="bg-[#0E131E]">Zoom Blur</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <GlassSlider
                    label="Font Size"
                    value={selectedClip.textConfig.fontSize}
                    min={16}
                    max={140}
                    unit="px"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig ? { ...p.textConfig, fontSize: v } : undefined,
                      }))
                    }
                  />
                  <GlassSlider
                    label="Box Opacity"
                    value={Math.round(selectedClip.textConfig.bgOpacity * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig
                          ? { ...p.textConfig, bgOpacity: v / 100 }
                          : undefined,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {TEXT_COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set text color ${hex}`}
                      onClick={() =>
                        onUpdateClip(selectedClip.id, (p) => ({
                          ...p,
                          textConfig: p.textConfig ? { ...p.textConfig, color: hex } : undefined,
                        }))
                      }
                      style={{ backgroundColor: hex }}
                      className={`w-6 h-6 rounded-md border transition-transform ${
                        selectedClip.textConfig?.color.toLowerCase() === hex.toLowerCase()
                          ? 'border-amber-400 scale-110 ring-1 ring-amber-400'
                          : 'border-white/25 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'emoji' && (
          <div className="space-y-2.5" data-testid="emoji-vault-panel">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-zinc-200">
                Emoji &amp; Stickers ({filteredEmojis.length})
              </span>
              <select
                value={emojiAnim}
                onChange={(e) => {
                  const nextAnim = e.target.value as EmojiAnimationType;
                  setEmojiAnim(nextAnim);
                  if (selectedClip?.kind === 'emoji' && selectedClip.emojiConfig) {
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      emojiConfig: p.emojiConfig ? { ...p.emojiConfig, animation: nextAnim } : undefined,
                    }));
                  }
                }}
                aria-label="Emoji Animation"
                className="rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1 text-[10px] text-zinc-200"
              >
                <option value="bounce" className="bg-[#0E131E]">Bounce</option>
                <option value="float" className="bg-[#0E131E]">Float</option>
                <option value="pulse" className="bg-[#0E131E]">Pulse</option>
                <option value="spin" className="bg-[#0E131E]">Spin</option>
                <option value="pop" className="bg-[#0E131E]">Pop</option>
                <option value="shake" className="bg-[#0E131E]">Shake</option>
                <option value="none" className="bg-[#0E131E]">Static</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search fire, crown, neon..."
                aria-label="Search emojis and stickers"
                className="w-full rounded-lg border border-white/12 bg-white/[0.05] pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Live Sticker Style Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {EMOJI_STYLE_CARDS.map((st) => {
                const active =
                  (selectedClip?.emojiConfig?.style ?? emojiStyle) === st.id;
                const demoEmoji = selectedClip?.emojiConfig?.emoji ?? '🔥';
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setEmojiStyle(st.id);
                      if (selectedClip?.kind === 'emoji' && selectedClip.emojiConfig) {
                        onUpdateClip(selectedClip.id, (p) => ({
                          ...p,
                          emojiConfig: p.emojiConfig ? { ...p.emojiConfig, style: st.id } : undefined,
                        }));
                      }
                    }}
                    className={`rounded-xl border p-1.5 flex flex-col items-center gap-0.5 backdrop-blur-md transition-colors ${
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className={`text-lg leading-none ${st.cls}`}>{demoEmoji}</span>
                    <span className="text-[9px] truncate w-full text-center">
                      {st.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setEmojiCat(cat)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium shrink-0 border ${
                    emojiCat === cat
                      ? 'border-amber-400 bg-amber-500 text-zinc-950 font-semibold'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {selectedClip?.kind === 'emoji' && selectedClip.emojiConfig && (
              <GlassSlider
                label="Sticker Size"
                value={selectedClip.emojiConfig.size}
                min={48}
                max={240}
                step={4}
                unit="px"
                onChange={(v) =>
                  onUpdateClip(selectedClip.id, (p) => ({
                    ...p,
                    emojiConfig: p.emojiConfig ? { ...p.emojiConfig, size: v } : undefined,
                  }))
                }
              />
            )}

            <div className="grid grid-cols-4 gap-1.5">
              {filteredEmojis.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Add ${item.label} Emoji`}
                  onClick={() => onAddEmojiClip(item, emojiStyle, emojiAnim)}
                  title={`${item.label} (${item.category})`}
                  className="group rounded-xl border border-white/12 bg-white/[0.04] hover:border-amber-400/60 hover:bg-white/[0.1] backdrop-blur-md p-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <span
                    className={`text-2xl leading-none transition-transform group-hover:scale-125 ${
                      emojiStyle === 'neon'
                        ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]'
                        : emojiStyle === 'sticker'
                        ? 'drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]'
                        : ''
                    }`}
                  >
                    {item.emoji}
                  </span>
                  <span className="text-[9px] text-zinc-300 truncate w-full text-center">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-3">
            {/* Multi-Track Mixer Overlay Launcher */}
            {onToggleAudioMixer && (
              <button
                type="button"
                onClick={onToggleAudioMixer}
                data-testid="vault-open-audio-mixer-btn"
                className={`w-full rounded-xl border p-2.5 backdrop-blur-md flex items-center justify-between gap-2 transition-colors ${
                  audioMixerOpen
                    ? 'border-emerald-400 bg-emerald-500/22 text-emerald-100'
                    : 'border-emerald-400/35 bg-white/[0.04] hover:bg-emerald-500/15 text-zinc-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 text-left">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">
                      Multi-Track Audio Mixer
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      Adjust multiple tracks live over timeline
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-300 shrink-0">
                  {audioMixerOpen ? 'Active' : 'Open'}
                </span>
              </button>
            )}

            {/* Voiceover & Global LUFS Action Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleVoiceoverRecording}
                className={`rounded-xl border p-2.5 text-left backdrop-blur-md flex flex-col gap-1 transition-colors ${
                  isRecording
                    ? 'border-rose-400 bg-rose-500/25 text-white'
                    : 'border-emerald-400/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  {isRecording ? (
                    <Square className="w-4 h-4 fill-current text-rose-300" />
                  ) : (
                    <Mic className="w-4 h-4 text-emerald-300" />
                  )}
                  <span className="text-[10px] font-mono-tabular">
                    {isRecording ? `${recSeconds}s` : 'Mic'}
                  </span>
                </div>
                <span className="text-[11px] font-semibold">
                  {isRecording ? 'Stop Voiceover' : 'Record Voiceover'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNormalizeAllAudio(-14)}
                disabled={isNormalizingAudio}
                className="rounded-xl border border-amber-400/35 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 backdrop-blur-md p-2.5 text-left flex flex-col gap-1 transition-colors text-amber-100"
              >
                <div className="flex items-center justify-between">
                  <Volume2 className="w-4 h-4 text-amber-300" />
                  <span className="text-[10px] font-mono-tabular">-14 LUFS</span>
                </div>
                <span className="text-[11px] font-semibold">
                  {isNormalizingAudio ? 'Measuring...' : 'Normalize Mix'}
                </span>
              </button>
            </div>
            {/* Real-Time Voiceover Microphone Waveform Meter */}
            {isRecording && (
              <div
                data-testid="live-voiceover-waveform"
                className="rounded-xl border border-rose-400/45 bg-rose-500/[0.08] backdrop-blur-md p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1.5 font-bold text-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>LIVE MIC INPUT</span>
                    <span className="font-mono-tabular text-zinc-300">
                      {formatVoiceoverTimer(recSeconds)}
                    </span>
                  </div>
                  <span
                    className={`font-mono-tabular font-semibold ${
                      liveMicClipping
                        ? 'text-rose-400'
                        : liveMicDb > -12
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {liveMicClipping ? 'CLIP ' : ''}
                    {liveMicDb} dBFS
                  </span>
                </div>
                <div
                  aria-label="Live voiceover input waveform"
                  className="h-12 w-full rounded-lg bg-black/50 border border-white/10 px-1.5 py-1 flex items-center gap-[2px]"
                >
                  {liveMicBars.map((lvl, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${Math.round(lvl * 100)}%` }}
                      className={`flex-1 min-w-[2px] rounded-full transition-[height] duration-75 ${
                        lvl >= 0.88
                          ? 'bg-rose-400'
                          : lvl >= 0.58
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {recError && <p className="text-[11px] text-rose-400">{recError}</p>}

            {/* Selected Clip Audio Controls */}
            {selectedClip && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="grid grid-cols-2 gap-1.5">
                  <GlassSlider
                    label="Clip Volume"
                    value={selectedClip.audio.volume}
                    min={0}
                    max={500}
                    unit="%"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: { ...p.audio, volume: v },
                      }))
                    }
                  />
                  <GlassSlider
                    label={`Pan (${panLabel})`}
                    value={panVal}
                    min={-100}
                    max={100}
                    step={5}
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: { ...p.audio, pan: v },
                      }))
                    }
                  />
                  <GlassSlider
                    label="Fade In"
                    value={selectedClip.audio.fadeIn}
                    min={0}
                    max={4}
                    step={0.1}
                    unit="s"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: { ...p.audio, fadeIn: v },
                      }))
                    }
                  />
                  <GlassSlider
                    label="Fade Out"
                    value={selectedClip.audio.fadeOut}
                    min={0}
                    max={4}
                    step={0.1}
                    unit="s"
                    onChange={(v) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: { ...p.audio, fadeOut: v },
                      }))
                    }
                  />
                </div>

                {/* 2026 Voice DSP & Auto-Ducking Grid */}
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(selectedClip.audio.voiceIsolation)}
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: { ...p.audio, voiceIsolation: !p.audio.voiceIsolation },
                      }))
                    }
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-semibold backdrop-blur-md ${
                      selectedClip.audio.voiceIsolation
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    Voice AI
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={(selectedClip.audio.highPassHz ?? 0) > 20}
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: {
                          ...p.audio,
                          highPassHz: (p.audio.highPassHz ?? 0) > 20 ? 0 : 85,
                        },
                      }))
                    }
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-semibold backdrop-blur-md ${
                      (selectedClip.audio.highPassHz ?? 0) > 20
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    De-Hum
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedClip.audio.compressorEnabled !== false}
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        audio: {
                          ...p.audio,
                          compressorEnabled: p.audio.compressorEnabled === false,
                        },
                      }))
                    }
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-semibold backdrop-blur-md ${
                      selectedClip.audio.compressorEnabled !== false
                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    Limiter
                  </button>
                  {onAutoDuckClip && (
                    <button
                      type="button"
                      onClick={() => onAutoDuckClip(selectedClip.id)}
                      className="py-1.5 px-1 rounded-lg border border-sky-400/35 bg-sky-500/15 hover:bg-sky-500/25 text-[10px] font-semibold text-sky-100"
                    >
                      Auto-Duck
                    </button>
                  )}
                </div>

                {/* EQ Presets with Live Frequency Curve SVG Previews */}
                <div className="grid grid-cols-3 gap-1.5">
                  {EQ_PRESETS.map((eq) => {
                    const active =
                      selectedClip.audio.eqBass === eq.eqBass &&
                      selectedClip.audio.eqMid === eq.eqMid &&
                      selectedClip.audio.eqTreble === eq.eqTreble;
                    const y1 = 16 - eq.eqBass * 0.8;
                    const y2 = 16 - eq.eqMid * 0.8;
                    const y3 = 16 - eq.eqTreble * 0.8;
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, (p) => ({
                            ...p,
                            audio: {
                              ...p.audio,
                              eqBass: eq.eqBass,
                              eqMid: eq.eqMid,
                              eqTreble: eq.eqTreble,
                            },
                          }))
                        }
                        className={`rounded-xl border p-1.5 backdrop-blur-md flex flex-col items-center gap-1 transition-colors ${
                          active
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                        }`}
                      >
                        <svg viewBox="0 0 60 32" className="w-full h-6">
                          <line x1="0" y1="16" x2="60" y2="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                          <path
                            d={`M 4 ${y1} Q 30 ${y2} 56 ${y3}`}
                            fill="none"
                            stroke={active ? '#34d399' : '#94a3b8'}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-[10px] font-semibold truncate w-full text-center">
                          {eq.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* LUFS & Keyframes */}
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-2">
                  <div className="grid grid-cols-4 gap-1">
                    {LUFS_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setTargetLufs(preset.lufs)}
                        className={`py-1 rounded text-[10px] font-mono-tabular font-semibold ${
                          targetLufs === preset.lufs
                            ? 'bg-amber-500 text-zinc-950'
                            : 'bg-white/[0.05] text-zinc-300'
                        }`}
                      >
                        {preset.lufs}LU
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preventClipping}
                      onChange={(e) => setPreventClipping(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>True-Peak Limiter (-0.5 dBTP)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isNormalizingAudio}
                      onClick={() =>
                        onNormalizeClipAudio(selectedClip.id, targetLufs, preventClipping)
                      }
                      className="py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/35 text-[10px] font-semibold text-amber-200"
                    >
                      Normalize Clip
                    </button>
                    <button
                      type="button"
                      disabled={isNormalizingAudio}
                      onClick={() =>
                        onNormalizeTrackAudio(selectedClip.trackId, targetLufs, preventClipping)
                      }
                      className="py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/35 text-[10px] font-semibold text-emerald-200"
                    >
                      Normalize Track
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddAudioKeyframe(selectedClip.id)}
                    className="w-full py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[10px] font-semibold text-amber-300 flex items-center justify-center gap-1"
                  >
                    <Diamond className="w-2.5 h-2.5" /> Add Volume/Pan Keyframe @ {formatShortTime(localTime)}
                  </button>
                  {(selectedClip.audioKeyframes ?? []).map((akf) => (
                    <div
                      key={akf.id}
                      className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-white/[0.04]"
                    >
                      <span className="font-mono-tabular text-zinc-300">
                        ◆ {formatShortTime(akf.time)} · {akf.volume}%
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveAudioKeyframe(selectedClip.id, akf.id)}
                        className="text-rose-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {normalizeStatusMessage && (
                    <p className="text-[10px] text-emerald-300 leading-snug">
                      {normalizeStatusMessage}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Draggable Music & SFX Library Grid */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">
                  Audio &amp; SFX Vault
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Import
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {assets
                  .filter((a) => a.kind === 'audio')
                  .map((asset) => {
                    const target = asset.audioSubType === 'sfx' ? sfxTrack : musicTrack;
                    return (
                      <div
                        key={asset.id}
                        draggable
                        onDragStart={(e) => handleAssetDragStart(e, asset)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md p-2 space-y-1.5 cursor-grab active:cursor-grabbing"
                      >
                        <div className="h-7 rounded-md bg-black/45 px-1.5 flex items-center gap-[1.5px]">
                          {(asset.waveform ?? [0.3, 0.7, 0.5, 0.9, 0.4, 0.6]).slice(0, 18).map((v, i) => (
                            <div
                              key={i}
                              style={{ height: `${Math.max(15, Math.round(v * 90))}%` }}
                              className="flex-1 bg-emerald-400/80 rounded-full"
                            />
                          ))}
                        </div>
                        <p className="text-[10.5px] font-semibold text-zinc-100 truncate">
                          {asset.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => onAddAssetToTimeline(asset, target, 'time')}
                          className="w-full py-1 rounded-md bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/35 text-[10px] font-semibold flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add ({formatShortTime(asset.duration)})
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'motion' && (
          !selectedClip ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-zinc-400">
              Select a clip on the timeline to adjust PiP layout, Mask, Transform, or Keyframes.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Live PiP & Split Screen Diagram Grid */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-200 block">
                  PiP &amp; Split Layout Grid
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {PIP_LAYOUT_CARDS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const patch = getPipPresetPatch(preset.id);
                        onUpdateClip(selectedClip.id, (p) => ({
                          ...p,
                          mask: patch.mask,
                          transform: { ...p.transform, ...patch.transform },
                        }));
                      }}
                      className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] hover:border-cyan-400/50 backdrop-blur-md p-1.5 flex flex-col items-center gap-1"
                    >
                      <div className="w-full aspect-video rounded bg-black/50 border border-white/15 relative overflow-hidden">
                        <div
                          className={`absolute ${preset.boxCls} rounded-[2px] bg-cyan-400/45 border border-cyan-300`}
                        />
                      </div>
                      <span className="text-[9.5px] font-medium text-zinc-200 whitespace-nowrap">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Frame Mask Preview Grid + Soft Edge Feathering */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1">
                    <Feather className="w-3 h-3 text-cyan-300" />
                    Frame Mask Shapes &amp; Feather
                  </span>
                  {(selectedClip.feather ?? 0) > 0 && (
                    <span className="text-[10px] font-mono-tabular text-cyan-300">
                      {selectedClip.feather}% soft edge
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MASK_PREVIEW_CARDS.map((m) => {
                    const active = (selectedClip.mask ?? 'none') === m.id;
                    const featherVal = selectedClip.feather ?? 0;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, (p) => ({ ...p, mask: m.id }))
                        }
                        className={`rounded-xl border p-1.5 backdrop-blur-md flex flex-col items-center gap-1 transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09]'
                        }`}
                      >
                        <div className="w-full aspect-video rounded bg-black/60 overflow-hidden flex items-center justify-center relative">
                          {previewSampleImage ? (
                            <img
                              src={previewSampleImage}
                              alt=""
                              style={{
                                ...m.clipStyle,
                                ...(active && featherVal > 0
                                  ? {
                                      maskImage: `radial-gradient(ellipse at center, black ${Math.max(
                                        25,
                                        90 - featherVal * 0.65
                                      )}%, transparent 100%)`,
                                      WebkitMaskImage: `radial-gradient(ellipse at center, black ${Math.max(
                                        25,
                                        90 - featherVal * 0.65
                                      )}%, transparent 100%)`,
                                    }
                                  : {}),
                              }}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              style={m.clipStyle}
                              className="w-full h-full bg-gradient-to-br from-amber-400 to-cyan-500"
                            />
                          )}
                        </div>
                        <span className="text-[9.5px] font-medium truncate w-full text-center">
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <GlassSlider
                  label="Mask & Edge Feather"
                  value={selectedClip.feather ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({ ...p, feather: v }))
                  }
                />
              </div>

              {/* Precision Timing & Transform Sliders Grid */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                <label className="rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-1 text-[10px] text-zinc-400">
                  <span>Start Time (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={selectedClip.startTime}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        startTime: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-xs font-mono-tabular text-white"
                  />
                </label>
                <label className="rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-1 text-[10px] text-zinc-400">
                  <span>Duration (s)</span>
                  <input
                    type="number"
                    min={0.3}
                    step={0.1}
                    value={selectedClip.duration}
                    onChange={(e) =>
                      onAdjustDuration(selectedClip.id, Number(e.target.value) || 0.5)
                    }
                    className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-xs font-mono-tabular text-white"
                  />
                </label>
                <GlassSlider
                  label="Scale"
                  value={Math.round(selectedClip.transform.scale * 100)}
                  min={20}
                  max={250}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, scale: v / 100 },
                    }))
                  }
                />
                <GlassSlider
                  label="Opacity"
                  value={Math.round(selectedClip.transform.opacity * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, opacity: v / 100 },
                    }))
                  }
                />
                <GlassSlider
                  label="Pos X"
                  value={Math.round(selectedClip.transform.x * 100)}
                  min={-100}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, x: v / 100 },
                    }))
                  }
                />
                <GlassSlider
                  label="Pos Y"
                  value={Math.round(selectedClip.transform.y * 100)}
                  min={-100}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, y: v / 100 },
                    }))
                  }
                />
                <GlassSlider
                  label="Rotation"
                  value={selectedClip.transform.rotation}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, rotation: v },
                    }))
                  }
                />
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-1">
                  <span className="text-[10px] text-zinc-400 block">Blend Mode</span>
                  <select
                    aria-label="Blend Mode"
                    value={selectedClip.blendMode}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        blendMode: e.target.value as BlendMode,
                      }))
                    }
                    className="w-full rounded bg-black/40 border border-white/10 px-1.5 py-1 text-[11px] text-white"
                  >
                    <option value="source-over" className="bg-[#0E131E]">Normal</option>
                    <option value="screen" className="bg-[#0E131E]">Screen</option>
                    <option value="multiply" className="bg-[#0E131E]">Multiply</option>
                    <option value="overlay" className="bg-[#0E131E]">Overlay</option>
                    <option value="lighten" className="bg-[#0E131E]">Lighten</option>
                    <option value="darken" className="bg-[#0E131E]">Darken</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, flipH: !p.transform.flipH },
                    }))
                  }
                  className={`py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 ${
                    selectedClip.transform.flipH
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  <FlipHorizontal className="w-3 h-3" /> Flip H
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...p.transform, flipV: !p.transform.flipV },
                    }))
                  }
                  className={`py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 ${
                    selectedClip.transform.flipV
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  <FlipVertical className="w-3 h-3" /> Flip V
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      transform: { ...DEFAULT_TRANSFORM },
                    }))
                  }
                  className="py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-[11px] text-zinc-300 flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              {/* Keyframes */}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-200">
                    Keyframes ({selectedClip.keyframes.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <select
                      value={keyframeEasing}
                      onChange={(e) => setKeyframeEasing(e.target.value as EasingType)}
                      aria-label="Keyframe Easing"
                      className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] text-zinc-200"
                    >
                      <option value="linear" className="bg-[#0E131E]">Linear</option>
                      <option value="easeIn" className="bg-[#0E131E]">Ease In</option>
                      <option value="easeOut" className="bg-[#0E131E]">Ease Out</option>
                      <option value="easeInOut" className="bg-[#0E131E]">In-Out</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onAddKeyframe(selectedClip.id, keyframeEasing)}
                      className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-[10px] font-semibold flex items-center gap-1"
                    >
                      <Diamond className="w-2.5 h-2.5" /> Add @ {formatShortTime(localTime)}
                    </button>
                  </div>
                </div>
                {selectedClip.keyframes.map((kf) => (
                  <div
                    key={kf.id}
                    className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-black/30"
                  >
                    <span className="font-mono-tabular text-zinc-200">
                      ◆ {formatShortTime(kf.time)} · {Math.round(kf.scale * 100)}% · {kf.easing}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveKeyframe(selectedClip.id, kf.id)}
                      className="text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {activeTab === 'speed' && (
          !selectedClip ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-zinc-400">
              Select a clip to adjust speed curve, reverse, or freeze frame.
            </div>
          ) : (
            <div className="space-y-3">
              <GlassSlider
                label="Playback Speed"
                value={selectedClip.speed}
                min={0.25}
                max={8}
                step={0.25}
                unit="x"
                onChange={(v) =>
                  onUpdateClip(selectedClip.id, (p) => ({ ...p, speed: v }))
                }
              />

              <div className="grid grid-cols-3 gap-1.5">
                {[0.25, 0.5, 1, 1.5, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (p) => ({ ...p, speed: spd }))
                    }
                    className={`py-1.5 rounded-xl border text-xs font-mono-tabular font-semibold ${
                      selectedClip.speed === spd
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-1 border-t border-white/10">
                <span className="text-[11px] font-semibold text-zinc-200 block">
                  Speed Ramp Curves (Live Preview)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SPEED_RAMP_CARDS.map((preset) => {
                    const active = selectedClip.speedRamp === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, (p) => ({ ...p, speedRamp: preset.id }))
                        }
                        className={`rounded-xl border p-2 backdrop-blur-md flex flex-col gap-1 transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09]'
                        }`}
                      >
                        <svg viewBox="0 0 60 32" className="w-full h-7 rounded bg-black/40">
                          <path
                            d={preset.svgPath}
                            fill="none"
                            stroke={active ? '#fbbf24' : '#38bdf8'}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-[10.5px] font-semibold truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({ ...p, reversed: !p.reversed }))
                  }
                  className={`min-h-[38px] rounded-xl border text-xs font-semibold ${
                    selectedClip.reversed
                      ? 'border-sky-400 bg-sky-500/25 text-sky-100'
                      : 'border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]'
                  }`}
                >
                  {selectedClip.reversed ? 'Reverse: On' : 'Reverse Clip'}
                </button>
                <button
                  type="button"
                  onClick={() => onFreezeFrame(selectedClip.id)}
                  className="min-h-[38px] rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-semibold text-zinc-200"
                >
                  Freeze Frame
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'chroma' && (
          !selectedClip ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-zinc-400">
              Select a video or image clip to configure Chroma Key backdrop removal.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-100">Chroma Key</p>
                  <p className="text-[10px] text-zinc-400">Live alpha green/blue removal</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedClip.chromaKey.enabled}
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, enabled: !p.chromaKey.enabled },
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedClip.chromaKey.enabled
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-white/10 text-zinc-200'
                  }`}
                >
                  {selectedClip.chromaKey.enabled ? 'Active' : 'Enable'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, color: '#19d819', enabled: true },
                    }))
                  }
                  className="rounded-xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] p-2 flex flex-col items-center gap-1"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#19d819] border border-white/30" />
                  <span className="text-[10px] text-emerald-300 font-medium">Green</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, color: '#0047ff', enabled: true },
                    }))
                  }
                  className="rounded-xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] p-2 flex flex-col items-center gap-1"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#0047ff] border border-white/30" />
                  <span className="text-[10px] text-sky-300 font-medium">Blue</span>
                </button>
                <label className="rounded-xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] p-2 flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    aria-label="Custom Key Color"
                    value={selectedClip.chromaKey.color}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, (p) => ({
                        ...p,
                        chromaKey: { ...p.chromaKey, color: e.target.value, enabled: true },
                      }))
                    }
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-zinc-300 font-medium">Custom</span>
                </label>
              </div>

              {onToggleEyedropper && (
                <button
                  type="button"
                  onClick={onToggleEyedropper}
                  className={`w-full min-h-[36px] rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    eyedropperActive
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                      : 'border-white/12 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.1]'
                  }`}
                >
                  <Pipette className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {eyedropperActive ? 'Tap Stage to Sample Color...' : 'Pick Screen Color'}
                  </span>
                </button>
              )}

              <div className="grid grid-cols-1 gap-2">
                <GlassSlider
                  label="Color Similarity"
                  value={selectedClip.chromaKey.similarity}
                  min={5}
                  max={95}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, similarity: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Edge Smoothness"
                  value={selectedClip.chromaKey.smoothness}
                  min={0}
                  max={80}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, smoothness: v },
                    }))
                  }
                />
                <GlassSlider
                  label="Spill Suppression"
                  value={selectedClip.chromaKey.spill}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, spill: v },
                    }))
                  }
                />
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
};
