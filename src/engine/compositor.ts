import type { MediaAsset, TimelineClip, TimelineTrack, TransitionType } from '../types/editor';
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
import { computeTransitionFrameState } from './transitionsLibrary';
import { renderNeonClipEffect } from './neonEngine';
import {
  computeMotionBlurTrailOffsets,
  evaluateMotionPresetTransform,
} from './motionPresets';
import { resolveRenderableAssetSrc } from './proxyGenerator';

export class MediaElementCache {
  private images = new Map<string, HTMLImageElement>();
  private videos = new Map<string, HTMLVideoElement>();
  private failedVideos = new Set<string>();
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private vfxCanvas: HTMLCanvasElement | null = null;
  private featherCanvas: HTMLCanvasElement | null = null;

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

  getFeatherCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.featherCanvas) {
      this.featherCanvas = document.createElement('canvas');
    }
    if (this.featherCanvas.width !== width) this.featherCanvas.width = width;
    if (this.featherCanvas.height !== height) this.featherCanvas.height = height;
    return this.featherCanvas;
  }
}

function applyMaskAndFeatherAlpha(
  fCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: TimelineClip['mask'],
  tf: { x: number; y: number; scale: number },
  featherPct: number
): void {
  const f = clamp(featherPct / 100, 0, 1);
  if (f <= 0.01) return;

  fCtx.save();
  fCtx.globalCompositeOperation = 'destination-in';

  if (mask === 'circle') {
    const cx = width / 2 + tf.x * width;
    const cy = height / 2 + tf.y * height;
    const radius = Math.min(width, height) * 0.42 * clamp(tf.scale, 0.25, 2.5);
    const innerR = Math.max(0, radius * (1 - f * 0.78));
    const grad = fCtx.createRadialGradient(cx, cy, innerR, cx, cy, Math.max(1, radius));
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, 0, width, height);
    fCtx.restore();
    return;
  }

  if (mask === 'splitLeft') {
    const splitX = width * 0.5;
    const band = Math.max(8, width * 0.22 * f);
    const grad = fCtx.createLinearGradient(splitX - band, 0, splitX, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, 0, width, height);
    fCtx.restore();
    return;
  }

  if (mask === 'splitRight') {
    const splitX = width * 0.5;
    const band = Math.max(8, width * 0.22 * f);
    const grad = fCtx.createLinearGradient(splitX, 0, splitX + band, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, 0, width, height);
    fCtx.restore();
    return;
  }

  if (mask === 'cinema') {
    const bar = height * 0.14;
    const band = Math.max(8, height * 0.2 * f);
    const topGrad = fCtx.createLinearGradient(0, bar, 0, bar + band);
    topGrad.addColorStop(0, 'rgba(255,255,255,0)');
    topGrad.addColorStop(1, 'rgba(255,255,255,1)');
    fCtx.fillStyle = topGrad;
    fCtx.fillRect(0, 0, width, height * 0.5);

    const botGrad = fCtx.createLinearGradient(0, height - bar - band, 0, height - bar);
    botGrad.addColorStop(0, 'rgba(255,255,255,1)');
    botGrad.addColorStop(1, 'rgba(255,255,255,0)');
    fCtx.fillStyle = botGrad;
    fCtx.fillRect(0, height * 0.5, width, height * 0.5);
    fCtx.restore();
    return;
  }

  // Full frame ('none') or 'rounded' — radial elliptical alpha feather around box bounds
  const isRounded = mask === 'rounded';
  const cx = isRounded ? width / 2 + tf.x * width : width / 2;
  const cy = isRounded ? height / 2 + tf.y * height : height / 2;
  const boxW = isRounded ? width * clamp(tf.scale, 0.25, 2.5) : width;
  const boxH = isRounded ? height * clamp(tf.scale, 0.25, 2.5) : height;
  const maxR = Math.max(boxW, boxH) * 0.56;
  const innerR = Math.max(4, maxR * (1 - f * 0.65));

  fCtx.translate(cx, cy);
  fCtx.scale(boxW / Math.max(1, maxR * 2), boxH / Math.max(1, maxR * 2));
  const rad = fCtx.createRadialGradient(0, 0, innerR, 0, 0, maxR);
  rad.addColorStop(0, 'rgba(255,255,255,1)');
  rad.addColorStop(0.75, `rgba(255,255,255,${(1 - f * 0.35).toFixed(2)})`);
  rad.addColorStop(1, 'rgba(255,255,255,0)');
  fCtx.fillStyle = rad;
  fCtx.fillRect(-maxR * 1.5, -maxR * 1.5, maxR * 3, maxR * 3);
  fCtx.restore();
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
  previewLutOverride?: { clipId: string; lutId: string } | null;
  previewTransitionOverride?: { clipId: string; type: TransitionType; progress: number } | null;
  animateEffects?: boolean;
  preferProxy?: boolean;
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
  shouldAnimate: boolean,
  previewTransitionOverride?: { clipId: string; type: TransitionType; progress: number } | null
) {
  const cfg = clip.textConfig;
  if (!cfg) return;

  const tf = evaluateKeyframes(clip, localTime);
  const mp = evaluateMotionPresetTransform(clip.motionPreset, localTime, clip.duration);
  const isPreviewingTrans = previewTransitionOverride?.clipId === clip.id;
  const activeTransType = isPreviewingTrans
    ? previewTransitionOverride.type
    : clip.transitionIn.type;
  const transDur = Math.max(0.05, clip.transitionIn.duration);
  const transProgress = isPreviewingTrans
    ? clamp(previewTransitionOverride.progress, 0, 1)
    : clamp(localTime / transDur, 0, 1);
  const transState =
    activeTransType !== 'none' &&
    (isPreviewingTrans || (shouldAnimate && localTime < transDur))
      ? computeTransitionFrameState(activeTransType, transProgress, width, height)
      : null;

  const animIn = shouldAnimate ? clamp(localTime / 0.45, 0, 1) : 1;
  const animOut = shouldAnimate ? clamp((clip.duration - localTime) / 0.35, 0, 1) : 1;
  let alpha = tf.opacity * mp.opacityMult * Math.min(1, animOut) * (transState?.opacity ?? 1);
  let offsetY = (transState?.offsetY ?? 0) + mp.dy * height;
  let offsetX = (transState?.offsetX ?? 0) + mp.dx * width;
  let scaleAnim = (transState?.scale ?? 1) * mp.scaleMult;
  let extraBlurPx = transState?.blurPx ?? 0;
  let visibleText = cfg.text;

  switch (cfg.animation) {
    case 'fade':
      alpha *= animIn;
      break;
    case 'slideUp':
      alpha *= animIn;
      offsetY += (1 - Math.pow(animIn, 0.5)) * 36;
      break;
    case 'pop':
      scaleAnim *= 0.65 + 0.35 * Math.sin(clamp(animIn, 0, 1) * (Math.PI / 2));
      alpha *= animIn;
      break;
    case 'bounce': {
      const p = clamp(animIn, 0, 1);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const spring = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      scaleAnim *= shouldAnimate ? clamp(0.45 + 0.55 * spring, 0.4, 1.18) : 1;
      alpha *= Math.min(1, p * 1.6);
      break;
    }
    case 'glitch': {
      if (shouldAnimate && animIn < 1) {
        offsetX += Math.sin(localTime * 68) * (1 - animIn) * 18;
        offsetY += Math.cos(localTime * 52) * (1 - animIn) * 6;
      }
      alpha *= Math.min(1, animIn * 1.4);
      break;
    }
    case 'zoomBlur':
      scaleAnim *= shouldAnimate ? 1.42 - 0.42 * Math.pow(animIn, 0.7) : 1;
      extraBlurPx += shouldAnimate ? (1 - animIn) * 8 : 0;
      alpha *= animIn;
      break;
    case 'typewriter': {
      const progress = shouldAnimate ? clamp(localTime / 1.2, 0.05, 1) : 1;
      const chars = Math.max(1, Math.floor(cfg.text.length * progress));
      visibleText = cfg.text.slice(0, chars);
      break;
    }
    default:
      break;
  }

  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (extraBlurPx > 0.3) {
    ctx.filter = `blur(${extraBlurPx.toFixed(1)}px)`;
  }
  const scaleFactor = width / 1280;
  const px = width / 2 + tf.x * width + offsetX;
  const py = height / 2 + tf.y * height + offsetY;
  ctx.translate(px, py);
  ctx.rotate(((tf.rotation + mp.rotationDeg + (transState?.rotation ?? 0)) * Math.PI) / 180);
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

  applyTracking(
    textStyle === 'cinema' && letterSpacingPx === 0 ? Math.round(6 * scaleFactor) : letterSpacingPx
  );
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
    textStyle === 'badge'
      ? Math.max(0.78, cfg.bgOpacity)
      : textStyle === 'glass'
      ? Math.max(0.55, cfg.bgOpacity)
      : cfg.bgOpacity;

  if (effectiveBgOpacity > 0.02 || textStyle === 'badge' || textStyle === 'glass' || textStyle === 'highlight') {
    ctx.save();
    const r = (textStyle === 'badge' ? 16 : textStyle === 'glass' ? 18 : 10) * scaleFactor;
    if (textStyle === 'highlight') {
      ctx.fillStyle = cfg.bgColor && cfg.bgColor !== '#090A0D' ? cfg.bgColor : '#F59E0B';
      ctx.globalAlpha *= 0.92;
      ctx.transform(1, 0, -0.14, 1, 0, 0);
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8 * scaleFactor);
      ctx.fill();
    } else {
      ctx.globalAlpha *= effectiveBgOpacity;
      ctx.fillStyle = textStyle === 'glass' ? 'rgba(15, 23, 42, 0.72)' : cfg.bgColor || '#0B1120';
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, r);
      ctx.fill();
      if (textStyle === 'badge' || textStyle === 'glass') {
        ctx.globalAlpha = clamp(alpha, 0, 1) * (textStyle === 'glass' ? 0.55 : 0.95);
        ctx.lineWidth = Math.max(1.5, 2 * scaleFactor);
        ctx.strokeStyle = textStyle === 'glass' ? 'rgba(255,255,255,0.45)' : cfg.color;
        ctx.stroke();
      }
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

  if (textStyle === 'retro3d') {
    const stepPx = Math.max(2, 4 * scaleFactor);
    ctx.fillStyle = '#0f172a';
    for (let layer = 4; layer >= 1; layer--) {
      ctx.fillText(visibleText, layer * stepPx * 0.55, mainY + layer * stepPx * 0.55);
    }
  }

  ctx.lineJoin = 'round';
  ctx.lineWidth =
    textStyle === 'outline'
      ? Math.max(2, 7 * scaleFactor)
      : textStyle === 'neon'
      ? Math.max(1, 2 * scaleFactor)
      : Math.max(1, 3 * scaleFactor);
  ctx.strokeStyle = textStyle === 'neon' ? cfg.color : cfg.strokeColor;
  if (textStyle !== 'highlight') {
    ctx.strokeText(visibleText, 0, mainY);
  }

  if (textStyle === 'gradient') {
    const grad = ctx.createLinearGradient(-boxW * 0.45, mainY - fontSize * 0.4, boxW * 0.45, mainY + fontSize * 0.4);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(0.5, cfg.color === '#111827' ? '#ffffff' : cfg.color);
    grad.addColorStop(1, '#f472b6');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = textStyle === 'highlight' && cfg.color === '#F9FAFB' ? '#090A0D' : cfg.color;
  }
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

function drawEmojiOverlay(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  width: number,
  height: number,
  localTime: number,
  shouldAnimate: boolean,
  previewTransitionOverride?: { clipId: string; type: TransitionType; progress: number } | null
) {
  const cfg = clip.emojiConfig;
  if (!cfg) return;

  const tf = evaluateKeyframes(clip, localTime);
  const mp = evaluateMotionPresetTransform(clip.motionPreset, localTime, clip.duration);
  const scaleFactor = width / 1280;
  const isPreviewingTrans = previewTransitionOverride?.clipId === clip.id;
  const activeTransType = isPreviewingTrans
    ? previewTransitionOverride.type
    : clip.transitionIn.type;
  const transDur = Math.max(0.05, clip.transitionIn.duration);
  const transProgress = isPreviewingTrans
    ? previewTransitionOverride.progress
    : clamp(localTime / transDur, 0, 1);
  const transState =
    activeTransType !== 'none' &&
    (isPreviewingTrans || (shouldAnimate && localTime < transDur))
      ? computeTransitionFrameState(activeTransType, transProgress, width, height)
      : null;

  let animOffsetY = 0;
  let animScale = 1;
  let animRot = 0;
  let animAlpha = 1;

  const tLoop = shouldAnimate ? localTime : localTime * 0.5;
  switch (cfg.animation) {
    case 'bounce':
      animOffsetY = -Math.abs(Math.sin(tLoop * 5.2)) * 18 * scaleFactor;
      break;
    case 'float':
      animOffsetY = Math.sin(tLoop * 2.8) * 11 * scaleFactor;
      animRot = Math.sin(tLoop * 2.1) * 5;
      break;
    case 'pulse':
      animScale = 1 + Math.sin(tLoop * 5.5) * 0.14;
      break;
    case 'spin':
      animRot = (tLoop * 110) % 360;
      break;
    case 'pop': {
      const p = shouldAnimate ? clamp(localTime / 0.35, 0, 1) : 1;
      animScale = 0.5 + 0.5 * Math.sin(p * (Math.PI / 2));
      animAlpha = p;
      break;
    }
    case 'shake':
      animRot = Math.sin(tLoop * 18) * 11;
      break;
    default:
      break;
  }

  ctx.save();
  ctx.globalAlpha = clamp(tf.opacity * mp.opacityMult * animAlpha * (transState?.opacity ?? 1), 0, 1);
  const px = width / 2 + tf.x * width + mp.dx * width + (transState?.offsetX ?? 0);
  const py = height / 2 + tf.y * height + mp.dy * height + animOffsetY + (transState?.offsetY ?? 0);
  ctx.translate(px, py);
  ctx.rotate(((tf.rotation + mp.rotationDeg + animRot + (transState?.rotation ?? 0)) * Math.PI) / 180);
  const s = tf.scale * mp.scaleMult * animScale * (transState?.scale ?? 1);
  ctx.scale(s * (tf.flipH ? -1 : 1), s * (tf.flipV ? -1 : 1));

  const fontSize = Math.max(28, Math.round(cfg.size * scaleFactor));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (cfg.style === 'badge') {
    const boxR = fontSize * 0.85;
    ctx.save();
    ctx.fillStyle = cfg.bgColor || 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-boxR, -boxR, boxR * 2, boxR * 2, boxR * 0.42);
    ctx.fill();
    ctx.lineWidth = Math.max(2, 3 * scaleFactor);
    ctx.strokeStyle = cfg.glowColor || '#22d3ee';
    ctx.stroke();
    ctx.restore();
  } else if (cfg.style === 'neon') {
    ctx.shadowColor = cfg.glowColor || '#22d3ee';
    ctx.shadowBlur = 24 * scaleFactor;
  } else if (cfg.style === 'sticker') {
    // Crisp die-cut white sticker halo
    ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.16));
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 10 * scaleFactor;
    ctx.strokeText(cfg.emoji, 0, 0);
  }

  ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText(cfg.emoji, 0, 0);
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
    previewLutOverride,
    previewTransitionOverride,
    animateEffects,
    preferProxy,
    onAssetLoad,
  } = options;
  const shouldAnimateEffects = Boolean(isPlaying || animateEffects);

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
      drawTextOverlay(
        ctx,
        clip,
        width,
        height,
        localTime,
        shouldAnimateEffects,
        previewTransitionOverride
      );
      continue;
    }

    if (clip.kind === 'emoji') {
      drawEmojiOverlay(
        ctx,
        clip,
        width,
        height,
        localTime,
        shouldAnimateEffects,
        previewTransitionOverride
      );
      continue;
    }

    const asset = assetMap.get(clip.assetId);
    if (!asset) continue;

    const effectiveGrade =
      previewLutOverride && previewLutOverride.clipId === clip.id
        ? { ...clip.colorGrade, lutId: previewLutOverride.lutId }
        : clip.colorGrade;

    const vfx = clip.vfx;
    if (vfx?.cinemaBars > maxCinemaBars) {
      maxCinemaBars = vfx.cinemaBars;
    }

    const tf = evaluateKeyframes(clip, localTime);
    const mp = evaluateMotionPresetTransform(clip.motionPreset, localTime, clip.duration);
    const activeTransType =
      previewTransitionOverride && previewTransitionOverride.clipId === clip.id
        ? previewTransitionOverride.type
        : clip.transitionIn.type;
    const transitionDur = Math.max(0.05, clip.transitionIn.duration);
    const transProgress =
      previewTransitionOverride && previewTransitionOverride.clipId === clip.id
        ? clamp(previewTransitionOverride.progress, 0, 1)
        : clamp(localTime / transitionDur, 0, 1);
    const isTransitionActive =
      activeTransType !== 'none' &&
      (localTime < transitionDur || previewTransitionOverride?.clipId === clip.id);

    const transState = isTransitionActive
      ? computeTransitionFrameState(activeTransType, transProgress, width, height)
      : computeTransitionFrameState('none', 1, width, height);

    // Draw outgoing adjacent clip underneath incoming transition clip (real A -> B cut transition)
    if (isTransitionActive) {
      const outgoingClip = clips.find(
        (c) =>
          c.id !== clip.id &&
          c.trackId === clip.trackId &&
          (c.kind === 'image' || c.kind === 'video') &&
          Math.abs(c.startTime + c.duration - clip.startTime) <= 0.18 &&
          !activeClips.some((ac) => ac.id === c.id)
      );
      if (outgoingClip) {
        const outAsset = assetMap.get(outgoingClip.assetId);
        if (outAsset) {
          const outSrc = resolveRenderableAssetSrc(outAsset, preferProxy);
          let outDrawable: CanvasImageSource | null = null;
          let outSrcW = outAsset.width || 1280;
          let outSrcH = outAsset.height || 720;
          if (outAsset.kind === 'image') {
            const img = cache.getImage(outSrc, onAssetLoad);
            if (img) {
              outDrawable = img;
              outSrcW = img.naturalWidth || 1280;
              outSrcH = img.naturalHeight || 720;
            }
          } else if (outAsset.kind === 'video') {
            const vid = cache.getVideo(outSrc, onAssetLoad);
            if (vid) {
              outDrawable = vid;
              outSrcW = vid.videoWidth || 1280;
              outSrcH = vid.videoHeight || 720;
            }
          }
          if (outDrawable) {
            const outTf = evaluateKeyframes(outgoingClip, outgoingClip.duration);
            ctx.save();
            ctx.globalAlpha = clamp(outTf.opacity, 0, 1);
            ctx.filter = buildCanvasFilterString(outgoingClip.colorGrade, outgoingClip.vfx);
            ctx.translate(
              width / 2 + outTf.x * width + transState.outgoingOffsetX,
              height / 2 + outTf.y * height + transState.outgoingOffsetY
            );
            ctx.rotate((outTf.rotation * Math.PI) / 180);
            ctx.scale(
              outTf.scale * (outTf.flipH ? -1 : 1),
              outTf.scale * (outTf.flipV ? -1 : 1)
            );
            drawCoverImage(ctx, outDrawable, outSrcW, outSrcH, width, height);
            ctx.restore();
          }
        }
      }
    }

    const transOpacity = transState.opacity * mp.opacityMult;
    const transOffsetX = transState.offsetX + mp.dx * width;
    const transOffsetY = transState.offsetY + mp.dy * height;
    const transScale = transState.scale * mp.scaleMult;
    const transRotation = transState.rotation + mp.rotationDeg;
    const radialClipRadius = transState.radialRadius;
    const glitchBoost = transState.glitchBoost;

    const activeAssetSrc = resolveRenderableAssetSrc(asset, preferProxy);
    let drawable: CanvasImageSource | null = null;
    let srcW = asset.width || 1280;
    let srcH = asset.height || 720;

    if (asset.kind === 'image') {
      const img = cache.getImage(activeAssetSrc, onAssetLoad);
      if (img) {
        drawable = img;
        srcW = img.naturalWidth || 1280;
        srcH = img.naturalHeight || 720;
      }
    } else if (asset.kind === 'video') {
      const vid = cache.getVideo(activeAssetSrc, onAssetLoad);
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
      ? {
          ...DEFAULT_VFX,
          ...vfx,
          glitch: Math.min(100, vfx.glitch + glitchBoost),
          blur: Math.min(100, (vfx.blur ?? 0) + transState.blurPx * 4),
        }
      : {
          ...DEFAULT_VFX,
          glitch: glitchBoost,
          blur: Math.min(100, transState.blurPx * 4),
        };

    // Camera impact shake offset
    const shakeAmp = (effectiveVfx.shake ?? 0) > 1 ? (effectiveVfx.shake / 100) * 26 : 0;
    const shakeX = shakeAmp > 0 ? Math.sin(playhead * 47.3) * shakeAmp : 0;
    const shakeY = shakeAmp > 0 ? Math.cos(playhead * 61.7) * shakeAmp * 0.7 : 0;
    const shakeRot = shakeAmp > 0 ? Math.sin(playhead * 37.1) * (effectiveVfx.shake / 100) * 3.5 : 0;

    const needsPixelPass =
      clip.chromaKey.enabled ||
      (effectiveGrade.grain ?? 0) > 1 ||
      (effectiveGrade.sharpness ?? 0) > 1 ||
      effectiveVfx.glitch > 1 ||
      effectiveVfx.distortion > 1 ||
      effectiveVfx.pixelate > 1 ||
      effectiveVfx.vhsScanlines > 1 ||
      (effectiveVfx.mirror ?? 0) > 1 ||
      (effectiveVfx.duotone ?? 0) > 1 ||
      (effectiveVfx.prism ?? 0) > 1 ||
      (effectiveVfx.nightVision ?? 0) > 1;

    const featherPct = clip.feather ?? 0;

    ctx.save();
    if (radialClipRadius !== null) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radialClipRadius, 0, Math.PI * 2);
      ctx.clip();
    }
    if (transState.curtainOpenRatio !== null) {
      const openW = width * transState.curtainOpenRatio;
      ctx.beginPath();
      ctx.rect((width - openW) / 2, 0, openW, height);
      ctx.clip();
    }
    if (transState.verticalSplitRatio !== null) {
      const openH = height * transState.verticalSplitRatio;
      ctx.beginPath();
      ctx.rect(0, (height - openH) / 2, width, openH);
      ctx.clip();
    }
    if (transState.diagonalProgress !== null) {
      const d = transState.diagonalProgress;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width * d * 2, 0);
      ctx.lineTo(0, height * d * 2);
      ctx.closePath();
      ctx.clip();
    }
    if (transState.wipeXRatio !== null) {
      ctx.beginPath();
      ctx.rect(0, 0, width * transState.wipeXRatio, height);
      ctx.clip();
    }
    if (transState.wipeRightRatio !== null) {
      const w = width * transState.wipeRightRatio;
      ctx.beginPath();
      ctx.rect(width - w, 0, w, height);
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

    const compositeWithOptionalFeather = (drawSource: (targetCtx: CanvasRenderingContext2D) => void) => {
      if (featherPct > 1) {
        const fCanvas = cache.getFeatherCanvas(width, height);
        const fCtx = fCanvas.getContext('2d');
        if (fCtx) {
          fCtx.clearRect(0, 0, width, height);
          drawSource(fCtx);
          applyMaskAndFeatherAlpha(fCtx, width, height, clip.mask, tf, featherPct);
          ctx.save();
          ctx.globalAlpha = clamp(tf.opacity * transOpacity, 0, 1);
          ctx.globalCompositeOperation = clip.blendMode;
          ctx.drawImage(fCanvas, 0, 0);
          ctx.restore();
          return;
        }
      }
      ctx.save();
      ctx.globalAlpha = clamp(tf.opacity * transOpacity, 0, 1);
      ctx.globalCompositeOperation = clip.blendMode;
      drawSource(ctx);
      ctx.restore();
    };

    if (needsPixelPass && drawable) {
      const off = cache.getOffscreenCanvas(width, height);
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.clearRect(0, 0, width, height);
        offCtx.save();
        offCtx.filter = buildCanvasFilterString(effectiveGrade, effectiveVfx);
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
        applyPixelGradeAndChroma(imgData.data, effectiveGrade, clip.chromaKey);

        let workingData = imgData.data;
        if ((effectiveGrade.sharpness ?? 0) > 1) {
          const sharpBuf = new Uint8ClampedArray(workingData.length);
          applySharpnessPass(workingData, sharpBuf, width, height, effectiveGrade.sharpness);
          imgData.data.set(sharpBuf);
          workingData = imgData.data;
        }

        const hasSpatialVfx =
          effectiveVfx.glitch > 1 ||
          effectiveVfx.distortion > 1 ||
          effectiveVfx.pixelate > 1 ||
          effectiveVfx.vhsScanlines > 1 ||
          (effectiveVfx.mirror ?? 0) > 1 ||
          (effectiveVfx.duotone ?? 0) > 1 ||
          (effectiveVfx.prism ?? 0) > 1 ||
          (effectiveVfx.nightVision ?? 0) > 1;

        if (hasSpatialVfx) {
          const vfxCanvas = cache.getVfxCanvas(width, height);
          const vfxCtx = vfxCanvas.getContext('2d');
          if (vfxCtx) {
            const outImg = vfxCtx.createImageData(width, height);
            applyVfxPixelPass(workingData, outImg.data, width, height, effectiveVfx, playhead);
            vfxCtx.putImageData(outImg, 0, 0);
            compositeWithOptionalFeather((tCtx) => {
              tCtx.drawImage(vfxCanvas, 0, 0);
            });
          }
        } else {
          offCtx.putImageData(imgData, 0, 0);
          compositeWithOptionalFeather((tCtx) => {
            tCtx.drawImage(off, 0, 0);
          });
        }
      }
    } else {
      compositeWithOptionalFeather((tCtx) => {
        tCtx.save();
        tCtx.filter = buildCanvasFilterString(effectiveGrade, effectiveVfx);
        tCtx.translate(
          width / 2 + tf.x * width + transOffsetX + shakeX,
          height / 2 + tf.y * height + transOffsetY + shakeY
        );
        tCtx.rotate(((tf.rotation + transRotation + shakeRot) * Math.PI) / 180);
        tCtx.scale(
          tf.scale * transScale * (tf.flipH ? -1 : 1),
          tf.scale * transScale * (tf.flipV ? -1 : 1)
        );
        if (drawable) {
          drawCoverImage(tCtx, drawable, srcW, srcH, width, height);
        } else {
          drawLegacyFormatFallback(tCtx, asset, width, height, localTime);
        }
        tCtx.restore();
      });
    }

    // Cinema Directional Shutter-Angle Motion Blur VFX
    if ((effectiveVfx.motionBlur ?? 0) > 1 && drawable) {
      const mbIntensity = effectiveVfx.motionBlur ?? 0;
      const prevTime = Math.max(0, localTime - 0.06);
      const prevTf = evaluateKeyframes(clip, prevTime);
      const prevMp = evaluateMotionPresetTransform(clip.motionPreset, prevTime, clip.duration);
      const velPxX =
        ((tf.x - prevTf.x) + (mp.dx - prevMp.dx)) * width;
      const velPxY =
        ((tf.y - prevTf.y) + (mp.dy - prevMp.dy)) * height;
      const scaleVel =
        tf.scale * mp.scaleMult - prevTf.scale * prevMp.scaleMult;
      const mbEchoes = computeMotionBlurTrailOffsets({
        velocityPxX: velPxX,
        velocityPxY: velPxY,
        scaleVel,
        intensityPct: mbIntensity,
        canvasWidth: width,
        steps: 4,
      });
      const echoBlurPx = Math.max(1, (mbIntensity / 100) * 3.2);
      for (const echo of mbEchoes) {
        ctx.save();
        ctx.globalAlpha = clamp(tf.opacity * transOpacity * echo.alpha, 0, 0.45);
        ctx.filter = `blur(${echoBlurPx.toFixed(1)}px)`;
        ctx.translate(
          width / 2 + tf.x * width + transOffsetX + shakeX + echo.offsetX,
          height / 2 + tf.y * height + transOffsetY + shakeY + echo.offsetY
        );
        ctx.rotate(((tf.rotation + transRotation + shakeRot) * Math.PI) / 180);
        const es = clamp(tf.scale * transScale + echo.scaleDelta, 0.1, 5);
        ctx.scale(es * (tf.flipH ? -1 : 1), es * (tf.flipV ? -1 : 1));
        drawCoverImage(ctx, drawable, srcW, srcH, width, height);
        ctx.restore();
      }
    }

    // Anamorphic Bloom / Halation Glow overlay
    if (effectiveVfx.bloom > 1 && drawable) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp((effectiveVfx.bloom / 100) * 0.48, 0, 0.55);
      ctx.filter = `blur(${Math.round(8 + (effectiveVfx.bloom / 100) * 16)}px) brightness(135%)`;
      ctx.translate(width / 2 + tf.x * width + mp.dx * width, height / 2 + tf.y * height + mp.dy * height);
      ctx.scale(tf.scale * mp.scaleMult, tf.scale * mp.scaleMult);
      drawCoverImage(ctx, drawable, srcW, srcH, width, height);
      ctx.restore();
    }

    // Warm 35mm Film Burn Flare VFX
    if ((effectiveVfx.filmBurn ?? 0) > 1) {
      const fb = clamp((effectiveVfx.filmBurn ?? 0) / 100, 0, 1);
      const driftX = width * (0.12 + 0.08 * Math.sin(playhead * 2.4));
      const driftY = height * (0.22 + 0.06 * Math.cos(playhead * 1.9));
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = fb * 0.78;
      const g1 = ctx.createRadialGradient(
        driftX,
        driftY,
        8,
        driftX,
        driftY,
        Math.max(width, height) * 0.65
      );
      g1.addColorStop(0, 'rgba(255, 224, 150, 0.95)');
      g1.addColorStop(0.32, 'rgba(249, 115, 22, 0.72)');
      g1.addColorStop(0.68, 'rgba(225, 29, 72, 0.35)');
      g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    ctx.restore();

    if (transState.flashAlpha > 0.01) {
      ctx.save();
      ctx.fillStyle = transState.flashColor;
      ctx.globalAlpha = clamp(transState.flashAlpha, 0, 1);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (transState.leakAlpha > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(transState.leakAlpha, 0, 0.9);
      const leakGrad = ctx.createRadialGradient(
        width * 0.18,
        height * 0.28,
        12,
        width * 0.35,
        height * 0.45,
        Math.max(width, height) * 0.85
      );
      leakGrad.addColorStop(0, 'rgba(255, 214, 120, 0.95)');
      leakGrad.addColorStop(0.45, 'rgba(249, 115, 22, 0.65)');
      leakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leakGrad;
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

    if (clip.neon?.enabled) {
      const neonBox = getClipCanvasBox(clip, localTime, width, height);
      renderNeonClipEffect(
        ctx,
        width,
        height,
        neonBox,
        clip.neon,
        playhead,
        shouldAnimateEffects
      );
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
