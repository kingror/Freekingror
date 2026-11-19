import type { ChromaKeyConfig, ColorGrade, VfxConfig } from '../types/editor';
import { clamp } from './timelineMath';

export interface LutPreset {
  id: string;
  name: string;
  category: 'Cinema' | 'Film' | 'Vintage' | 'Mono';
  description: string;
  previewGradient: string;
  exposureBias: number;
  contrastBias: number;
  saturationBias: number;
  hueBias: number;
  temperatureBias: number;
  tintBias: number;
  shadowRgb: [number, number, number];
  highlightRgb: [number, number, number];
}

export interface VfxPresetDef {
  id: keyof VfxConfig;
  name: string;
  category: 'Glitch' | 'Lens' | 'Retro' | 'Cinema';
  description: string;
  defaultIntensity: number;
}

export const VFX_LIBRARY: VfxPresetDef[] = [
  {
    id: 'glitch',
    name: 'RGB Glitch Split',
    category: 'Glitch',
    description: 'Animated chromatic channel offset & digital tear slices.',
    defaultIntensity: 55,
  },
  {
    id: 'blur',
    name: 'Gaussian Dream Blur',
    category: 'Lens',
    description: 'Smooth optical defocus for backgrounds & transitions.',
    defaultIntensity: 40,
  },
  {
    id: 'distortion',
    name: 'Wave & Lens Warp',
    category: 'Lens',
    description: 'Fluid sinusoidal ripple & optical barrel distortion.',
    defaultIntensity: 48,
  },
  {
    id: 'bloom',
    name: 'Anamorphic Bloom',
    category: 'Cinema',
    description: 'Silky highlight halation & atmospheric light bleed.',
    defaultIntensity: 50,
  },
  {
    id: 'pixelate',
    name: '8-Bit Mosaic',
    category: 'Glitch',
    description: 'Crisp retro pixel mosaic or privacy censor grid.',
    defaultIntensity: 45,
  },
  {
    id: 'vhsScanlines',
    name: 'Analog VHS CRT',
    category: 'Retro',
    description: '90s camcorder phosphor scanlines & analog jitter.',
    defaultIntensity: 60,
  },
  {
    id: 'cinemaBars',
    name: '2.39:1 Cinema Scope',
    category: 'Cinema',
    description: 'Anamorphic widescreen matte framing bars.',
    defaultIntensity: 75,
  },
  {
    id: 'mirror',
    name: 'Mirror Kaleidoscope',
    category: 'Lens',
    description: 'Symmetrical dual & 4-quadrant prism reflection.',
    defaultIntensity: 60,
  },
  {
    id: 'duotone',
    name: 'Cyber Duotone',
    category: 'Cinema',
    description: 'Deep cobalt shadow & electric magenta highlight map.',
    defaultIntensity: 65,
  },
  {
    id: 'shake',
    name: 'Camera Impact Shake',
    category: 'Glitch',
    description: 'Handheld action tremor & beat-drop micro-jitter.',
    defaultIntensity: 45,
  },
];

