import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor';
import {
  applyPixelGradeAndChroma,
  applySharpnessPass,
  applyVfxPixelPass,
  buildCanvasFilterString,
  computeHistogramBins,
  type HistogramData,
} from './colorEngine';
import {
  DEFAULT_VFX,
  clamp,
  evaluateKeyframes,
  getEffectiveSpeedAtTime,
} from './timelineMath';
import { getClipCanvasBox } from './previewGizmo';

export class MediaElementCache {
  private images = new Map<string, HTMLImageElement>();
  private videos = new Map<string, HTMLVideoElement>();
  private failedVideos = new Set<string>();
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private vfxCanvas: HTMLCanvasElement | null = null;

  preloadImage(src: string, img: HTMLImageElement): void {
    if (img.complete && img.naturalWidth > 0) {
      this.images.set(src, img);
    }
  }

  getImage(src: string, onLoad?: () => void): HTMLImageElement | null {
    let img = this.images.get(src);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      if (onLoad) {
        img.addEventListener('load', onLoad, { once: true });
      }
      img.src = src;
      this.images.set(src, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }

  getVideo(src: string, onReady?: () => void): HTMLVideoElement | null {
    if (this.failedVideos.has(src)) return null;
    let vid = this.videos.get(src);
    if (!vid) {
      vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.playsInline = true;
      vid.muted = true;
      vid.preload = 'auto';
      vid.addEventListener('error', () => {
        this.failedVideos.add(src);
      });
      if (onReady) {
        vid.addEventListener('loadeddata', onReady, { once: true });
      }
      vid.src = src;
      this.videos.set(src, vid);
    }
    if (vid.readyState >= 2) {
      return vid;
    }
    return null;
  }

  syncVideoToTime(
    vid: HTMLVideoElement,
    targetSourceTime: number,
    isPlaying: boolean,
    playbackRate: number
  ): void {
    const clampedRate = clamp(playbackRate, 0.2, 8);
    if (Math.abs(vid.playbackRate - clampedRate) > 0.05) {
      try {
        vid.playbackRate = clampedRate;
      } catch {
        // Ignore unsupported playbackRate bounds
      }
    }

    const duration = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 60;
    const desired = clamp(targetSourceTime, 0, Math.max(0, duration - 0.04));
    const drift = Math.abs(vid.currentTime - desired);

    if (isPlaying) {
      if (drift > 0.35 && !vid.seeking) {
        vid.currentTime = desired;
      }
      if (vid.paused) {
        vid.play().catch(() => {});
      }
    } else {
      if (!vid.paused) {
        vid.pause();
      }
      if (drift > 0.04 && !vid.seeking) {
        vid.currentTime = desired;
      }
    }
  }

  pauseAllVideos(): void {
    for (const vid of this.videos.values()) {
      if (!vid.paused) vid.pause();
    }
  }

  getOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    if (this.offscreenCanvas.width !== width) this.offscreenCanvas.width = width;
    if (this.offscreenCanvas.height !== height) this.offscreenCanvas.height = height;
    return this.offscreenCanvas;
  }

  getVfxCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.vfxCanvas) {
      this.vfxCanvas = document.createElement('canvas');
    }
    if (this.vfxCanvas.width !== width) this.vfxCanvas.width = width;
    if (this.vfxCanvas.height !== height) this.vfxCanvas.height = height;
    return this.vfxCanvas;
  }
}

export interface RenderFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  playhead: number;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAsset[];
  cache: MediaElementCache;
  isPlaying: boolean;
  showSafeMargins?: boolean;
  computeHistogram?: boolean;
  selectedClipId?: string | null;
  showSelectionBox?: boolean;
  snapGuides?: { x: boolean; y: boolean };
  onAssetLoad?: () => void;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number
) {
  const srcRatio = srcW / Math.max(1, srcH);
  const dstRatio = targetW / Math.max(1, targetH);
  let drawW = targetW;
  let drawH = targetH;
  if (srcRatio > dstRatio) {
    drawH = targetH;
    drawW = targetH * srcRatio;
  } else {
    drawW = targetW;
    drawH = targetW / srcRatio;
  }
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
}

