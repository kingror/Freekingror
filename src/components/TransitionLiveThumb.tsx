import React from 'react';
import type { TransitionType } from '../types/editor';
import { clamp } from '../engine/timelineMath';
import { computeTransitionFrameState } from '../engine/transitionsLibrary';

interface TransitionLiveThumbProps {
  type: TransitionType;
  progress: number; // 0..1 continuous animation phase
  accent: string;
  imageA?: string;
  imageB?: string;
  compact?: boolean;
}

export const TransitionLiveThumb: React.FC<TransitionLiveThumbProps> = ({
  type,
  progress,
  accent,
  imageA,
  imageB,
  compact = false,
}) => {
  const w = 160;
  const h = 90;
  const p = clamp(progress, 0, 1);
  const state = computeTransitionFrameState(type, p, w, h);

  let clipPath = 'none';
  if (state.wipeXRatio !== null) {
    const rightInset = Math.max(0, (1 - state.wipeXRatio) * 100);
    clipPath = `inset(0 ${rightInset.toFixed(1)}% 0 0)`;
  } else if (state.wipeRightRatio !== null) {
    const leftInset = Math.max(0, (1 - state.wipeRightRatio) * 100);
    clipPath = `inset(0 0 0 ${leftInset.toFixed(1)}%)`;
  } else if (state.radialRadius !== null) {
    const pct = Math.min(115, (state.radialRadius / Math.hypot(w, h)) * 145);
    clipPath = `circle(${pct.toFixed(1)}% at 50% 50%)`;
  } else if (state.curtainOpenRatio !== null) {
    const side = Math.max(0, (1 - state.curtainOpenRatio) * 50);
    clipPath = `inset(0 ${side.toFixed(1)}% 0 ${side.toFixed(1)}%)`;
  } else if (state.verticalSplitRatio !== null) {
    const tb = Math.max(0, (1 - state.verticalSplitRatio) * 50);
    clipPath = `inset(${tb.toFixed(1)}% 0 ${tb.toFixed(1)}% 0)`;
  } else if (state.diagonalProgress !== null) {
    const d = Math.min(200, state.diagonalProgress * 200);
    clipPath = `polygon(0 0, ${d.toFixed(1)}% 0, 0 ${d.toFixed(1)}%)`;
  }

  const outTx = (state.outgoingOffsetX / w) * 100;
  const outTy = (state.outgoingOffsetY / h) * 100;
  const inTx = (state.offsetX / w) * 100;
  const inTy = (state.offsetY / h) * 100;

  // Hard cut switches cleanly at midpoint of loop so user sees A -> B
  const hardCutVisible = type !== 'none' || p >= 0.45;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-white/15 bg-black/50 ${
        compact ? 'aspect-[16/9]' : 'aspect-video'
      }`}
    >
      {/* Outgoing Frame A */}
      <div
        style={{
          transform: `translate3d(${outTx.toFixed(2)}%, ${outTy.toFixed(2)}%, 0)`,
        }}
        className="absolute inset-0 will-change-transform"
      >
        {imageA ? (
          <img
            src={imageA}
            alt=""
            draggable={false}
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500/60 via-orange-600/40 to-slate-900" />
        )}
        <span className="absolute left-1 top-1 px-1 rounded bg-black/60 text-[8px] font-mono-tabular font-bold text-amber-200 pointer-events-none">
          A
        </span>
      </div>

      {/* Incoming Frame B */}
      {hardCutVisible && (
        <div
          style={{
            opacity: state.opacity,
            clipPath,
            transform: `translate3d(${inTx.toFixed(2)}%, ${inTy.toFixed(2)}%, 0) scale(${state.scale.toFixed(
              3
            )}) rotate(${state.rotation.toFixed(1)}deg)`,
            filter: `${state.blurPx > 0.2 ? `blur(${(state.blurPx * 0.35).toFixed(1)}px) ` : ''}${
              state.glitchBoost > 10 ? `saturate(170%) contrast(120%)` : ''
            }`.trim() || undefined,
          }}
          className="absolute inset-0 will-change-transform"
        >
          {imageB ? (
            <img
              src={imageB}
              alt=""
              draggable={false}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${accent}88, #0f172a 85%)`,
              }}
            />
          )}
          <span className="absolute right-1 bottom-1 px-1 rounded bg-black/65 text-[8px] font-mono-tabular font-bold text-cyan-200 pointer-events-none">
            B
          </span>
        </div>
      )}

      {/* RGB Glitch Split Accent */}
      {state.glitchBoost > 15 && (
        <div
          style={{
            opacity: clamp(state.glitchBoost / 120, 0, 0.55),
            boxShadow: 'inset 3px 0 0 rgba(34,211,238,0.8), inset -3px 0 0 rgba(236,72,153,0.8)',
          }}
          className="absolute inset-0 pointer-events-none"
        />
      )}

      {/* Flash Overlay */}
      {state.flashAlpha > 0.02 && (
        <div
          style={{
            backgroundColor: state.flashColor,
            opacity: clamp(state.flashAlpha, 0, 1),
          }}
          className="absolute inset-0 pointer-events-none"
        />
      )}

      {/* Amber Light Leak Overlay */}
      {state.leakAlpha > 0.02 && (
        <div
          style={{
            opacity: clamp(state.leakAlpha, 0, 0.9),
            background:
              'radial-gradient(circle at 22% 30%, rgba(255,214,120,0.95), rgba(249,115,22,0.55) 45%, transparent 80%)',
            mixBlendMode: 'screen',
          }}
          className="absolute inset-0 pointer-events-none"
        />
      )}

      {/* Mini Seam Progress Bar */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/15 pointer-events-none">
        <div
          style={{ width: `${Math.round(p * 100)}%`, backgroundColor: accent }}
          className="h-full"
        />
      </div>
    </div>
  );
};
