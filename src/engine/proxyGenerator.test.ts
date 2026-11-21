import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProxyDimensions,
  resolveRenderableAssetSrc,
  shouldGenerateProxy,
} from './proxyGenerator';

test('shouldGenerateProxy flags high-resolution visual assets and skips audio or SD assets', () => {
  assert.equal(
    shouldGenerateProxy({ kind: 'image', width: 1920, height: 1080, sizeBytes: 2_000_000 }),
    true
  );
  assert.equal(
    shouldGenerateProxy({ kind: 'video', width: 3840, height: 2160, sizeBytes: 18_000_000 }),
    true
  );
  assert.equal(
    shouldGenerateProxy({ kind: 'video', width: 1280, height: 720, sizeBytes: 6_000_000 }),
    true
  );
  assert.equal(
    shouldGenerateProxy({ kind: 'image', width: 1280, height: 720, sizeBytes: 400_000 }),
    false
  );
  assert.equal(
    shouldGenerateProxy({ kind: 'audio', width: 0, height: 0, sizeBytes: 20_000_000 }),
    false
  );
});

test('computeProxyDimensions preserves aspect ratio and produces even <= 720p dimensions', () => {
  const uhd = computeProxyDimensions(3840, 2160);
  assert.equal(uhd.width, 720);
  assert.equal(uhd.height, 406);
  assert.equal(uhd.width % 2, 0);
  assert.equal(uhd.height % 2, 0);

  const portrait = computeProxyDimensions(1080, 1920);
  assert.equal(portrait.height, 720);
  assert.equal(portrait.width, 406);
});

test('resolveRenderableAssetSrc uses proxy during interactive edit and master during export', () => {
  const asset = {
    src: 'blob:master-4k',
    proxySrc: 'blob:proxy-720p',
    proxyStatus: 'ready' as const,
  };
  assert.equal(resolveRenderableAssetSrc(asset, true), 'blob:proxy-720p');
  assert.equal(resolveRenderableAssetSrc(asset, false), 'blob:master-4k');
  assert.equal(resolveRenderableAssetSrc({ src: 'blob:master', proxyStatus: 'generating' }, true), 'blob:master');
});
