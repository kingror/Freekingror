import type { MotionPresetConfig, MotionPresetType } from '../types/editor';
import { clamp } from './timelineMath';

export type MotionPresetCategory = 'Cinema' | 'Dynamic' | 'Rhythm';

export interface MotionPresetDef {
  id: MotionPresetType;
  name: string;
  category: MotionPresetCategory;
  description: string;
  accentColor: string;
  defaultIntensity: number;
  defaultSpeed: number;
}

export const MOTION_PRESET_CATEGORIES: ('All' | MotionPresetCategory)[] = [
  'All',
  'Cinema',
  'Dynamic',
  'Rhythm',
];

export const DEFAULT_MOTION_PRESET_CONFIG: MotionPresetConfig = {
  preset: 'none',
  intensity: 55,
  speed: 1,
};

export const MOTION_PRESET_LIBRARY: MotionPresetDef[] = [
  {
    id: 'none',
    name: 'Static Hold',
    category: 'Cinema',
    description: 'Clean locked tripod frame without automatic motion.',
    accentColor: '#94a3b8',
    defaultIntensity: 0,
    defaultSpeed: 1,
  },
  {
    id: 'kenBurnsIn',
    name: 'Ken Burns In',
    category: 'Cinema',
    description: 'Smooth documentary push-in toward frame center.',
    accentColor: '#fbbf24',
    defaultIntensity: 60,
    defaultSpeed: 1,
  },
  {
    id: 'kenBurnsOut',
    name: 'Ken Burns Out',
    category: 'Cinema',
    description: 'Slow dramatic reveal pulling back from subject.',
    accentColor: '#38bdf8',
    defaultIntensity: 60,
    defaultSpeed: 1,
  },
  {
    id: 'panLeft',
    name: 'Dolly Pan Left',
    category: 'Cinema',
    description: 'Silky horizontal tracking sweep right-to-left.',
    accentColor: '#22d3ee',
    defaultIntensity: 55,
    defaultSpeed: 1,
  },
  {
    id: 'panRight',
    name: 'Dolly Pan Right',
    category: 'Cinema',
    description: 'Silky horizontal tracking sweep left-to-right.',
    accentColor: '#a78bfa',
    defaultIntensity: 55,
    defaultSpeed: 1,
  },
  {
    id: 'handheldFloat',
    name: 'Handheld Float',
    category: 'Dynamic',
    description: 'Organic cinema gimbal breathing & micro-drift.',
    accentColor: '#34d399',
    defaultIntensity: 50,
    defaultSpeed: 1,
  },
  {
    id: 'beatPulse',
    name: 'Beat Bass Pulse',
    category: 'Rhythm',
    description: 'Rhythmic 120 BPM scale thump synced to timeline time.',
    accentColor: '#f472b6',
    defaultIntensity: 65,
    defaultSpeed: 1,
  },
  {
    id: 'whipZoom',
    name: 'Snap Whip Zoom',
    category: 'Dynamic',
    description: 'Fast opening zoom-snap settling into crisp framing.',
    accentColor: '#f97316',
    defaultIntensity: 70,
    defaultSpeed: 1.2,
  },
  {
    id: 'cinematicTilt',
    name: 'Dutch Tilt Sweep',
    category: 'Dynamic',
    description: 'Progressive subtle horizon roll & push for trailers.',
    accentColor: '#eab308',
    defaultIntensity: 55,
    defaultSpeed: 1,
  },
];

export interface MotionDelta {
  dx: number; // normalized canvas width offset
  dy: number; // normalized canvas height offset
  scaleMult: number;
  rotationDeg: number;
  opacityMult: number;
}

const IDENTITY_MOTION: MotionDelta = {
  dx: 0,
  dy: 0,
  scaleMult: 1,
  rotationDeg: 0,
  opacityMult: 1,
};

