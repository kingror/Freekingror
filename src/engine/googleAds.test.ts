import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
  GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
  GOOGLE_IMA_VAST_TEST_TAG,
  getGoogleTestAdUnit,
} from './googleAds';

test('Google Video Ads module exposes official Google AdMob & IMA Test Ad Unit IDs', () => {
  assert.equal(
    GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
    'ca-app-pub-3940256099942544/5224354917'
  );
  assert.equal(
    GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID,
    'ca-app-pub-3940256099942544/8691691433'
  );
  assert.ok(GOOGLE_IMA_VAST_TEST_TAG.startsWith('https://pubads.g.doubleclick.net/gampad/ads'));

  const rewarded = getGoogleTestAdUnit('rewarded');
  assert.equal(rewarded.adUnitId, GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID);
  assert.ok(rewarded.skipAfterSec >= 4);

  const interstitial = getGoogleTestAdUnit('interstitial');
  assert.equal(interstitial.adUnitId, GOOGLE_ADMOB_INTERSTITIAL_VIDEO_TEST_ID);
});
