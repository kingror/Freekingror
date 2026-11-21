import type { TransitionType } from '../types/editor';
import { clamp } from './timelineMath';

export type TransitionCategory =
  | 'Dissolve'
  | 'Wipes'
  | 'Push & Slide'
  | 'Zoom & Spin'
  | '2026 FX';

export const TRANSITION_CATEGORIES: ('All' | TransitionCategory)[] = [
  'All',
  'Dissolve',
  'Wipes',
  'Push & Slide',
  'Zoom & Spin',
  '2026 FX',
];

export interface TransitionPresetDef {
  type: TransitionType;
  label: string;
  category: TransitionCategory;
  desc: string;
  accent: string;
  defaultDuration: number;
}

export const TRANSITION_LIBRARY: TransitionPresetDef[] = [
  { type: 'none', label: 'Hard Cut', category: 'Dissolve', desc: 'Instant frame-accurate cut', accent: '#94a3b8', defaultDuration: 0.4 },
  { type: 'crossDissolve', label: 'Cross Dissolve', category: 'Dissolve', desc: 'Smooth cinematic opacity blend A→B', accent: '#38bdf8', defaultDuration: 0.8 },
  { type: 'dipBlack', label: 'Dip to Black', category: 'Dissolve', desc: 'Fade down through dark slate', accent: '#64748b', defaultDuration: 0.7 },
  { type: 'dipWhite', label: 'Dip to White', category: 'Dissolve', desc: 'Flash transition for beat drops', accent: '#f8fafc', defaultDuration: 0.6 },
  { type: 'wipeLeft', label: 'Linear Wipe Left', category: 'Wipes', desc: 'Clean horizontal wipe reveal across cut', accent: '#38bdf8', defaultDuration: 0.7 },
  { type: 'wipeRight', label: 'Linear Wipe Right', category: 'Wipes', desc: 'Reverse horizontal wipe sweep', accent: '#34d399', defaultDuration: 0.7 },
  { type: 'radialWipe', label: 'Radial Iris Wipe', category: 'Wipes', desc: 'Circular aperture expand', accent: '#fbbf24', defaultDuration: 0.75 },
  { type: 'curtainOpen', label: 'Curtain Wipe', category: 'Wipes', desc: 'Twin center split barn-door wipe', accent: '#22d3ee', defaultDuration: 0.75 },
  { type: 'curtainClose', label: 'Vertical Split Wipe', category: 'Wipes', desc: 'Top & bottom shutter reveal', accent: '#fb7185', defaultDuration: 0.75 },
  { type: 'diagonalWipe', label: 'Diagonal Slice Wipe', category: 'Wipes', desc: '45-degree angled cinema wipe', accent: '#a855f7', defaultDuration: 0.75 },
  { type: 'pushLeft', label: 'Push Left', category: 'Push & Slide', desc: 'Clip B pushes Clip A off-screen left', accent: '#38bdf8', defaultDuration: 0.65 },
  { type: 'pushRight', label: 'Push Right', category: 'Push & Slide', desc: 'Clip B pushes Clip A off-screen right', accent: '#38bdf8', defaultDuration: 0.65 },
  { type: 'pushUp', label: 'Push Up', category: 'Push & Slide', desc: 'Clip B pushes Clip A upward', accent: '#34d399', defaultDuration: 0.65 },
  { type: 'pushDown', label: 'Push Down', category: 'Push & Slide', desc: 'Clip B pushes Clip A downward', accent: '#34d399', defaultDuration: 0.65 },
  { type: 'slideLeft', label: 'Slide Over Left', category: 'Push & Slide', desc: 'Incoming frame glides over outgoing', accent: '#60a5fa', defaultDuration: 0.6 },
  { type: 'slideRight', label: 'Slide Over Right', category: 'Push & Slide', desc: 'Incoming frame glides in from left', accent: '#60a5fa', defaultDuration: 0.6 },
  { type: 'slideUp', label: 'Slide Over Up', category: 'Push & Slide', desc: 'Vertical cover reveal upward', accent: '#2dd4bf', defaultDuration: 0.6 },
  { type: 'slideDown', label: 'Slide Over Down', category: 'Push & Slide', desc: 'Vertical drop-in cover downward', accent: '#2dd4bf', defaultDuration: 0.6 },
  { type: 'whipPan', label: 'Whip Pan', category: 'Push & Slide', desc: 'High-energy lateral whip sweep', accent: '#fbbf24', defaultDuration: 0.5 },
  { type: 'zoomIn', label: 'Punch Zoom In', category: 'Zoom & Spin', desc: 'Dynamic scale-in punch cut', accent: '#22d3ee', defaultDuration: 0.6 },
  { type: 'zoomOut', label: 'Zoom Out Drop', category: 'Zoom & Spin', desc: 'Pull-back wide reveal', accent: '#22d3ee', defaultDuration: 0.6 },
  { type: 'blurZoom', label: 'Optic Blur Zoom', category: 'Zoom & Spin', desc: 'High-speed optical zoom blur', accent: '#818cf8', defaultDuration: 0.65 },
  { type: 'bounceIn', label: 'Elastic Bounce', category: 'Zoom & Spin', desc: 'Spring overshoot snap reveal', accent: '#34d399', defaultDuration: 0.65 },
  { type: 'spin', label: '360 Spin Cut', category: 'Zoom & Spin', desc: 'Rotational whip entrance', accent: '#c084fc', defaultDuration: 0.65 },
  { type: 'kaleidoscope', label: 'Kaleido Flip', category: 'Zoom & Spin', desc: 'Mirrored twist kaleidoscope spin', accent: '#f472b6', defaultDuration: 0.7 },
  { type: 'lightLeak', label: 'Amber Light Leak', category: '2026 FX', desc: 'Golden anamorphic flare wash', accent: '#f59e0b', defaultDuration: 0.75 },
  { type: 'filmBurn', label: '35mm Film Burn', category: '2026 FX', desc: 'Warm sprocket ember burn', accent: '#f97316', defaultDuration: 0.75 },
  { type: 'shutterFlash', label: 'Shutter Flash', category: '2026 FX', desc: 'Strobe camera shutter burst', accent: '#e2e8f0', defaultDuration: 0.45 },
  { type: 'beatStrobe', label: 'Beat Strobe', category: '2026 FX', desc: 'Rhythmic contrast & scale pulse', accent: '#ec4899', defaultDuration: 0.55 },
  { type: 'prismRgb', label: 'Prism RGB Split', category: '2026 FX', desc: 'Spectral chromatic separation', accent: '#22d3ee', defaultDuration: 0.6 },
  { type: 'glitchCut', label: 'Glitch RGB Cut', category: '2026 FX', desc: 'Digital chromatic tear entrance', accent: '#a855f7', defaultDuration: 0.55 },
];

