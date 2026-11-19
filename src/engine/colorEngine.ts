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