export const LUT_PRESETS: LutPreset[] = [
  {
    id: 'natural',
    name: 'Rec.709 Natural',
    category: 'Cinema',
    description: 'Clean broadcast standard curve with true skin tones.',
    previewGradient: 'linear-gradient(135deg, #334155, #94a3b8)',
    exposureBias: 0,
    contrastBias: 4,
    saturationBias: 0,
    hueBias: 0,
    temperatureBias: 0,
    tintBias: 0,
    shadowRgb: [0, 0, 0],
    highlightRgb: [0, 0, 0],
  },
  {
    id: 'tealOrange',
    name: 'Teal & Orange',
    category: 'Cinema',
    description: 'Hollywood blockbuster warm skin highlights & cool shadows.',
    previewGradient: 'linear-gradient(135deg, #0f766e, #f59e0b)',
    exposureBias: 2,
    contrastBias: 18,
    saturationBias: 14,
    hueBias: 0,
    temperatureBias: 8,
    tintBias: -4,
    shadowRgb: [-14, 10, 22],
    highlightRgb: [22, 8, -12],
  },
  {
    id: 'kodak2383',
    name: 'Kodak 2383 Print',
    category: 'Film',
    description: 'Rich 35mm print density, creamy highlights & deep blacks.',
    previewGradient: 'linear-gradient(135deg, #78350f, #fbbf24)',
    exposureBias: -3,
    contrastBias: 22,
    saturationBias: 8,
    hueBias: 0,
    temperatureBias: 12,
    tintBias: 4,
    shadowRgb: [8, 2, -8],
    highlightRgb: [16, 10, -4],
  },
  {
    id: 'fujiEterna',
    name: 'Fuji Eterna Soft',
    category: 'Film',
    description: 'Muted pastel midtones with lifted documentary shadows.',
    previewGradient: 'linear-gradient(135deg, #1e3a5f, #93c5fd)',
    exposureBias: 4,
    contrastBias: -6,
    saturationBias: -14,
    hueBias: 0,
    temperatureBias: -8,
    tintBias: 6,
    shadowRgb: [6, 12, 16],
    highlightRgb: [4, 4, -2],
  },
  {
    id: 'vintage1977',
    name: 'Vintage 1977 Sepia',
    category: 'Vintage',
    description: 'Faded analog print warmth with soft matte highlights.',
    previewGradient: 'linear-gradient(135deg, #713f12, #fde68a)',
    exposureBias: 5,
    contrastBias: -8,
    saturationBias: -24,
    hueBias: -4,
    temperatureBias: 36,
    tintBias: 8,
    shadowRgb: [18, 10, -8],
    highlightRgb: [20, 14, -10],
  },
  {
    id: 'polaroidFade',
    name: 'Instant Matte Film',
    category: 'Vintage',
    description: 'Nostalgic emerald shadow cast & creamy retro fade.',
    previewGradient: 'linear-gradient(135deg, #14532d, #fef08a)',
    exposureBias: 6,
    contrastBias: -12,
    saturationBias: -16,
    hueBias: 4,
    temperatureBias: 14,
    tintBias: -8,
    shadowRgb: [-4, 14, 10],
    highlightRgb: [18, 12, -6],
  },
  {
    id: 'goldenHour',
    name: 'Amber Sunflare',
    category: 'Cinema',
    description: 'Warm sunset bloom ideal for travel & outdoor reels.',
    previewGradient: 'linear-gradient(135deg, #9a3412, #fcd34d)',
    exposureBias: 6,
    contrastBias: 10,
    saturationBias: 18,
    hueBias: 0,
    temperatureBias: 28,
    tintBias: 4,
    shadowRgb: [10, -2, -12],
    highlightRgb: [24, 14, -14],
  },
  {
    id: 'cyberSteel',
    name: 'Night Steel',
    category: 'Cinema',
    description: 'Crisp urban midnight blues with sharp specular contrast.',
    previewGradient: 'linear-gradient(135deg, #0f172a, #38bdf8)',
    exposureBias: -4,
    contrastBias: 26,
    saturationBias: 6,
    hueBias: -6,
    temperatureBias: -24,
    tintBias: -6,
    shadowRgb: [-10, 6, 24],
    highlightRgb: [-4, 10, 18],
  },
  {
    id: 'bleachBypass',
    name: 'Bleach Bypass',
    category: 'Film',
    description: 'Gritty silver-retention contrast with desaturated grit.',
    previewGradient: 'linear-gradient(135deg, #27272a, #a1a1aa)',
    exposureBias: -2,
    contrastBias: 36,
    saturationBias: -46,
    hueBias: 0,
    temperatureBias: -6,
    tintBias: 0,
    shadowRgb: [-6, -6, -4],
    highlightRgb: [8, 8, 6],
  },
  {
    id: 'noir',
    name: 'Silver Noir B&W',
    category: 'Mono',
    description: 'High-drama monochrome silver halide print.',
    previewGradient: 'linear-gradient(135deg, #09090b, #e4e4e7)',
    exposureBias: 0,
    contrastBias: 30,
    saturationBias: -100,
    hueBias: 0,
    temperatureBias: 0,
    tintBias: 0,
    shadowRgb: [0, 0, 0],
    highlightRgb: [4, 4, 4],
  },
  {
    id: 'leicaMono',
    name: 'Street Leica Mono',
    category: 'Mono',
    description: 'Smooth editorial grayscale with rich midtone separation.',
    previewGradient: 'linear-gradient(135deg, #18181b, #d4d4d8)',
    exposureBias: 4,
    contrastBias: 16,
    saturationBias: -100,
    hueBias: 0,
    temperatureBias: 0,
    tintBias: 0,
    shadowRgb: [2, 2, 2],
    highlightRgb: [0, 0, 0],
  },
];

