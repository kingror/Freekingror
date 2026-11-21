import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
  GOOGLE_ADMOB_REWARDED_INTERSTITIAL_TEST_ID,
  GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
  GOOGLE_IMA_VAST_TEST_TAG,
  consumeAdFreePassExport,
  consumeCourtesyFreeExport,
  formatAdPassRemaining,
  getAdPassStatus,
  getGoogleTestAdUnit,
  recordVideoAdRewardCompleted,
  resetAdPacingStateForTests,
} from './googleAds';

test('returns official Google AdMob test ad unit IDs for rewarded, rewardedInterstitial, and interstitial', () => {
  const rewarded = getGoogleTestAdUnit('rewarded');
  assert.equal(rewarded.adUnitId, GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID);
  assert.equal(rewarded.vastTagUrl, GOOGLE_IMA_VAST_TEST_TAG);
  assert.ok(rewarded.skipAfterSec <= 3);

  const rewInt = getGoogleTestAdUnit('rewardedInterstitial');
  assert.equal(rewInt.adUnitId, GOOGLE_ADMOB_REWARDED_INTERSTITIAL_TEST_ID);
  assert.ok(rewInt.skipAfterSec <= 3);

  const interstitial = getGoogleTestAdUnit('interstitial');
  assert.equal(interstitial.adUnitId, GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID);
  assert.ok(interstitial.skipAfterSec <= 2);
});

test('completing one rewarded ad grants frustration-free 20m / 5-export Ad-Free Pro Pass', () => {
  resetAdPacingStateForTests();
  const t0 = 1_700_000_000_000;
  assert.equal(getAdPassStatus(t0).hasActivePass, false);
  assert.equal(getAdPassStatus(t0).courtesyGraceAvailable, true);

  const afterAd = recordVideoAdRewardCompleted('rewarded', GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID, t0);
  assert.equal(afterAd.hasActivePass, true);
  assert.equal(afterAd.remainingExports, 5);
  assert.equal(afterAd.totalAdsWatched, 1);
  assert.equal(formatAdPassRemaining(afterAd.remainingMs), '20m');

  // Subsequent exports consume quota without nagging with an ad wall
  const afterExport1 = consumeAdFreePassExport(t0 + 60_000);
  assert.equal(afterExport1.hasActivePass, true);
  assert.equal(afterExport1.remainingExports, 4);

  // Expires cleanly after 20 minutes
  const expired = getAdPassStatus(t0 + 21 * 60_000);
  assert.equal(expired.hasActivePass, false);
  assert.equal(expired.remainingExports, 0);
});

test('courtesy skip grants one immediate zero-wait bypass per session cycle', () => {
  resetAdPacingStateForTests();
  const t0 = 1_700_000_000_000;
  assert.equal(getAdPassStatus(t0).courtesyGraceAvailable, true);
  const afterCourtesy = consumeCourtesyFreeExport(t0);
  assert.equal(afterCourtesy.courtesyGraceAvailable, false);
});
