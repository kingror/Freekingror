import type { MediaFormatInfo } from '../types/editor';

export interface FormatSpecEntry {
  extension: string;
  container: string;
  codecs: string;
  category: 'video' | 'audio' | 'image';
  nativeBrowserDecode: boolean;
  androidHardwareSupport: string;
  description: string;
}

export const SUPPORTED_FORMAT_SPECS: FormatSpecEntry[] = [
  {
    extension: 'mp4',
    container: 'MPEG-4 Part 14 (ISOBMFF)',
    codecs: 'H.264 / AVC, H.265 / HEVC, AV1, AAC',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'MediaCodec HW Accelerated',
    description: 'Universal Android camera & social delivery container.',
  },
  {
    extension: 'mov',
    container: 'QuickTime Movie (QTFF)',
    codecs: 'H.264, HEVC, ProRes 422 / 4444, PCM',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'ISOBMFF-compatible HW Decode',
    description: 'Cinema camera & iOS/ProRes master editing container.',
  },
  {
    extension: 'webm',
    container: 'WebM (Matroska Profile)',
    codecs: 'VP8, VP9, AV1, Opus, Vorbis',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Native Chromium HW/SW',
    description: 'Royalty-free web & alpha-channel cinema container.',
  },
  {
    extension: 'mkv',
    container: 'Matroska Multimedia (EBML)',
    codecs: 'H.264, HEVC, VP9, AV1, FLAC, AC3',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Chromium / ExoPlayer MKV Demux',
    description: 'Multi-track lossless archive container with subtitles.',
  },
  {
    extension: '3gp',
    container: '3GPP Multimedia',
    codecs: 'H.264, H.263, MPEG-4, AMR-NB/WB',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Native Android Core',
    description: 'Lightweight mobile recording & messaging container.',
  },
  {
    extension: 'm4v',
    container: 'iTunes / MPEG-4 Video',
    codecs: 'H.264, AAC',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'MediaCodec H.264',
    description: 'DRM-free MP4 variant with chapter markers.',
  },
  {
    extension: 'ogv',
    container: 'Ogg Video',
    codecs: 'Theora, Opus, Vorbis',
    category: 'video',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Native Browser Decode',
    description: 'Open-standard streaming container.',
  },
  {
    extension: 'avi',
    container: 'Audio Video Interleave (RIFF)',
    codecs: 'MJPEG, DivX, Xvid, H.264, PCM',
    category: 'video',
    nativeBrowserDecode: false,
    androidHardwareSupport: 'Container Inspector + Remux',
    description: 'Classic desktop & action-cam capture container.',
  },
  {
    extension: 'flv',
    container: 'Flash Video (FLV)',
    codecs: 'H.264 / Sorenson Spark, AAC',
    category: 'video',
    nativeBrowserDecode: false,
    androidHardwareSupport: 'Container Inspector + Remux',
    description: 'Legacy broadcast & live stream capture format.',
  },
  {
    extension: 'ts',
    container: 'MPEG Transport Stream',
    codecs: 'H.264, MPEG-2, AAC',
    category: 'video',
    nativeBrowserDecode: false,
    androidHardwareSupport: 'HLS / Broadcast Stream',
    description: 'Broadcast & AVCHD camcorder transport stream.',
  },
  {
    extension: 'wmv',
    container: 'Windows Media Video (ASF)',
    codecs: 'VC-1, WMV9, WMA',
    category: 'video',
    nativeBrowserDecode: false,
    androidHardwareSupport: 'Container Inspector + Remux',
    description: 'Legacy Windows editing & archive format.',
  },
  {
    extension: 'gif',
    container: 'Graphics Interchange Format',
    codecs: 'LZW Animated Frames',
    category: 'image',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Direct Canvas Raster',
    description: 'Looping reaction clips & lightweight stickers.',
  },
  {
    extension: 'mp3',
    container: 'MPEG-1/2 Audio Layer III',
    codecs: 'MP3 CBR / VBR',
    category: 'audio',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'WebAudio + MediaCodec',
    description: 'Universal compressed music & voiceover audio.',
  },
  {
    extension: 'wav',
    container: 'RIFF WAVE PCM',
    codecs: 'Uncompressed LPCM 16/24/32-bit',
    category: 'audio',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Zero-latency WebAudio',
    description: 'Studio master lossless audio format.',
  },
  {
    extension: 'aac',
    container: 'Advanced Audio Coding (ADTS)',
    codecs: 'AAC-LC, HE-AAC',
    category: 'audio',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Hardware AAC Decoder',
    description: 'High-efficiency mobile audio track.',
  },
  {
    extension: 'flac',
    container: 'Free Lossless Audio Codec',
    codecs: 'FLAC 24-bit',
    category: 'audio',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Native Android FLAC',
    description: 'Bit-perfect compressed studio audio.',
  },
  {
    extension: 'ogg',
    container: 'Ogg Vorbis / Opus',
    codecs: 'Opus, Vorbis',
    category: 'audio',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Native WebAudio',
    description: 'High-fidelity low-bitrate game & cinema stems.',
  },
  {
    extension: 'png',
    container: 'Portable Network Graphics',
    codecs: 'RGBA Lossless (Alpha)',
    category: 'image',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Direct GPU Texture',
    description: 'Transparent overlays, watermarks & LUT stills.',
  },
  {
    extension: 'jpg',
    container: 'JPEG / JFIF',
    codecs: 'DCT Still Frame',
    category: 'image',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Direct GPU Texture',
    description: 'High-resolution photography & B-roll stills.',
  },
  {
    extension: 'webp',
    container: 'WebP RIFF',
    codecs: 'VP8 / VP8L (Alpha)',
    category: 'image',
    nativeBrowserDecode: true,
    androidHardwareSupport: 'Direct GPU Texture',
    description: 'Modern compressed stills & animated overlays.',
  },
];

