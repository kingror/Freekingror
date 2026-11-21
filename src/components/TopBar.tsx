import React from 'react';
import {
  ArrowLeft,
  Check,
  FileVideo,
  HardDrive,
  Redo2,
  Share,
  Undo2,
} from 'lucide-react';
import type { AspectRatio } from '../types/editor';
import { RornLogo } from './RornLogo';

export type AutoSaveStatus = 'saving' | 'saved';

interface TopBarProps {
  projectTitle: string;
  onRenameProject: (name: string) => void;
  aspectRatio: AspectRatio;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenFormats: () => void;
  onOpenExport: () => void;
  onBackToHome?: () => void;
  autoSaveState?: AutoSaveStatus;
  lastSavedAt?: number | null;
}

const RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:5', '21:9'];

export const TopBar: React.FC<TopBarProps> = ({
  projectTitle,
  onRenameProject,
  aspectRatio,
  onChangeAspectRatio,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenFormats,
  onOpenExport,
  onBackToHome,
  autoSaveState = 'saved',
  lastSavedAt = null,
}) => {
  const isSaving = autoSaveState === 'saving';
  const savedTimeStr = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const saveTooltip = isSaving
    ? 'Auto-saving project to internal storage...'
    : savedTimeStr
    ? `Saved to internal storage at ${savedTimeStr}`
    : 'All changes saved to internal storage';

  return (
    <header className="h-[54px] shrink-0 border-b border-white/10 bg-[#0D0F14] px-2 sm:px-3 lg:px-5 flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden">
      {/* Zone 1: Back to Home + Cool Animated RORN mark + editable project name + internal storage auto-save icon */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Back to Home Screen"
            title="Back to Home"
            className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg border border-white/10 bg-[#141824] text-cyan-200 hover:bg-[#1B2233] transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <RornLogo size={24} animated />
          <span className="text-xs sm:text-base lg:text-lg font-bold tracking-[0.08em] sm:tracking-[0.14em] whitespace-nowrap rorn-wordmark-cool">
            RORN
          </span>
        </div>
        <span className="hidden md:inline text-zinc-600 shrink-0" aria-hidden="true">/</span>
        <input
          type="text"
          value={projectTitle}
          onChange={(e) => onRenameProject(e.target.value)}
          aria-label="Project Name"
          className="hidden md:block bg-transparent text-xs lg:text-sm font-medium text-zinc-300 hover:text-white focus:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/60 rounded px-1.5 py-1 min-w-0 max-w-[160px] truncate"
        />
        <span
          role="status"
          aria-live="polite"
          aria-label={saveTooltip}
          title={saveTooltip}
          data-testid="topbar-autosave-indicator"
          data-save-state={autoSaveState}
          className={`relative inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg transition-all duration-300 shrink-0 ${
            isSaving
              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/45 shadow-[0_0_12px_rgba(52,211,153,0.45)] animate-pulse'
              : 'text-zinc-400/80 hover:text-zinc-200'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
          {isSaving ? (
            <span
              className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"
              aria-hidden="true"
            />
          ) : (
            <Check
              className="w-2.5 h-2.5 text-emerald-400/90 absolute bottom-0.5 right-0.5 sm:bottom-1 stroke-[3]"
              aria-hidden="true"
            />
          )}
        </span>
      </div>

      {/* Zone 2: Studio Controls (Dedicated Non-Overlapping Undo/Redo Group, Aspect Ratio, Formats) */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div
          role="group"
          aria-label="History controls"
          className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-white/10 bg-[#141720] p-0.5 shrink-0"
        >
          <button
            type="button"
            data-testid="topbar-undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo"
            className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-md text-zinc-200 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            data-testid="topbar-redo-btn"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo"
            className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-md text-zinc-200 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
          >
            <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <label className="sr-only" htmlFor="aspect-ratio-select">
          Canvas Aspect Ratio
        </label>
        <select
          id="aspect-ratio-select"
          value={aspectRatio}
          onChange={(e) => onChangeAspectRatio(e.target.value as AspectRatio)}
          aria-label="Canvas Aspect Ratio"
          className="h-8 sm:h-9 rounded-lg border border-white/10 bg-[#151821] px-1.5 sm:px-2 text-[11px] sm:text-xs font-mono-tabular font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 whitespace-nowrap shrink-0"
        >
          {RATIOS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onOpenFormats}
          className="hidden md:flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#151821] px-3 h-9 text-xs font-medium text-zinc-200 hover:bg-[#1E2330] transition-colors whitespace-nowrap shrink-0"
        >
          <FileVideo className="w-3.5 h-3.5 text-sky-400" />
          <span>Formats</span>
        </button>

        {/* Zone 3: Primary Action CTA */}
        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-amber-500 px-2.5 sm:px-3.5 h-8 sm:h-9 text-xs font-semibold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
