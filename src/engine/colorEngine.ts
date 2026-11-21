import type { ChromaKeyConfig, ColorGrade, VfxConfig } from '../types/editor';
import { clamp } from './timelineMath';

export type LutCategory =
  | 'Cinema'
  | 'Film'
  | 'Vintage'
  | 'Moody'
  | 'Vibrant'
  | 'Portrait'
  | 'Neon'
  | 'Pastel'
  | 'Travel'
  | 'Mono';

export const LUT_CATEGORIES: ('All' | LutCategory)[] = [
  'All',
  'Cinema',
  'Film',
  'Vintage',
  'Moody',
  'Vibrant',
  'Portrait',
  'Neon',
  'Pastel',
  'Travel',
  'Mono',
];

export interface LutPreset {
  id: string;
  name: string;
  category: LutCategory;
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
  {
    id: 'filmBurn',
    name: 'Warm Film Burn',
    category: 'Retro',
    description: 'Organic 35mm amber-crimson edge light flare.',
    defaultIntensity: 60,
  },
  {
    id: 'prism',
    name: 'Chromatic Prism',
    category: 'Lens',
    description: 'Radial RGB optical dispersion across frame edges.',
    defaultIntensity: 55,
  },
  {
    id: 'nightVision',
    name: 'Night Scope CRT',
    category: 'Retro',
    description: 'Tactical phosphor emerald night-vision & scanlines.',
    defaultIntensity: 70,
  },
  {
    id: 'motionBlur',
    name: 'Cinema Motion Blur',
    category: 'Cinema',
    description: 'Directional 180-deg shutter-angle trail for smooth motion.',
    defaultIntensity: 55,
  },
];