export function evaluateMotionPresetTransform(
  config: MotionPresetConfig | undefined,
  localTime: number,
  duration: number
): MotionDelta {
  if (!config || config.preset === 'none') {
    return IDENTITY_MOTION;
  }

  const strength = clamp((config.intensity ?? 55) / 100, 0, 1);
  if (strength <= 0.001) {
    return IDENTITY_MOTION;
  }

  const speed = clamp(config.speed ?? 1, 0.25, 3);
  const safeDur = Math.max(0.1, duration);
  const rawProgress = clamp(localTime / safeDur, 0, 1);
  // Smooth ease-in-out curve for linear sweeps
  const eased =
    rawProgress < 0.5
      ? 2 * rawProgress * rawProgress
      : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

  switch (config.preset) {
    case 'kenBurnsIn': {
      const zoomSpan = 0.28 * strength;
      return {
        dx: 0,
        dy: -0.015 * strength * eased,
        scaleMult: 1 + zoomSpan * eased,
        rotationDeg: 0,
        opacityMult: 1,
      };
    }
    case 'kenBurnsOut': {
      const zoomSpan = 0.28 * strength;
      return {
        dx: 0,
        dy: 0.015 * strength * (1 - eased),
        scaleMult: 1 + zoomSpan * (1 - eased),
        rotationDeg: 0,
        opacityMult: 1,
      };
    }
    case 'panLeft': {
      const overscan = 1 + 0.2 * strength;
      const panSpan = 0.14 * strength;
      return {
        dx: panSpan * (0.5 - eased),
        dy: 0,
        scaleMult: overscan,
        rotationDeg: 0,
        opacityMult: 1,
      };
    }
    case 'panRight': {
      const overscan = 1 + 0.2 * strength;
      const panSpan = 0.14 * strength;
      return {
        dx: panSpan * (eased - 0.5),
        dy: 0,
        scaleMult: overscan,
        rotationDeg: 0,
        opacityMult: 1,
      };
    }
    case 'handheldFloat': {
      const phase = localTime * speed * 2.1;
      return {
        dx: Math.sin(phase) * 0.022 * strength,
        dy: Math.cos(phase * 1.37) * 0.018 * strength,
        scaleMult: 1 + 0.06 * strength + Math.sin(phase * 0.7) * 0.015 * strength,
        rotationDeg: Math.sin(phase * 0.85) * 2.4 * strength,
        opacityMult: 1,
      };
    }
    case 'beatPulse': {
      // 2 beats/sec at speed=1 (120 BPM)
      const beatPhase = (localTime * 2 * speed) % 1;
      const envelope = Math.pow(1 - beatPhase, 3);
      return {
        dx: 0,
        dy: 0,
        scaleMult: 1 + 0.14 * strength * envelope,
        rotationDeg: Math.sin(localTime * Math.PI * speed) * 1.2 * strength * envelope,
        opacityMult: 1,
      };
    }
    case 'whipZoom': {
      const settle = clamp(localTime / clamp(0.42 / speed, 0.15, 0.9), 0, 1);
      const decay = Math.pow(1 - settle, 2.5);
      return {
        dx: 0,
        dy: 0,
        scaleMult: 1 + 0.45 * strength * decay,
        rotationDeg: -4 * strength * decay,
        opacityMult: clamp(0.35 + 0.65 * settle, 0, 1),
      };
    }
    case 'cinematicTilt': {
      const overscan = 1 + 0.16 * strength;
      return {
        dx: 0.03 * strength * (eased - 0.5),
        dy: 0,
        scaleMult: overscan + 0.08 * strength * eased,
        rotationDeg: (eased - 0.5) * 9 * strength,
        opacityMult: 1,
      };
    }
    default:
      return IDENTITY_MOTION;
  }
}

export interface MotionBlurEcho {
  offsetX: number;
  offsetY: number;
  scaleDelta: number;
  alpha: number;
}

/**
 * Formats 0..100 motion blur intensity as cinema shutter angle (0° to 360°).
 */
export function formatShutterAngleLabel(intensityPct: number): string {
  const deg = Math.round(clamp(intensityPct, 0, 100) * 3.6);
  return `${deg}° Shutter`;
}

/**
 * Computes progressive shutter-angle ghost offsets along the clip's instantaneous
 * motion trajectory (with subtle horizontal optical sweep if clip is stationary).
 */
export function computeMotionBlurTrailOffsets(params: {
  velocityPxX: number;
  velocityPxY: number;
  scaleVel: number;
  intensityPct: number;
  canvasWidth: number;
  steps?: number;
}): MotionBlurEcho[] {
  const strength = clamp(params.intensityPct / 100, 0, 1);
  if (strength <= 0.01) return [];

  const steps = clamp(Math.round(params.steps ?? 4), 2, 6);
  const mag = Math.hypot(params.velocityPxX, params.velocityPxY);
  const minSweep = Math.max(4, params.canvasWidth * 0.018) * strength;
  const dirX = mag > 0.5 ? params.velocityPxX / mag : 1;
  const dirY = mag > 0.5 ? params.velocityPxY / mag : 0;
  const travel = Math.max(minSweep, Math.min(params.canvasWidth * 0.08, mag * 0.9 * strength));

  const echoes: MotionBlurEcho[] = [];
  for (let i = 1; i <= steps; i++) {
    const frac = i / steps;
    echoes.push({
      offsetX: -dirX * travel * frac,
      offsetY: -dirY * travel * frac,
      scaleDelta: -params.scaleVel * 0.35 * strength * frac,
      alpha: Number((0.28 * strength * (1 - frac * 0.55)).toFixed(3)),
    });
  }
  return echoes;
}