export function getLutPreset(lutId: string): LutPreset {
  return LUT_PRESETS.find((l) => l.id === lutId) ?? LUT_PRESETS[0];
}

export interface EqPresetDef {
  id: 'flat' | 'voiceClarity' | 'cinemaBass' | 'lofiRadio' | 'podcast';
  name: string;
  eqBass: number;
  eqMid: number;
  eqTreble: number;
}

export const EQ_PRESETS: EqPresetDef[] = [
  { id: 'flat', name: 'Flat', eqBass: 0, eqMid: 0, eqTreble: 0 },
  { id: 'voiceClarity', name: 'Voice Clarity', eqBass: -3, eqMid: 5, eqTreble: 4 },
  { id: 'cinemaBass', name: 'Cinema Bass', eqBass: 6, eqMid: -1, eqTreble: 3 },
  { id: 'lofiRadio', name: 'Lo-Fi Radio', eqBass: -8, eqMid: 7, eqTreble: -7 },
  { id: 'podcast', name: 'Crisp Podcast', eqBass: 2, eqMid: 4, eqTreble: 5 },
];

export function computeAutoEnhanceGrade(current: ColorGrade): ColorGrade {
  return {
    ...current,
    exposure: clamp(current.exposure === 0 ? 5 : current.exposure + 3, -60, 60),
    contrast: clamp(Math.max(14, current.contrast + 12), -60, 80),
    saturation: clamp(Math.max(12, current.saturation + 10), -100, 100),
    temperature: clamp(current.temperature === 0 ? 4 : current.temperature, -60, 60),
    sharpness: clamp(Math.max(24, current.sharpness ?? 0), 0, 100),
    vignette: clamp(Math.max(12, current.vignette ?? 0), 0, 100),
  };
}

