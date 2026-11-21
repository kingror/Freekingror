import type { AspectRatio, ExportFormat, ExportResolution } from '../types/editor';

export interface SocialExportPreset {
  id: string;
  label: string;
  platform: string;
  aspectRatio: AspectRatio;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: 24 | 30 | 60;
  bitrateMbps: number;
  codecBadge: string;
}

export const SOCIAL_EXPORT_PRESETS: SocialExportPreset[] = [
  {
    id: 'tiktok',
    label: 'TikTok / Reels',
    platform: 'TikTok',
    aspectRatio: '9:16',
    format: 'mp4',
    resolution: '1080p',
    fps: 60,
    bitrateMbps: 20,
    codecBadge: '9:16 · MP4 · 60fps',
  },
  {
    id: 'youtube',
    label: 'YouTube 4K',
    platform: 'YouTube',
    aspectRatio: '16:9',
    format: 'mp4',
    resolution: '2160p',
    fps: 60,
    bitrateMbps: 36,
    codecBadge: '16:9 · MP4 · 4K60',
  },
  {
    id: 'instagram_square',
    label: 'Instagram 1:1',
    platform: 'Instagram',
    aspectRatio: '1:1',
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    bitrateMbps: 14,
    codecBadge: '1:1 · MP4 · 1080p',
  },
  {
    id: 'instagram_portrait',
    label: 'IG Feed 4:5',
    platform: 'Instagram',
    aspectRatio: '4:5',
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    bitrateMbps: 14,
    codecBadge: '4:5 · MP4 · 1080p',
  },
  {
    id: 'youtube_shorts_webm',
    label: 'YT Shorts VP9',
    platform: 'YouTube',
    aspectRatio: '9:16',
    format: 'webm',
    resolution: '1080p',
    fps: 60,
    bitrateMbps: 18,
    codecBadge: '9:16 · WEBM · VP9',
  },
  {
    id: 'cinema_scope',
    label: 'Cinema 21:9',
    platform: 'Cinema',
    aspectRatio: '21:9',
    format: 'mov',
    resolution: '2160p',
    fps: 24,
    bitrateMbps: 40,
    codecBadge: '21:9 · MOV · 24fps',
  },
];

export function findMatchingSocialPresetId(
  aspectRatio: AspectRatio,
  settings: {
    format: ExportFormat;
    resolution: ExportResolution;
    fps: 24 | 30 | 60;
  }
): string | null {
  const exact = SOCIAL_EXPORT_PRESETS.find(
    (p) =>
      p.aspectRatio === aspectRatio &&
      p.format === settings.format &&
      p.resolution === settings.resolution &&
      p.fps === settings.fps
  );
  return exact ? exact.id : null;
}
