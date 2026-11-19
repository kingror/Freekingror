import type { TimelineClip } from '../types/editor';
import { clamp, evaluateKeyframes } from './timelineMath';

export interface GizmoHandlePoint {
  id: 'nw' | 'ne' | 'sw' | 'se' | 'rotate';
  x: number;
  y: number;
}

export interface ClipCanvasBox {
  clipId: string;
  cx: number;
  cy: number;
  boxW: number;
  boxH: number;
  rotationDeg: number;
  scale: number;
  corners: [
    GizmoHandlePoint,
    GizmoHandlePoint,
    GizmoHandlePoint,
    GizmoHandlePoint
  ];
  rotateHandle: GizmoHandlePoint;
}

export type PreviewHitResult =
  | { type: 'rotate'; clipId: string }
  | { type: 'resize'; clipId: string; corner: 'nw' | 'ne' | 'sw' | 'se' }
  | { type: 'move'; clipId: string }
  | null;

export function getClipCanvasBox(
  clip: TimelineClip,
  localTime: number,
  width: number,
  height: number
): ClipCanvasBox {
  const tf = evaluateKeyframes(clip, clamp(localTime, 0, clip.duration));
  const safeScale = clamp(tf.scale, 0.15, 4);
  const cx = width / 2 + tf.x * width;
  const cy = height / 2 + tf.y * height;

  const baseW = clip.kind === 'text' ? width * 0.48 : width * 0.94;
  const baseH = clip.kind === 'text' ? height * 0.18 : height * 0.94;
  const boxW = Math.max(48, baseW * safeScale);
  const boxH = Math.max(36, baseH * safeScale);

  const rad = (tf.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const toCanvas = (lx: number, ly: number) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  });

  const hw = boxW / 2;
  const hh = boxH / 2;
  const nw = toCanvas(-hw, -hh);
  const ne = toCanvas(hw, -hh);
  const sw = toCanvas(-hw, hh);
  const se = toCanvas(hw, hh);
  const rotRaw = toCanvas(0, -hh - Math.min(34, Math.max(22, height * 0.06)));

  return {
    clipId: clip.id,
    cx,
    cy,
    boxW,
    boxH,
    rotationDeg: tf.rotation,
    scale: safeScale,
    corners: [
      { id: 'nw', x: nw.x, y: nw.y },
      { id: 'ne', x: ne.x, y: ne.y },
      { id: 'sw', x: sw.x, y: sw.y },
      { id: 'se', x: se.x, y: se.y },
    ],
    rotateHandle: {
      id: 'rotate',
      x: clamp(rotRaw.x, 14, width - 14),
      y: clamp(rotRaw.y, 14, height - 14),
    },
  };
}

/**
 * Hit tests interactive handles of selectedClipId first (rotate + 4 corners),
 * then checks active visual clips from top-most to bottom-most layer.
 * `activeClipsBottomToTop` is expected in compositing order (V1 first, V2, T1 last).
 */
export function hitTestPreviewPoint(params: {
  px: number;
  py: number;
  width: number;
  height: number;
  playhead: number;
  activeClipsBottomToTop: TimelineClip[];
  selectedClipId: string | null;
  handleRadius?: number;
}): PreviewHitResult {
  const {
    px,
    py,
    width,
    height,
    playhead,
    activeClipsBottomToTop,
    selectedClipId,
    handleRadius = 20,
  } = params;

  if (selectedClipId) {
    const sel = activeClipsBottomToTop.find((c) => c.id === selectedClipId);
    if (sel && sel.kind !== 'audio') {
      const localT = clamp(playhead - sel.startTime, 0, sel.duration);
      const box = getClipCanvasBox(sel, localT, width, height);

      if (Math.hypot(px - box.rotateHandle.x, py - box.rotateHandle.y) <= handleRadius) {
        return { type: 'rotate', clipId: sel.id };
      }
      for (const corner of box.corners) {
        if (Math.hypot(px - corner.x, py - corner.y) <= handleRadius) {
          return {
            type: 'resize',
            clipId: sel.id,
            corner: corner.id as 'nw' | 'ne' | 'sw' | 'se',
          };
        }
      }
    }
  }

  for (let i = activeClipsBottomToTop.length - 1; i >= 0; i--) {
    const clip = activeClipsBottomToTop[i];
    if (clip.kind === 'audio') continue;
    const localT = clamp(playhead - clip.startTime, 0, clip.duration);
    const box = getClipCanvasBox(clip, localT, width, height);

    const dx = px - box.cx;
    const dy = py - box.cy;
    const rad = (-box.rotationDeg * Math.PI) / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

    if (Math.abs(lx) <= box.boxW / 2 && Math.abs(ly) <= box.boxH / 2) {
      return { type: 'move', clipId: clip.id };
    }
  }

  return null;
}

export interface GizmoDragOutput {
  patch: { x?: number; y?: number; scale?: number; rotation?: number };
  snapX: boolean;
  snapY: boolean;
}

export function computeGizmoDragUpdate(params: {
  mode: 'move' | 'resize' | 'rotate';
  origTransform: { x: number; y: number; scale: number; rotation: number };
  origCenterX: number;
  origCenterY: number;
  startCanvasX: number;
  startCanvasY: number;
  currCanvasX: number;
  currCanvasY: number;
  width: number;
  height: number;
  snapToCenter?: boolean;
}): GizmoDragOutput {
  const {
    mode,
    origTransform,
    origCenterX,
    origCenterY,
    startCanvasX,
    startCanvasY,
    currCanvasX,
    currCanvasY,
    width,
    height,
    snapToCenter = true,
  } = params;

  if (mode === 'move') {
    const dx = (currCanvasX - startCanvasX) / Math.max(1, width);
    const dy = (currCanvasY - startCanvasY) / Math.max(1, height);
    let nextX = clamp(origTransform.x + dx, -1, 1);
    let nextY = clamp(origTransform.y + dy, -1, 1);
    let snapX = false;
    let snapY = false;

    if (snapToCenter) {
      if (Math.abs(nextX) <= 0.018) {
        nextX = 0;
        snapX = true;
      }
      if (Math.abs(nextY) <= 0.018) {
        nextY = 0;
        snapY = true;
      }
    }

    return {
      patch: {
        x: Number(nextX.toFixed(3)),
        y: Number(nextY.toFixed(3)),
      },
      snapX,
      snapY,
    };
  }

  if (mode === 'resize') {
    const startDist = Math.max(14, Math.hypot(startCanvasX - origCenterX, startCanvasY - origCenterY));
    const currDist = Math.max(8, Math.hypot(currCanvasX - origCenterX, currCanvasY - origCenterY));
    const ratio = currDist / startDist;
    const nextScale = clamp(origTransform.scale * ratio, 0.2, 3.0);
    return {
      patch: { scale: Number(nextScale.toFixed(3)) },
      snapX: false,
      snapY: false,
    };
  }

  // rotate: top handle sits at -90 degrees relative to center when rotation=0
  const rawAngleDeg =
    (Math.atan2(currCanvasY - origCenterY, currCanvasX - origCenterX) * 180) / Math.PI + 90;
  let normalized = ((rawAngleDeg + 180) % 360 + 360) % 360 - 180;
  if (snapToCenter) {
    for (const snapDeg of [-180, -90, 0, 90, 180]) {
      if (Math.abs(normalized - snapDeg) <= 3) {
        normalized = snapDeg;
        break;
      }
    }
  }
  return {
    patch: { rotation: Math.round(normalized) },
    snapX: false,
    snapY: false,
  };
}