const EXTENSION_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  mts: 'ts',
  m2ts: 'ts',
  mpeg: 'ts',
  mpg: 'ts',
  m4a: 'aac',
  opus: 'ogg',
  '3gpp': '3gp',
  '3g2': '3gp',
};

export function extractExtension(filename: string): string {
  const parts = filename.toLowerCase().trim().split('.');
  if (parts.length < 2) return '';
  const raw = parts[parts.length - 1];
  return EXTENSION_ALIASES[raw] ?? raw;
}

export function detectContainerFromBytes(
  bytes: Uint8Array,
  filename: string
): { container: string; codecGuess: string; category: 'video' | 'audio' | 'image' } | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { container: 'PNG Image', codecGuess: 'RGBA Lossless', category: 'image' };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { container: 'JPEG Image', codecGuess: 'DCT Photo', category: 'image' };
  }
  // GIF: GIF87a / GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { container: 'Animated GIF', codecGuess: 'LZW Indexed', category: 'image' };
  }
  // ISOBMFF (MP4 / MOV / M4V / 3GP): offset 4..7 == "ftyp"
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === 'qt  ') {
      return { container: 'QuickTime MOV', codecGuess: 'H.264 / ProRes', category: 'video' };
    }
    if (brand.startsWith('3gp')) {
      return { container: '3GPP Mobile Video', codecGuess: 'H.264 / AAC', category: 'video' };
    }
    if (brand === 'M4A ') {
      return { container: 'MPEG-4 Audio', codecGuess: 'AAC-LC', category: 'audio' };
    }
    return { container: 'MPEG-4 (MP4)', codecGuess: 'H.264 / HEVC', category: 'video' };
  }
  // EBML (MKV / WebM): 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const ext = extractExtension(filename);
    if (ext === 'webm') {
      return { container: 'WebM (EBML)', codecGuess: 'VP9 / AV1 / Opus', category: 'video' };
    }
    return { container: 'Matroska (MKV)', codecGuess: 'H.264 / HEVC / VP9', category: 'video' };
  }
  // RIFF (AVI / WAV / WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const form = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (form === 'AVI ') {
      return { container: 'AVI (RIFF)', codecGuess: 'MJPEG / Xvid / H.264', category: 'video' };
    }
    if (form === 'WAVE') {
      return { container: 'WAV PCM Audio', codecGuess: 'Uncompressed LPCM', category: 'audio' };
    }
    if (form === 'WEBP') {
      return { container: 'WebP Image', codecGuess: 'VP8 / Alpha', category: 'image' };
    }
  }
  // FLV: 46 4C 56 01
  if (bytes[0] === 0x46 && bytes[1] === 0x4c && bytes[2] === 0x56) {
    return { container: 'Flash Video (FLV)', codecGuess: 'H.264 / AAC', category: 'video' };
  }
  // Ogg: OggS
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    const ext = extractExtension(filename);
    return ext === 'ogv'
      ? { container: 'Ogg Video', codecGuess: 'Theora / Vorbis', category: 'video' }
      : { container: 'Ogg Audio', codecGuess: 'Opus / Vorbis', category: 'audio' };
  }
  // FLAC: fLaC
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { container: 'FLAC Lossless', codecGuess: 'FLAC PCM', category: 'audio' };
  }
  // MP3: ID3 or frame sync FF FB / FF F3
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return { container: 'MP3 Audio', codecGuess: 'MPEG Layer III', category: 'audio' };
  }
  // MPEG-TS: 0x47 sync byte
  if (bytes[0] === 0x47) {
    return { container: 'MPEG Transport Stream', codecGuess: 'H.264 / MPEG-2', category: 'video' };
  }

  return null;
}

export function inspectMediaFileSpec(
  filename: string,
  mimeType: string,
  bytes?: Uint8Array
): MediaFormatInfo {
  const ext = extractExtension(filename);
  const spec = SUPPORTED_FORMAT_SPECS.find((s) => s.extension === ext);
  const byteMatch = bytes ? detectContainerFromBytes(bytes, filename) : null;

  let category: 'video' | 'audio' | 'image' = spec?.category ?? byteMatch?.category ?? 'video';
  if (!spec && !byteMatch) {
    if (mimeType.startsWith('audio/')) category = 'audio';
    else if (mimeType.startsWith('image/')) category = 'image';
  }

  const container = byteMatch?.container ?? spec?.container ?? `${ext.toUpperCase() || 'RAW'} Stream`;
  const codecLabel = byteMatch?.codecGuess ?? spec?.codecs ?? (mimeType || 'Auto-Detect');
  const nativePlayable = spec?.nativeBrowserDecode ?? (category === 'image' || category === 'audio');

  return {
    container,
    extension: ext || 'bin',
    codecLabel,
    mimeType: mimeType || `${category}/${ext || 'octet-stream'}`,
    category,
    nativePlayable,
    strategy:
      category === 'image'
        ? 'image-sequence'
        : category === 'audio'
        ? 'audio-pcm'
        : nativePlayable
        ? 'hardware-direct'
        : 'remux-compatible',
    notes:
      spec?.description ??
      'Container inspected via binary signature and routed to universal timeline.',
  };
}
