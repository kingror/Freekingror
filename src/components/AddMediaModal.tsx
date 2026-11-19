import React, { useRef, useState } from 'react';
import { Film, Layers, Music, Plus, Upload, X } from 'lucide-react';
import type { InsertPlacement, MediaAsset, TimelineTrack } from '../types/editor';
import { formatShortTime } from '../engine/timelineMath';

interface AddMediaModalProps {
  open: boolean;
  mode: 'video' | 'audio';
  assets: MediaAsset[];
  tracks: TimelineTrack[];
  playhead: number;
  onClose: () => void;
  onImportToTarget: (params: {
    files: FileList | File[];
    destinationTrackId: string | 'new';
    placement: InsertPlacement;
    kind: 'video' | 'audio';
  }) => void;
  onAddExistingToTarget: (params: {
    asset: MediaAsset;
    destinationTrackId: string | 'new';
    placement: InsertPlacement;
    kind: 'video' | 'audio';
  }) => void;
  onCreateEmptyTrackOnly: (kind: 'video' | 'audio') => void;
}

export const AddMediaModal: React.FC<AddMediaModalProps> = ({
  open,
  mode,
  assets,
  tracks,
  playhead,
  onClose,
  onImportToTarget,
  onAddExistingToTarget,
  onCreateEmptyTrackOnly,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compatibleTracks = tracks.filter((t) =>
    mode === 'video' ? t.type === 'video' || t.type === 'overlay' : t.type === 'audio'
  );
  const defaultTrackId =
    compatibleTracks.find((t) => (mode === 'video' ? t.type === 'overlay' : t.type === 'audio'))?.id ??
    compatibleTracks[0]?.id ??
    'new';

  const [selectedTarget, setSelectedTarget] = useState<string | 'new'>(defaultTrackId);
  const [placement, setPlacement] = useState<InsertPlacement>(
    mode === 'video' ? 'back' : 'time'
  );

  // Sync default target if modal re-opens cleanly
  const effectiveTarget =
    selectedTarget === 'new' || compatibleTracks.some((t) => t.id === selectedTarget)
      ? selectedTarget
      : defaultTrackId;

  if (!open) return null;

  const matchingAssets = assets.filter((a) =>
    mode === 'video' ? a.kind === 'video' || a.kind === 'image' : a.kind === 'audio'
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'video' ? 'Add Video or Photo to Timeline' : 'Add Audio to Timeline'}
      data-testid="add-media-modal"
    >
      <div className="w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-white/10 bg-[#11141C] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {mode === 'video' ? (
              <Film className="w-5 h-5 text-violet-400 shrink-0" />
            ) : (
              <Music className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">
                {mode === 'video' ? 'Add Video or Photo Layer' : 'Add Audio, Music or SFX'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Choose Main Timeline, Sub-Video layer, or create a separate track
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add Media Dialog"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          data-testid="add-media-file-input"
          accept={
            mode === 'video'
              ? 'video/*,image/*,.mkv,.avi,.flv,.mov,.wmv,.3gp,.ts,.mts,.m4v,.ogv,.webm,.mp4,.gif'
              : 'audio/*,.mp3,.wav,.aac,.flac,.ogg,.m4a,.opus'
          }
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportToTarget({
                files: e.target.files,
                destinationTrackId: effectiveTarget,
                placement,
                kind: mode,
              });
              e.target.value = '';
              onClose();
            }
          }}
          className="hidden"
        />

        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-4">
          {/* Step 1: Destination Timeline Picker */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              1. Destination Timeline Track
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {compatibleTracks.map((tr) => {
                const active = effectiveTarget === tr.id;
                const subtitle =
                  tr.type === 'video'
                    ? 'Primary storyline'
                    : tr.type === 'overlay'
                    ? 'Sub-Video / PiP layer'
                    : tr.role === 'sfx'
                    ? 'Sound effects lane'
                    : 'Music / Audio lane';
                return (
                  <button
                    key={tr.id}
                    type="button"
                    data-testid={`dest-track-${tr.id}`}
                    onClick={() => setSelectedTarget(tr.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                        : 'border-white/10 bg-[#151923] text-zinc-300 hover:bg-[#1B202C]'
                    }`}
                  >
                    <p className="text-xs font-semibold truncate">{tr.label}</p>
                    <p className="text-[10px] text-zinc-400">{subtitle}</p>
                  </button>
                );
              })}

              <button
                type="button"
                data-testid="dest-track-new"
                onClick={() => setSelectedTarget('new')}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  effectiveTarget === 'new'
                    ? 'border-violet-400 bg-violet-500/20 text-violet-100'
                    : 'border-dashed border-white/25 bg-[#151923] text-zinc-200 hover:border-violet-400/60'
                }`}
              >
                <p className="text-xs font-semibold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-violet-300" />
                  {mode === 'video' ? 'New Separate Sub-Video Track' : 'New Separate Audio Track'}
                </p>
                <p className="text-[10px] text-zinc-400">
                  Creates V{compatibleTracks.length + 1} / A{compatibleTracks.length + 1} and places clip there
                </p>
              </button>
            </div>
          </div>

          {/* Step 2: Placement Timing */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-zinc-200 block">
              2. Position on Selected Timeline
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'time', label: `At Playhead (${formatShortTime(playhead)})` },
                  { id: 'back', label: 'Append End' },
                  { id: 'front', label: 'Insert Start' },
                ] as { id: InsertPlacement; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlacement(opt.id)}
                  className={`min-h-[34px] px-2 rounded-lg border text-[11px] font-medium transition-colors truncate ${
                    placement === opt.id
                      ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                      : 'border-white/10 bg-[#151923] text-zinc-300 hover:bg-[#1B202C]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3A: Upload from Device */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-cyan-400/45 bg-cyan-500/10 hover:bg-cyan-500/20 p-3.5 flex items-center justify-center gap-2.5 text-cyan-100 transition-colors"
          >
            <Upload className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-xs font-semibold">
              {mode === 'video'
                ? 'Choose Video / Photo File from Device'
                : 'Choose Audio / Music File from Device'}
            </span>
          </button>

          {/* Step 3B: Pick from Project Library */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-300 block">
              Or Add from Studio Library ({matchingAssets.length})
            </span>
            <div className="space-y-1.5 max-h-[210px] overflow-y-auto studio-scroll pr-1">
              {matchingAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  data-testid={`modal-add-asset-${asset.id}`}
                  onClick={() => {
                    onAddExistingToTarget({
                      asset,
                      destinationTrackId: effectiveTarget,
                      placement,
                      kind: mode,
                    });
                    onClose();
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#151923] hover:border-amber-400/50 hover:bg-[#1C2230] p-2.5 flex items-center justify-between gap-2.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-12 h-8 rounded bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {asset.kind === 'image' ? (
                        <img
                          src={asset.src}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : asset.kind === 'video' ? (
                        <Film className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Music className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{asset.name}</p>
                      <p className="text-[10px] font-mono-tabular text-zinc-400">
                        {asset.formatInfo.extension.toUpperCase()} · {formatShortTime(asset.duration)}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-zinc-950 text-[11px] font-bold shrink-0 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-white/10 bg-[#0D1017] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onCreateEmptyTrackOnly(mode);
              onClose();
            }}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline"
          >
            Add Empty {mode === 'video' ? 'Sub-Video' : 'Audio'} Track Only
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
