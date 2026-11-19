import React, { useRef, useState } from 'react';
import {
  Film,
  Mic,
  Music,
  Palette,
  Plus,
  Search,
  Sparkles,
  Square,
  Type,
  Upload,
  Volume2,
  Wand2,
} from 'lucide-react';
import type {
  InsertPlacement,
  LeftVaultTab,
  MediaAsset,
  TextPresetType,
  TimelineClip,
  TimelineTrack,
  TransitionType,
  VfxConfig,
} from '../types/editor';
import {
  LUT_CATEGORIES,
  LUT_PRESETS,
  VFX_LIBRARY,
  type LutCategory,
} from '../engine/colorEngine';
import { formatShortTime } from '../engine/timelineMath';

interface MediaVaultPanelProps {
  activeTab: LeftVaultTab;
  onChangeTab: (tab: LeftVaultTab) => void;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
  selectedClip: TimelineClip | null;
  onImportFiles: (files: FileList | File[]) => void;
  onAddAssetToTimeline: (
    asset: MediaAsset,
    trackId: string,
    placement?: InsertPlacement,
    startTime?: number
  ) => void;
  onApplyLut: (lutId: string) => void;
  onApplyVfx: (key: keyof VfxConfig, intensity: number) => void;
  onApplyTransition: (type: TransitionType) => void;
  onAddTextClip: (preset: TextPresetType) => void;
  onVoiceoverRecorded: (blob: Blob, durationSec: number) => void;
  onNormalizeAllAudio: (targetLufs: number) => void;
  isNormalizingAudio?: boolean;
}

const TRANSITION_OPTIONS: { type: TransitionType; label: string; desc: string }[] = [
  { type: 'none', label: 'Hard Cut', desc: 'Instant frame-accurate cut' },
  { type: 'crossDissolve', label: 'Cross Dissolve', desc: 'Smooth cinematic opacity blend' },
  { type: 'dipBlack', label: 'Dip to Black', desc: 'Fade down through dark slate' },
  { type: 'dipWhite', label: 'Dip to White', desc: 'Flash transition for beat drops' },
  { type: 'slideLeft', label: 'Slide Left', desc: 'Push incoming frame from right' },
  { type: 'slideRight', label: 'Slide Right', desc: 'Push incoming frame from left' },
  { type: 'slideUp', label: 'Slide Up', desc: 'Vertical reveal wipe upward' },
  { type: 'zoomIn', label: 'Punch Zoom In', desc: 'Dynamic scale-in punch cut' },
  { type: 'zoomOut', label: 'Zoom Out Drop', desc: 'Pull-back wide reveal' },
  { type: 'whipPan', label: 'Whip Pan', desc: 'High-energy lateral whip sweep' },
  { type: 'glitchCut', label: 'Glitch RGB Cut', desc: 'Digital chromatic tear entrance' },
  { type: 'radialWipe', label: 'Radial Iris Wipe', desc: 'Circular aperture expand' },
  { type: 'spin', label: '360 Spin Cut', desc: 'Rotational whip entrance' },
];

const TEXT_PRESETS: { preset: TextPresetType; label: string; sample: string }[] = [
  { preset: 'title', label: 'Cinema Hero Title', sample: 'CHAPTER ONE' },
  { preset: 'lowerThird', label: 'Broadcast Lower Third', sample: 'DIRECTOR CUT' },
  { preset: 'subtitle', label: 'Clean Reel Caption', sample: 'Tap to edit caption text' },
  { preset: 'kinetic', label: 'Kinetic Impact Pop', sample: 'ULTRA 60FPS' },
];

