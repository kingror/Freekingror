import type { MediaAsset } from '../types/editor';

export const PROXY_MAX_LONG_EDGE = 720;
export const HIGH_RES_LONG_EDGE_THRESHOLD = 1280;
export const HIGH_RES_SIZE_BYTES_THRESHOLD = 4_000_000;

export function shouldGenerateProxy(asset: {
  kind: MediaAsset['kind'];
  width: number;
  height: number;
  sizeBytes?: number;
  formatInfo?: { nativePlayable?: boolean };
}): boolean {
  if (asset.kind === 'audio') return false;
  if (asset.formatInfo && asset.formatInfo.nativePlayable === false) return false;
  const longEdge = Math.max(asset.width || 0, asset.height || 0);
  if (longEdge > HIGH_RES_LONG_EDGE_THRESHOLD) return true;
  if ((asset.sizeBytes ?? 0) > HIGH_RES_SIZE_BYTES_THRESHOLD) return true;
  return false;
}

/**
 * Scales source dimensions down so the longest edge fits within maxLongEdge,
 * snapping width & height to even integers (>= 2) for hardware video encoders.
 */
export function computeProxyDimensions(
  srcWidth: number,
  srcHeight: number,
  maxLongEdge = PROXY_MAX_LONG_EDGE
): { width: number; height: number } {
  const w = Math.max(2, Math.round(srcWidth || maxLongEdge));
  const h = Math.max(2, Math.round(srcHeight || Math.round((maxLongEdge * 9) / 16)));
  const longEdge = Math.max(w, h);
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;

  const snapEven = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return {
    width: snapEven(w),
    height: snapEven(h),
  };
}

export function resolveRenderableAssetSrc(
  asset: Pick<MediaAsset, 'src' | 'proxySrc' | 'proxyStatus'>,
  preferProxy?: boolean
): string {
  if (preferProxy && asset.proxyStatus === 'ready' && asset.proxySrc) {
    return asset.proxySrc;
  }
  return asset.src;
}

export interface GeneratedProxyResult {
  proxySrc: string;
  proxyWidth: number;
  proxyHeight: number;
  proxySizeBytes: number;
}

async function generateImageProxy(asset: MediaAsset): Promise<GeneratedProxyResult | null> {
  if (typeof document === 'undefined') return null;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 4000);
    el.onload = () => {
      window.clearTimeout(timer);
      resolve(el);
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    el.src = asset.src;
  });

  if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;

  const target = computeProxyDimensions(img.naturalWidth, img.naturalHeight, PROXY_MAX_LONG_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82);
  });
  if (!blob || blob.size === 0) return null;

  return {
    proxySrc: URL.createObjectURL(blob),
    proxyWidth: target.width,
    proxyHeight: target.height,
    proxySizeBytes: blob.size,
  };
}

async function generateVideoProxy(asset: MediaAsset): Promise<GeneratedProxyResult | null> {
  if (
    typeof document === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined'
  ) {
    return null;
  }

  const canvasProto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  };
  if (typeof canvasProto.captureStream !== 'function') {
    return null;
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : '';
  if (!mimeType) return null;

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const loaded = await new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 4000);
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    video.src = asset.src;
  });

  if (!loaded || video.videoWidth <= 0 || video.videoHeight <= 0) {
    video.removeAttribute('src');
    return null;
  }

  const target = computeProxyDimensions(video.videoWidth, video.videoHeight, PROXY_MAX_LONG_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stream = canvas.captureStream(24);
  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_100_000,
    });
  } catch {
    return null;
  }

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const blob = await new Promise<Blob | null>((resolve) => {
    let settled = false;
    let raf = 0;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      video.pause();
      video.removeAttribute('src');
      stream.getTracks().forEach((t) => t.stop());
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const out = new Blob(chunks, { type: mimeType });
      resolve(out.size > 0 ? out : null);
    };

    recorder.onstop = finish;
    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };

    const drawTick = () => {
      if (settled) return;
      ctx.drawImage(video, 0, 0, target.width, target.height);
      if (video.ended || video.currentTime >= Math.min(video.duration || 8, 8)) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      raf = requestAnimationFrame(drawTick);
    };

    recorder.start(200);
    try {
      video.playbackRate = 2;
    } catch {
      // Ignore playbackRate limits
    }
    video.play().catch(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    });
    raf = requestAnimationFrame(drawTick);

    // Cap background transcode wall time so mobile browser stays snappy
    window.setTimeout(() => {
      if (!settled && recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, 5200);
  });

  if (!blob) return null;

  return {
    proxySrc: URL.createObjectURL(blob),
    proxyWidth: target.width,
    proxyHeight: target.height,
    proxySizeBytes: blob.size,
  };
}

/**
 * Generates a lightweight <=720p proxy Blob URL in the background without blocking UI.
 */
export async function generateMediaProxyAsync(
  asset: MediaAsset
): Promise<GeneratedProxyResult | null> {
  // Yield cleanly to browser paint/idle queue before canvas work
  await new Promise<void>((resolve) => {
    const win =
      typeof window !== 'undefined'
        ? (window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
          })
        : null;
    if (win?.requestIdleCallback) {
      win.requestIdleCallback(() => resolve(), { timeout: 220 });
    } else {
      setTimeout(resolve, 40);
    }
  });

  if (asset.kind === 'image') {
    return generateImageProxy(asset);
  }
  if (asset.kind === 'video') {
    return generateVideoProxy(asset);
  }
  return null;
}
