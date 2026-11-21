import type { NeonConfig, NeonMode } from '../types/editor';
import { clamp } from './timelineMath';
import type { ClipCanvasBox } from './previewGizmo';

export const DEFAULT_NEON_CONFIG: NeonConfig = {
  enabled: false,
  mode: 'doubleTube',
  color: '#22d3ee',
  secondaryColor: '#ec4899',
  intensity: 80,
  blurRadius: 24,
  borderWidth: 5,
  cornerRadius: 20,
  pulseSpeed: 1.5,
};

export interface NeonPaletteColor {
  id: string;
  name: string;
  hex: string;
}

export const NEON_COLOR_PALETTE: NeonPaletteColor[] = [
  { id: 'cyan', name: 'Cyber Cyan', hex: '#22d3ee' },
  { id: 'magenta', name: 'Hot Magenta', hex: '#ec4899' },
  { id: 'violet', name: 'Ultra Violet', hex: '#a855f7' },
  { id: 'lime', name: 'Acid Lime', hex: '#a3e635' },
  { id: 'amber', name: 'Plasma Amber', hex: '#f59e0b' },
  { id: 'crimson', name: 'Laser Red', hex: '#f43f5e' },
  { id: 'ice', name: 'Ice Electric', hex: '#38bdf8' },
  { id: 'gold', name: 'Solar Gold', hex: '#fde047' },
];

export interface NeonModeMeta {
  id: NeonMode;
  label: string;
  description: string;
}

export const NEON_MODES: NeonModeMeta[] = [
  { id: 'doubleTube', label: 'Dual Tube', description: 'Outer primary + inner accent neon tubes' },
  { id: 'frameBorder', label: 'Neon Frame', description: 'Crisp single glowing glass-tube border' },
  { id: 'edgeGlow', label: 'Edge Wash', description: 'Atmospheric inner neon rim light bleed' },
  { id: 'pulseAura', label: 'Pulse Aura', description: 'Beat-reactive expanding halo ring' },
  { id: 'cyberGrid', label: 'Cyber Grid', description: 'Sci-fi scanline & perspective wireframe glow' },
  { id: 'cornerBrackets', label: 'HUD Brackets', description: 'Futuristic glowing viewfinder corners' },
];

export interface NeonPreset {
  id: string;
  name: string;
  tag: string;
  config: NeonConfig;
}