export const MediaVaultPanel: React.FC<MediaVaultPanelProps> = ({
  activeTab,
  onChangeTab,
  assets,
  tracks,
  selectedClip,
  onImportFiles,
  onAddAssetToTimeline,
  onApplyLut,
  onApplyVfx,
  onApplyTransition,
  onAddTextClip,
  onVoiceoverRecorded,
  onNormalizeAllAudio,
  isNormalizingAudio = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lutCat, setLutCat] = useState<'All' | LutCategory>('All');
  const [lutSearch, setLutSearch] = useState('');
  const [vfxCat, setVfxCat] = useState<'All' | 'Glitch' | 'Lens' | 'Cinema' | 'Retro'>('All');
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recError, setRecError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);

  const tabs: { id: LeftVaultTab; label: string; icon: React.ReactNode }[] = [
    { id: 'media', label: 'Media', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'luts', label: 'Filters', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'vfx', label: 'VFX', icon: <Wand2 className="w-3.5 h-3.5" /> },
    { id: 'transitions', label: 'Trans', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'titles', label: 'Text', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-3.5 h-3.5" /> },
  ];

  const primaryVideoTrack = tracks.find((t) => t.type === 'video')?.id ?? 'track_v1';
  const overlayTrack = tracks.find((t) => t.type === 'overlay')?.id ?? primaryVideoTrack;
  const musicTrack = tracks.find((t) => t.type === 'audio')?.id ?? 'track_a1';
  const sfxTrack =
    tracks.find((t) => t.type === 'audio' && t.role === 'sfx')?.id ?? musicTrack;

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
      if (timerRef.current) window.clearInterval(timerRef.current);
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecError('Microphone recording is unavailable in this browser context.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      startTsRef.current = performance.now();
      setRecSeconds(0);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
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

  return (
    <aside
      className="flex flex-col h-full bg-[#0D0F14] border-r border-white/10 min-h-0"
      aria-label="Media and Effects Library"
    >
      {/* 6-Tab Studio Library Strip */}
      <div className="shrink-0 border-b border-white/10 p-1.5 grid grid-cols-3 gap-1 bg-[#11141B]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[34px] flex items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors ${
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

      {/* Always-mounted universal file input */}
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-3">
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
              className="w-full rounded-xl border border-dashed border-white/20 bg-[#131720] hover:border-amber-500/60 hover:bg-[#171C28] p-3.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors min-h-[84px]"
            >
              <Upload className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-100">
                Import Video, Image Overlay or Audio
              </span>
              <span className="text-[11px] text-zinc-400">
                Drag clips to timeline or drop files here
              </span>
            </button>

            <div className="space-y-2">
              {assets
                .filter((a) => a.kind !== 'audio')
                .map((asset) => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => handleAssetDragStart(e, asset)}
                    title="Drag onto any timeline lane, or insert Front / Back / Overlay"
                    className="rounded-xl border border-white/10 bg-[#13161E] hover:border-white/20 p-2.5 space-y-2 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-16 h-10 rounded-md overflow-hidden bg-black shrink-0 border border-white/10 flex items-center justify-center">
                        {asset.kind === 'image' ? (
                          <img
                            src={asset.src}
                            alt={asset.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <Film className="w-4 h-4 text-sky-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-100 truncate">
                          {asset.name}
                        </p>
                        <p className="text-[11px] font-mono-tabular text-zinc-400 truncate">
                          {asset.formatInfo.extension.toUpperCase()} · {formatShortTime(asset.duration)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => onAddAssetToTimeline(asset, primaryVideoTrack, 'front')}
                        aria-label={`Insert ${asset.name} to Front of Main Video`}
                        className="px-1.5 py-1 rounded bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-[10px] font-semibold flex items-center justify-center gap-0.5 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" /> Front
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddAssetToTimeline(asset, primaryVideoTrack, 'back')}
                        aria-label={`Add ${asset.name} to Back of Main Video`}
                        className="px-1.5 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[10px] font-semibold flex items-center justify-center gap-0.5 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" /> Back
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddAssetToTimeline(asset, overlayTrack, 'time')}
                        aria-label={`Add ${asset.name} to Overlay`}
                        className="px-1.5 py-1 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-[10px] font-semibold flex items-center justify-center gap-0.5 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" /> V2
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}

        {activeTab === 'luts' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-zinc-200">
                Live Color Filters
              </span>
              <span
                data-testid="vault-filter-count"
                className="rounded-md bg-cyan-500/15 border border-cyan-400/25 px-2 py-0.5 text-[10px] font-mono-tabular font-semibold text-cyan-300"
              >
                {filteredLuts.length} / {LUT_PRESETS.length} Live
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={lutSearch}
                onChange={(e) => setLutSearch(e.target.value)}
                placeholder={`Search ${LUT_PRESETS.length}+ live filters...`}
                aria-label="Search live filters"
                className="w-full rounded-lg border border-white/10 bg-[#13161E] pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {LUT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLutCat(cat)}
                  className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 ${
                    lutCat === cat
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-[#161A24] text-zinc-300 hover:bg-[#1E2330]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400">
              {selectedClip
                ? `Filter Target: ${selectedClip.name}`
                : 'Select a visual clip to preview live filters in real time.'}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {filteredLuts.map((lut) => {
                const isSelected = selectedClip?.colorGrade.lutId === lut.id;
                return (
                  <button
                    key={lut.id}
                    type="button"
                    disabled={!selectedClip || selectedClip.kind === 'audio'}
                    onClick={() => onApplyLut(lut.id)}
                    className={`w-full text-left rounded-xl border p-2 flex items-center gap-2.5 transition-all disabled:opacity-40 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-white/10 bg-[#13161E] hover:bg-[#191D28]'
                    }`}
                  >
                    <div
                      style={{ background: lut.previewGradient }}
                      className="w-9 h-9 rounded-lg shrink-0 border border-white/15"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-xs font-semibold text-zinc-100 truncate">{lut.name}</p>
                        <span className="text-[9px] font-mono-tabular text-zinc-400 shrink-0">
                          {lut.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{lut.description}</p>
                    </div>
                  </button>
                );
              })}
              {filteredLuts.length === 0 && (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  No filters matched &ldquo;{lutSearch}&rdquo;.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'vfx' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(['All', 'Glitch', 'Lens', 'Cinema', 'Retro'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVfxCat(cat)}
                  className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 ${
                    vfxCat === cat
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-[#161A24] text-zinc-300 hover:bg-[#1E2330]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400">
              {selectedClip
                ? `Tap to toggle & customize intensity on ${selectedClip.name}`
                : 'Select a visual clip to apply Glitch, Mirror, Duotone, Shake, or Cinema VFX.'}
            </p>
            {filteredVfx.map((fx) => {
              const currentVal = selectedClip?.vfx?.[fx.id] ?? 0;
              const isActive = currentVal > 0;
              return (
                <button
                  key={fx.id}
                  type="button"
                  disabled={!selectedClip || selectedClip.kind === 'audio' || selectedClip.kind === 'text'}
                  onClick={() => onApplyVfx(fx.id, isActive ? 0 : fx.defaultIntensity)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors disabled:opacity-40 ${
                    isActive
                      ? 'border-amber-500 bg-amber-500/15'
                      : 'border-white/10 bg-[#13161E] hover:bg-[#191D28]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-100">{fx.name}</span>
                    <span className="text-[11px] font-mono-tabular text-amber-300">
                      {isActive ? `${currentVal}%` : 'Apply'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{fx.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'transitions' && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-400">
              {selectedClip
                ? `Entrance transition on: ${selectedClip.name}`
                : 'Select any visual clip to set its entrance transition.'}
            </p>
            {TRANSITION_OPTIONS.map((tr) => {
              const active = selectedClip?.transitionIn.type === tr.type;
              return (
                <button
                  key={tr.type}
                  type="button"
                  disabled={!selectedClip || selectedClip.kind === 'audio'}
                  onClick={() => onApplyTransition(tr.type)}
                  className={`w-full text-left rounded-xl border p-2.5 transition-colors disabled:opacity-40 ${
                    active
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-white/10 bg-[#13161E] hover:bg-[#191D28]'
                  }`}
                >
                  <p className="text-xs font-semibold text-zinc-100">{tr.label}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{tr.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'titles' && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-400">
              Tap a preset to insert an animated title on T1 at the playhead.
            </p>
            {TEXT_PRESETS.map((item) => (
              <button
                key={item.preset}
                type="button"
                onClick={() => onAddTextClip(item.preset)}
                className="w-full text-left rounded-xl border border-white/10 bg-[#13161E] hover:border-pink-400/50 hover:bg-[#191D28] p-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">{item.label}</span>
                  <Plus className="w-3.5 h-3.5 text-pink-400" />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 font-medium">{item.sample}</p>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-3">
            {/* Voiceover Recorder */}
            <div className="rounded-xl border border-white/10 bg-[#131720] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-100">Voiceover Mic</span>
                {isRecording && (
                  <span className="text-xs font-mono-tabular text-rose-400">
                    REC {recSeconds}s
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={toggleVoiceoverRecording}
                className={`w-full min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  isRecording
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/30'
                }`}
              >
                {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Stop & Add Voiceover' : 'Record Voiceover'}</span>
              </button>
              {recError && <p className="text-[11px] text-rose-400">{recError}</p>}
            </div>

            <button
              type="button"
              onClick={() => onNormalizeAllAudio(-14)}
              disabled={isNormalizingAudio}
              className="w-full rounded-xl border border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 px-3 py-2.5 text-xs font-semibold text-amber-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-amber-300" />
              <span>
                {isNormalizingAudio ? 'Measuring LUFS...' : 'Normalize All Audio (-14 LUFS)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border border-white/15 bg-[#131720] hover:bg-[#191E2A] px-3 py-2.5 text-xs font-medium text-zinc-100 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Import Music / Voice / SFX</span>
            </button>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 block">
                Music & Sound Effects Library
              </span>
              {assets
                .filter((a) => a.kind === 'audio')
                .map((asset) => {
                  const target = asset.audioSubType === 'sfx' ? sfxTrack : musicTrack;
                  return (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleAssetDragStart(e, asset)}
                      className="rounded-xl border border-white/10 bg-[#13161E] hover:border-white/20 p-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-100 truncate">{asset.name}</p>
                        <p className="text-[11px] font-mono-tabular text-zinc-400">
                          {asset.audioSubType?.toUpperCase() ?? 'AUDIO'} · {formatShortTime(asset.duration)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddAssetToTimeline(asset, target, 'time')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