export function filterTransitions(
  category: 'All' | TransitionCategory,
  query = ''
): TransitionPresetDef[] {
  const q = query.trim().toLowerCase();
  return TRANSITION_LIBRARY.filter((t) => {
    if (category !== 'All' && t.category !== category) return false;
    if (!q) return true;
    return (
      t.label.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });
}

export interface TransitionFrameState {
  opacity: number;
  offsetX: number;
  offsetY: number;
  outgoingOffsetX: number;
  outgoingOffsetY: number;
  scale: number;
  rotation: number;
  blurPx: number;
  glitchBoost: number;
  flashAlpha: number;
  flashColor: string;
  leakAlpha: number;
  radialRadius: number | null;
  curtainOpenRatio: number | null;
  verticalSplitRatio: number | null;
  diagonalProgress: number | null;
  wipeXRatio: number | null;
  wipeRightRatio: number | null;
}

export function computeTransitionFrameState(
  type: TransitionType,
  rawProgress01: number,
  width: number,
  height: number
): TransitionFrameState {
  const p = clamp(rawProgress01, 0, 1);
  const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const state: TransitionFrameState = {
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    outgoingOffsetX: 0,
    outgoingOffsetY: 0,
    scale: 1,
    rotation: 0,
    blurPx: 0,
    glitchBoost: 0,
    flashAlpha: 0,
    flashColor: '#ffffff',
    leakAlpha: 0,
    radialRadius: null,
    curtainOpenRatio: null,
    verticalSplitRatio: null,
    diagonalProgress: null,
    wipeXRatio: null,
    wipeRightRatio: null,
  };

  if (type === 'none' || p >= 1) return state;

  switch (type) {
    case 'crossDissolve':
      state.opacity = p;
      break;
    case 'dipBlack':
      state.opacity = p;
      state.flashColor = '#000000';
      state.flashAlpha = Math.sin((1 - p) * Math.PI * 0.5) * 0.85;
      break;
    case 'dipWhite':
      state.opacity = p;
      state.flashColor = '#ffffff';
      state.flashAlpha = Math.sin((1 - p) * Math.PI * 0.5) * 0.85;
      break;
    case 'lightLeak':
      state.opacity = 0.25 + 0.75 * p;
      state.scale = 1.06 - 0.06 * p;
      state.leakAlpha = Math.sin(p * Math.PI) * 0.82;
      break;
    case 'filmBurn':
      state.opacity = 0.2 + 0.8 * p;
      state.flashColor = '#fb923c';
      state.flashAlpha = Math.sin(p * Math.PI) * 0.72;
      state.blurPx = (1 - p) * 6;
      break;
    case 'shutterFlash':
      state.flashColor = '#ffffff';
      state.flashAlpha = p < 0.35 ? 0.92 * (1 - p / 0.35) : 0;
      state.scale = 1.12 - 0.12 * p;
      break;
    case 'beatStrobe': {
      const pulse = Math.abs(Math.sin(p * Math.PI * 3));
      state.scale = 1 + pulse * 0.09 * (1 - p);
      state.flashColor = '#ec4899';
      state.flashAlpha = pulse * 0.28 * (1 - p);
      state.opacity = 0.45 + 0.55 * p;
      break;
    }
    case 'prismRgb':
      state.glitchBoost = (1 - p) * 95;
      state.scale = 1.08 - 0.08 * p;
      state.opacity = 0.3 + 0.7 * p;
      break;
    case 'glitchCut':
      state.glitchBoost = (1 - p) * 85;
      break;
    case 'pushLeft':
      state.offsetX = (1 - eased) * width;
      state.outgoingOffsetX = -eased * width;
      break;
    case 'pushRight':
      state.offsetX = -(1 - eased) * width;
      state.outgoingOffsetX = eased * width;
      break;
    case 'pushUp':
      state.offsetY = (1 - eased) * height;
      state.outgoingOffsetY = -eased * height;
      break;
    case 'pushDown':
      state.offsetY = -(1 - eased) * height;
      state.outgoingOffsetY = eased * height;
      break;
    case 'slideLeft':
      state.offsetX = (1 - Math.pow(p, 0.5)) * width;
      break;
    case 'slideRight':
      state.offsetX = -(1 - Math.pow(p, 0.5)) * width;
      break;
    case 'slideUp':
      state.offsetY = (1 - Math.pow(p, 0.5)) * height;
      break;
    case 'slideDown':
      state.offsetY = -(1 - Math.pow(p, 0.5)) * height;
      break;
    case 'whipPan':
      state.offsetX = Math.sin((1 - p) * Math.PI * 0.5) * width * 0.6;
      state.outgoingOffsetX = -Math.sin(p * Math.PI * 0.5) * width * 0.45;
      state.blurPx = (1 - p) * 10;
      break;
    case 'wipeLeft':
      state.wipeXRatio = eased;
      break;
    case 'wipeRight':
      state.wipeRightRatio = eased;
      break;
    case 'zoomIn':
      state.scale = 0.72 + 0.28 * p;
      state.opacity = p;
      break;
    case 'zoomOut':
      state.scale = 1.45 - 0.45 * p;
      state.opacity = p;
      break;
    case 'blurZoom':
      state.scale = 1.6 - 0.6 * Math.pow(p, 0.65);
      state.blurPx = (1 - p) * 14;
      state.opacity = Math.min(1, p * 1.35);
      break;
    case 'bounceIn': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const spring = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      state.scale = clamp(0.4 + 0.6 * spring, 0.35, 1.2);
      state.opacity = Math.min(1, p * 1.8);
      break;
    }
    case 'spin':
      state.rotation = (1 - p) * 180;
      state.scale = 0.55 + 0.45 * p;
      state.opacity = p;
      break;
    case 'kaleidoscope':
      state.rotation = (1 - p) * -120;
      state.scale = 0.65 + 0.35 * p;
      state.glitchBoost = (1 - p) * 45;
      state.opacity = 0.35 + 0.65 * p;
      break;
    case 'radialWipe':
      state.radialRadius = p * Math.hypot(width, height) * 0.65;
      break;
    case 'curtainOpen':
      state.curtainOpenRatio = p;
      break;
    case 'curtainClose':
      state.verticalSplitRatio = p;
      break;
    case 'diagonalWipe':
      state.diagonalProgress = p;
      break;
  }

  return state;
}
