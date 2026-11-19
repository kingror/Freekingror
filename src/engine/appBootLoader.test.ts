import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRealBootProgress,
  discoverAppBootFiles,
  formatBytesRead,
} from './appBootLoader';

test('computeRealBootProgress starts at 1%, scales with real bytes & tasks, and reaches 100% only on full completion', () => {
  assert.equal(
    computeRealBootProgress({ bytesRead: 0, totalBytes: 1000, completedTasks: 0, totalTasks: 10 }),
    1
  );

  // When bytes are not yet known (totalBytes = 0), uses real completed tasks ratio
  const unknownBytesMid = computeRealBootProgress({
    bytesRead: 0,
    totalBytes: 0,
    completedTasks: 5,
    totalTasks: 10,
  });
  assert.equal(unknownBytesMid, 50);

  // Midpoint with known real stream bytes
  const mid = computeRealBootProgress({
    bytesRead: 500,
    totalBytes: 1000,
    completedTasks: 5,
    totalTasks: 10,
  });
  assert.equal(mid, 50);

  // Does not hit 100% until final task finishes
  const almostDone = computeRealBootProgress({
    bytesRead: 1000,
    totalBytes: 1000,
    completedTasks: 9,
    totalTasks: 10,
  });
  assert.ok(almostDone < 100 && almostDone >= 95);

  assert.equal(
    computeRealBootProgress({ bytesRead: 1000, totalBytes: 1000, completedTasks: 10, totalTasks: 10 }),
    100
  );
});

test('discoverAppBootFiles returns real bundled media entries without fake sizes', () => {
  const files = discoverAppBootFiles();
  assert.ok(files.length >= 4);
  assert.ok(files.some((f) => f.isImage));
  assert.ok(files.every((f) => typeof f.url === 'string' && f.url.length > 0));
});

test('formatBytesRead formats KB and MB cleanly', () => {
  assert.equal(formatBytesRead(0), '0 KB');
  assert.equal(formatBytesRead(12_288), '12 KB');
  assert.equal(formatBytesRead(2 * 1024 * 1024), '2.0 MB');
});