export function buildCanvasFilterString(grade: ColorGrade, vfx?: VfxConfig): string {
  const lut = getLutPreset(grade.lutId);
  const exposure = clamp(100 + grade.exposure + lut.exposureBias, 20, 220);
  const contrast = clamp(100 + grade.contrast + lut.contrastBias, 30, 240);
  const saturate = clamp(100 + grade.saturation + lut.saturationBias, 0, 260);
  const hueRotate = clamp((grade.hue ?? 0) + lut.hueBias + (grade.tint + lut.tintBias) * 0.45, -180, 180);
  const sepia = clamp(Math.max(0, (grade.temperature + lut.temperatureBias) * 0.35), 0, 55);
  const blurPx = vfx && vfx.blur > 0 ? clamp((vfx.blur / 100) * 14, 0, 16) : 0;

  const parts = [
    `brightness(${exposure.toFixed(0)}%)`,
    `contrast(${contrast.toFixed(0)}%)`,
    `saturate(${saturate.toFixed(0)}%)`,
  ];
  if (Math.abs(hueRotate) >= 1) parts.push(`hue-rotate(${hueRotate.toFixed(1)}deg)`);
  if (sepia >= 1) parts.push(`sepia(${sepia.toFixed(0)}%)`);
  if (blurPx >= 0.2) parts.push(`blur(${blurPx.toFixed(1)}px)`);
  return parts.join(' ');
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0, 217, 36];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [0, 217, 36];
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function applyPixelGradeAndChroma(
  data: Uint8ClampedArray,
  grade: ColorGrade,
  chroma: ChromaKeyConfig
): void {
  const lut = getLutPreset(grade.lutId);
  const tempShift = (grade.temperature + lut.temperatureBias) * 0.45;
  const hasLutSplit =
    lut.shadowRgb[0] !== 0 ||
    lut.shadowRgb[1] !== 0 ||
    lut.shadowRgb[2] !== 0 ||
    lut.highlightRgb[0] !== 0 ||
    lut.highlightRgb[1] !== 0 ||
    lut.highlightRgb[2] !== 0;

  const [keyR, keyG, keyB] = chroma.enabled ? hexToRgb(chroma.color) : [0, 0, 0];
  const simDist = (chroma.similarity / 100) * 195 + 18;
  const featherDist = Math.max(4, (chroma.smoothness / 100) * 90);
  const spillFactor = chroma.spill / 100;
  const grainAmp = (grade.grain ?? 0) > 1 ? (grade.grain / 100) * 34 : 0;

  if (!chroma.enabled && !hasLutSplit && Math.abs(tempShift) < 2 && grainAmp === 0) {
    return;
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];

    if (a === 0) continue;

    if (hasLutSplit || Math.abs(tempShift) >= 2) {
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const shW = 1 - luma;
      const hiW = luma;
      r = clamp(r + tempShift + lut.shadowRgb[0] * shW + lut.highlightRgb[0] * hiW, 0, 255);
      g = clamp(g + lut.shadowRgb[1] * shW + lut.highlightRgb[1] * hiW, 0, 255);
      b = clamp(b - tempShift + lut.shadowRgb[2] * shW + lut.highlightRgb[2] * hiW, 0, 255);
    }

    if (grainAmp > 0) {
      // Deterministic organic 35mm grain noise
      const px = i >> 2;
      const hash = Math.sin(px * 12.9898 + 78.233) * 43758.5453;
      const noise = ((hash - Math.floor(hash)) - 0.5) * 2 * grainAmp;
      r = clamp(r + noise, 0, 255);
      g = clamp(g + noise, 0, 255);
      b = clamp(b + noise, 0, 255);
    }

    if (chroma.enabled) {
      const dr = r - keyR;
      const dg = g - keyG;
      const db = b - keyB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < simDist) {
        a = 0;
      } else if (dist < simDist + featherDist) {
        const edgeAlpha = (dist - simDist) / featherDist;
        a = Math.round(a * clamp(edgeAlpha, 0, 1));
      }

      if (a > 0 && spillFactor > 0) {
        if (keyG >= keyR && keyG >= keyB) {
          const maxRB = Math.max(r, b);
          if (g > maxRB) {
            g = Math.round(g - (g - maxRB) * spillFactor * 0.85);
          }
        } else if (keyB >= keyR && keyB >= keyG) {
          const maxRG = Math.max(r, g);
          if (b > maxRG) {
            b = Math.round(b - (b - maxRG) * spillFactor * 0.85);
          }
        }
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
}

export function applySharpnessPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  sharpness: number
): void {
  if (sharpness <= 1 || width < 3 || height < 3) {
    dst.set(src);
    return;
  }
  const amount = clamp((sharpness / 100) * 1.45, 0, 1.5);
  for (let y = 0; y < height; y++) {
    const yUp = Math.max(0, y - 1);
    const yDn = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xLt = Math.max(0, x - 1);
      const xRt = Math.min(width - 1, x + 1);
      const idx = (y * width + x) * 4;
      const a = src[idx + 3];
      if (a === 0) {
        dst[idx + 3] = 0;
        continue;
      }
      const upIdx = (yUp * width + x) * 4;
      const dnIdx = (yDn * width + x) * 4;
      const ltIdx = (y * width + xLt) * 4;
      const rtIdx = (y * width + xRt) * 4;

      for (let c = 0; c < 3; c++) {
        const center = src[idx + c];
        const avg = (src[upIdx + c] + src[dnIdx + c] + src[ltIdx + c] + src[rtIdx + c]) * 0.25;
        dst[idx + c] = clamp(Math.round(center + (center - avg) * amount), 0, 255);
      }
      dst[idx + 3] = a;
    }
  }
}

/**
 * Pure pixel-level VFX processor for Glitch RGB channel split, Wave Distortion,
 * Pixelate Mosaic, and Analog VHS scanlines.
 */
