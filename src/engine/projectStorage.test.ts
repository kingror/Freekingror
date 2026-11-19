import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProjectProgress,
  createNewBlankProjectRecord,
  createSeedDemoProject,
  deleteSavedProject,
  formatProjectDateTime,
  upsertSavedProject,
} from './projectStorage';
import { INITIAL_TRACKS } from './sampleProject';

test('computeProjectProgress scales cleanly from blank project to graded exported project', () => {
  const blankPct = computeProjectProgress({
    clips: [],
    tracks: INITIAL_TRACKS,
    playhead: 0,
    exportedCount: 0,
  });
  assert.equal(blankPct, 10);

  const demo = createSeedDemoProject(1_700_000_000_000);
  assert.equal(demo.progressPct, 90);

  const exportedPct = computeProjectProgress({
    clips: demo.clips,
    tracks: demo.tracks,
    playhead: demo.playhead,
    exportedCount: 1,
  });
  assert.equal(exportedPct, 100);
});

test('upsertSavedProject, createNewBlankProjectRecord, and deleteSavedProject maintain sorted list', () => {
  const demo = createSeedDemoProject(1_700_000_000_000);
  const fresh = createNewBlankProjectRecord([demo], 1_700_001_000_000);
  assert.equal(fresh.clips.length, 0);
  assert.equal(fresh.progressPct, 10);

  const listAfterAdd = upsertSavedProject(fresh, [demo]);
  assert.equal(listAfterAdd.length, 2);
  assert.equal(listAfterAdd[0].id, fresh.id);

  const listAfterDelete = deleteSavedProject(demo.id, listAfterAdd);
  assert.equal(listAfterDelete.length, 1);
  assert.equal(listAfterDelete[0].id, fresh.id);
});

test('formatProjectDateTime returns readable date and time string', () => {
  const label = formatProjectDateTime(1_700_000_000_000);
  assert.ok(label.includes('·'));
  assert.ok(label.length > 8);
});
