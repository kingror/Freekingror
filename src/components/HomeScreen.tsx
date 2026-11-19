import React from 'react';
import { CalendarClock, Film, FileVideo, Plus, Trash2 } from 'lucide-react';
import {
  formatProjectDateTime,
  type SavedProjectRecord,
} from '../engine/projectStorage';
import { RornLogo } from './RornLogo';

interface HomeScreenProps {
  projects: SavedProjectRecord[];
  onCreateNew: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenFormats: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  projects,
  onCreateNew,
  onOpenProject,
  onDeleteProject,
  onOpenFormats,
}) => {
  return (
    <div
      data-testid="rorn-home-screen"
      className="min-h-[100dvh] w-full flex flex-col bg-[#070A12] text-[#F3F4F6] overflow-y-auto studio-scroll"
    >
      {/* Top Header: Left-Top Cool Animated RORN Logo + Title */}
      <header className="shrink-0 border-b border-cyan-500/15 bg-[#0B101D]/90 backdrop-blur-md px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <RornLogo size={36} animated />
          <div className="flex flex-col leading-none">
            <span className="text-xl sm:text-2xl font-bold tracking-[0.22em] rorn-wordmark-cool">
              RORN
            </span>
            <span className="text-[10px] font-medium tracking-[0.14em] text-cyan-300/70 uppercase mt-0.5">
              Studio Workspace
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFormats}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-[#101829] px-3 py-2 text-xs font-medium text-sky-100 hover:bg-[#162238] transition-colors min-h-[38px]"
          >
            <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
            <span>Formats</span>
          </button>
        </div>
      </header>

      {/* Main Home Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col gap-8">
        {/* Left-Center Hero Action Row with + NEW button */}
        <section className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#0F172A] via-[#0B1222] to-[#080D1A] p-6 sm:p-8 shadow-2xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
          />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Create &amp; Edit in 4K
              </h1>
              <p className="mt-1.5 text-sm text-slate-300">
                Start a fresh multi-track timeline or continue your recent edits right where you left off.
              </p>

              {/* Prominent + NEW Button in Left/Center Zone */}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  data-testid="home-new-project-btn"
                  onClick={onCreateNew}
                  aria-label="+ NEW Project"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 px-7 py-3.5 text-sm sm:text-base font-bold tracking-wider text-slate-950 shadow-[0_8px_30px_rgba(56,189,248,0.35)] hover:brightness-110 active:scale-[0.98] transition-all min-h-[48px]"
                >
                  <Plus className="w-5 h-5 stroke-[2.75]" aria-hidden="true" />
                  <span>NEW</span>
                </button>

                <span className="text-xs text-slate-400 font-mono-tabular">
                  {projects.length} {projects.length === 1 ? 'saved project' : 'saved projects'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Projects List */}
        <section aria-labelledby="recent-projects-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="recent-projects-heading"
              className="text-base sm:text-lg font-semibold text-white tracking-tight"
            >
              Recent Projects
            </h2>
            <span className="text-xs text-slate-400">
              Auto-saved with date, time &amp; progress
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#0C1220] p-10 text-center">
              <Film className="w-8 h-8 text-cyan-400/70 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-200">No recent projects yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Tap <strong className="text-cyan-300">+ NEW</strong> above to launch the video editor.
              </p>
            </div>
          ) : (
            <div
              data-testid="recent-projects-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {projects.map((proj) => (
                <article
                  key={proj.id}
                  data-testid={`project-card-${proj.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0D1322] hover:border-cyan-400/45 transition-all shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProject(proj.id)}
                    aria-label={`Open project ${proj.title}`}
                    className="flex flex-col text-left flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-t-xl"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-36 w-full bg-[#090E19] overflow-hidden border-b border-white/10">
                      {proj.thumbnailSrc ? (
                        <img
                          src={proj.thumbnailSrc}
                          alt={proj.title}
                          className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#080C17] text-cyan-400/50">
                          <Film className="w-8 h-8 mb-1" />
                          <span className="text-[11px] font-mono-tabular text-slate-400">
                            Empty Timeline
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="rounded-md bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono-tabular font-semibold text-cyan-300 border border-cyan-400/20">
                          {proj.aspectRatio}
                        </span>
                        <span className="rounded-md bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono-tabular text-slate-200">
                          {proj.durationSec.toFixed(1)}s
                        </span>
                      </div>
                    </div>

                    {/* Metadata + Date/Time + Saved Progress */}
                    <div className="p-4 flex flex-col gap-3 w-full">
                      <div>
                        <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {proj.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-tabular">
                          <CalendarClock className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                          <span className="truncate">{formatProjectDateTime(proj.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Saved Project Progress Bar */}
                      <div className="w-full">
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            Progress · {proj.clipCount} {proj.clipCount === 1 ? 'clip' : 'clips'}
                          </span>
                          <span className="font-mono-tabular font-semibold text-cyan-300">
                            {proj.progressPct}%
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${proj.title} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={proj.progressPct}
                          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                            style={{ width: `${proj.progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Card Footer Delete Action */}
                  <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj.id)}
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200 py-1"
                    >
                      Open in Editor →
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      aria-label={`Delete project ${proj.title}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