function drawLegacyFormatFallback(
  ctx: CanvasRenderingContext2D,
  asset: MediaAsset,
  width: number,
  height: number,
  localTime: number
) {
  const grad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  grad.addColorStop(0, '#131824');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -width / 2; x <= width / 2; x += 24) {
    const y = Math.sin(x * 0.015 + localTime * 3.5) * 28;
    if (x === -width / 2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#f3f4f6';
  ctx.textAlign = 'center';
  ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(asset.name, 0, -14);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 16px "JetBrains Mono", monospace';
  ctx.fillText(
    `${asset.formatInfo.container} · ${asset.formatInfo.codecLabel}`,
    0,
    20
  );
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  width: number,
  height: number,
  localTime: number,
  isPlaying: boolean
) {
  const cfg = clip.textConfig;
  if (!cfg) return;

  const tf = evaluateKeyframes(clip, localTime);
  const animIn = isPlaying ? clamp(localTime / 0.45, 0, 1) : 1;
  const animOut = isPlaying ? clamp((clip.duration - localTime) / 0.35, 0, 1) : 1;
  let alpha = tf.opacity * Math.min(1, animOut);
  let offsetY = 0;
  let scaleAnim = 1;
  let visibleText = cfg.text;

  switch (cfg.animation) {
    case 'fade':
      alpha *= animIn;
      break;
    case 'slideUp':
      alpha *= animIn;
      offsetY = (1 - Math.pow(animIn, 0.5)) * 36;
      break;
    case 'pop':
      scaleAnim = 0.65 + 0.35 * Math.sin(clamp(animIn, 0, 1) * (Math.PI / 2));
      alpha *= animIn;
      break;
    case 'typewriter': {
      const progress = isPlaying ? clamp(localTime / 1.2, 0.05, 1) : 1;
      const chars = Math.max(1, Math.floor(cfg.text.length * progress));
      visibleText = cfg.text.slice(0, chars);
      break;
    }
    default:
      break;
  }

  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const scaleFactor = width / 1280;
  const px = width / 2 + tf.x * width;
  const py = height / 2 + tf.y * height + offsetY;
  ctx.translate(px, py);
  ctx.rotate((tf.rotation * Math.PI) / 180);
  ctx.scale(tf.scale * scaleAnim, tf.scale * scaleAnim);

  const textStyle = cfg.textStyle ?? 'clean';
  const fontWeight = cfg.fontWeight ?? '700';
  const letterSpacingPx = Math.round((cfg.letterSpacing ?? 0) * scaleFactor);
  const fontSize = Math.max(14, Math.round(cfg.fontSize * scaleFactor));

  const applyTracking = (tracking: number) => {
    const ctxWithSpacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if ('letterSpacing' in ctxWithSpacing) {
      ctxWithSpacing.letterSpacing = `${tracking}px`;
    }
  };

  applyTracking(textStyle === 'cinema' && letterSpacingPx === 0 ? Math.round(6 * scaleFactor) : letterSpacingPx);
  ctx.font = `${fontWeight} ${fontSize}px "${cfg.fontFamily}", "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(visibleText);
  const subText = cfg.subtitle?.trim() || '';
  const subFontSize = Math.max(11, Math.round(fontSize * 0.42));
  let boxW = metrics.width + 54 * scaleFactor;
  if (subText) {
    ctx.font = `500 ${subFontSize}px "Plus Jakarta Sans", sans-serif`;
    boxW = Math.max(boxW, ctx.measureText(subText).width + 54 * scaleFactor);
  }
  const boxH = (subText ? fontSize * 1.95 : fontSize * 1.45) + 18 * scaleFactor;

  const effectiveBgOpacity =
    textStyle === 'badge' ? Math.max(0.75, cfg.bgOpacity) : cfg.bgOpacity;

  if (effectiveBgOpacity > 0.02 || textStyle === 'badge') {
    ctx.save();
    ctx.globalAlpha *= effectiveBgOpacity;
    ctx.fillStyle = cfg.bgColor || '#0B1120';
    const r = (textStyle === 'badge' ? 14 : 10) * scaleFactor;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, r);
    ctx.fill();
    if (textStyle === 'badge') {
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.lineWidth = Math.max(1.5, 2 * scaleFactor);
      ctx.strokeStyle = cfg.color;
      ctx.stroke();
    }
    ctx.restore();
  }

  const mainY = subText ? -subFontSize * 0.55 : 0;
  ctx.font = `${fontWeight} ${fontSize}px "${cfg.fontFamily}", "Plus Jakarta Sans", sans-serif`;
  if (cfg.preset === 'lowerThird') {
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-boxW / 2, -boxH / 2 + 8 * scaleFactor, 4 * scaleFactor, boxH - 16 * scaleFactor);
  }

  ctx.save();
  if (textStyle === 'neon') {
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 18 * scaleFactor;
  } else if (textStyle === 'cinema') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 12 * scaleFactor;
    ctx.shadowOffsetY = 4 * scaleFactor;
  }

  ctx.lineJoin = 'round';
  ctx.lineWidth =
    textStyle === 'outline'
      ? Math.max(2, 7 * scaleFactor)
      : textStyle === 'neon'
      ? Math.max(1, 2 * scaleFactor)
      : Math.max(1, 3 * scaleFactor);
  ctx.strokeStyle = textStyle === 'neon' ? cfg.color : cfg.strokeColor;
  ctx.strokeText(visibleText, 0, mainY);
  ctx.fillStyle = cfg.color;
  ctx.fillText(visibleText, 0, mainY);
  if (textStyle === 'neon') {
    ctx.shadowBlur = 6 * scaleFactor;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.45;
    ctx.fillText(visibleText, 0, mainY);
  }
  ctx.restore();

  if (textStyle === 'cinema') {
    ctx.save();
    ctx.fillStyle = cfg.color;
    ctx.globalAlpha *= 0.7;
    const ruleW = Math.min(boxW * 0.55, 160 * scaleFactor);
    const ruleY = subText ? mainY + fontSize * 0.48 : mainY + fontSize * 0.62;
    ctx.fillRect(-ruleW / 2, ruleY, ruleW, Math.max(1.5, 2 * scaleFactor));
    ctx.restore();
  }

  if (subText) {
    applyTracking(Math.round(1 * scaleFactor));
    ctx.font = `500 ${subFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(243, 244, 246, 0.88)';
    ctx.fillText(subText, 0, mainY + fontSize * 0.72);
  }
  ctx.restore();
}

export function renderCompositeFrame(options: RenderFrameOptions): HistogramData | null {
  const {
    ctx,
    width,
    height,
    playhead,
    clips,
    tracks,
    assets,
    cache,
    isPlaying,
    showSafeMargins,
    computeHistogram,
    selectedClipId,
    showSelectionBox,
    snapGuides,
    onAssetLoad,
  } = options;

  ctx.save();
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, width, height);

  const trackIndexMap = new Map(tracks.map((t, idx) => [t.id, { track: t, order: tracks.length - idx }]));
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const hasSoloVisual = tracks.some((t) => t.type !== 'audio' && t.solo);

  // Render order: bottom-most visual track up to top-most titles/overlays
  const activeClips = clips
    .filter((c) => {
      const info = trackIndexMap.get(c.trackId);
      if (!info || info.track.hidden || info.track.type === 'audio') return false;
      if (hasSoloVisual && !info.track.solo) return false;
      return playhead >= c.startTime && playhead <= c.startTime + c.duration;
    })
    .sort((a, b) => {
      const oa = trackIndexMap.get(a.trackId)?.order ?? 0;
      const ob = trackIndexMap.get(b.trackId)?.order ?? 0;
      return oa - ob;
    });

  let maxCinemaBars = 0;

  for (const clip of activeClips) {
    const localTime = clamp(playhead - clip.startTime, 0, clip.duration);

    if (clip.kind === 'text') {
      drawTextOverlay(ctx, clip, width, height, localTime, isPlaying);
      continue;
    }

    const asset = assetMap.get(clip.assetId);
    if (!asset) continue;

    const vfx = clip.vfx;
    if (vfx?.cinemaBars > maxCinemaBars) {
      maxCinemaBars = vfx.cinemaBars;
    }

    const tf = evaluateKeyframes(clip, localTime);
    const transitionDur = Math.max(0.05, clip.transitionIn.duration);
    const transProgress = clamp(localTime / transitionDur, 0, 1);

    let transOpacity = 1;
    let transOffsetX = 0;
    let transOffsetY = 0;
    let transScale = 1;
    let transRotation = 0;
    let radialClipRadius: number | null = null;
    let glitchBoost = 0;

    if (clip.transitionIn.type !== 'none' && localTime < transitionDur) {
      switch (clip.transitionIn.type) {
        case 'crossDissolve':
        case 'dipBlack':
        case 'dipWhite':
          transOpacity = transProgress;
          break;
        case 'slideLeft':
          transOffsetX = (1 - Math.pow(transProgress, 0.5)) * width;
          break;
        case 'slideRight':
          transOffsetX = -(1 - Math.pow(transProgress, 0.5)) * width;
          break;
        case 'slideUp':
          transOffsetY = (1 - Math.pow(transProgress, 0.5)) * height;
          break;
        case 'zoomIn':
          transScale = 0.72 + 0.28 * transProgress;
          transOpacity = transProgress;
          break;
        case 'zoomOut':
          transScale = 1.45 - 0.45 * transProgress;
          transOpacity = transProgress;
          break;
        case 'whipPan':
          transOffsetX = Math.sin((1 - transProgress) * Math.PI * 0.5) * width * 0.6;
          break;
        case 'spin':
          transRotation = (1 - transProgress) * 180;
          transScale = 0.55 + 0.45 * transProgress;
          transOpacity = transProgress;
          break;
        case 'radialWipe':
          radialClipRadius = transProgress * Math.hypot(width, height) * 0.65;
          break;
        case 'glitchCut':
          glitchBoost = (1 - transProgress) * 85;
          break;
      }
    }

    let drawable: CanvasImageSource | null = null;
    let srcW = asset.width || 1280;
    let srcH = asset.height || 720;

    if (asset.kind === 'image') {
      const img = cache.getImage(asset.src, onAssetLoad);
      if (img) {
        drawable = img;
        srcW = img.naturalWidth || 1280;
        srcH = img.naturalHeight || 720;
      }
    } else if (asset.kind === 'video') {
      const vid = cache.getVideo(asset.src, onAssetLoad);
      if (vid) {
        const progress01 = localTime / Math.max(0.05, clip.duration);
        const effSpeed = getEffectiveSpeedAtTime(clip.speed, clip.speedRamp, progress01);
        const rawSourceTime = clip.freezeFrame
          ? clip.sourceOffset
          : clip.reversed
          ? Math.max(0, asset.duration - clip.sourceOffset - localTime * effSpeed)
          : clip.sourceOffset + localTime * effSpeed;
        cache.syncVideoToTime(vid, rawSourceTime, isPlaying && !clip.freezeFrame, effSpeed);
        drawable = vid;
        srcW = vid.videoWidth || 1280;
        srcH = vid.videoHeight || 720;
      }
    }

    const effectiveVfx = vfx
      ? { ...DEFAULT_VFX, ...vfx, glitch: Math.min(100, vfx.glitch + glitchBoost) }
      : { ...DEFAULT_VFX, glitch: glitchBoost };

    // Camera impact shake offset
    const shakeAmp = (effectiveVfx.shake ?? 0) > 1 ? (effectiveVfx.shake / 100) * 26 : 0;
    const shakeX = shakeAmp > 0 ? Math.sin(playhead * 47.3) * shakeAmp : 0;
    const shakeY = shakeAmp > 0 ? Math.cos(playhead * 61.7) * shakeAmp * 0.7 : 0;
    const shakeRot = shakeAmp > 0 ? Math.sin(playhead * 37.1) * (effectiveVfx.shake / 100) * 3.5 : 0;

    const needsPixelPass =
      clip.chromaKey.enabled ||
      (clip.colorGrade.grain ?? 0) > 1 ||
      (clip.colorGrade.sharpness ?? 0) > 1 ||
      effectiveVfx.glitch > 1 ||
      effectiveVfx.distortion > 1 ||
      effectiveVfx.pixelate > 1 ||
      effectiveVfx.vhsScanlines > 1 ||
      (effectiveVfx.mirror ?? 0) > 1 ||
      (effectiveVfx.duotone ?? 0) > 1;

    ctx.save();
    if (radialClipRadius !== null) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radialClipRadius, 0, Math.PI * 2);
      ctx.clip();
    }
    if (clip.mask && clip.mask !== 'none') {
      ctx.beginPath();
      if (clip.mask === 'circle') {
        const radius = Math.min(width, height) * 0.42 * clamp(tf.scale, 0.25, 2.5);
        ctx.arc(width / 2 + tf.x * width, height / 2 + tf.y * height, radius, 0, Math.PI * 2);
      } else if (clip.mask === 'rounded') {
        const boxW = width * clamp(tf.scale, 0.25, 2.5);
        const boxH = height * clamp(tf.scale, 0.25, 2.5);
        const cx = width / 2 + tf.x * width;
        const cy = height / 2 + tf.y * height;
        ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, Math.min(boxW, boxH) * 0.14);
      } else if (clip.mask === 'splitLeft') {
        ctx.rect(0, 0, width * 0.5, height);
      } else if (clip.mask === 'splitRight') {
        ctx.rect(width * 0.5, 0, width * 0.5, height);
      } else if (clip.mask === 'cinema') {
        const bar = height * 0.14;
        ctx.rect(0, bar, width, height - bar * 2);
      }
      ctx.clip();
    }

    if (needsPixelPass && drawable) {
      const off = cache.getOffscreenCanvas(width, height);
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.clearRect(0, 0, width, height);
        offCtx.save();
        offCtx.filter = buildCanvasFilterString(clip.colorGrade, effectiveVfx);
        offCtx.translate(
          width / 2 + tf.x * width + transOffsetX + shakeX,
          height / 2 + tf.y * height + transOffsetY + shakeY
        );
        offCtx.rotate(((tf.rotation + transRotation + shakeRot) * Math.PI) / 180);
        offCtx.scale(
          tf.scale * transScale * (tf.flipH ? -1 : 1),
          tf.scale * transScale * (tf.flipV ? -1 : 1)
        );
        drawCoverImage(offCtx, drawable, srcW, srcH, width, height);
        offCtx.restore();

        const imgData = offCtx.getImageData(0, 0, width, height);
        applyPixelGradeAndChroma(imgData.data, clip.colorGrade, clip.chromaKey);

        let workingData = imgData.data;
        if ((clip.colorGrade.sharpness ?? 0) > 1) {
          const sharpBuf = new Uint8ClampedArray(workingData.length);
          applySharpnessPass(workingData, sharpBuf, width, height, clip.colorGrade.sharpness);
          imgData.data.set(sharpBuf);
          workingData = imgData.data;
        }

        const hasSpatialVfx =
          effectiveVfx.glitch > 1 ||
          effectiveVfx.distortion > 1 ||
          effectiveVfx.pixelate > 1 ||
          effectiveVfx.vhsScanlines > 1 ||
          (effectiveVfx.mirror ?? 0) > 1 ||
          (effectiveVfx.duotone ?? 0) > 1;

        if (hasSpatialVfx) {
          const vfxCanvas = cache.getVfxCanvas(width, height);
          const vfxCtx = vfxCanvas.getContext('2d');
          if (vfxCtx) {
            const outImg = vfxCtx.createImageData(width, height);
            applyVfxPixelPass(workingData, outImg.data, width, height, effectiveVfx, playhead);
            vfxCtx.putImageData(outImg, 0, 0);
            ctx.save();
            ctx.globalAlpha = clamp(tf.opacity * transOpacity, 0, 1);
            ctx.globalCompositeOperation = clip.blendMode;
            ctx.drawImage(vfxCanvas, 0, 0);
            ctx.restore();
          }
        } else {
          offCtx.putImageData(imgData, 0, 0);
          ctx.save();
          ctx.globalAlpha = clamp(tf.opacity * transOpacity, 0, 1);
          ctx.globalCompositeOperation = clip.blendMode;
          ctx.drawImage(off, 0, 0);
          ctx.restore();
        }
      }
    } else {
      ctx.save();
      ctx.globalAlpha = clamp(tf.opacity * transOpacity, 0, 1);
      ctx.globalCompositeOperation = clip.blendMode;
      ctx.filter = buildCanvasFilterString(clip.colorGrade, effectiveVfx);
      ctx.translate(
        width / 2 + tf.x * width + transOffsetX + shakeX,
        height / 2 + tf.y * height + transOffsetY + shakeY
      );
      ctx.rotate(((tf.rotation + transRotation + shakeRot) * Math.PI) / 180);
      ctx.scale(
        tf.scale * transScale * (tf.flipH ? -1 : 1),
        tf.scale * transScale * (tf.flipV ? -1 : 1)
      );

      if (drawable) {
        drawCoverImage(ctx, drawable, srcW, srcH, width, height);
      } else {
        drawLegacyFormatFallback(ctx, asset, width, height, localTime);
      }
      ctx.restore();
    }

    // Anamorphic Bloom / Halation Glow overlay
    if (effectiveVfx.bloom > 1 && drawable) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp((effectiveVfx.bloom / 100) * 0.48, 0, 0.55);
      ctx.filter = `blur(${Math.round(8 + (effectiveVfx.bloom / 100) * 16)}px) brightness(135%)`;
      ctx.translate(width / 2 + tf.x * width, height / 2 + tf.y * height);
      ctx.scale(tf.scale, tf.scale);
      drawCoverImage(ctx, drawable, srcW, srcH, width, height);
      ctx.restore();
    }

    ctx.restore();

    if (
      (clip.transitionIn.type === 'dipWhite' || clip.transitionIn.type === 'dipBlack') &&
      localTime < transitionDur
    ) {
      const dipAlpha = Math.sin((1 - transProgress) * Math.PI * 0.5) * 0.85;
      ctx.save();
      ctx.fillStyle = clip.transitionIn.type === 'dipWhite' ? '#ffffff' : '#000000';
      ctx.globalAlpha = clamp(dipAlpha, 0, 1);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (clip.colorGrade.vignette > 1) {
      const vigStrength = clamp(clip.colorGrade.vignette / 100, 0, 1) * 0.85;
      const radGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.28,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      radGrad.addColorStop(0, 'rgba(0,0,0,0)');
      radGrad.addColorStop(1, `rgba(0,0,0,${vigStrength.toFixed(2)})`);
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Cinema 2.39:1 Letterbox Bars VFX
  if (maxCinemaBars > 1) {
    const barHeight = Math.round(height * 0.115 * (maxCinemaBars / 100));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, barHeight);
    ctx.fillRect(0, height - barHeight, width, barHeight);
  }

  // Selected clip on-canvas 2026 interactive transform gizmo (resize corners + rotate grip + snap guides)
  if (showSelectionBox && selectedClipId && !isPlaying) {
    const sel = activeClips.find((c) => c.id === selectedClipId);
    if (sel) {
      if (snapGuides?.x) {
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        ctx.restore();
      }
      if (snapGuides?.y) {
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.restore();
      }

      const localT = clamp(playhead - sel.startTime, 0, sel.duration);
      const box = getClipCanvasBox(sel, localT, width, height);

      ctx.save();
      // Bounding rectangle
      ctx.translate(box.cx, box.cy);
      ctx.rotate((box.rotationDeg * Math.PI) / 180);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(-box.boxW / 2, -box.boxH / 2, box.boxW, box.boxH);
      ctx.setLineDash([]);
      ctx.restore();

      // Stem connecting top center to rotate grip
      const topMidX = (box.corners[0].x + box.corners[1].x) / 2;
      const topMidY = (box.corners[0].y + box.corners[1].y) / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topMidX, topMidY);
      ctx.lineTo(box.rotateHandle.x, box.rotateHandle.y);
      ctx.stroke();

      // Rotation circular grip
      ctx.fillStyle = '#090D16';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(box.rotateHandle.x, box.rotateHandle.y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(box.rotateHandle.x, box.rotateHandle.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 4 circular corner resize handles
      for (const c of box.corners) {
        ctx.fillStyle = '#090D16';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  if (showSafeMargins) {
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(width / 2 - 14, height / 2);
    ctx.lineTo(width / 2 + 14, height / 2);
    ctx.moveTo(width / 2, height / 2 - 14);
    ctx.lineTo(width / 2, height / 2 + 14);
    ctx.stroke();
    ctx.restore();
  }

  let histogram: HistogramData | null = null;
  if (computeHistogram) {
    try {
      const sample = ctx.getImageData(0, 0, width, height);
      histogram = computeHistogramBins(sample.data, 32, 16);
    } catch {
      histogram = null;
    }
  }

  ctx.restore();
  return histogram;
}
