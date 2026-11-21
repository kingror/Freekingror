import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveAudioPan,
  computeEffectiveTrackAndClipGain,
  estimateTrackLiveMeterLevel,
  formatPanLabel,
  getMixerTracks,
  getTrackPan,
  getTrackVolumePct,
  isTrackAudible,
  resetMixerTracks,
  updateTrackPanInList,
  updateTrackVolumeInList,
  volumePctToDbLabel,
} from './audioMixer';
import { INITIAL_TRACKS, createInitialAssets, createInitialClips } from './sampleProject';

test('getTrackVolumePct and updateTrackVolumeInList clamp and preserve independence', () => {
  let tracks = INITIAL_TRACKS.map((t) => ({ ...t }));
  assert.equal(getTrackVolumePct(tracks[3]), 100);

  tracks = updateTrackVolumeInList(tracks, 'track_a1', 42);
  tracks = updateTrackVolumeInList(tracks, 'track_a2', 165);

  const a1 = tracks.find((t) => t.id === 'track_a1')!;
  const a2 = tracks.find((t) => t.id === 'track_a2')!;
  assert.equal(getTrackVolumePct(a1), 42);
  assert.equal(getTrackVolumePct(a2), 165);

  // Clamping boundaries
  tracks = updateTrackVolumeInList(tracks, 'track_a1', -25);
  tracks = updateTrackVolumeInList(tracks, 'track_a2', 350);
  assert.equal(getTrackVolumePct(tracks.find((t) => t.id === 'track_a1')), 0);
  assert.equal(getTrackVolumePct(tracks.find((t) => t.id === 'track_a2')), 200);
});

test('volumePctToDbLabel formats unity, boost, attenuation, and silence cleanly', () => {
  assert.equal(volumePctToDbLabel(0), '-∞ dB');
  assert.equal(volumePctToDbLabel(100), '0.0 dB');
  assert.equal(volumePctToDbLabel(200), '+6.0 dB');
  assert.equal(volumePctToDbLabel(50), '-6.0 dB');
});

test('independent track volume & solo/mute affect computeEffectiveTrackAndClipGain', () => {
  const clips = createInitialClips();
  const a1Clip = clips.find((c) => c.trackId === 'track_a1')!;
  const a2Clip = clips.find((c) => c.trackId === 'track_a2')!;

  let tracks = INITIAL_TRACKS.map((t) => ({ ...t }));
  tracks = updateTrackVolumeInList(tracks, 'track_a1', 50);
  tracks = updateTrackVolumeInList(tracks, 'track_a2', 150);

  const trA1 = tracks.find((t) => t.id === 'track_a1')!;
  const trA2 = tracks.find((t) => t.id === 'track_a2')!;

  const g1 = computeEffectiveTrackAndClipGain(a1Clip, trA1, tracks, 5.5, 100);
  const g2 = computeEffectiveTrackAndClipGain(a2Clip, trA2, tracks, 0.8, 100);

  assert.ok(g1 > 0.4 && g1 < 0.6, `expected ~0.475 for A1 at 50%, got ${g1}`);
  assert.ok(g2 > 1.2 && g2 < 1.5, `expected ~1.35 for A2 at 150%, got ${g2}`);

  // Soloing track_a2 silences track_a1 without mutating A1's volume setting
  const soloTracks = tracks.map((t) => (t.id === 'track_a2' ? { ...t, solo: true } : t));
  assert.equal(isTrackAudible(soloTracks.find((t) => t.id === 'track_a1')!, soloTracks), false);
  assert.equal(isTrackAudible(soloTracks.find((t) => t.id === 'track_a2')!, soloTracks), true);
  assert.equal(
    computeEffectiveTrackAndClipGain(a1Clip, soloTracks.find((t) => t.id === 'track_a1')!, soloTracks, 5.5, 100),
    0
  );
  assert.equal(getTrackVolumePct(soloTracks.find((t) => t.id === 'track_a1')), 50);
});

test('track pan sums cleanly with clip pan and clamps within [-1, 1]', () => {
  const clips = createInitialClips();
  const a2Clip = clips.find((c) => c.trackId === 'track_a2')!;
  const tracks = updateTrackPanInList(INITIAL_TRACKS, 'track_a2', 50);
  const trA2 = tracks.find((t) => t.id === 'track_a2')!;

  assert.equal(getTrackPan(trA2), 50);
  assert.equal(formatPanLabel(0), 'C');
  assert.equal(formatPanLabel(-45), 'L45');
  assert.equal(formatPanLabel(50), 'R50');

  const panEnd = computeEffectiveAudioPan(a2Clip, trA2, 1.6);
  assert.equal(panEnd, 1);
});

test('getMixerTracks includes all audio tracks and video tracks hosting video clips', () => {
  const clips = createInitialClips();
  const tracks = INITIAL_TRACKS.map((t) => ({ ...t }));
  const baseMixer = getMixerTracks(tracks, clips);
  assert.deepEqual(
    baseMixer.map((t) => t.id),
    ['track_a1', 'track_a2']
  );

  const withVideoClip = [
    ...clips,
    {
      ...clips[0],
      id: 'clip_v_real',
      kind: 'video' as const,
      trackId: 'track_v1',
    },
  ];
  const mixerWithVideo = getMixerTracks(tracks, withVideoClip);
  assert.deepEqual(
    mixerWithVideo.map((t) => t.id),
    ['track_a1', 'track_a2', 'track_v1']
  );
});

test('estimateTrackLiveMeterLevel responds to independent track volumes and resetMixerTracks restores defaults', () => {
  const assets = createInitialAssets('blob:test-score');
  const clips = createInitialClips();
  let tracks = updateTrackVolumeInList(INITIAL_TRACKS, 'track_a1', 160);
  tracks = updateTrackVolumeInList(tracks, 'track_a2', 40);

  const mA1 = estimateTrackLiveMeterLevel(
    tracks.find((t) => t.id === 'track_a1')!,
    tracks,
    clips,
    assets,
    5.5,
    true,
    100
  );
  const mA2 = estimateTrackLiveMeterLevel(
    tracks.find((t) => t.id === 'track_a2')!,
    tracks,
    clips,
    assets,
    5.5,
    true,
    100
  );

  assert.ok(mA1.level01 > mA2.level01, `expected boosted A1 (${mA1.level01}) > attenuated A2 (${mA2.level01})`);

  const reset = resetMixerTracks(tracks);
  assert.equal(getTrackVolumePct(reset.find((t) => t.id === 'track_a1')), 100);
  assert.equal(getTrackVolumePct(reset.find((t) => t.id === 'track_a2')), 100);
  assert.equal(getTrackPan(reset.find((t) => t.id === 'track_a2')), 0);
});
