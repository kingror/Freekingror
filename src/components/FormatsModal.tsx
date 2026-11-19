import React, { useState } from 'react';
import { CheckCircle2, Cpu, X } from 'lucide-react';
import { SUPPORTED_FORMAT_SPECS } from '../engine/formatInspector';

interface FormatsModalProps {
  open: boolean;
  onClose: () => void;
}

export const FormatsModal: React.FC<FormatsModalProps> = ({ open, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');

  if (!open) return null;

  const filtered = SUPPORTED_FORMAT_SPECS.filter((item) =>
    filter === 'all' ? true : item.category === filter
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Supported Media Formats Matrix"
    >
      <div className="w-full max-w-3xl max-h-[86vh] rounded-2xl border border-white/10 bg-[#11141C] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Universal Multi-Format Engine
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Container signature inspection & Android MediaCodec decode matrix
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Formats Modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(['all', 'video', 'audio', 'image'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === cat
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-[#191D28] text-zinc-300 hover:bg-[#222736]'
              }`}
            >
              {cat} ({cat === 'all' ? SUPPORTED_FORMAT_SPECS.length : SUPPORTED_FORMAT_SPECS.filter((s) => s.category === cat).length})
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll divide-y divide-white/5 px-5">
          {filtered.map((spec) => (
            <div
              key={spec.extension}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-xs font-semibold text-amber-400 uppercase">
                    .{spec.extension}
                  </span>
                  <span className="text-xs font-semibold text-zinc-100">{spec.container}</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Codecs: {spec.codecs} · {spec.description}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium shrink-0">
                {spec.nativeBrowserDecode ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {spec.androidHardwareSupport}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sky-400">
                    <Cpu className="w-3.5 h-3.5" />
                    {spec.androidHardwareSupport}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
