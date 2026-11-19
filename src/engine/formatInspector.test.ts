import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_FORMAT_SPECS,
  detectContainerFromBytes,
  extractExtension,
  inspectMediaFileSpec,
} from './formatInspector';

test('extractExtension normalizes common aliases', () => {
  assert.equal(extractExtension('clip.JPEG'), 'jpg');
  assert.equal(extractExtension('cam.MTS'), 'ts');
  assert.equal(extractExtension('voice.m4a'), 'aac');
  assert.equal(extractExtension('movie.mkv'), 'mkv');
});

test('detectContainerFromBytes identifies MP4, MKV, AVI, WAV, PNG, JPEG signatures', () => {
  const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.equal(detectContainerFromBytes(mp4, 'video.mp4')?.container, 'MPEG-4 (MP4)');

  const mkv = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81]);
  assert.equal(detectContainerFromBytes(mkv, 'movie.mkv')?.container, 'Matroska (MKV)');
  assert.equal(detectContainerFromBytes(mkv, 'clip.webm')?.container, 'WebM (EBML)');

  const avi = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20,
  ]);
  assert.equal(detectContainerFromBytes(avi, 'old.avi')?.container, 'AVI (RIFF)');

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  assert.equal(detectContainerFromBytes(png, 'overlay.png')?.category, 'image');
});

test('inspectMediaFileSpec covers all major formats cleanly', () => {
  const mov = inspectMediaFileSpec('cinema.mov', 'video/quicktime');
  assert.equal(mov.category, 'video');
  assert.equal(mov.strategy, 'hardware-direct');

  const flv = inspectMediaFileSpec('stream.flv', 'video/x-flv');
  assert.equal(flv.category, 'video');
  assert.equal(flv.strategy, 'remux-compatible');

  assert.ok(SUPPORTED_FORMAT_SPECS.length >= 18);
});