const CORE_LUT_PRESETS: LutPreset[] = [
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

interface CompactLutSpec {
  id: string;
  name: string;
  category: LutCategory;
  c1: string;
  c2: string;
  exp: number;
  con: number;
  sat: number;
  hue: number;
  temp: number;
  tint: number;
  sh: [number, number, number];
  hi: [number, number, number];
  desc: string;
}

const EXPANDED_LUT_SPECS: CompactLutSpec[] = [
  // Cinema (14)
  { id: 'cin_imax_epic', name: 'IMAX Epic', category: 'Cinema', c1: '#0c4a6e', c2: '#fb923c', exp: 1, con: 24, sat: 10, hue: -2, temp: 6, tint: -2, sh: [-12, 8, 18], hi: [20, 10, -8], desc: 'Large-format theatrical contrast & rich sky separation.' },
  { id: 'cin_dune_ochre', name: 'Desert Ochre', category: 'Cinema', c1: '#7c2d12', c2: '#fde047', exp: 4, con: 16, sat: -8, hue: -4, temp: 30, tint: 4, sh: [14, 4, -14], hi: [24, 16, -12], desc: 'Sun-scorched sandstone tones with amber highlights.' },
  { id: 'cin_arctic_slate', name: 'Arctic Slate', category: 'Cinema', c1: '#0f172a', c2: '#67e8f9', exp: 2, con: 18, sat: -10, hue: -8, temp: -28, tint: -4, sh: [-10, 8, 22], hi: [-4, 14, 20], desc: 'Cool glacier blues with crisp highlight clarity.' },
  { id: 'cin_emerald_thriller', name: 'Matrix Emerald', category: 'Cinema', c1: '#052e16', c2: '#4ade80', exp: -4, con: 28, sat: -6, hue: 14, temp: -12, tint: -22, sh: [-12, 18, -6], hi: [2, 16, 0], desc: 'Stylized cyber-green midtones & deep obsidian blacks.' },
  { id: 'cin_blockbuster', name: 'Blockbuster Punch', category: 'Cinema', c1: '#155e75', c2: '#f97316', exp: 0, con: 26, sat: 18, hue: 0, temp: 10, tint: -4, sh: [-16, 8, 20], hi: [24, 10, -14], desc: 'High-impact action grade with bold cyan/orange separation.' },
  { id: 'cin_anomorphic_blue', name: 'Anamorphic Flare', category: 'Cinema', c1: '#1e1b4b', c2: '#38bdf8', exp: 3, con: 14, sat: 12, hue: -6, temp: -18, tint: 4, sh: [-6, 4, 24], hi: [6, 16, 22], desc: 'Electric blue halation inspired by anamorphic glass.' },
  { id: 'cin_obsidian_gold', name: 'Obsidian Gold', category: 'Cinema', c1: '#18181b', c2: '#eab308', exp: -2, con: 24, sat: 6, hue: 0, temp: 18, tint: 2, sh: [4, 0, -10], hi: [22, 16, -10], desc: 'Luxury dark shadows paired with warm metallic gold.' },
  { id: 'cin_nordic_frost', name: 'Nordic Frost', category: 'Cinema', c1: '#1e293b', c2: '#bae6fd', exp: 4, con: 8, sat: -20, hue: -4, temp: -22, tint: 2, sh: [-4, 8, 16], hi: [4, 10, 14], desc: 'Desaturated Scandinavian winter thriller palette.' },
  { id: 'cin_sunset_crimson', name: 'Crimson Dusk', category: 'Cinema', c1: '#4c0519', c2: '#fb7185', exp: 2, con: 20, sat: 16, hue: 6, temp: 20, tint: 14, sh: [14, -6, 6], hi: [22, 4, 4], desc: 'Velvet crimson twilight with dramatic shadow density.' },
  { id: 'cin_cobalt_drama', name: 'Cobalt Drama', category: 'Cinema', c1: '#0c192c', c2: '#60a5fa', exp: -3, con: 22, sat: 8, hue: -10, temp: -20, tint: 0, sh: [-8, 4, 22], hi: [4, 12, 18], desc: 'Deep maritime blue shadows with clean neutral whites.' },
  { id: 'cin_bronze_hero', name: 'Bronze Hero', category: 'Cinema', c1: '#451a03', c2: '#d97706', exp: 1, con: 22, sat: 4, hue: -2, temp: 22, tint: 2, sh: [10, 2, -10], hi: [18, 10, -8], desc: 'Warm metallic bronze tone for epic hero shots.' },
  { id: 'cin_velvet_violet', name: 'Velvet Violet', category: 'Cinema', c1: '#2e1065', c2: '#c084fc', exp: 0, con: 18, sat: 14, hue: 10, temp: -10, tint: 18, sh: [10, -6, 20], hi: [16, 4, 18], desc: 'Dreamy ultraviolet cast for music videos & night scenes.' },
  { id: 'cin_skyline_4k', name: 'Skyline 4K', category: 'Cinema', c1: '#0f172a', c2: '#22d3ee', exp: 3, con: 16, sat: 14, hue: -4, temp: -12, tint: -2, sh: [-8, 10, 16], hi: [10, 16, 18], desc: 'Modern architectural sheen with crisp cyan highlights.' },
  { id: 'cin_solaris_warm', name: 'Solaris Warmth', category: 'Cinema', c1: '#7c2d12', c2: '#fdba74', exp: 5, con: 10, sat: 12, hue: 0, temp: 24, tint: 6, sh: [12, 4, -8], hi: [20, 12, -10], desc: 'Glowing afternoon sun wrap with gentle roll-off.' },

  // Film (14)
  { id: 'flm_portra400', name: 'Kodak Portra 400', category: 'Film', c1: '#78350f', c2: '#fed7aa', exp: 4, con: 6, sat: -4, hue: 2, temp: 10, tint: 4, sh: [6, 4, -4], hi: [12, 8, -2], desc: 'Renowned natural skin reproduction & soft pastel roll-off.' },
  { id: 'flm_portra800', name: 'Kodak Portra 800', category: 'Film', c1: '#713f12', c2: '#fde68a', exp: 5, con: 12, sat: 6, hue: 0, temp: 14, tint: 2, sh: [8, 4, -6], hi: [16, 10, -4], desc: 'Warm low-light 35mm emulsion with rich amber grain.' },
  { id: 'flm_cinestill800t', name: 'CineStill 800T', category: 'Film', c1: '#083344', c2: '#f43f5e', exp: 0, con: 20, sat: 12, hue: -6, temp: -18, tint: 6, sh: [-10, 8, 18], hi: [20, 4, 8], desc: 'Tungsten-balanced night stock with subtle red halation.' },
  { id: 'flm_cinestill50d', name: 'CineStill 50D', category: 'Film', c1: '#1e3a8a', c2: '#fcd34d', exp: 3, con: 12, sat: 8, hue: 0, temp: 6, tint: 0, sh: [-4, 4, 10], hi: [14, 10, -4], desc: 'Fine-grain daylight motion picture emulsion.' },
  { id: 'flm_fuji_pro400h', name: 'Fuji Pro 400H', category: 'Film', c1: '#064e3b', c2: '#a7f3d0', exp: 5, con: -4, sat: -8, hue: 6, temp: -6, tint: -10, sh: [-4, 12, 8], hi: [4, 10, 4], desc: 'Airy mint greens and soft wedding-editorial highlights.' },
  { id: 'flm_velvia50', name: 'Fuji Velvia 50', category: 'Film', c1: '#1d4ed8', c2: '#f43f5e', exp: -2, con: 28, sat: 36, hue: 2, temp: 4, tint: 6, sh: [-6, -2, 12], hi: [14, 6, 4], desc: 'Ultra-vivid slide film saturation for epic landscapes.' },
  { id: 'flm_provia100', name: 'Fuji Provia 100F', category: 'Film', c1: '#0369a1', c2: '#7dd3fc', exp: 1, con: 14, sat: 14, hue: -2, temp: -4, tint: 0, sh: [-4, 4, 10], hi: [8, 10, 8], desc: 'Balanced transparency stock with punchy blues.' },
  { id: 'flm_ektar100', name: 'Kodak Ektar 100', category: 'Film', c1: '#991b1b', c2: '#fbbf24', exp: 0, con: 20, sat: 26, hue: 0, temp: 12, tint: 4, sh: [8, -2, -6], hi: [18, 8, -8], desc: 'Rich commercial reds & crisp micro-contrast.' },
  { id: 'flm_gold200', name: 'Kodak Gold 200', category: 'Film', c1: '#92400e', c2: '#fef08a', exp: 4, con: 8, sat: 10, hue: -2, temp: 22, tint: 2, sh: [10, 6, -10], hi: [18, 14, -8], desc: 'Classic warm consumer 35mm golden nostalgia.' },
  { id: 'flm_ultramax', name: 'Kodak Ultramax 400', category: 'Film', c1: '#1e40af', c2: '#fb923c', exp: 2, con: 16, sat: 16, hue: 0, temp: 6, tint: 0, sh: [-6, 2, 14], hi: [16, 10, -4], desc: 'Punchy street snapshots with cool shadows & warm sun.' },
  { id: 'flm_superia400', name: 'Fuji Superia X-Tra', category: 'Film', c1: '#065f46', c2: '#6ee7b7', exp: 2, con: 14, sat: 10, hue: 6, temp: -4, tint: -12, sh: [-6, 12, 6], hi: [8, 12, 2], desc: 'Distinctive emerald-tinted shadows & snappy midtones.' },
  { id: 'flm_agfa_vista', name: 'Agfa Vista 200', category: 'Film', c1: '#9f1239', c2: '#fdba74', exp: 3, con: 12, sat: 18, hue: 4, temp: 8, tint: 8, sh: [8, -2, 4], hi: [16, 8, -4], desc: 'Rosy warm reds & crisp European daylight contrast.' },
  { id: 'flm_vision3_500t', name: 'Vision3 500T', category: 'Film', c1: '#1e293b', c2: '#38bdf8', exp: -1, con: 16, sat: 4, hue: -4, temp: -14, tint: -2, sh: [-8, 6, 16], hi: [10, 8, 6], desc: 'Cinema negative curve built for mixed night lighting.' },
  { id: 'flm_technicolor', name: '2-Strip Technicolor', category: 'Film', c1: '#0f766e', c2: '#ef4444', exp: 2, con: 22, sat: 20, hue: 8, temp: 4, tint: -8, sh: [-14, 14, 10], hi: [24, 4, -8], desc: 'Classic 1930s red-cyan dual-emulsion dye look.' },

  // Vintage (13)
  { id: 'vin_1960_slide', name: '1960s Kodachrome', category: 'Vintage', c1: '#7f1d1d', c2: '#fcd34d', exp: 2, con: 18, sat: 6, hue: -2, temp: 20, tint: 6, sh: [12, 2, -10], hi: [18, 12, -8], desc: 'Iconic archival magazine print tones.' },
  { id: 'vin_super8', name: 'Super 8 Home Reel', category: 'Vintage', c1: '#78350f', c2: '#fde68a', exp: 6, con: -6, sat: -18, hue: -4, temp: 26, tint: 4, sh: [16, 10, -8], hi: [18, 14, -6], desc: 'Soft faded home-movie reel with lifted blacks.' },
  { id: 'vin_polaroid_sx70', name: 'SX-70 Instant', category: 'Vintage', c1: '#1e3a5f', c2: '#fef08a', exp: 7, con: -10, sat: -14, hue: 6, temp: 12, tint: -6, sh: [2, 12, 14], hi: [18, 14, -4], desc: 'Creamy instant-print borders with teal shadow haze.' },
  { id: 'vin_lomo_lc', name: 'Lomo LC-A Cross', category: 'Vintage', c1: '#047857', c2: '#facc15', exp: 1, con: 24, sat: 22, hue: 10, temp: 6, tint: -16, sh: [-8, 18, 8], hi: [18, 16, -12], desc: 'Cross-processed vibrant greens & golden highlights.' },
  { id: 'vin_sepia_archival', name: 'Archival Sepia', category: 'Vintage', c1: '#451a03', c2: '#d6d3d1', exp: 2, con: 10, sat: -70, hue: 0, temp: 44, tint: 6, sh: [16, 8, -12], hi: [20, 12, -12], desc: 'Warm antique darkroom sepia toning.' },
  { id: 'vin_90s_cam', name: '90s Camcorder', category: 'Vintage', c1: '#312e81', c2: '#fde047', exp: 4, con: 6, sat: 12, hue: -6, temp: -6, tint: 10, sh: [6, 4, 14], hi: [12, 10, -4], desc: 'Nostalgic Hi8 video-tape warmth & punch.' },
  { id: 'vin_retro_cafe', name: 'Retro Espresso', category: 'Vintage', c1: '#431407', c2: '#fdba74', exp: -2, con: 14, sat: -12, hue: -2, temp: 24, tint: 2, sh: [14, 6, -6], hi: [16, 10, -6], desc: 'Rich roasted coffee tones for cozy interiors.' },
  { id: 'vin_pastel_70s', name: '70s Summer Haze', category: 'Vintage', c1: '#9a3412', c2: '#fbcfe8', exp: 8, con: -14, sat: -10, hue: 4, temp: 20, tint: 10, sh: [14, 6, 4], hi: [18, 12, 4], desc: 'Sun-bleached low-contrast retro summer glow.' },
  { id: 'vin_faded_denim', name: 'Faded Denim', category: 'Vintage', c1: '#1e3a8a', c2: '#cbd5e1', exp: 5, con: -8, sat: -26, hue: -6, temp: -14, tint: 0, sh: [4, 8, 18], hi: [6, 8, 10], desc: 'Washed-out indigo shadows & matte highlights.' },
  { id: 'vin_vhs_magenta', name: 'VHS Tape Drift', category: 'Vintage', c1: '#581c87', c2: '#f472b6', exp: 2, con: 10, sat: 8, hue: 12, temp: -4, tint: 18, sh: [14, -4, 16], hi: [18, 4, 12], desc: 'Analog tape chroma shift with rosy highlights.' },
  { id: 'vin_autumn_postcard', name: 'Autumn Postcard', category: 'Vintage', c1: '#7c2d12', c2: '#fb923c', exp: 3, con: 8, sat: 4, hue: -4, temp: 26, tint: 4, sh: [12, 4, -8], hi: [20, 10, -10], desc: 'Warm russet foliage & soft vintage contrast.' },
  { id: 'vin_matte_olive', name: 'Matte Olive', category: 'Vintage', c1: '#365314', c2: '#d9f99d', exp: 3, con: -6, sat: -20, hue: 8, temp: 10, tint: -14, sh: [4, 12, -4], hi: [10, 12, -6], desc: 'Muted army olive shadows with soft matte lift.' },
  { id: 'vin_sun_bleached', name: 'Sun Bleached', category: 'Vintage', c1: '#854d0e', c2: '#fef9c3', exp: 10, con: -16, sat: -28, hue: 0, temp: 22, tint: 2, sh: [14, 12, 2], hi: [18, 16, 4], desc: 'High-key airy vintage wash with chalky blacks.' },

  // Moody (14)
  { id: 'moo_dark_academia', name: 'Dark Academia', category: 'Moody', c1: '#271a11', c2: '#a16207', exp: -6, con: 20, sat: -22, hue: -2, temp: 14, tint: 2, sh: [8, 2, -6], hi: [12, 8, -4], desc: 'Moody walnut shadows & candlelit amber highlights.' },
  { id: 'moo_rainforest', name: 'Rainforest Deep', category: 'Moody', c1: '#022c22', c2: '#10b981', exp: -5, con: 22, sat: -8, hue: 6, temp: -10, tint: -14, sh: [-8, 14, 6], hi: [-2, 12, 4], desc: 'Lush deep pine shadows with wet foliage contrast.' },
  { id: 'moo_storm_cloud', name: 'Storm Cloud', category: 'Moody', c1: '#0f172a', c2: '#64748b', exp: -4, con: 24, sat: -34, hue: -4, temp: -16, tint: -2, sh: [-6, 2, 12], hi: [2, 6, 10], desc: 'Overcast slate drama with heavy midtone grit.' },
  { id: 'moo_espresso_matte', name: 'Espresso Matte', category: 'Moody', c1: '#1c1917', c2: '#78716c', exp: -3, con: 10, sat: -28, hue: 0, temp: 12, tint: 2, sh: [10, 6, 0], hi: [10, 6, -2], desc: 'Lifted warm charcoal shadows for moody portraits.' },
  { id: 'moo_midnight_indigo', name: 'Midnight Indigo', category: 'Moody', c1: '#090d24', c2: '#4f46e5', exp: -6, con: 24, sat: 4, hue: -10, temp: -24, tint: 8, sh: [-4, -2, 22], hi: [4, 6, 18], desc: 'Deep nocturnal blue-violet mood.' },
  { id: 'moo_foggy_coast', name: 'Foggy Coast', category: 'Moody', c1: '#1e293b', c2: '#94a3b8', exp: 2, con: -6, sat: -36, hue: -2, temp: -12, tint: 0, sh: [-2, 4, 10], hi: [4, 6, 8], desc: 'Soft misty ocean horizon with muted slate.' },
  { id: 'moo_ember_shadow', name: 'Ember Shadow', category: 'Moody', c1: '#1f1209', c2: '#ea580c', exp: -5, con: 26, sat: 4, hue: -2, temp: 18, tint: 4, sh: [8, 0, -8], hi: [22, 8, -10], desc: 'Dark shadowy frame lit by glowing ember accents.' },
  { id: 'moo_forest_mist', name: 'Forest Mist', category: 'Moody', c1: '#14532d', c2: '#9ca3af', exp: 1, con: 4, sat: -26, hue: 4, temp: -8, tint: -10, sh: [-4, 10, 4], hi: [4, 8, 4], desc: 'Soft misty evergreen tones with calm contrast.' },
  { id: 'moo_charcoal_cyan', name: 'Charcoal Cyan', category: 'Moody', c1: '#090d16', c2: '#06b6d4', exp: -4, con: 24, sat: -10, hue: -6, temp: -18, tint: -6, sh: [-10, 8, 16], hi: [0, 12, 16], desc: 'Matte graphite blacks with cool cyan accents.' },
  { id: 'moo_wine_cellar', name: 'Burgundy Mood', category: 'Moody', c1: '#3b0764', c2: '#be123c', exp: -5, con: 22, sat: -6, hue: 8, temp: 10, tint: 16, sh: [14, -6, 6], hi: [16, 2, 6], desc: 'Rich merlot shadows for moody indoor scenes.' },
  { id: 'moo_wet_asphalt', name: 'Wet Asphalt', category: 'Moody', c1: '#09090b', c2: '#3f3f46', exp: -4, con: 28, sat: -32, hue: 0, temp: -10, tint: 0, sh: [-4, 0, 8], hi: [4, 6, 8], desc: 'Street-level rainy pavement contrast.' },
  { id: 'moo_moss_stone', name: 'Moss & Stone', category: 'Moody', c1: '#1a2e05', c2: '#71717a', exp: -2, con: 14, sat: -22, hue: 6, temp: 2, tint: -10, sh: [0, 10, -2], hi: [6, 8, 2], desc: 'Earthy moss greens balanced against cool stone.' },
  { id: 'moo_dusk_obsidian', name: 'Dusk Obsidian', category: 'Moody', c1: '#0c0a09', c2: '#57534e', exp: -6, con: 24, sat: -20, hue: 0, temp: 4, tint: 2, sh: [4, 2, 0], hi: [8, 6, 2], desc: 'Minimalist dark obsidian contrast with subtle warmth.' },
  { id: 'moo_cold_harbor', name: 'Cold Harbor', category: 'Moody', c1: '#0c4a6e', c2: '#64748b', exp: -3, con: 18, sat: -24, hue: -6, temp: -22, tint: -4, sh: [-8, 4, 16], hi: [0, 6, 12], desc: 'Steely industrial harbor blues.' },

  // Vibrant (14)
  { id: 'vib_tropical_punch', name: 'Tropical Punch', category: 'Vibrant', c1: '#0284c7', c2: '#facc15', exp: 5, con: 16, sat: 34, hue: 0, temp: 8, tint: -4, sh: [-6, 10, 12], hi: [18, 14, -6], desc: 'Bright resort turquoise waters & sunny golden sand.' },
  { id: 'vib_summer_pop', name: 'Summer Pop', category: 'Vibrant', c1: '#ec4899', c2: '#f59e0b', exp: 6, con: 14, sat: 32, hue: 2, temp: 12, tint: 6, sh: [8, 0, 8], hi: [20, 12, -4], desc: 'Energetic lifestyle pop for travel vlogs.' },
  { id: 'vib_emerald_bloom', name: 'Emerald Bloom', category: 'Vibrant', c1: '#059669', c2: '#a3e635', exp: 4, con: 14, sat: 28, hue: 6, temp: 2, tint: -10, sh: [-6, 14, 2], hi: [10, 18, -4], desc: 'Lush botanical greens with sunlit sparkle.' },
  { id: 'vib_citrus_zing', name: 'Citrus Zing', category: 'Vibrant', c1: '#ea580c', c2: '#fde047', exp: 6, con: 12, sat: 30, hue: -4, temp: 18, tint: 0, sh: [8, 4, -8], hi: [22, 16, -10], desc: 'Zesty tangerine and lemon radiance.' },
  { id: 'vib_azure_coast', name: 'Azure Coast', category: 'Vibrant', c1: '#0369a1', c2: '#22d3ee', exp: 4, con: 16, sat: 28, hue: -4, temp: -12, tint: -4, sh: [-10, 8, 20], hi: [4, 16, 20], desc: 'Crystal-clear Mediterranean blue saturation.' },
  { id: 'vib_berry_crush', name: 'Berry Crush', category: 'Vibrant', c1: '#9d174d', c2: '#fb7185', exp: 3, con: 18, sat: 30, hue: 8, temp: 6, tint: 16, sh: [12, -6, 10], hi: [20, 4, 10], desc: 'Rich raspberry & rose highlights.' },
  { id: 'vib_festival_day', name: 'Festival Daylight', category: 'Vibrant', c1: '#7c3aed', c2: '#f43f5e', exp: 5, con: 18, sat: 36, hue: 4, temp: 8, tint: 8, sh: [8, -2, 16], hi: [18, 8, 6], desc: 'High-energy music festival daylight color pop.' },
  { id: 'vib_candy_sky', name: 'Candy Sky', category: 'Vibrant', c1: '#38bdf8', c2: '#f472b6', exp: 7, con: 8, sat: 26, hue: 4, temp: -2, tint: 14, sh: [4, 6, 16], hi: [18, 10, 14], desc: 'Cotton-candy sunset skies & airy brightness.' },
  { id: 'vib_vivid_hdr', name: 'Vivid HDR Boost', category: 'Vibrant', c1: '#1d4ed8', c2: '#22c55e', exp: 3, con: 26, sat: 34, hue: 0, temp: 0, tint: 0, sh: [-4, 2, 6], hi: [12, 12, 12], desc: 'Crisp micro-contrast & punchy dynamic range.' },
  { id: 'vib_coral_reef', name: 'Coral Reef', category: 'Vibrant', c1: '#0d9488', c2: '#fb7185', exp: 4, con: 14, sat: 30, hue: 2, temp: 6, tint: 6, sh: [-8, 14, 12], hi: [22, 8, 6], desc: 'Teal ocean depth paired with coral pink highlights.' },
  { id: 'vib_spring_meadow', name: 'Spring Meadow', category: 'Vibrant', c1: '#16a34a', c2: '#fde047', exp: 6, con: 10, sat: 24, hue: 4, temp: 10, tint: -8, sh: [-4, 12, 0], hi: [14, 16, -6], desc: 'Fresh morning greens and warm sunlight.' },
  { id: 'vib_mango_sunset', name: 'Mango Sunset', category: 'Vibrant', c1: '#c2410c', c2: '#facc15', exp: 4, con: 16, sat: 32, hue: -2, temp: 26, tint: 4, sh: [12, 2, -10], hi: [24, 14, -12], desc: 'Juicy sunset amber & deep crimson warmth.' },
  { id: 'vib_electric_teal', name: 'Electric Teal', category: 'Vibrant', c1: '#0f766e', c2: '#2dd4bf', exp: 3, con: 18, sat: 28, hue: -6, temp: -14, tint: -10, sh: [-12, 14, 16], hi: [0, 18, 16], desc: 'Saturated modern aqua teal tones.' },
  { id: 'vib_ruby_spark', name: 'Ruby Spark', category: 'Vibrant', c1: '#991b1b', c2: '#f97316', exp: 2, con: 20, sat: 30, hue: 2, temp: 14, tint: 8, sh: [12, -4, -4], hi: [22, 8, -4], desc: 'Fiery red-orange brilliance for sports & action.' },

  // Portrait (12)
  { id: 'por_peach_glow', name: 'Peach Glow', category: 'Portrait', c1: '#9a3412', c2: '#fed7aa', exp: 6, con: 4, sat: 6, hue: 2, temp: 14, tint: 6, sh: [8, 4, -2], hi: [16, 10, 0], desc: 'Flattering warm peach skin radiance.' },
  { id: 'por_clean_beauty', name: 'Clean Studio Beauty', category: 'Portrait', c1: '#475569', c2: '#f8fafc', exp: 7, con: 6, sat: -4, hue: 0, temp: 4, tint: 2, sh: [2, 2, 4], hi: [8, 8, 8], desc: 'Neutral high-clarity commercial beauty lighting.' },
  { id: 'por_honey_skin', name: 'Honey Bronzer', category: 'Portrait', c1: '#78350f', c2: '#fde68a', exp: 4, con: 10, sat: 8, hue: -2, temp: 20, tint: 2, sh: [10, 4, -6], hi: [18, 12, -6], desc: 'Sun-kissed golden skin glow.' },
  { id: 'por_porcelain', name: 'Porcelain Cool', category: 'Portrait', c1: '#334155', c2: '#e0f2fe', exp: 7, con: 2, sat: -10, hue: -2, temp: -10, tint: 4, sh: [0, 4, 10], hi: [6, 8, 10], desc: 'Luminous cool-toned editorial fashion skin.' },
  { id: 'por_rose_velvet', name: 'Rose Velvet', category: 'Portrait', c1: '#881337', c2: '#fecdd3', exp: 5, con: 6, sat: 4, hue: 4, temp: 8, tint: 12, sh: [10, 0, 6], hi: [16, 6, 8], desc: 'Soft rosy cheeks & romantic matte highlights.' },
  { id: 'por_editorial_warm', name: 'Editorial Warm', category: 'Portrait', c1: '#57534e', c2: '#fde68a', exp: 4, con: 12, sat: -8, hue: 0, temp: 14, tint: 2, sh: [8, 4, -2], hi: [14, 10, -2], desc: 'Magazine cover warmth with natural shadow depth.' },
  { id: 'por_creamy_matte', name: 'Creamy Matte', category: 'Portrait', c1: '#44403c', c2: '#f5f5f4', exp: 6, con: -8, sat: -12, hue: 0, temp: 8, tint: 2, sh: [8, 6, 4], hi: [10, 8, 4], desc: 'Silky lifted shadows for soft daylight portraits.' },
  { id: 'por_golden_silk', name: 'Golden Silk', category: 'Portrait', c1: '#854d0e', c2: '#fef08a', exp: 5, con: 8, sat: 10, hue: 0, temp: 18, tint: 2, sh: [10, 6, -4], hi: [16, 12, -4], desc: 'Warm backlit hair-light shimmer.' },
  { id: 'por_mocha_tone', name: 'Mocha Richness', category: 'Portrait', c1: '#292524', c2: '#d6d3d1', exp: 2, con: 14, sat: -6, hue: 0, temp: 12, tint: 2, sh: [10, 4, -2], hi: [12, 8, 0], desc: 'Deep flattering contrast for rich skin tones.' },
  { id: 'por_soft_ivory', name: 'Soft Ivory', category: 'Portrait', c1: '#64748b', c2: '#fefce8', exp: 8, con: -4, sat: -14, hue: 2, temp: 8, tint: 0, sh: [6, 6, 4], hi: [10, 10, 6], desc: 'Airy bridal ivory brightness.' },
  { id: 'por_studio_crisp', name: 'Studio Crisp', category: 'Portrait', c1: '#1e293b', c2: '#e2e8f0', exp: 3, con: 18, sat: 2, hue: 0, temp: 0, tint: 0, sh: [-2, 0, 4], hi: [8, 8, 8], desc: 'Sharp talking-head YouTube studio look.' },
  { id: 'por_champagne', name: 'Champagne Tint', category: 'Portrait', c1: '#713f12', c2: '#fef3c7', exp: 5, con: 6, sat: -6, hue: 2, temp: 14, tint: 4, sh: [8, 6, 0], hi: [16, 12, 2], desc: 'Refined champagne highlight sheen.' },

  // Neon (11)
  { id: 'neo_cyberpunk_2099', name: 'Cyberpunk 2099', category: 'Neon', c1: '#0284c7', c2: '#ec4899', exp: 0, con: 26, sat: 30, hue: -8, temp: -16, tint: 20, sh: [-8, 12, 26], hi: [26, 0, 22], desc: 'Electric cyan shadows & hot magenta neon lights.' },
  { id: 'neo_tokyo_rain', name: 'Tokyo Rain Neon', category: 'Neon', c1: '#0f172a', c2: '#22d3ee', exp: -2, con: 28, sat: 24, hue: -10, temp: -22, tint: 10, sh: [-10, 10, 24], hi: [8, 18, 26], desc: 'Wet Shinjuku night reflections in vivid cyan.' },
  { id: 'neo_synthwave', name: 'Synthwave 84', category: 'Neon', c1: '#4c1d95', c2: '#f43f5e', exp: 2, con: 22, sat: 28, hue: 14, temp: -8, tint: 26, sh: [12, -8, 26], hi: [26, 4, 18], desc: 'Retro-futuristic purple & sunset laser grid.' },
  { id: 'neo_acid_lime', name: 'Acid Lime', category: 'Neon', c1: '#064e3b', c2: '#bef264', exp: 2, con: 24, sat: 26, hue: 18, temp: -4, tint: -24, sh: [-10, 18, 4], hi: [14, 24, -6], desc: 'Hyper-electric toxic lime rave energy.' },
  { id: 'neo_ultraviolet', name: 'Ultraviolet Club', category: 'Neon', c1: '#1e1b4b', c2: '#a855f7', exp: -2, con: 24, sat: 26, hue: 16, temp: -18, tint: 24, sh: [8, -6, 26], hi: [18, 6, 26], desc: 'Blacklight club violet with glowing highlights.' },
  { id: 'neo_laser_red', name: 'Laser Crimson', category: 'Neon', c1: '#18181b', c2: '#ef4444', exp: -3, con: 28, sat: 24, hue: 4, temp: 12, tint: 12, sh: [12, -8, -4], hi: [28, 0, 4], desc: 'Bold scarlet stage laser look.' },
  { id: 'neo_arcade_blue', name: 'Arcade Electric', category: 'Neon', c1: '#0c4a6e', c2: '#38bdf8', exp: 1, con: 24, sat: 28, hue: -12, temp: -26, tint: -4, sh: [-12, 8, 28], hi: [6, 20, 28], desc: 'High-voltage arcade cobalt & ice blue.' },
  { id: 'neo_miami_vice', name: 'Miami Night', category: 'Neon', c1: '#0d9488', c2: '#fb7185', exp: 3, con: 20, sat: 28, hue: 2, temp: -6, tint: 14, sh: [-12, 16, 18], hi: [24, 6, 16], desc: '80s pastel-neon aqua & flamingo pink.' },
  { id: 'neo_plasma_orange', name: 'Plasma Orange', category: 'Neon', c1: '#312e81', c2: '#fb923c', exp: 1, con: 24, sat: 26, hue: -4, temp: 16, tint: 6, sh: [-6, -2, 22], hi: [28, 12, -10], desc: 'Deep indigo shadow with burning neon orange.' },
  { id: 'neo_hologram', name: 'Prism Hologram', category: 'Neon', c1: '#06b6d4', c2: '#c084fc', exp: 4, con: 16, sat: 24, hue: 24, temp: -12, tint: 14, sh: [-8, 14, 22], hi: [20, 10, 24], desc: 'Iridescent prism hue-shift sheen.' },
  { id: 'neo_midnight_arcade', name: 'Midnight Tron', category: 'Neon', c1: '#020617', c2: '#00f2fe', exp: -4, con: 32, sat: 20, hue: -8, temp: -24, tint: -6, sh: [-12, 10, 24], hi: [4, 22, 26], desc: 'Razor-sharp black contrast with glowing cyan edges.' },

  // Mono (10)
  { id: 'mon_ansel_adams', name: 'Ansel Zone B&W', category: 'Mono', c1: '#09090b', c2: '#f4f4f5', exp: 0, con: 34, sat: -100, hue: 0, temp: 0, tint: 0, sh: [-4, -4, -4], hi: [8, 8, 8], desc: 'Deepest Zone I blacks & luminous Zone IX whites.' },
  { id: 'mon_ilford_hp5', name: 'Ilford HP5 Classic', category: 'Mono', c1: '#18181b', c2: '#d4d4d8', exp: 3, con: 14, sat: -100, hue: 0, temp: 0, tint: 0, sh: [4, 4, 4], hi: [2, 2, 2], desc: 'Forgiving documentary 400-speed monochrome.' },
  { id: 'mon_kodak_trix', name: 'Kodak Tri-X 400', category: 'Mono', c1: '#09090b', c2: '#e4e4e7', exp: -1, con: 28, sat: -100, hue: 0, temp: 0, tint: 0, sh: [-2, -2, -2], hi: [6, 6, 6], desc: 'Punchy photojournalism grain & crisp shadows.' },
  { id: 'mon_platinum_print', name: 'Platinum Print', category: 'Mono', c1: '#292524', c2: '#f5f5f4', exp: 4, con: 8, sat: -100, hue: 0, temp: 8, tint: 0, sh: [6, 5, 3], hi: [6, 5, 3], desc: 'Subtle warm silver-platinum darkroom glow.' },
  { id: 'mon_selenium_tone', name: 'Selenium Cool B&W', category: 'Mono', c1: '#0f172a', c2: '#e2e8f0', exp: 1, con: 20, sat: -100, hue: 0, temp: -10, tint: 2, sh: [0, 0, 6], hi: [4, 4, 8], desc: 'Archival eggplant-slate cool monochrome split.' },
  { id: 'mon_cyanotype', name: 'Prussian Cyanotype', category: 'Mono', c1: '#0c4a6e', c2: '#e0f2fe', exp: 2, con: 18, sat: -75, hue: -8, temp: -30, tint: -4, sh: [-10, 6, 22], hi: [2, 12, 20], desc: 'Historic Prussian blueprint monochrome.' },
  { id: 'mon_soft_charcoal', name: 'Soft Charcoal', category: 'Mono', c1: '#27272a', c2: '#a1a1aa', exp: 4, con: -6, sat: -100, hue: 0, temp: 0, tint: 0, sh: [8, 8, 8], hi: [-2, -2, -2], desc: 'Lifted matte charcoal grayscale.' },
  { id: 'mon_high_key_white', name: 'High-Key Fashion', category: 'Mono', c1: '#52525b', c2: '#ffffff', exp: 10, con: 16, sat: -100, hue: 0, temp: 0, tint: 0, sh: [4, 4, 4], hi: [12, 12, 12], desc: 'Bright airy studio fashion monochrome.' },
  { id: 'mon_graphite_edge', name: 'Graphite Edge', category: 'Mono', c1: '#18181b', c2: '#71717a', exp: -3, con: 24, sat: -100, hue: 0, temp: -4, tint: 0, sh: [-2, -2, 0], hi: [4, 4, 4], desc: 'Architectural steel-gray monochrome.' },
  { id: 'mon_warm_silver', name: 'Warm Silver Nitrate', category: 'Mono', c1: '#44403c', c2: '#fef3c7', exp: 2, con: 16, sat: -92, hue: 0, temp: 16, tint: 2, sh: [8, 4, -2], hi: [12, 8, 0], desc: 'Classic warm wet-plate silver tint.' },
  { id: 'mon_noir_silhouette', name: 'Noir Silhouette', category: 'Mono', c1: '#000000', c2: '#d4d4d8', exp: -6, con: 44, sat: -100, hue: 0, temp: 0, tint: 0, sh: [-8, -8, -8], hi: [10, 10, 10], desc: 'Extreme graphic black-and-white contrast.' },

  // === 114 New 2026 Pro Filters (226 Total) ===
  // Neon Expansion (25)
  { id: 'neo_cyber_mint', name: 'Cyber Mint Tube', category: 'Neon', c1: '#042f2e', c2: '#5eead4', exp: 2, con: 24, sat: 28, hue: -10, temp: -18, tint: -14, sh: [-10, 18, 20], hi: [6, 26, 22], desc: 'Fluorescent mint-cyan shadow split.' },
  { id: 'neo_sakura_laser', name: 'Sakura Laser Pink', category: 'Neon', c1: '#500724', c2: '#f472b6', exp: 3, con: 20, sat: 30, hue: 10, temp: -6, tint: 28, sh: [16, -6, 20], hi: [28, 8, 22], desc: 'Electric Tokyo blossom pink highlights.' },
  { id: 'neo_volt_surge', name: 'Volt Surge', category: 'Neon', c1: '#1a2e05', c2: '#d9f99d', exp: 2, con: 26, sat: 32, hue: 14, temp: 4, tint: -26, sh: [-6, 18, -4], hi: [18, 28, -8], desc: 'High-voltage chartreuse neon highlight glow.' },
  { id: 'neo_synth_gold', name: 'Synthwave Gold', category: 'Neon', c1: '#3b0764', c2: '#facc15', exp: 1, con: 24, sat: 28, hue: 4, temp: 14, tint: 16, sh: [10, -8, 24], hi: [28, 20, -6], desc: 'Purple horizon paired with glowing gold sun.' },
  { id: 'neo_vaporwave', name: 'Vaporwave 1995', category: 'Neon', c1: '#0891b2', c2: '#e879f9', exp: 4, con: 14, sat: 26, hue: 18, temp: -12, tint: 24, sh: [-6, 12, 26], hi: [24, 6, 26], desc: 'Dreamy VHS aqua and bubblegum violet haze.' },
  { id: 'neo_blade_runner', name: 'Blade City 2049', category: 'Neon', c1: '#0c4a6e', c2: '#fb923c', exp: -3, con: 30, sat: 22, hue: -6, temp: 4, tint: -4, sh: [-14, 12, 26], hi: [28, 12, -10], desc: 'Rainy neon cyan haze meets sodium-vapor amber.' },
  { id: 'neo_biohazard', name: 'Biohazard Glow', category: 'Neon', c1: '#052e16', c2: '#4ade80', exp: -1, con: 28, sat: 30, hue: 20, temp: -8, tint: -28, sh: [-12, 22, 2], hi: [6, 28, 4], desc: 'Radioactive emerald neon tube cast.' },
  { id: 'neo_magenta_haze', name: 'Magenta Haze', category: 'Neon', c1: '#701a75', c2: '#fb7185', exp: 2, con: 20, sat: 28, hue: 8, temp: 4, tint: 28, sh: [18, -8, 22], hi: [26, 4, 16], desc: 'Saturated club magenta fog & soft pink edges.' },
  { id: 'neo_plasma_cyan', name: 'Plasma Cyan', category: 'Neon', c1: '#083344', c2: '#00f5d4', exp: 1, con: 26, sat: 30, hue: -14, temp: -24, tint: -10, sh: [-14, 16, 26], hi: [2, 26, 26], desc: 'Ultra-bright cyan plasma highlight wash.' },
  { id: 'neo_retrowave', name: 'Retrowave Outrun', category: 'Neon', c1: '#1e1b4b', c2: '#f43f5e', exp: 0, con: 28, sat: 32, hue: 12, temp: 2, tint: 22, sh: [10, -10, 26], hi: [28, 2, 14], desc: 'Outrun midnight highway with crimson taillight glow.' },
  { id: 'neo_disco_violet', name: 'Disco Violet', category: 'Neon', c1: '#2e1065', c2: '#c084fc', exp: 2, con: 22, sat: 28, hue: 14, temp: -14, tint: 24, sh: [8, -6, 28], hi: [20, 8, 28], desc: 'Shimmering dancefloor ultraviolet glow.' },
  { id: 'neo_cobalt_pulse', name: 'Cobalt Pulse', category: 'Neon', c1: '#172554', c2: '#60a5fa', exp: 0, con: 26, sat: 26, hue: -14, temp: -28, tint: 2, sh: [-8, 4, 30], hi: [8, 16, 30], desc: 'Deep cobalt club lights with electric blue edge.' },
  { id: 'neo_toxic_lime', name: 'Toxic Slime', category: 'Neon', c1: '#14532d', c2: '#a3e635', exp: 1, con: 26, sat: 34, hue: 22, temp: 2, tint: -28, sh: [-8, 20, -6], hi: [16, 28, -10], desc: 'Vibrant street-dance neon lime accent.' },
  { id: 'neo_solar_flare', name: 'Neon Solar Flare', category: 'Neon', c1: '#7c2d12', c2: '#fde047', exp: 4, con: 22, sat: 30, hue: -4, temp: 24, tint: 6, sh: [14, 0, -10], hi: [30, 18, -12], desc: 'Blazing amber-yellow neon sign bloom.' },
  { id: 'neo_holo_frost', name: 'Holo Frost', category: 'Neon', c1: '#0f172a', c2: '#a5f3fc', exp: 4, con: 16, sat: 20, hue: -8, temp: -24, tint: 4, sh: [-6, 12, 24], hi: [14, 22, 28], desc: 'Cool holographic ice blue specular pop.' },
  { id: 'neo_inferno_red', name: 'Neon Inferno', category: 'Neon', c1: '#450a0a', c2: '#fb7185', exp: -1, con: 30, sat: 30, hue: 2, temp: 16, tint: 14, sh: [18, -10, -4], hi: [30, 4, 6], desc: 'Intense crimson sign reflection with crushed blacks.' },
  { id: 'neo_ghost_blue', name: 'Ghost Protocol', category: 'Neon', c1: '#020617', c2: '#38bdf8', exp: -2, con: 28, sat: 16, hue: -12, temp: -26, tint: -2, sh: [-10, 8, 26], hi: [4, 18, 26], desc: 'Stealth cyber-espionage cold neon blue.' },
  { id: 'neo_glitch_rose', name: 'Glitch Rose', category: 'Neon', c1: '#18181b', c2: '#fda4af', exp: 2, con: 24, sat: 24, hue: 8, temp: 4, tint: 22, sh: [10, -4, 16], hi: [28, 10, 18], desc: 'Pastel neon rose mixed with obsidian contrast.' },
  { id: 'neo_matrix_glow', name: 'Code Matrix Neon', category: 'Neon', c1: '#022c22', c2: '#22c55e', exp: -2, con: 30, sat: 22, hue: 16, temp: -10, tint: -26, sh: [-14, 20, -4], hi: [4, 26, 2], desc: 'Digital green phosphor monitor glow.' },
  { id: 'neo_afterhours', name: 'Club Afterhours', category: 'Neon', c1: '#1e1b4b', c2: '#f472b6', exp: -3, con: 26, sat: 26, hue: 6, temp: -12, tint: 20, sh: [8, -4, 22], hi: [24, 6, 20], desc: 'Moody 3AM neon bar lighting.' },
  { id: 'neo_sapphire_ice', name: 'Sapphire Neon', category: 'Neon', c1: '#0c192c', c2: '#22d3ee', exp: 0, con: 24, sat: 28, hue: -10, temp: -22, tint: 2, sh: [-10, 6, 28], hi: [10, 20, 28], desc: 'Rich sapphire shadows with piercing cyan tubes.' },
  { id: 'neo_coral_glow', name: 'Coral Neon', category: 'Neon', c1: '#0f766e', c2: '#fb7185', exp: 3, con: 20, sat: 30, hue: 2, temp: 4, tint: 12, sh: [-12, 16, 18], hi: [28, 8, 12], desc: 'Modern neon coral & teal split aesthetic.' },
  { id: 'neo_amber_sign', name: 'Diner Amber Sign', category: 'Neon', c1: '#1c1917', c2: '#f59e0b', exp: 1, con: 26, sat: 24, hue: -2, temp: 22, tint: 6, sh: [10, 2, -8], hi: [28, 14, -10], desc: 'Retro roadside neon diner glow.' },
  { id: 'neo_hyper_magenta', name: 'Hyper Magenta', category: 'Neon', c1: '#3b0764', c2: '#f0abfc', exp: 2, con: 24, sat: 34, hue: 16, temp: -10, tint: 30, sh: [16, -8, 28], hi: [28, 6, 28], desc: 'Maximum saturation magenta-violet stage wash.' },
  { id: 'neo_dual_prism', name: 'Dual Prism 2026', category: 'Neon', c1: '#06b6d4', c2: '#f43f5e', exp: 1, con: 26, sat: 30, hue: 0, temp: -8, tint: 10, sh: [-12, 14, 24], hi: [26, 6, 14], desc: 'Signature cyan & laser crimson dual prism.' },

  // Cinema Expansion (15)
  { id: 'cin_oppenheimer', name: 'Atomic Drama', category: 'Cinema', c1: '#27272a', c2: '#f97316', exp: -2, con: 30, sat: -14, hue: 0, temp: 14, tint: 2, sh: [-6, -2, 6], hi: [24, 10, -10], desc: 'Teal-gray midtones with fiery amber highlights.' },
  { id: 'cin_avatar_biolum', name: 'Bioluminescent', category: 'Cinema', c1: '#042f2e', c2: '#38bdf8', exp: 0, con: 20, sat: 24, hue: -10, temp: -22, tint: 4, sh: [-10, 12, 24], hi: [8, 20, 26], desc: 'Glowing night jungle blues and aqua.' },
  { id: 'cin_sicario_dust', name: 'Border Dust', category: 'Cinema', c1: '#451a03', c2: '#d97706', exp: 1, con: 24, sat: -18, hue: -2, temp: 26, tint: 4, sh: [10, 4, -8], hi: [20, 12, -10], desc: 'Tense desaturated ochre thriller palette.' },
  { id: 'cin_joker_grit', name: 'Gotham Grit', category: 'Cinema', c1: '#064e3b', c2: '#f59e0b', exp: -3, con: 28, sat: 8, hue: 4, temp: -4, tint: -12, sh: [-10, 14, 8], hi: [22, 12, -10], desc: 'Gritty turquoise shadows with warm streetlamp glow.' },
  { id: 'cin_lalaland_gold', name: 'Jazz Twilight', category: 'Cinema', c1: '#312e81', c2: '#fde047', exp: 3, con: 16, sat: 24, hue: 4, temp: 6, tint: 10, sh: [4, -4, 22], hi: [24, 18, -4], desc: 'Rich musical violet skies with golden warmth.' },
  { id: 'cin_revenant_ice', name: 'Glacier Cold', category: 'Cinema', c1: '#0f172a', c2: '#cbd5e1', exp: 2, con: 18, sat: -26, hue: -4, temp: -26, tint: -2, sh: [-8, 6, 18], hi: [4, 8, 12], desc: 'Stark survivalist winter steel tones.' },
  { id: 'cin_skyfall_slate', name: 'Espionage Slate', category: 'Cinema', c1: '#0c4a6e', c2: '#94a3b8', exp: -2, con: 24, sat: -12, hue: -4, temp: -16, tint: -2, sh: [-10, 6, 18], hi: [6, 10, 14], desc: 'Tailored spy-thriller blue-gray finish.' },
  { id: 'cin_dune_spice', name: 'Arrakis Spice', category: 'Cinema', c1: '#431407', c2: '#fb923c', exp: 2, con: 22, sat: -4, hue: -4, temp: 32, tint: 4, sh: [14, 2, -14], hi: [26, 12, -14], desc: 'Monolithic desert orange-copper drama.' },
  { id: 'cin_interstellar', name: 'Orbital Horizon', category: 'Cinema', c1: '#18181b', c2: '#bae6fd', exp: 1, con: 20, sat: -14, hue: -2, temp: -10, tint: 0, sh: [-4, 4, 12], hi: [12, 14, 16], desc: 'Clean anamorphic space-epic neutrality.' },
  { id: 'cin_nocturnal_red', name: 'Nocturnal Velvet', category: 'Cinema', c1: '#450a0a', c2: '#fda4af', exp: -4, con: 26, sat: 6, hue: 4, temp: 10, tint: 12, sh: [14, -6, 0], hi: [20, 6, 6], desc: 'Deep darkroom velvet red cinema mood.' },
  { id: 'cin_mediterranean', name: 'Riviera Cinema', category: 'Cinema', c1: '#0369a1', c2: '#fef08a', exp: 5, con: 12, sat: 16, hue: 0, temp: 12, tint: 0, sh: [-8, 6, 16], hi: [20, 14, -4], desc: 'Sun-drenched European coastal film stock.' },
  { id: 'cin_neo_noir_26', name: 'Neo Noir 2026', category: 'Cinema', c1: '#09090b', c2: '#22d3ee', exp: -4, con: 32, sat: -16, hue: -6, temp: -18, tint: 0, sh: [-10, 8, 18], hi: [6, 16, 18], desc: 'High-contrast modern detective thriller.' },
  { id: 'cin_amber_teal_pro', name: 'Blockbuster Gold', category: 'Cinema', c1: '#115e59', c2: '#fbbf24', exp: 1, con: 22, sat: 16, hue: 0, temp: 12, tint: -4, sh: [-14, 12, 18], hi: [24, 14, -12], desc: 'Balanced teal shadows & sunlit gold highlights.' },
  { id: 'cin_deep_emerald', name: 'Emerald Odyssey', category: 'Cinema', c1: '#022c22', c2: '#6ee7b7', exp: -1, con: 22, sat: 6, hue: 8, temp: -8, tint: -16, sh: [-10, 16, 6], hi: [4, 18, 8], desc: 'Lush cinematic forest shadow density.' },
  { id: 'cin_tokyo_drift', name: 'Midnight Expressway', category: 'Cinema', c1: '#0f172a', c2: '#f97316', exp: -2, con: 26, sat: 14, hue: -4, temp: -4, tint: 4, sh: [-8, 6, 20], hi: [24, 10, -8], desc: 'Night highway headlights & deep cobalt tarmac.' },

  // Film Expansion (15)
  { id: 'flm_portra160', name: 'Kodak Portra 160', category: 'Film', c1: '#78350f', c2: '#ffedd5', exp: 5, con: 2, sat: -8, hue: 2, temp: 8, tint: 4, sh: [4, 4, 0], hi: [10, 8, 0], desc: 'Ultra-fine daylight portrait negative.' },
  { id: 'flm_ektachrome', name: 'Ektachrome E100', category: 'Film', c1: '#1e3a8a', c2: '#bae6fd', exp: 2, con: 18, sat: 16, hue: -4, temp: -10, tint: 2, sh: [-6, 4, 16], hi: [8, 12, 16], desc: 'Crisp cool-balanced reversal slide film.' },
  { id: 'flm_astia100f', name: 'Fuji Astia 100F', category: 'Film', c1: '#9f1239', c2: '#fed7aa', exp: 4, con: 8, sat: 6, hue: 2, temp: 8, tint: 6, sh: [4, 2, 2], hi: [14, 8, 2], desc: 'Soft commercial fashion slide palette.' },
  { id: 'flm_natura1600', name: 'Fuji Natura 1600', category: 'Film', c1: '#064e3b', c2: '#fde68a', exp: 4, con: 10, sat: 4, hue: 4, temp: 4, tint: -6, sh: [-4, 10, 8], hi: [14, 12, -2], desc: 'Available-light warm grain 35mm emulsion.' },
  { id: 'flm_colorplus200', name: 'Kodak ColorPlus 200', category: 'Film', c1: '#92400e', c2: '#fde047', exp: 3, con: 10, sat: 8, hue: -2, temp: 20, tint: 2, sh: [10, 6, -8], hi: [18, 14, -8], desc: 'Sunny vintage yellow-gold 35mm roll.' },
  { id: 'flm_lomography400', name: 'Lomo CN 400', category: 'Film', c1: '#047857', c2: '#f43f5e', exp: 1, con: 20, sat: 24, hue: 4, temp: 6, tint: 2, sh: [-6, 12, 8], hi: [20, 6, 4], desc: 'Playful punchy saturated street film.' },
  { id: 'flm_reala_ace', name: 'Fuji Reala Ace', category: 'Film', c1: '#1e293b', c2: '#a7f3d0', exp: 2, con: 14, sat: 2, hue: 0, temp: -4, tint: -4, sh: [-4, 8, 10], hi: [8, 10, 6], desc: 'True-to-life hybrid film simulation.' },
  { id: 'flm_classic_neg', name: 'Classic Negative', category: 'Film', c1: '#134e4a', c2: '#fdba74', exp: 0, con: 22, sat: -8, hue: 4, temp: 6, tint: -8, sh: [-8, 12, 10], hi: [18, 10, -6], desc: 'High-character cyan-brown street print.' },
  { id: 'flm_bleach_2383', name: 'Silver Print 2383', category: 'Film', c1: '#18181b', c2: '#d4d4d8', exp: -2, con: 32, sat: -34, hue: 0, temp: 4, tint: 0, sh: [2, 2, 0], hi: [10, 8, 4], desc: 'Theatrical silver-retention 35mm look.' },
  { id: 'flm_metropolis', name: 'Lomo Metropolis', category: 'Film', c1: '#365314', c2: '#d6d3d1', exp: -1, con: 22, sat: -30, hue: 6, temp: 8, tint: -10, sh: [2, 10, -4], hi: [12, 10, -2], desc: 'Muted urban desaturated tungsten print.' },
  { id: 'flm_pacific_blue', name: 'Amber Coastal 400', category: 'Film', c1: '#0e7490', c2: '#fed7aa', exp: 4, con: 10, sat: 8, hue: -2, temp: 10, tint: -2, sh: [-6, 8, 12], hi: [16, 10, -4], desc: 'Breezy California beach roll aesthetic.' },
  { id: 'flm_redscale_xr', name: 'Redscale XR', category: 'Film', c1: '#7f1d1d', c2: '#fbbf24', exp: 1, con: 22, sat: 18, hue: -10, temp: 36, tint: 10, sh: [20, 0, -14], hi: [26, 12, -16], desc: 'Reverse-exposed fiery crimson-amber film.' },
  { id: 'flm_proimage100', name: 'ProImage 100', category: 'Film', c1: '#7c2d12', c2: '#fef08a', exp: 4, con: 8, sat: 10, hue: 0, temp: 12, tint: 2, sh: [6, 4, -4], hi: [14, 10, -4], desc: 'Warm wedding & tropical daylight emulsion.' },
  { id: 'flm_vision3_250d', name: 'Vision3 250D', category: 'Film', c1: '#1e3a8a', c2: '#fde68a', exp: 2, con: 14, sat: 6, hue: 0, temp: 8, tint: 0, sh: [-4, 4, 10], hi: [14, 10, -4], desc: 'Rich cinema daylight motion picture negative.' },
  { id: 'flm_polaroid_600', name: 'Polaroid 600 Fade', category: 'Film', c1: '#3f3f46', c2: '#fef3c7', exp: 6, con: -10, sat: -16, hue: 4, temp: 16, tint: -4, sh: [8, 10, 6], hi: [16, 14, -4], desc: 'Soft creamy instant square frame look.' },

  // Vintage Expansion (12)
  { id: 'vin_1950_diner', name: '1950s Chrome', category: 'Vintage', c1: '#0f766e', c2: '#fb7185', exp: 3, con: 16, sat: 10, hue: 2, temp: 10, tint: -4, sh: [-6, 12, 10], hi: [18, 8, 0], desc: 'Mid-century pastel turquoise & cherry tones.' },
  { id: 'vin_1988_mall', name: '1988 Retro Tape', category: 'Vintage', c1: '#4c1d95', c2: '#fde047', exp: 4, con: 6, sat: 12, hue: -6, temp: -4, tint: 12, sh: [8, 2, 16], hi: [14, 10, -4], desc: 'Warm VHS home-camcorder chroma cast.' },
  { id: 'vin_1970_route66', name: 'Route 66 Fade', category: 'Vintage', c1: '#7c2d12', c2: '#fcd34d', exp: 6, con: -8, sat: -14, hue: -4, temp: 28, tint: 4, sh: [14, 8, -8], hi: [20, 14, -8], desc: 'Dusty American highway 70s print fade.' },
  { id: 'vin_velvet_vinyl', name: 'Velvet Vinyl', category: 'Vintage', c1: '#431407', c2: '#d6d3d1', exp: -1, con: 14, sat: -20, hue: 0, temp: 18, tint: 4, sh: [12, 6, -4], hi: [14, 10, -4], desc: 'Warm analog record-sleeve shadow depth.' },
  { id: 'vin_tinted_1920', name: 'Amber Silent Era', category: 'Vintage', c1: '#451a03', c2: '#fef08a', exp: 2, con: 18, sat: -60, hue: 0, temp: 40, tint: 4, sh: [16, 10, -10], hi: [22, 16, -12], desc: 'Classic amber-tinted nitrate archival reel.' },
  { id: 'vin_olive_field', name: 'Olive Field 74', category: 'Vintage', c1: '#365314', c2: '#fef3c7', exp: 4, con: -6, sat: -18, hue: 6, temp: 14, tint: -12, sh: [4, 12, -4], hi: [14, 12, -6], desc: 'Warm olive-green vintage documentary matte.' },
  { id: 'vin_cassette_pop', name: 'Cassette Pop', category: 'Vintage', c1: '#be185d', c2: '#38bdf8', exp: 3, con: 12, sat: 18, hue: 4, temp: 2, tint: 10, sh: [4, 2, 14], hi: [18, 8, 8], desc: 'Vibrant 80s walkman poster aesthetic.' },
  { id: 'vin_faded_cobalt', name: 'Faded Cobalt 92', category: 'Vintage', c1: '#1e3a8a', c2: '#e2e8f0', exp: 6, con: -10, sat: -22, hue: -6, temp: -16, tint: 0, sh: [6, 10, 20], hi: [8, 10, 12], desc: 'Soft washed denim 90s print cast.' },
  { id: 'vin_cinnamon_toast', name: 'Cinnamon Fade', category: 'Vintage', c1: '#7c2d12', c2: '#fed7aa', exp: 5, con: -6, sat: -10, hue: 0, temp: 24, tint: 6, sh: [14, 6, -4], hi: [18, 12, -4], desc: 'Cozy warm cinnamon matte highlights.' },
  { id: 'vin_sage_retro', name: 'Sage Retro', category: 'Vintage', c1: '#14532d', c2: '#e7e5e4', exp: 5, con: -8, sat: -24, hue: 6, temp: 4, tint: -12, sh: [2, 12, 6], hi: [10, 12, 4], desc: 'Calm eucalyptus vintage print aesthetic.' },
  { id: 'vin_sunset_polaroid', name: 'Sunset Instant', category: 'Vintage', c1: '#9a3412', c2: '#fbcfe8', exp: 6, con: -8, sat: -8, hue: 4, temp: 22, tint: 12, sh: [14, 4, 4], hi: [20, 10, 4], desc: 'Rosy warm instant film sunset bloom.' },
  { id: 'vin_bronze_print', name: 'Patina Bronze', category: 'Vintage', c1: '#44403c', c2: '#fbbf24', exp: 1, con: 16, sat: -30, hue: -2, temp: 26, tint: 2, sh: [12, 6, -6], hi: [18, 12, -8], desc: 'Aged metallic bronze patina grade.' },

  // Moody Expansion (12)
  { id: 'moo_obsidian_rain', name: 'Obsidian Rain', category: 'Moody', c1: '#09090b', c2: '#38bdf8', exp: -5, con: 28, sat: -22, hue: -6, temp: -18, tint: 0, sh: [-8, 4, 18], hi: [2, 10, 14], desc: 'Dark wet street reflection & icy highlights.' },
  { id: 'moo_deep_mahogany', name: 'Deep Mahogany', category: 'Moody', c1: '#27110a', c2: '#b45309', exp: -6, con: 22, sat: -16, hue: -2, temp: 16, tint: 4, sh: [12, 2, -6], hi: [16, 8, -6], desc: 'Rich wooden library dark mood.' },
  { id: 'moo_nordic_fjord', name: 'Nordic Fjord', category: 'Moody', c1: '#0f172a', c2: '#5eead4', exp: -3, con: 18, sat: -24, hue: -6, temp: -20, tint: -6, sh: [-8, 10, 16], hi: [0, 10, 12], desc: 'Moody misty fjord teal-slate shadows.' },
  { id: 'moo_shadow_orchid', name: 'Shadow Orchid', category: 'Moody', c1: '#2e1065', c2: '#a855f7', exp: -5, con: 24, sat: -8, hue: 10, temp: -12, tint: 18, sh: [8, -6, 18], hi: [14, 4, 16], desc: 'Mysterious dark plum editorial grade.' },
  { id: 'moo_iron_forge', name: 'Iron Forge', category: 'Moody', c1: '#18181b', c2: '#ea580c', exp: -4, con: 28, sat: -20, hue: 0, temp: 10, tint: 2, sh: [2, 0, -2], hi: [20, 8, -6], desc: 'Industrial dark steel lit by orange sparks.' },
  { id: 'moo_misty_pine', name: 'Misty Pine', category: 'Moody', c1: '#052e16', c2: '#94a3b8', exp: -2, con: 12, sat: -28, hue: 4, temp: -10, tint: -10, sh: [-4, 10, 4], hi: [4, 8, 6], desc: 'Foggy highland pine forest mood.' },
  { id: 'moo_velvet_ash', name: 'Velvet Ash', category: 'Moody', c1: '#1c1917', c2: '#a8a29e', exp: -2, con: 14, sat: -42, hue: 0, temp: 2, tint: 0, sh: [4, 4, 4], hi: [6, 6, 4], desc: 'Subtle muted ash matte look.' },
  { id: 'moo_abyss_blue', name: 'Abyssal Blue', category: 'Moody', c1: '#020617', c2: '#2563eb', exp: -6, con: 26, sat: -6, hue: -10, temp: -26, tint: 2, sh: [-8, 0, 22], hi: [0, 8, 18], desc: 'Deep ocean abyss nocturnal blue.' },
  { id: 'moo_smoked_amber', name: 'Smoked Amber', category: 'Moody', c1: '#1c1917', c2: '#d97706', exp: -4, con: 20, sat: -18, hue: -2, temp: 20, tint: 4, sh: [8, 4, -4], hi: [18, 10, -8], desc: 'Whiskey lounge warm low-key light.' },
  { id: 'moo_graphite_mint', name: 'Graphite Mint', category: 'Moody', c1: '#09090b', c2: '#34d399', exp: -3, con: 24, sat: -18, hue: 4, temp: -12, tint: -12, sh: [-6, 10, 8], hi: [0, 14, 10], desc: 'Dark slate with cool mint speculars.' },
  { id: 'moo_dusk_crimson', name: 'Dusk Garnet', category: 'Moody', c1: '#450a0a', c2: '#9f1239', exp: -5, con: 24, sat: -10, hue: 4, temp: 10, tint: 14, sh: [12, -6, 4], hi: [16, 2, 4], desc: 'Rich garnet shadow cast for dramatic reels.' },
  { id: 'moo_slate_matte', name: 'Matte Slate 26', category: 'Moody', c1: '#1e293b', c2: '#cbd5e1', exp: 0, con: 6, sat: -34, hue: -2, temp: -10, tint: 0, sh: [2, 4, 10], hi: [4, 6, 8], desc: 'Clean lifted slate blacks for architectural shots.' },

  // Vibrant Expansion (11)
  { id: 'vib_bali_lagoon', name: 'Bali Lagoon', category: 'Vibrant', c1: '#0891b2', c2: '#4ade80', exp: 5, con: 14, sat: 32, hue: -2, temp: 4, tint: -8, sh: [-8, 14, 14], hi: [12, 18, 6], desc: 'Tropical waterfall greens and turquoise lagoon.' },
  { id: 'vib_dragonfruit', name: 'Dragonfruit Pop', category: 'Vibrant', c1: '#be185d', c2: '#facc15', exp: 5, con: 16, sat: 34, hue: 4, temp: 6, tint: 16, sh: [12, -4, 12], hi: [24, 10, 6], desc: 'Exotic magenta & sunny citrus vibrancy.' },
  { id: 'vib_sunflower_day', name: 'Sunflower Field', category: 'Vibrant', c1: '#15803d', c2: '#fde047', exp: 6, con: 12, sat: 28, hue: -2, temp: 18, tint: -4, sh: [-2, 10, -4], hi: [22, 18, -10], desc: 'Bright summer yellows & crisp garden greens.' },
  { id: 'vib_santorini', name: 'Santorini Sky', category: 'Vibrant', c1: '#1d4ed8', c2: '#bae6fd', exp: 7, con: 14, sat: 26, hue: -4, temp: -12, tint: 0, sh: [-8, 6, 20], hi: [8, 14, 18], desc: 'Crisp Greek island cobalt domes & bright whites.' },
  { id: 'vib_carnival_glow', name: 'Carnival Pop', category: 'Vibrant', c1: '#7c3aed', c2: '#fb923c', exp: 4, con: 18, sat: 36, hue: 2, temp: 10, tint: 10, sh: [8, -2, 18], hi: [24, 12, -4], desc: 'Festive ultraviolet and warm firework gold.' },
  { id: 'vib_matcha_fresh', name: 'Matcha Fresh', category: 'Vibrant', c1: '#047857', c2: '#bef264', exp: 5, con: 10, sat: 24, hue: 6, temp: 4, tint: -12, sh: [-4, 14, 2], hi: [12, 18, -4], desc: 'Crisp botanical cafe greenery.' },
  { id: 'vib_flamingo_coast', name: 'Flamingo Coast', category: 'Vibrant', c1: '#0d9488', c2: '#f472b6', exp: 5, con: 14, sat: 30, hue: 4, temp: 2, tint: 12, sh: [-8, 12, 14], hi: [24, 8, 14], desc: 'Playful turquoise water & flamingo pink sky.' },
  { id: 'vib_amber_blaze', name: 'Amber Blaze', category: 'Vibrant', c1: '#b91c1c', c2: '#fbbf24', exp: 3, con: 20, sat: 32, hue: -2, temp: 22, tint: 4, sh: [12, 0, -8], hi: [26, 14, -10], desc: 'High-energy fiery sunset radiance.' },
  { id: 'vib_ultramarine', name: 'Ultramarine Pop', category: 'Vibrant', c1: '#1e3a8a', c2: '#22d3ee', exp: 3, con: 20, sat: 32, hue: -8, temp: -16, tint: 0, sh: [-10, 6, 24], hi: [6, 18, 22], desc: 'Electric ocean blues & crisp specular contrast.' },
  { id: 'vib_aurora_green', name: 'Aurora Borealis', category: 'Vibrant', c1: '#064e3b', c2: '#a855f7', exp: 2, con: 18, sat: 32, hue: 10, temp: -12, tint: -6, sh: [-8, 16, 14], hi: [14, 18, 20], desc: 'Northern lights emerald & violet shimmer.' },
  { id: 'vib_cherry_soda', name: 'Cherry Pop', category: 'Vibrant', c1: '#9f1239', c2: '#fb7185', exp: 4, con: 16, sat: 30, hue: 4, temp: 8, tint: 14, sh: [12, -4, 6], hi: [22, 6, 8], desc: 'Glossy cherry red pop for product reels.' },

  // Portrait Expansion (10)
  { id: 'por_sunlit_tan', name: 'Sunlit Bronze', category: 'Portrait', c1: '#7c2d12', c2: '#fde68a', exp: 4, con: 10, sat: 10, hue: -2, temp: 18, tint: 2, sh: [10, 4, -6], hi: [18, 12, -6], desc: 'Natural golden-hour skin warmth.' },
  { id: 'por_silk_studio', name: 'Silk Ringlight', category: 'Portrait', c1: '#475569', c2: '#ffffff', exp: 8, con: 4, sat: -2, hue: 0, temp: 2, tint: 2, sh: [2, 2, 4], hi: [10, 10, 10], desc: 'Flattering clean creator ringlight finish.' },
  { id: 'por_cocoa_glow', name: 'Cocoa Radiance', category: 'Portrait', c1: '#431407', c2: '#fdba74', exp: 3, con: 12, sat: 4, hue: 0, temp: 14, tint: 4, sh: [10, 4, -4], hi: [16, 10, -2], desc: 'Luminous caramel-amber tone for deep skin.' },
  { id: 'por_rose_quartz', name: 'Rose Quartz Skin', category: 'Portrait', c1: '#881337', c2: '#fce7f3', exp: 6, con: 2, sat: 0, hue: 4, temp: 4, tint: 10, sh: [8, 2, 6], hi: [14, 8, 10], desc: 'Gentle rose-tinted porcelain beauty look.' },
  { id: 'por_editorial_noir', name: 'Vogue Warm', category: 'Portrait', c1: '#292524', c2: '#fef3c7', exp: 2, con: 18, sat: -16, hue: 0, temp: 10, tint: 2, sh: [6, 4, 0], hi: [14, 10, 2], desc: 'High-fashion low-saturation studio warmth.' },
  { id: 'por_daylight_pure', name: 'Daylight Natural', category: 'Portrait', c1: '#334155', c2: '#f8fafc', exp: 5, con: 6, sat: 2, hue: 0, temp: 2, tint: 0, sh: [0, 2, 2], hi: [8, 8, 6], desc: 'Clean true-color window light portrait grade.' },
  { id: 'por_caramel_soft', name: 'Caramel Soft', category: 'Portrait', c1: '#78350f', c2: '#fed7aa', exp: 5, con: -4, sat: -4, hue: 0, temp: 16, tint: 4, sh: [10, 6, -2], hi: [16, 10, -2], desc: 'Silky caramel shadows & gentle skin roll-off.' },
  { id: 'por_cool_editorial', name: 'Cool Editorial', category: 'Portrait', c1: '#1e293b', c2: '#e0f2fe', exp: 4, con: 10, sat: -14, hue: -2, temp: -12, tint: 2, sh: [-2, 4, 10], hi: [6, 8, 12], desc: 'Crisp high-fashion cool skin contrast.' },
  { id: 'por_golden_backlit', name: 'Golden Backlight', category: 'Portrait', c1: '#854d0e', c2: '#fef08a', exp: 7, con: 4, sat: 8, hue: 0, temp: 22, tint: 2, sh: [12, 6, -4], hi: [20, 14, -6], desc: 'Dreamy golden halo backlight skin sheen.' },
  { id: 'por_podcast_pro', name: 'Podcast 4K Look', category: 'Portrait', c1: '#0f172a', c2: '#fde68a', exp: 3, con: 16, sat: 4, hue: 0, temp: 6, tint: 0, sh: [-4, 2, 6], hi: [12, 10, 4], desc: 'Balanced cool background & warm key light.' },

  // Pastel Category (8)
  { id: 'pas_cotton_candy', name: 'Cotton Candy', category: 'Pastel', c1: '#7dd3fc', c2: '#fbcfe8', exp: 8, con: -10, sat: 4, hue: 4, temp: 2, tint: 12, sh: [8, 8, 16], hi: [18, 12, 16], desc: 'Airy pastel baby-blue and pink dream glow.' },
  { id: 'pas_lavender_milk', name: 'Lavender Milk', category: 'Pastel', c1: '#a78bfa', c2: '#fae8ff', exp: 7, con: -8, sat: -6, hue: 8, temp: -6, tint: 16, sh: [10, 4, 18], hi: [14, 10, 18], desc: 'Soft lilac highlight wash & creamy shadows.' },
  { id: 'pas_peach_sorbet', name: 'Peach Sorbet', category: 'Pastel', c1: '#fb923c', c2: '#ffedd5', exp: 8, con: -10, sat: 2, hue: 2, temp: 16, tint: 6, sh: [12, 8, 2], hi: [20, 14, 4], desc: 'Warm pastel apricot morning haze.' },
  { id: 'pas_mint_macaron', name: 'Mint Macaron', category: 'Pastel', c1: '#34d399', c2: '#ecfdf5', exp: 7, con: -8, sat: -6, hue: 4, temp: -8, tint: -10, sh: [2, 14, 10], hi: [10, 18, 12], desc: 'Clean pastel pistachio & airy whites.' },
  { id: 'pas_buttercream', name: 'Buttercream', category: 'Pastel', c1: '#eab308', c2: '#fefce8', exp: 9, con: -12, sat: -10, hue: 0, temp: 18, tint: 2, sh: [10, 10, 0], hi: [18, 16, 4], desc: 'Warm creamy pastel vanilla highlight.' },
  { id: 'pas_blush_cloud', name: 'Blush Cloud', category: 'Pastel', c1: '#f472b6', c2: '#fff1f2', exp: 8, con: -10, sat: -4, hue: 4, temp: 6, tint: 14, sh: [12, 4, 8], hi: [18, 10, 12], desc: 'Soft dreamy rose-petal morning glow.' },
  { id: 'pas_sky_powder', name: 'Sky Powder', category: 'Pastel', c1: '#38bdf8', c2: '#f0f9ff', exp: 8, con: -10, sat: -8, hue: -4, temp: -12, tint: 0, sh: [2, 10, 18], hi: [10, 14, 20], desc: 'Weightless powdery pale blue daylight.' },
  { id: 'pas_matcha_latte', name: 'Matcha Latte', category: 'Pastel', c1: '#65a30d', c2: '#f7fee7', exp: 7, con: -10, sat: -12, hue: 6, temp: 6, tint: -10, sh: [6, 12, 2], hi: [12, 16, 4], desc: 'Minimalist creamy cafe aesthetic.' },

  // Travel Category (8)
  { id: 'trv_amalfi_sun', name: 'Amalfi Sun', category: 'Travel', c1: '#0284c7', c2: '#fde047', exp: 5, con: 14, sat: 22, hue: -2, temp: 14, tint: -2, sh: [-6, 8, 14], hi: [20, 14, -6], desc: 'Vibrant Italian coast sea blues & lemon sun.' },
  { id: 'trv_kyoto_bamboo', name: 'Kyoto Bamboo', category: 'Travel', c1: '#065f46', c2: '#d9f99d', exp: 3, con: 14, sat: 14, hue: 6, temp: 2, tint: -12, sh: [-6, 14, 4], hi: [10, 16, -2], desc: 'Peaceful temple emerald & filtered forest light.' },
  { id: 'trv_marrakech', name: 'Marrakech Terracotta', category: 'Travel', c1: '#9a3412', c2: '#fdba74', exp: 3, con: 16, sat: 16, hue: -2, temp: 24, tint: 6, sh: [14, 4, -8], hi: [22, 12, -10], desc: 'Warm clay terracotta streets & sunlit spices.' },
  { id: 'trv_iceland_moss', name: 'Iceland Highland', category: 'Travel', c1: '#1e293b', c2: '#6ee7b7', exp: 1, con: 18, sat: -14, hue: 0, temp: -14, tint: -6, sh: [-6, 10, 12], hi: [6, 12, 10], desc: 'Volcanic black sand & vivid highland moss.' },
  { id: 'trv_paris_morning', name: 'Paris Cafe', category: 'Travel', c1: '#57534e', c2: '#fef3c7', exp: 5, con: 6, sat: -10, hue: 0, temp: 14, tint: 2, sh: [8, 6, 0], hi: [16, 12, 0], desc: 'Soft Parisian limestone & morning croissant warmth.' },
  { id: 'trv_alps_crisp', name: 'Swiss Alps Crisp', category: 'Travel', c1: '#0369a1', c2: '#f0f9ff', exp: 4, con: 16, sat: 12, hue: -2, temp: -8, tint: 0, sh: [-6, 6, 16], hi: [8, 12, 14], desc: 'Clear mountain air & crisp snow peak contrast.' },
  { id: 'trv_tulum_sand', name: 'Tulum Beach', category: 'Travel', c1: '#0f766e', c2: '#fef08a', exp: 6, con: 8, sat: 18, hue: 0, temp: 12, tint: -6, sh: [-4, 12, 12], hi: [18, 14, -4], desc: 'Breezy Mayan Riviera turquoise & warm sand.' },
  { id: 'trv_tokyo_dusk', name: 'Shibuya Twilight', category: 'Travel', c1: '#1e1b4b', c2: '#fb7185', exp: 0, con: 22, sat: 20, hue: 2, temp: -10, tint: 14, sh: [2, 2, 22], hi: [24, 8, 12], desc: 'Blue-hour metropolis glow with warm signage.' },

  // Mono Expansion (5)
  { id: 'mon_leica_street', name: 'Leica M11 Mono', category: 'Mono', c1: '#09090b', c2: '#e4e4e7', exp: 1, con: 24, sat: -100, hue: 0, temp: 0, tint: 0, sh: [-2, -2, -2], hi: [6, 6, 6], desc: 'Crisp high-microcontrast street monochrome.' },
  { id: 'mon_ir_infrared', name: 'Infrared B&W', category: 'Mono', c1: '#000000', c2: '#ffffff', exp: 2, con: 40, sat: -100, hue: 0, temp: -6, tint: 0, sh: [-8, -8, -4], hi: [12, 12, 12], desc: 'Dramatic black skies & glowing white foliage.' },
  { id: 'mon_split_copper', name: 'Copper Split B&W', category: 'Mono', c1: '#1c1917', c2: '#fed7aa', exp: 2, con: 20, sat: -82, hue: 0, temp: 22, tint: 4, sh: [4, 2, 0], hi: [18, 10, -2], desc: 'Cool charcoal shadows & warm copper highlights.' },
  { id: 'mon_silver_frost', name: 'Arctic Silver B&W', category: 'Mono', c1: '#0f172a', c2: '#e0f2fe', exp: 3, con: 18, sat: -88, hue: 0, temp: -18, tint: 0, sh: [-4, 2, 10], hi: [6, 10, 14], desc: 'Cool crystalline silver print tone.' },
  { id: 'mon_cinema_matte', name: 'Docu Matte B&W', category: 'Mono', c1: '#27272a', c2: '#d4d4d8', exp: 3, con: 6, sat: -100, hue: 0, temp: 0, tint: 0, sh: [8, 8, 8], hi: [0, 0, 0], desc: 'Gentle archival documentary grayscale.' },
];

const EXPANDED_LUT_PRESETS: LutPreset[] = EXPANDED_LUT_SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  description: s.desc,
  previewGradient: `linear-gradient(135deg, ${s.c1}, ${s.c2})`,
  exposureBias: s.exp,
  contrastBias: s.con,
  saturationBias: s.sat,
  hueBias: s.hue,
  temperatureBias: s.temp,
  tintBias: s.tint,
  shadowRgb: s.sh,
  highlightRgb: s.hi,
}));

