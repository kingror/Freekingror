import React from 'react';
import {
  FileVideo,
  Redo2,
  Share,
  Undo2,
} from 'lucide-react';
import type { AspectRatio } from '../types/editor';
import { PWAInstallButton } from './PWAInstallButton';

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
}) => {
  return (
    <header className="h-[52px] shrink-0 border-b border-white/10 bg-[#0D0F14] px-3 lg:px-5 flex items-center justify-between gap-3">
      {/* Zone 1: Single-line brand mark + editable project name */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base lg:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          KineForge
        </span>
        <span className="hidden sm:inline text-zinc-600" aria-hidden="true">/</span>
        <input
          type="text"
          value={projectTitle}
          onChange={(e) => onRenameProject(e.target.value)}
          aria-label="Project Name"
          className="hidden sm:block bg-transparent text-xs lg:text-sm font-medium text-zinc-300 hover:text-white focus:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/60 rounded px-1.5 py-1 max-w-[170px] truncate"
        />
      </div>

      {/* Zone 2: Studio Controls (Aspect Ratio, Undo/Redo, Formats Matrix) */}
      <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo"
            className="min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-[34px] flex items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo"
            className="min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-[34px] flex items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 className="w-4 h-4" />
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
          className="min-h-[36px] rounded-lg border border-white/10 bg-[#151821] px-2.5 py-1 text-xs font-mono-tabular font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 whitespace-nowrap"
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
          className="hidden md:flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#151821] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[#1E2330] transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
        >
          <FileVideo className="w-3.5 h-3.5 text-sky-400" />
          <span>Formats</span>
        </button>

        <PWAInstallButton />
      </div>

      {/* Zone 3: Primary Action CTA */}
      <button
        type="button"
        onClick={onOpenExport}
        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 lg:px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 min-h-[40px] lg:min-h-[36px]"
      >
        <Share className="w-3.5 h-3.5" />
        <span>Export</span>
      </button>
    </header>
  );
};