export function applyVfxPixelPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  vfx: VfxConfig,
  timeSec: number
): void {
  const hasGlitch = (vfx.glitch ?? 0) > 1;
  const hasDistort = (vfx.distortion ?? 0) > 1;
  const hasPixelate = (vfx.pixelate ?? 0) > 1;
  const hasVhs = (vfx.vhsScanlines ?? 0) > 1;
  const hasMirror = (vfx.mirror ?? 0) > 1;
  const hasDuotone = (vfx.duotone ?? 0) > 1;

  if (!hasGlitch && !hasDistort && !hasPixelate && !hasVhs && !hasMirror && !hasDuotone) {
    dst.set(src);
    return;
  }

  const blockSize = hasPixelate ? Math.max(2, Math.round((vfx.pixelate / 100) * 28)) : 1;
  const waveAmp = hasDistort ? (vfx.distortion / 100) * 24 : 0;
  const rgbShiftPx = hasGlitch ? Math.round((vfx.glitch / 100) * 18) : 0;
  const vhsStrength = hasVhs ? (vfx.vhsScanlines / 100) * 0.45 : 0;
  const quadMirror = (vfx.mirror ?? 0) >= 50;
  const duotoneMix = hasDuotone ? clamp((vfx.duotone ?? 0) / 100, 0, 1) : 0;

  for (let y = 0; y < height; y++) {
    const mirY = hasMirror && quadMirror && y >= height >> 1 ? height - 1 - y : y;
    const syBase = hasPixelate ? Math.floor(mirY / blockSize) * blockSize : mirY;
    const waveX = hasDistort
      ? Math.round(Math.sin(y * 0.045 + timeSec * 5.2) * waveAmp)
      : 0;
    const bandHash = Math.sin(Math.floor(y / 14) * 12.9898 + Math.floor(timeSec * 12) * 78.233);
    const glitchTear =
      hasGlitch && Math.abs(bandHash) > 0.72
        ? Math.round(bandHash * (vfx.glitch / 100) * 32)
        : 0;

    const scanDim = hasVhs && y % 3 === 0 ? 1 - vhsStrength : 1;

    for (let x = 0; x < width; x++) {
      const mirX = hasMirror && x >= width >> 1 ? width - 1 - x : x;
      const sxBase = hasPixelate ? Math.floor(mirX / blockSize) * blockSize : mirX;
      const sx = clamp(sxBase + waveX + glitchTear, 0, width - 1);
      const sy = clamp(syBase, 0, height - 1);

      const dstIdx = (y * width + x) * 4;
      let r: number;
      let g: number;
      let b: number;
      let a: number;

      if (hasGlitch) {
        const rx = clamp(sx + rgbShiftPx, 0, width - 1);
        const bx = clamp(sx - rgbShiftPx, 0, width - 1);
        const rIdx = (sy * width + rx) * 4;
        const gIdx = (sy * width + sx) * 4;
        const bIdx = (sy * width + bx) * 4;
        r = src[rIdx] * scanDim;
        g = src[gIdx + 1] * scanDim;
        b = src[bIdx + 2] * scanDim;
        a = src[gIdx + 3];
      } else {
        const sIdx = (sy * width + sx) * 4;
        r = src[sIdx] * scanDim;
        g = src[sIdx + 1] * scanDim;
        b = src[sIdx + 2] * scanDim;
        a = src[sIdx + 3];
      }

      if (hasDuotone && a > 0) {
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const duoR = 14 + luma * (244 - 14);
        const duoG = 28 + luma * (74 - 28);
        const duoB = 104 + luma * (212 - 104);
        r = r * (1 - duotoneMix) + duoR * duotoneMix;
        g = g * (1 - duotoneMix) + duoG * duotoneMix;
        b = b * (1 - duotoneMix) + duoB * duotoneMix;
      }

      dst[dstIdx] = Math.round(r);
      dst[dstIdx + 1] = Math.round(g);
      dst[dstIdx + 2] = Math.round(b);
      dst[dstIdx + 3] = a;
    }
  }
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
}

export function computeHistogramBins(
  rgba: Uint8ClampedArray,
  bins = 32,
  stride = 4
): HistogramData {
  const rBins = new Array<number>(bins).fill(0);
  const gBins = new Array<number>(bins).fill(0);
  const bBins = new Array<number>(bins).fill(0);
  const lBins = new Array<number>(bins).fill(0);

  const step = Math.max(1, stride) * 4;
  for (let i = 0; i < rgba.length; i += step) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;

    rBins[Math.min(bins - 1, Math.floor((r / 256) * bins))]++;
    gBins[Math.min(bins - 1, Math.floor((g / 256) * bins))]++;
    bBins[Math.min(bins - 1, Math.floor((b / 256) * bins))]++;
    lBins[Math.min(bins - 1, Math.floor((l / 256) * bins))]++;
  }

  const normalize = (arr: number[]) => {
    const maxVal = Math.max(1, ...arr);
    return arr.map((v) => Number((v / maxVal).toFixed(3)));
  };

  return {
    r: normalize(rBins),
    g: normalize(gBins),
    b: normalize(bBins),
    luma: normalize(lBins),
  };
}
