import React, { useState } from 'react';
import type { HistogramData } from '../engine/colorEngine';

interface HistogramScopeProps {
  data: HistogramData | null;
}

function buildPolylinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const step = width / Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - v * (height - 4) - 2).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
}

export const HistogramScope: React.FC<HistogramScopeProps> = ({ data }) => {
  const [mode, setMode] = useState<'rgb' | 'luma'>('rgb');

  if (!data) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0D0F14]/90 p-2 text-[11px] text-zinc-400">
        Sampling RGB scope...
      </div>
    );
  }

  const w = 160;
  const h = 56;

  return (
    <div
      className="rounded-xl border border-white/10 bg-[#0B0D12]/90 backdrop-blur-md p-2.5 shadow-xl"
      aria-label="Live Video Scopes"
    >
      <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono-tabular text-zinc-400">
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'rgb' ? 'luma' : 'rgb'))}
          className="text-zinc-200 hover:text-amber-300 font-semibold transition-colors"
          title="Switch between RGB Parade and Luma Scope"
        >
          {mode === 'rgb' ? 'RGB Parade' : 'Luma Scope'}
        </button>
        <span>0 — 255</span>
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible">
        <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1={w * 0.5} y1="0" x2={w * 0.5} y2={h} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {mode === 'rgb' ? (
          <>
            <polyline
              fill="none"
              stroke="rgba(248, 113, 113, 0.85)"
              strokeWidth="1.5"
              points={buildPolylinePoints(data.r, w, h)}
            />
            <polyline
              fill="none"
              stroke="rgba(74, 222, 128, 0.85)"
              strokeWidth="1.5"
              points={buildPolylinePoints(data.g, w, h)}
            />
            <polyline
              fill="none"
              stroke="rgba(96, 165, 250, 0.85)"
              strokeWidth="1.5"
              points={buildPolylinePoints(data.b, w, h)}
            />
          </>
        ) : (
          <polyline
            fill="rgba(245, 158, 11, 0.18)"
            stroke="rgba(251, 191, 36, 0.95)"
            strokeWidth="1.8"
            points={`0,${h} ${buildPolylinePoints(data.luma, w, h)} ${w},${h}`}
          />
        )}
      </svg>
    </div>
  );
};

