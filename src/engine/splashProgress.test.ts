import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_DISPLAY_NAME,
  APP_PACKAGE_NAME,
  SPLASH_DURATION_MS,
  computeSplashProgress,
  getSplashStageLabel,
  shouldSkipSplashFromSearch,
} from './splashProgress';

test('APP_DISPLAY_NAME and APP_PACKAGE_NAME match RORN and com.rorn.pro', () => {
  assert.equal(APP_DISPLAY_NAME, 'RORN');
  assert.equal(APP_PACKAGE_NAME, 'com.rorn.pro');
});

test('computeSplashProgress starts at 1%, rises monotonically, and reaches 100%', () => {
  assert.equal(computeSplashProgress(0), 1);
  assert.equal(computeSplashProgress(-100), 1);
  assert.equal(computeSplashProgress(SPLASH_DURATION_MS), 100);
  assert.equal(computeSplashProgress(SPLASH_DURATION_MS + 500), 100);

  let prev = 1;
  for (let ms = 0; ms <= SPLASH_DURATION_MS; ms += 50) {
    const val = computeSplashProgress(ms, SPLASH_DURATION_MS);
    assert.ok(val >= 1 && val <= 100, `progress ${val} out of bounds`);
    assert.ok(val >= prev, `progress decreased from ${prev} to ${val} at ${ms}ms`);
    prev = val;
  }
});

test('getSplashStageLabel returns expected stage labels across 1-100%', () => {
  assert.equal(getSplashStageLabel(1), 'Booting RORN Core');
  assert.equal(getSplashStageLabel(35), 'Loading Timeline & Color Engine');
  assert.equal(getSplashStageLabel(70), 'Calibrating Audio Mixer & Scopes');
  assert.equal(getSplashStageLabel(95), 'Preparing Studio Workspace');
  assert.equal(getSplashStageLabel(100), 'Ready');
});

test('shouldSkipSplashFromSearch only skips when autostart=1', () => {
  assert.equal(shouldSkipSplashFromSearch(''), false);
  assert.equal(shouldSkipSplashFromSearch('?foo=bar'), false);
  assert.equal(shouldSkipSplashFromSearch('?autostart=0'), false);
  assert.equal(shouldSkipSplashFromSearch('?autostart=1'), true);
});