export const NEON_PRESETS: NeonPreset[] = [
  {
    id: 'neon_cyber_dual',
    name: 'Cyberpunk Dual',
    tag: 'Cyan + Pink',
    config: {
      enabled: true,
      mode: 'doubleTube',
      color: '#22d3ee',
      secondaryColor: '#ec4899',
      intensity: 88,
      blurRadius: 28,
      borderWidth: 5,
      cornerRadius: 22,
      pulseSpeed: 1.6,
    },
  },
  {
    id: 'neon_tokyo_cyan',
    name: 'Tokyo Rain Tube',
    tag: 'Ice Cyan',
    config: {
      enabled: true,
      mode: 'frameBorder',
      color: '#22d3ee',
      secondaryColor: '#38bdf8',
      intensity: 85,
      blurRadius: 32,
      borderWidth: 6,
      cornerRadius: 16,
      pulseSpeed: 0,
    },
  },
  {
    id: 'neon_synth_pink',
    name: 'Synthwave 1984',
    tag: 'Magenta + Gold',
    config: {
      enabled: true,
      mode: 'cyberGrid',
      color: '#ec4899',
      secondaryColor: '#f59e0b',
      intensity: 84,
      blurRadius: 24,
      borderWidth: 4,
      cornerRadius: 12,
      pulseSpeed: 2.0,
    },
  },
  {
    id: 'neon_acid_rave',
    name: 'Acid Biohazard',
    tag: 'Toxic Lime',
    config: {
      enabled: true,
      mode: 'edgeGlow',
      color: '#a3e635',
      secondaryColor: '#22d3ee',
      intensity: 90,
      blurRadius: 36,
      borderWidth: 6,
      cornerRadius: 24,
      pulseSpeed: 2.8,
    },
  },
  {
    id: 'neon_hud_tactical',
    name: 'HUD Optic 2099',
    tag: 'Corner HUD',
    config: {
      enabled: true,
      mode: 'cornerBrackets',
      color: '#38bdf8',
      secondaryColor: '#fde047',
      intensity: 86,
      blurRadius: 20,
      borderWidth: 5,
      cornerRadius: 8,
      pulseSpeed: 1.2,
    },
  },
  {
    id: 'neon_ultraviolet',
    name: 'Ultraviolet Pulse',
    tag: 'Beat Aura',
    config: {
      enabled: true,
      mode: 'pulseAura',
      color: '#a855f7',
      secondaryColor: '#ec4899',
      intensity: 92,
      blurRadius: 38,
      borderWidth: 6,
      cornerRadius: 28,
      pulseSpeed: 3.2,
    },
  },
  {
    id: 'neon_laser_red',
    name: 'Laser Crimson',
    tag: 'Action Red',
    config: {
      enabled: true,
      mode: 'doubleTube',
      color: '#f43f5e',
      secondaryColor: '#f59e0b',
      intensity: 90,
      blurRadius: 28,
      borderWidth: 5,
      cornerRadius: 14,
      pulseSpeed: 2.4,
    },
  },
  {
    id: 'neon_solar_gold',
    name: 'Solar Prestige',
    tag: 'Gold Edge',
    config: {
      enabled: true,
      mode: 'edgeGlow',
      color: '#fde047',
      secondaryColor: '#f59e0b',
      intensity: 80,
      blurRadius: 34,
      borderWidth: 5,
      cornerRadius: 24,
      pulseSpeed: 0.8,
    },
  },
  {
    id: 'neon_arcade_grid',
    name: 'Tron Matrix Grid',
    tag: 'Wireframe',
    config: {
      enabled: true,
      mode: 'cyberGrid',
      color: '#22d3ee',
      secondaryColor: '#a855f7',
      intensity: 82,
      blurRadius: 22,
      borderWidth: 4,
      cornerRadius: 6,
      pulseSpeed: 1.5,
    },
  },
  {
    id: 'neon_club_strobe',
    name: 'Club Beat Halo',
    tag: 'Fast Pulse',
    config: {
      enabled: true,
      mode: 'pulseAura',
      color: '#ec4899',
      secondaryColor: '#22d3ee',
      intensity: 95,
      blurRadius: 42,
      borderWidth: 7,
      cornerRadius: 32,
      pulseSpeed: 4.2,
    },
  },
  {
    id: 'neon_cinema_hud',
    name: 'Stealth Amber HUD',
    tag: 'Amber Frame',
    config: {
      enabled: true,
      mode: 'cornerBrackets',
      color: '#f59e0b',
      secondaryColor: '#22d3ee',
      intensity: 82,
      blurRadius: 20,
      borderWidth: 4,
      cornerRadius: 10,
      pulseSpeed: 0,
    },
  },
  {
    id: 'neon_mint_ice',
    name: 'Emerald Holo',
    tag: 'Clean Tube',
    config: {
      enabled: true,
      mode: 'frameBorder',
      color: '#a3e635',
      secondaryColor: '#38bdf8',
      intensity: 78,
      blurRadius: 26,
      borderWidth: 4,
      cornerRadius: 26,
      pulseSpeed: 1.0,
    },
  },
];

export function resolveNeonConfig(neon?: Partial<NeonConfig> | null): NeonConfig {
  if (!neon) return { ...DEFAULT_NEON_CONFIG };
  return {
    enabled: Boolean(neon.enabled),
    mode: neon.mode ?? DEFAULT_NEON_CONFIG.mode,
    color: neon.color || DEFAULT_NEON_CONFIG.color,
    secondaryColor: neon.secondaryColor || DEFAULT_NEON_CONFIG.secondaryColor,
    intensity: clamp(neon.intensity ?? DEFAULT_NEON_CONFIG.intensity, 0, 100),
    blurRadius: clamp(neon.blurRadius ?? DEFAULT_NEON_CONFIG.blurRadius, 4, 64),
    borderWidth: clamp(neon.borderWidth ?? DEFAULT_NEON_CONFIG.borderWidth, 1, 24),
    cornerRadius: clamp(neon.cornerRadius ?? DEFAULT_NEON_CONFIG.cornerRadius, 0, 64),
    pulseSpeed: clamp(neon.pulseSpeed ?? DEFAULT_NEON_CONFIG.pulseSpeed, 0, 5),
  };
}

