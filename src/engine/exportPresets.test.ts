import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCIAL_EXPORT_PRESETS,
  findMatchingSocialPresetId,
} from './exportPresets';

test('SOCIAL_EXPORT_PRESETS includes TikTok 9:16, YouTube 16:9, and Instagram 1:1', () => {
  const byId = new Map(SOCIAL_EXPORT_PRESETS.map((p) => [p.id, p]));
  assert.equal(byId.get('tiktok')?.aspectRatio, '9:16');
  assert.equal(byId.get('youtube')?.aspectRatio, '16:9');
  assert.equal(byId.get('instagram_square')?.aspectRatio, '1:1');
  assert.ok(SOCIAL_EXPORT_PRESETS.length >= 6);
});

test('findMatchingSocialPresetId matches active aspect ratio and codec config', () => {
  assert.equal(
    findMatchingSocialPresetId('9:16', { format: 'mp4', resolution: '1080p', fps: 60 }),
    'tiktok'
  );
  assert.equal(
    findMatchingSocialPresetId('1:1', { format: 'mp4', resolution: '1080p', fps: 30 }),
    'instagram_square'
  );
  assert.equal(
    findMatchingSocialPresetId('16:9', { format: 'gif', resolution: '480p', fps: 24 }),
    null
  );
});
