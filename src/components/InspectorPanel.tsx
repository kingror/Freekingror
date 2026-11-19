import React, { useState } from 'react';
import {
  Diamond,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  Palette,
  Pipette,
  RotateCcw,
  Sliders,
  Sparkles,
  Type,
  Volume2,
  Wand2,
} from 'lucide-react';
import type {
  BlendMode,
  ClipMaskShape,
  EasingType,
  InspectorTab,
  SpeedRampPreset,
  TextAnimationType,
  TimelineClip,
  TransitionType,
} from '../types/editor';
import {
  EQ_PRESETS,
  LUT_PRESETS,
  VFX_LIBRARY,
  computeAutoEnhanceGrade,
} from '../engine/colorEngine';
import { LUFS_PRESETS } from '../engine/audioNormalizer';
import {
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
  formatShortTime,
  getPipPresetPatch,
  type PipPresetId,
} from '../engine/timelineMath';

interface InspectorPanelProps {
  clip: TimelineClip | null;
  playhead: number;
  activeTab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
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
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-300 font-medium">{label}</span>
      <span className="font-mono-tabular text-amber-300">
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

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  clip,
  playhead,
  activeTab,
  onChangeTab,
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
}) => {
  const [targetLufs, setTargetLufs] = useState<number>(-14);
  const [preventClipping, setPreventClipping] = useState<boolean>(true);
  const [keyframeEasing, setKeyframeEasing] = useState<EasingType>('easeInOut');
  const tabs: { id: InspectorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'color', label: 'Color', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'vfx', label: 'VFX', icon: <Wand2 className="w-3.5 h-3.5" /> },
    { id: 'motion', label: 'Motion', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'speed', label: 'Speed', icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: 'chroma', label: 'Chroma', icon: <Pipette className="w-3.5 h-3.5" /> },
    { id: 'transition', label: 'Trans', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3.5 h-3.5" /> },
  ];

  if (!clip) {
    return (
      <aside
        className="flex flex-col h-full bg-[#0D0F14] border-l border-white/10 p-5 items-center justify-center text-center"
        aria-label="Clip Inspector"
      >
        <Sliders className="w-7 h-7 text-zinc-600 mb-2" />
        <p className="text-sm font-medium text-zinc-300">No Clip Selected</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
          Tap any clip on the timeline to adjust color, VFX intensity, keyframes, stereo pan, or EQ.
        </p>
      </aside>
    );
  }

  const localTime = Math.max(0, Math.min(clip.duration, playhead - clip.startTime));
  const panVal = clip.audio.pan ?? 0;
  const panLabel =
    panVal === 0 ? 'Center' : panVal < 0 ? `${Math.abs(panVal)}% L` : `${panVal}% R`;

  return (
    <aside
      className="flex flex-col h-full bg-[#0D0F14] border-l border-white/10 min-h-0"
      aria-label="Clip Inspector"
    >
      {/* Active clip header */}
      <div className="shrink-0 border-b border-white/10 px-3 py-2 bg-[#11141B] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{clip.name}</p>
          <p className="text-[11px] font-mono-tabular text-zinc-400">
            In {formatShortTime(clip.startTime)} · Dur {formatShortTime(clip.duration)}
          </p>
        </div>
      </div>

      {/* 8-Tab Inspector Grid */}
      <div className="shrink-0 border-b border-white/10 p-1.5 grid grid-cols-4 gap-1 bg-[#0F1218]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[32px] px-1.5 flex items-center justify-center gap-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto studio-scroll p-3.5 space-y-4">
        {activeTab === 'color' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-200">Stylistic Filters & LUTs</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(clip.id, (prev) => ({
                      ...prev,
                      colorGrade: computeAutoEnhanceGrade(prev.colorGrade),
                    }))
                  }
                  className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Auto Enhance
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(clip.id, (prev) => ({
                      ...prev,
                      colorGrade: { ...DEFAULT_COLOR_GRADE },
                    }))
                  }
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {LUT_PRESETS.map((lut) => (
                <button
                  key={lut.id}
                  type="button"
                  onClick={() =>
                    onUpdateClip(clip.id, (prev) => ({
                      ...prev,
                      colorGrade: { ...prev.colorGrade, lutId: lut.id },
                    }))
                  }
                  className={`px-2.5 py-2 rounded-lg border text-left text-[11px] font-medium transition-colors truncate ${
                    clip.colorGrade.lutId === lut.id
                      ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                      : 'border-white/10 bg-[#141720] text-zinc-300 hover:bg-[#1A1F2B]'
                  }`}
                >
                  {lut.name}
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-1 border-t border-white/10">
              <SliderRow
                label="Brightness"
                value={clip.colorGrade.exposure}
                min={-60}
                max={60}
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, exposure: v },
                  }))
                }
              />
              <SliderRow
                label="Contrast"
                value={clip.colorGrade.contrast}
                min={-60}
                max={80}
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, contrast: v },
                  }))
                }
              />
              <SliderRow
                label="Saturation"
                value={clip.colorGrade.saturation}
                min={-100}
                max={100}
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, saturation: v },
                  }))
                }
              />
              <SliderRow
                label="Hue Shift"
                value={clip.colorGrade.hue ?? 0}
                min={-180}
                max={180}
                unit="°"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, hue: v },
                  }))
                }
              />
              <SliderRow
                label="Temperature"
                value={clip.colorGrade.temperature}
                min={-60}
                max={60}
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, temperature: v },
                  }))
                }
              />
              <SliderRow
                label="Tint"
                value={clip.colorGrade.tint}
                min={-50}
                max={50}
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, tint: v },
                  }))
                }
              />
              <SliderRow
                label="Vignette"
                value={clip.colorGrade.vignette}
                min={0}
                max={100}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, vignette: v },
                  }))
                }
              />
              <SliderRow
                label="Clarity / Sharpness"
                value={clip.colorGrade.sharpness ?? 0}
                min={0}
                max={100}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, sharpness: v },
                  }))
                }
              />
              <SliderRow
                label="35mm Film Grain"
                value={clip.colorGrade.grain ?? 0}
                min={0}
                max={100}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    colorGrade: { ...p.colorGrade, grain: v },
                  }))
                }
              />
            </div>
          </>
        )}

        {activeTab === 'vfx' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">
                Real-Time Visual Effects
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    vfx: { ...DEFAULT_VFX },
                  }))
                }
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset VFX
              </button>
            </div>
            <div className="space-y-3">
              {VFX_LIBRARY.map((fx) => (
                <SliderRow
                  key={fx.id}
                  label={fx.name}
                  value={clip.vfx?.[fx.id] ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(clip.id, (p) => ({
                      ...p,
                      vfx: { ...(p.vfx ?? DEFAULT_VFX), [fx.id]: v },
                    }))
                  }
                />
              ))}
            </div>
          </>
        )}

        {activeTab === 'motion' && (
          <>
            {/* Precision Timing & Duration Controls */}
            <div className="rounded-xl border border-white/10 bg-[#131720] p-3 space-y-2">
              <span className="text-xs font-semibold text-zinc-200 block">
                Timing & Duration Precision
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] text-zinc-400">
                  <span>Start Time (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={clip.startTime}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        startTime: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded-lg border border-white/15 bg-[#0B0D12] px-2.5 py-1.5 text-xs font-mono-tabular text-white"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-zinc-400">
                  <span>Duration (s)</span>
                  <input
                    type="number"
                    min={0.3}
                    step={0.1}
                    value={clip.duration}
                    onChange={(e) =>
                      onAdjustDuration(clip.id, Number(e.target.value) || 0.5)
                    }
                    className="w-full rounded-lg border border-white/15 bg-[#0B0D12] px-2.5 py-1.5 text-xs font-mono-tabular text-white"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-zinc-200">Transform & Blend</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    transform: { ...DEFAULT_TRANSFORM },
                  }))
                }
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            <div className="space-y-3">
              <SliderRow
                label="Scale"
                value={Math.round(clip.transform.scale * 100)}
                min={20}
                max={250}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, scale: v / 100 },
                  }))
                }
              />
              <SliderRow
                label="Position X"
                value={Math.round(clip.transform.x * 100)}
                min={-100}
                max={100}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, x: v / 100 },
                  }))
                }
              />
              <SliderRow
                label="Position Y"
                value={Math.round(clip.transform.y * 100)}
                min={-100}
                max={100}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, y: v / 100 },
                  }))
                }
              />
              <SliderRow
                label="Rotation"
                value={clip.transform.rotation}
                min={-180}
                max={180}
                unit="°"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, rotation: v },
                  }))
                }
              />
              <SliderRow
                label="Opacity"
                value={Math.round(clip.transform.opacity * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, opacity: v / 100 },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, flipH: !p.transform.flipH },
                  }))
                }
                className={`min-h-[38px] rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${
                  clip.transform.flipH
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#141720] text-zinc-300'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transform: { ...p.transform, flipV: !p.transform.flipV },
                  }))
                }
                className={`min-h-[38px] rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${
                  clip.transform.flipV
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#141720] text-zinc-300'
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" /> Flip V
              </button>
            </div>

            {/* Frame Mask Shape */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-xs font-semibold text-zinc-200 block">Frame Mask Shape</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'none', label: 'Full Frame' },
                    { id: 'circle', label: 'Circle' },
                    { id: 'rounded', label: 'Rounded' },
                    { id: 'splitLeft', label: 'Split Left' },
                    { id: 'splitRight', label: 'Split Right' },
                    { id: 'cinema', label: '2.39:1 Cut' },
                  ] as { id: ClipMaskShape; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        mask: m.id,
                      }))
                    }
                    className={`min-h-[32px] px-2 rounded-lg border text-[11px] font-medium transition-colors ${
                      (clip.mask ?? 'none') === m.id
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-[#141720] text-zinc-300 hover:bg-[#191D28]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 1-Tap PiP & Split-Screen Presets */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-xs font-semibold text-zinc-200 block">
                PiP & Split Layout Presets
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'topLeft', label: 'TL PiP' },
                    { id: 'topRight', label: 'TR PiP' },
                    { id: 'bottomLeft', label: 'BL PiP' },
                    { id: 'bottomRight', label: 'BR PiP' },
                    { id: 'splitLeft', label: 'Half L' },
                    { id: 'splitRight', label: 'Half R' },
                    { id: 'reset', label: 'Full' },
                  ] as { id: PipPresetId; label: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const patch = getPipPresetPatch(preset.id);
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        mask: patch.mask,
                        transform: { ...p.transform, ...patch.transform },
                      }));
                    }}
                    className="min-h-[30px] px-1.5 rounded-md border border-white/10 bg-[#141720] hover:bg-[#1D2230] text-[10px] font-medium text-zinc-200 whitespace-nowrap"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <label htmlFor="blend-mode-select" className="text-xs font-medium text-zinc-300 block">
                Blend Mode
              </label>
              <select
                id="blend-mode-select"
                value={clip.blendMode}
                onChange={(e) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    blendMode: e.target.value as BlendMode,
                  }))
                }
                className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#141720] px-2.5 text-xs text-zinc-100"
              >
                <option value="source-over">Normal</option>
                <option value="screen">Screen (Light Glow)</option>
                <option value="multiply">Multiply (Deepen)</option>
                <option value="overlay">Overlay (High Contrast)</option>
                <option value="lighten">Lighten</option>
                <option value="darken">Darken</option>
              </select>
            </div>

            {/* Keyframes Section */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Video Keyframes ({clip.keyframes.length})
                </span>
                <select
                  value={keyframeEasing}
                  onChange={(e) => setKeyframeEasing(e.target.value as EasingType)}
                  aria-label="Keyframe Easing Curve"
                  className="rounded-md border border-white/10 bg-[#141720] px-1.5 py-1 text-[10px] text-zinc-300"
                >
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In-Out</option>
                </select>
                <button
                  type="button"
                  onClick={() => onAddKeyframe(clip.id, keyframeEasing)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Diamond className="w-3 h-3" /> Add @ {formatShortTime(localTime)}
                </button>
              </div>
              {clip.keyframes.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  Scrub the playhead and tap Add Keyframe to animate scale, position, rotation, or opacity.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {clip.keyframes.map((kf) => (
                    <div
                      key={kf.id}
                      className="rounded-lg border border-white/10 bg-[#141720] px-2.5 py-1.5 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono-tabular text-zinc-200">
                        ◆ {formatShortTime(kf.time)} · {Math.round(kf.scale * 100)}% · {kf.easing}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveKeyframe(clip.id, kf.id)}
                        className="text-rose-400 hover:text-rose-300 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'speed' && (
          <>
            <SliderRow
              label="Playback Speed"
              value={clip.speed}
              min={0.25}
              max={8}
              step={0.25}
              unit="x"
              onChange={(v) =>
                onUpdateClip(clip.id, (p) => ({
                  ...p,
                  speed: v,
                }))
              }
            />

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-200 block">Speed Ramp Curve</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'none', label: 'Linear Constant' },
                    { id: 'ease', label: 'Smooth Curve' },
                    { id: 'hero', label: 'Hero Slow-Mo' },
                    { id: 'bullet', label: 'Bullet Time' },
                    { id: 'montage', label: 'Montage Ramp' },
                  ] as { id: SpeedRampPreset; label: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onUpdateClip(clip.id, (p) => ({ ...p, speedRamp: preset.id }))
                    }
                    className={`px-2.5 py-2 rounded-lg border text-left text-[11px] font-medium ${
                      clip.speedRamp === preset.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                        : 'border-white/10 bg-[#141720] text-zinc-300 hover:bg-[#191D28]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => onUpdateClip(clip.id, (p) => ({ ...p, reversed: !p.reversed }))}
                className={`min-h-[40px] rounded-lg border text-xs font-medium ${
                  clip.reversed
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-[#141720] text-zinc-300'
                }`}
              >
                {clip.reversed ? 'Reverse: On' : 'Reverse Clip'}
              </button>
              <button
                type="button"
                onClick={() => onFreezeFrame(clip.id)}
                className="min-h-[40px] rounded-lg border border-white/10 bg-[#141720] hover:bg-[#1A1F2B] text-xs font-medium text-zinc-200"
              >
                Insert Freeze Frame
              </button>
            </div>
          </>
        )}

        {activeTab === 'chroma' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-100">Chroma Key (Green/Blue Screen)</p>
                <p className="text-[11px] text-zinc-400">Remove backdrop color cleanly</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={clip.chromaKey.enabled}
                onClick={() =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    chromaKey: { ...p.chromaKey, enabled: !p.chromaKey.enabled },
                  }))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  clip.chromaKey.enabled
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-white/10 text-zinc-300'
                }`}
              >
                {clip.chromaKey.enabled ? 'Active' : 'Enable'}
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <label htmlFor="chroma-color-input" className="text-xs font-medium text-zinc-300 block">
                Key Backdrop Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="chroma-color-input"
                  type="color"
                  value={clip.chromaKey.color}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, color: e.target.value, enabled: true },
                    }))
                  }
                  className="w-10 h-9 rounded cursor-pointer bg-transparent border border-white/20"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(clip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, color: '#19d819', enabled: true },
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#141720] text-[11px] text-emerald-300"
                >
                  Studio Green
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(clip.id, (p) => ({
                      ...p,
                      chromaKey: { ...p.chromaKey, color: '#0047ff', enabled: true },
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#141720] text-[11px] text-sky-300"
                >
                  Studio Blue
                </button>
              </div>
              {onToggleEyedropper && (
                <button
                  type="button"
                  onClick={onToggleEyedropper}
                  className={`w-full mt-2 min-h-[34px] rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    eyedropperActive
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-white/15 bg-[#141720] text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  <Pipette className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {eyedropperActive ? 'Tap Frame to Sample Color...' : 'Pick Screen Color (Eyedropper)'}
                  </span>
                </button>
              )}
            </div>

            <SliderRow
              label="Color Similarity"
              value={clip.chromaKey.similarity}
              min={5}
              max={95}
              unit="%"
              onChange={(v) =>
                onUpdateClip(clip.id, (p) => ({
                  ...p,
                  chromaKey: { ...p.chromaKey, similarity: v },
                }))
              }
            />
            <SliderRow
              label="Edge Smoothness"
              value={clip.chromaKey.smoothness}
              min={0}
              max={80}
              unit="%"
              onChange={(v) =>
                onUpdateClip(clip.id, (p) => ({
                  ...p,
                  chromaKey: { ...p.chromaKey, smoothness: v },
                }))
              }
            />
            <SliderRow
              label="Spill Suppression"
              value={clip.chromaKey.spill}
              min={0}
              max={100}
              unit="%"
              onChange={(v) =>
                onUpdateClip(clip.id, (p) => ({
                  ...p,
                  chromaKey: { ...p.chromaKey, spill: v },
                }))
              }
            />
          </>
        )}

        {activeTab === 'transition' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="transition-type-select" className="text-xs font-semibold text-zinc-200 block">
                Entrance Transition
              </label>
              <select
                id="transition-type-select"
                value={clip.transitionIn.type}
                onChange={(e) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    transitionIn: {
                      ...p.transitionIn,
                      type: e.target.value as TransitionType,
                    },
                  }))
                }
                className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#141720] px-2.5 text-xs text-zinc-100"
              >
                <option value="none">None (Hard Cut)</option>
                <option value="crossDissolve">Cross Dissolve</option>
                <option value="dipBlack">Dip to Black</option>
                <option value="dipWhite">Dip to White</option>
                <option value="slideLeft">Slide Left</option>
                <option value="slideRight">Slide Right</option>
                <option value="slideUp">Slide Up</option>
                <option value="zoomIn">Punch Zoom In</option>
                <option value="zoomOut">Zoom Out Drop</option>
                <option value="whipPan">Whip Pan</option>
                <option value="glitchCut">Glitch RGB Cut</option>
                <option value="radialWipe">Radial Iris Wipe</option>
                <option value="spin">360 Spin Cut</option>
              </select>
            </div>
            <SliderRow
              label="Transition Duration"
              value={clip.transitionIn.duration}
              min={0.2}
              max={2.5}
              step={0.1}
              unit="s"
              onChange={(v) =>
                onUpdateClip(clip.id, (p) => ({
                  ...p,
                  transitionIn: { ...p.transitionIn, duration: v },
                }))
              }
            />
          </>
        )}

        {activeTab === 'text' && (
          <>
            {clip.kind !== 'text' || !clip.textConfig ? (
              <p className="text-xs text-zinc-400 leading-relaxed">
                Select a Title clip on track T1 (or add one from the Text tab in the Media Vault) to customize typography, animation, and lower-third styling.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="title-text-input" className="text-xs font-medium text-zinc-300 block">
                    Headline Text
                  </label>
                  <input
                    id="title-text-input"
                    type="text"
                    value={clip.textConfig.text}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig ? { ...p.textConfig, text: e.target.value } : undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-white/15 bg-[#141720] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="subtitle-text-input" className="text-xs font-medium text-zinc-300 block">
                    Subtitle / Caption
                  </label>
                  <input
                    id="subtitle-text-input"
                    type="text"
                    value={clip.textConfig.subtitle ?? ''}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig ? { ...p.textConfig, subtitle: e.target.value } : undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-white/15 bg-[#141720] px-3 py-2 text-xs text-white"
                  />
                </div>
                <SliderRow
                  label="Font Size"
                  value={clip.textConfig.fontSize}
                  min={22}
                  max={110}
                  unit="px"
                  onChange={(v) =>
                    onUpdateClip(clip.id, (p) => ({
                      ...p,
                      textConfig: p.textConfig ? { ...p.textConfig, fontSize: v } : undefined,
                    }))
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="text-anim-select" className="text-xs font-medium text-zinc-300 block">
                    Entrance Animation
                  </label>
                  <select
                    id="text-anim-select"
                    value={clip.textConfig.animation}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig
                          ? { ...p.textConfig, animation: e.target.value as TextAnimationType }
                          : undefined,
                      }))
                    }
                    className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#141720] px-2.5 text-xs text-zinc-100"
                  >
                    <option value="none">None</option>
                    <option value="fade">Smooth Fade</option>
                    <option value="slideUp">Slide Up</option>
                    <option value="pop">Kinetic Pop</option>
                    <option value="typewriter">Typewriter Reveal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="text-font-select" className="text-xs font-medium text-zinc-300 block">
                    Font Family
                  </label>
                  <select
                    id="text-font-select"
                    value={clip.textConfig.fontFamily}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        textConfig: p.textConfig ? { ...p.textConfig, fontFamily: e.target.value } : undefined,
                      }))
                    }
                    className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#141720] px-2.5 text-xs text-zinc-100"
                  >
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans (Studio)</option>
                    <option value="JetBrains Mono">JetBrains Mono (Technical)</option>
                    <option value="Georgia">Georgia (Editorial Serif)</option>
                    <option value="Impact">Impact (Kinetic Poster)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <label className="space-y-1 text-[11px] text-zinc-400">
                    <span>Fill Color</span>
                    <input
                      type="color"
                      value={clip.textConfig.color}
                      onChange={(e) =>
                        onUpdateClip(clip.id, (p) => ({
                          ...p,
                          textConfig: p.textConfig ? { ...p.textConfig, color: e.target.value } : undefined,
                        }))
                      }
                      className="w-full h-9 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] text-zinc-400">
                    <span>Outline</span>
                    <input
                      type="color"
                      value={clip.textConfig.strokeColor}
                      onChange={(e) =>
                        onUpdateClip(clip.id, (p) => ({
                          ...p,
                          textConfig: p.textConfig
                            ? { ...p.textConfig, strokeColor: e.target.value }
                            : undefined,
                        }))
                      }
                      className="w-full h-9 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] text-zinc-400">
                    <span>Box Fill</span>
                    <input
                      type="color"
                      value={clip.textConfig.bgColor}
                      onChange={(e) =>
                        onUpdateClip(clip.id, (p) => ({
                          ...p,
                          textConfig: p.textConfig ? { ...p.textConfig, bgColor: e.target.value } : undefined,
                        }))
                      }
                      className="w-full h-9 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                  </label>
                </div>

                <SliderRow
                  label="Backdrop Opacity"
                  value={Math.round(clip.textConfig.bgOpacity * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    onUpdateClip(clip.id, (p) => ({
                      ...p,
                      textConfig: p.textConfig ? { ...p.textConfig, bgOpacity: v / 100 } : undefined,
                    }))
                  }
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'audio' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Audio Gain & Stereo Pan</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, muted: !p.audio.muted },
                  }))
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  clip.audio.muted ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-zinc-200'
                }`}
              >
                {clip.audio.muted ? 'Muted' : 'Active'}
              </button>
            </div>
            <SliderRow
              label="Clip Volume"
              value={clip.audio.volume}
              min={0}
              max={500}
              unit="%"
              onChange={(v) =>
                onUpdateClip(clip.id, (p) => ({
                  ...p,
                  audio: { ...p.audio, volume: v },
                }))
              }
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium">Stereo Panning</span>
                <span className="font-mono-tabular text-emerald-300">{panLabel}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={5}
                value={panVal}
                aria-label="Stereo Panning"
                onChange={(e) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, pan: Number(e.target.value) },
                  }))
                }
                className="w-full studio-slider"
              />
            </div>

            {/* LUFS Audio Normalization Tool */}
            <div className="rounded-xl border border-white/10 bg-[#131720] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-100">
                  Normalize Audio (LUFS)
                </span>
                <span className="text-[11px] font-mono-tabular text-amber-300">
                  Target {targetLufs} LUFS
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {LUFS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setTargetLufs(preset.lufs)}
                    title={preset.desc}
                    className={`py-1.5 px-1 rounded-md text-[10px] font-mono-tabular font-semibold transition-colors whitespace-nowrap ${
                      targetLufs === preset.lufs
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-[#0B0D12] text-zinc-300 border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {preset.lufs} LU
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Custom Target Level</span>
                  <span className="font-mono-tabular text-zinc-200">{targetLufs} LUFS</span>
                </div>
                <input
                  type="range"
                  min={-24}
                  max={-9}
                  step={1}
                  value={targetLufs}
                  aria-label="Target LUFS Level"
                  onChange={(e) => setTargetLufs(Number(e.target.value))}
                  className="w-full studio-slider"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preventClipping}
                  onChange={(e) => setPreventClipping(e.target.checked)}
                  className="rounded border-white/20 bg-[#0B0D12] accent-amber-500"
                />
                <span>True-Peak Limiter (-0.5 dBTP ceiling)</span>
              </label>

              {clip.audio.measuredLufs !== undefined && (
                <p className="text-[11px] font-mono-tabular text-zinc-400">
                  In {clip.audio.measuredLufs} LUFS · Peak {clip.audio.peakDb ?? '--'} dBFS · Set{' '}
                  {clip.audio.targetLufs ?? targetLufs} LUFS
                </p>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isNormalizingAudio}
                  onClick={() => onNormalizeClipAudio(clip.id, targetLufs, preventClipping)}
                  className="min-h-[34px] px-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 text-[11px] font-semibold whitespace-nowrap"
                >
                  {isNormalizingAudio ? 'Analyzing...' : 'Normalize Clip'}
                </button>
                <button
                  type="button"
                  disabled={isNormalizingAudio}
                  onClick={() => onNormalizeTrackAudio(clip.trackId, targetLufs, preventClipping)}
                  className="min-h-[34px] px-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 text-[11px] font-semibold whitespace-nowrap"
                >
                  Normalize Track
                </button>
              </div>

              {normalizeStatusMessage && (
                <p className="text-[11px] text-emerald-300 leading-snug">
                  {normalizeStatusMessage}
                </p>
              )}
            </div>

            {/* Audio Keyframes & Auto-Ducking */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Audio Keyframes ({(clip.audioKeyframes ?? []).length})
                </span>
                <button
                  type="button"
                  onClick={() => onAddAudioKeyframe(clip.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <Diamond className="w-3 h-3" /> Key @ {formatShortTime(localTime)}
                </button>
              </div>
              {onAutoDuckClip && (
                <button
                  type="button"
                  onClick={() => onAutoDuckClip(clip.id)}
                  className="w-full min-h-[34px] rounded-lg border border-sky-500/35 bg-sky-500/15 hover:bg-sky-500/25 text-[11px] font-semibold text-sky-200 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Volume2 className="w-3.5 h-3.5 text-sky-300" />
                  <span>Auto-Duck Under Voice & SFX</span>
                </button>
              )}
              {(clip.audioKeyframes ?? []).length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  Add audio keyframes to automate volume ducking & L-to-R stereo panning over time.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(clip.audioKeyframes ?? []).map((akf) => (
                    <div
                      key={akf.id}
                      className="rounded-lg border border-white/10 bg-[#141720] px-2.5 py-1.5 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono-tabular text-zinc-200">
                        ◆ {formatShortTime(akf.time)} · {akf.volume}% · Pan {akf.pan}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveAudioKeyframe(clip.id, akf.id)}
                        className="text-rose-400 hover:text-rose-300 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <SliderRow
                label="Fade In"
                value={clip.audio.fadeIn}
                min={0}
                max={3}
                step={0.1}
                unit="s"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, fadeIn: v },
                  }))
                }
              />
              <SliderRow
                label="Fade Out"
                value={clip.audio.fadeOut}
                min={0}
                max={3}
                step={0.1}
                unit="s"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, fadeOut: v },
                  }))
                }
              />
            </div>

            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">3-Band Parametric EQ</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {EQ_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onUpdateClip(clip.id, (p) => ({
                        ...p,
                        audio: {
                          ...p.audio,
                          eqBass: preset.eqBass,
                          eqMid: preset.eqMid,
                          eqTreble: preset.eqTreble,
                        },
                      }))
                    }
                    className="px-2 py-1 rounded-md border border-white/10 bg-[#141720] hover:bg-amber-500/20 hover:border-amber-500/40 text-[10px] font-medium text-zinc-200 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <SliderRow
                label="Bass (120Hz)"
                value={clip.audio.eqBass}
                min={-12}
                max={12}
                unit=" dB"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, eqBass: v },
                  }))
                }
              />
              <SliderRow
                label="Midrange (1kHz)"
                value={clip.audio.eqMid}
                min={-12}
                max={12}
                unit=" dB"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, eqMid: v },
                  }))
                }
              />
              <SliderRow
                label="Treble (6kHz)"
                value={clip.audio.eqTreble}
                min={-12}
                max={12}
                unit=" dB"
                onChange={(v) =>
                  onUpdateClip(clip.id, (p) => ({
                    ...p,
                    audio: { ...p.audio, eqTreble: v },
                  }))
                }
              />
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