/**
 * Computes smooth oscillating neon intensity multiplier in [0.58, 1.0].
 * Returns 1 when pulseSpeed is 0 or animation is disabled.
 */
export function evaluateNeonPulseFactor(
  pulseSpeed: number,
  timeSec: number,
  animate = true
): number {
  if (!animate || pulseSpeed <= 0.01) return 1;
  const wave = 0.5 + 0.5 * Math.sin(timeSec * pulseSpeed * Math.PI * 2);
  return 0.58 + 0.42 * wave;
}

export function buildNeonPreviewStyle(neon: NeonConfig): {
  borderColor: string;
  boxShadow: string;
} {
  if (!neon.enabled) {
    return { borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'none' };
  }
  const glowPx = Math.max(6, Math.round(neon.blurRadius * 0.45));
  return {
    borderColor: neon.color,
    boxShadow: `0 0 ${glowPx}px ${neon.color}, inset 0 0 ${Math.round(glowPx * 0.65)}px ${neon.secondaryColor}`,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(34, 211, 238, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(34, 211, 238, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/**
 * Renders true hardware-accelerated Canvas 2D Neon tube lighting, edge washes,
 * dual tubes, cyber wireframes, or HUD brackets onto the clip's transformed bounding box.
 */
export function renderNeonClipEffect(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  box: ClipCanvasBox,
  rawNeon: NeonConfig | undefined,
  timeSec: number,
  shouldAnimate: boolean
): void {
  const neon = resolveNeonConfig(rawNeon);
  if (!neon.enabled || neon.intensity <= 1) return;

  const scaleFactor = canvasWidth / 1280;
  const pulse = evaluateNeonPulseFactor(neon.pulseSpeed, timeSec, shouldAnimate);
  const strength = clamp((neon.intensity / 100) * pulse, 0.05, 1);

  const margin = Math.max(6, Math.round(14 * scaleFactor));
  const w = Math.max(24, box.boxW - margin * 2);
  const h = Math.max(24, box.boxH - margin * 2);
  const radius = Math.min(neon.cornerRadius * scaleFactor, w * 0.35, h * 0.35);
  const strokeW = Math.max(1.5, neon.borderWidth * scaleFactor);
  const glowBlur = Math.max(4, neon.blurRadius * scaleFactor * (0.7 + 0.5 * strength));

  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate((box.rotationDeg * Math.PI) / 180);

  if (neon.mode === 'edgeGlow') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const edgeDepth = Math.min(w, h) * 0.22;
    const grad = ctx.createRadialGradient(
      0,
      0,
      Math.max(10, Math.min(w, h) * 0.24),
      0,
      0,
      Math.max(w, h) * 0.68
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.68, hexToRgba(neon.secondaryColor, 0.16 * strength));
    grad.addColorStop(1, hexToRgba(neon.color, 0.58 * strength));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.fill();

    // Inner bright rim glow
    ctx.shadowColor = neon.color;
    ctx.shadowBlur = glowBlur * 1.15;
    ctx.strokeStyle = hexToRgba(neon.color, 0.85 * strength);
    ctx.lineWidth = Math.max(1.5, strokeW * 0.85);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.stroke();

    // Subtle white hot filament highlight
    ctx.shadowBlur = edgeDepth * 0.12;
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.55 * strength).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, strokeW * 0.32);
    ctx.stroke();
    ctx.restore();
  } else if (neon.mode === 'doubleTube') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Outer Primary Tube
    ctx.shadowColor = neon.color;
    ctx.shadowBlur = glowBlur;
    ctx.strokeStyle = hexToRgba(neon.color, 0.92 * strength);
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.72 * strength).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, strokeW * 0.32);
    ctx.stroke();

    // Inner Secondary Tube
    const gap = Math.max(6, strokeW * 2.2);
    const iw = Math.max(12, w - gap * 2);
    const ih = Math.max(12, h - gap * 2);
    const ir = Math.max(0, radius - gap * 0.5);
    ctx.shadowColor = neon.secondaryColor;
    ctx.shadowBlur = glowBlur * 0.85;
    ctx.strokeStyle = hexToRgba(neon.secondaryColor, 0.9 * strength);
    ctx.lineWidth = Math.max(1.5, strokeW * 0.72);
    ctx.beginPath();
    ctx.roundRect(-iw / 2, -ih / 2, iw, ih, ir);
    ctx.stroke();
    ctx.restore();
  } else if (neon.mode === 'pulseAura') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const breathe = shouldAnimate && neon.pulseSpeed > 0
      ? 1 + 0.025 * Math.sin(timeSec * neon.pulseSpeed * Math.PI * 2)
      : 1;
    const aw = w * breathe;
    const ah = h * breathe;

    // Outer Halo
    ctx.shadowColor = neon.secondaryColor;
    ctx.shadowBlur = glowBlur * 1.45;
    ctx.strokeStyle = hexToRgba(neon.secondaryColor, 0.48 * strength);
    ctx.lineWidth = strokeW * 1.9;
    ctx.beginPath();
    ctx.roundRect(-aw / 2, -ah / 2, aw, ah, radius);
    ctx.stroke();

    // Core Neon Tube
    ctx.shadowColor = neon.color;
    ctx.shadowBlur = glowBlur;
    ctx.strokeStyle = hexToRgba(neon.color, 0.95 * strength);
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.stroke();

    // White filament center
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,255,255,${(0.75 * strength).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, strokeW * 0.35);
    ctx.stroke();
    ctx.restore();
  } else if (neon.mode === 'cyberGrid') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Clip inside rounded region
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.clip();

    const stepX = Math.max(36, Math.round(w / 8));
    const stepY = Math.max(28, Math.round(h / 6));
    const drift = shouldAnimate ? (timeSec * 36) % stepY : 0;

    ctx.strokeStyle = hexToRgba(neon.secondaryColor, 0.24 * strength);
    ctx.lineWidth = Math.max(1, 1.5 * scaleFactor);
    ctx.beginPath();
    for (let x = -w / 2 + stepX; x < w / 2; x += stepX) {
      ctx.moveTo(x, -h / 2);
      ctx.lineTo(x, h / 2);
    }
    for (let y = -h / 2 + drift; y < h / 2; y += stepY) {
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
    }
    ctx.stroke();
    ctx.restore();

    // Crisp Glowing Cyber Outer Border
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = neon.color;
    ctx.shadowBlur = glowBlur;
    ctx.strokeStyle = hexToRgba(neon.color, 0.92 * strength);
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.stroke();
    ctx.restore();
  } else if (neon.mode === 'cornerBrackets') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const arm = Math.min(w, h) * 0.22;
    const x0 = -w / 2;
    const x1 = w / 2;
    const y0 = -h / 2;
    const y1 = h / 2;

    const traceBrackets = () => {
      ctx.beginPath();
      // Top Left
      ctx.moveTo(x0, y0 + arm);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0 + arm, y0);
      // Top Right
      ctx.moveTo(x1 - arm, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x1, y0 + arm);
      // Bottom Right
      ctx.moveTo(x1, y1 - arm);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - arm, y1);
      // Bottom Left
      ctx.moveTo(x0 + arm, y1);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0, y1 - arm);
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = neon.color;
    ctx.shadowBlur = glowBlur * 1.1;
    ctx.strokeStyle = hexToRgba(neon.color, 0.95 * strength);
    ctx.lineWidth = strokeW * 1.15;
    traceBrackets();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,255,255,${(0.78 * strength).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, strokeW * 0.38);
    traceBrackets();
    ctx.stroke();

    // Accent crosshair tick marks
    ctx.shadowColor = neon.secondaryColor;
    ctx.shadowBlur = glowBlur * 0.7;
    ctx.strokeStyle = hexToRgba(neon.secondaryColor, 0.85 * strength);
    ctx.lineWidth = Math.max(1.5, strokeW * 0.6);
    ctx.beginPath();
    ctx.moveTo(-14 * scaleFactor, y0);
    ctx.lineTo(14 * scaleFactor, y0);
    ctx.moveTo(-14 * scaleFactor, y1);
    ctx.lineTo(14 * scaleFactor, y1);
    ctx.stroke();
    ctx.restore();
  } else {
    // frameBorder (crisp glowing neon frame)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = neon.color;
    ctx.shadowBlur = glowBlur;
    ctx.strokeStyle = hexToRgba(neon.color, 0.94 * strength);
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.72 * strength).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, strokeW * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  // Subtle canvas-wide ambient edge tint if canvas size matches full frame
  void canvasHeight;
  ctx.restore();
}