export const LUT_PRESETS: LutPreset[] = [...CORE_LUT_PRESETS, ...EXPANDED_LUT_PRESETS];

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
  const hasPrism = (vfx.prism ?? 0) > 1;
  const hasNightVision = (vfx.nightVision ?? 0) > 1;

  if (
    !hasGlitch &&
    !hasDistort &&
    !hasPixelate &&
    !hasVhs &&
    !hasMirror &&
    !hasDuotone &&
    !hasPrism &&
    !hasNightVision
  ) {
    dst.set(src);
    return;
  }

  const blockSize = hasPixelate ? Math.max(2, Math.round((vfx.pixelate / 100) * 28)) : 1;
  const waveAmp = hasDistort ? (vfx.distortion / 100) * 24 : 0;
  const rgbShiftPx = hasGlitch ? Math.round((vfx.glitch / 100) * 18) : 0;
  const prismShiftMax = hasPrism ? ((vfx.prism ?? 0) / 100) * 22 : 0;
  const vhsStrength = hasVhs ? (vfx.vhsScanlines / 100) * 0.45 : 0;
  const quadMirror = (vfx.mirror ?? 0) >= 50;
  const duotoneMix = hasDuotone ? clamp((vfx.duotone ?? 0) / 100, 0, 1) : 0;
  const nvMix = hasNightVision ? clamp((vfx.nightVision ?? 0) / 100, 0, 1) : 0;
  const halfW = width * 0.5;
  const halfH = height * 0.5;

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

    const scanDim =
      hasVhs && y % 3 === 0
        ? 1 - vhsStrength
        : hasNightVision && y % 4 === 0
        ? 1 - 0.25 * nvMix
        : 1;
    const ny = (y - halfH) / Math.max(1, halfH);

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

      if (hasGlitch || hasPrism) {
        const nx = (x - halfW) / Math.max(1, halfW);
        const radialPx = hasPrism ? Math.round(nx * prismShiftMax) : 0;
        const radialPy = hasPrism ? Math.round(ny * prismShiftMax * 0.65) : 0;
        const rx = clamp(sx + rgbShiftPx + radialPx, 0, width - 1);
        const ry = clamp(sy + radialPy, 0, height - 1);
        const bx = clamp(sx - rgbShiftPx - radialPx, 0, width - 1);
        const by = clamp(sy - radialPy, 0, height - 1);
        const rIdx = (ry * width + rx) * 4;
        const gIdx = (sy * width + sx) * 4;
        const bIdx = (by * width + bx) * 4;
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

      if (hasNightVision && a > 0) {
        const luma = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);
        const boosted = clamp((luma - 0.08) * 1.35, 0, 1);
        const nvR = boosted * 48;
        const nvG = clamp(32 + boosted * 223, 0, 255);
        const nvB = boosted * 78;
        r = r * (1 - nvMix) + nvR * nvMix;
        g = g * (1 - nvMix) + nvG * nvMix;
        b = b * (1 - nvMix) + nvB * nvMix;
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
