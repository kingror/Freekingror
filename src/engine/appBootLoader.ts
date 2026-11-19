import { SAMPLE_IMAGES, createAmbientScoreWavUrl } from './sampleProject';
import { loadSavedProjects } from './projectStorage';
import type { MediaElementCache } from './compositor';

export interface BootAssetEntry {
  id: string;
  label: string;
  url: string;
  isImage: boolean;
}

const CORE_MEDIA_FILES: BootAssetEntry[] = [
  {
    id: 'icon',
    label: 'RORN App Icon',
    url: '/icon.svg',
    isImage: false,
  },
  {
    id: 'mountain',
    label: 'Alpine_Dawn_4K.jpg',
    url: SAMPLE_IMAGES.mountain,
    isImage: true,
  },
  {
    id: 'city',
    label: 'Rain_Street_35mm.jpg',
    url: SAMPLE_IMAGES.city,
    isImage: true,
  },
  {
    id: 'greenscreen',
    label: 'Cinema_Rig_GreenScreen.jpg',
    url: SAMPLE_IMAGES.greenscreen,
    isImage: true,
  },
];

/**
 * Dynamically inspects loaded DOM scripts, stylesheets, and bundled media plates
 * so the boot loader reads actual app files from the device/network with zero
 * hardcoded fake byte counts.
 */
export function discoverAppBootFiles(): BootAssetEntry[] {
  const seenUrls = new Set<string>();
  const entries: BootAssetEntry[] = [];

  if (typeof document !== 'undefined') {
    const domNodes = Array.from(
      document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        'script[src], link[rel="stylesheet"][href], link[rel="icon"][href]'
      )
    );
    let idx = 0;
    for (const node of domNodes) {
      const rawUrl =
        node instanceof HTMLScriptElement ? node.getAttribute('src') : node.getAttribute('href');
      if (!rawUrl) continue;
      // Ignore external font CSS hosts so offline/CSP-isolated environments stay reliable
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        if (typeof window !== 'undefined' && !rawUrl.startsWith(window.location.origin)) {
          continue;
        }
      }
      if (seenUrls.has(rawUrl)) continue;
      seenUrls.add(rawUrl);
      const cleanName = rawUrl.split('?')[0].split('/').pop() || `module_${idx + 1}`;
      entries.push({
        id: `dom_${idx++}`,
        label: cleanName,
        url: rawUrl,
        isImage: false,
      });
    }
  }

  for (const media of CORE_MEDIA_FILES) {
    if (seenUrls.has(media.url)) continue;
    seenUrls.add(media.url);
    entries.push(media);
  }

  return entries;
}

export interface BootProgressUpdate {
  progress: number;
  stageLabel: string;
  bytesRead: number;
  totalBytes: number;
  elapsedMs: number;
}

export interface BootCalculationInput {
  bytesRead: number;
  totalBytes: number;
  completedTasks: number;
  totalTasks: number;
}

/**
 * Pure calculation mapping real file bytes read + real decode/storage tasks
 * to an integer percentage in [1, 100]. Only hits 100 when every task completes.
 */
export function computeRealBootProgress(input: BootCalculationInput): number {
  const { bytesRead, totalBytes, completedTasks, totalTasks } = input;
  const safeTotalTasks = Math.max(1, totalTasks);
  const clampedTasks = Math.min(safeTotalTasks, Math.max(0, completedTasks));

  if (clampedTasks >= safeTotalTasks && (totalBytes <= 0 || bytesRead >= totalBytes)) {
    return 100;
  }

  const taskRatio = clampedTasks / safeTotalTasks;
  const byteRatio =
    totalBytes > 0 ? Math.min(1, Math.max(0, bytesRead / totalBytes)) : taskRatio;

  const combined = byteRatio * 0.65 + taskRatio * 0.35;
  const pct = Math.round(1 + combined * 98);
  return Math.min(99, Math.max(1, pct));
}

export function formatBytesRead(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function decodeAndCacheImageBlob(
  url: string,
  blob: Blob,
  cache?: MediaElementCache | null
): Promise<void> {
  if (typeof Image === 'undefined') return;
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const objUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
    const cleanup = () => {
      if (objUrl && typeof URL !== 'undefined') URL.revokeObjectURL(objUrl);
    };
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Already loaded via onload
      }
      if (cache) {
        // Also populate live cache under the original asset URL
        const liveImg = new Image();
        liveImg.crossOrigin = 'anonymous';
        liveImg.onload = () => {
          cache.preloadImage(url, liveImg);
          cleanup();
          resolve();
        };
        liveImg.onerror = () => {
          cleanup();
          resolve();
        };
        liveImg.src = url;
        if (liveImg.complete && liveImg.naturalWidth > 0) {
          cache.preloadImage(url, liveImg);
          cleanup();
          resolve();
        }
        return;
      }
      cleanup();
      resolve();
    };
    img.onerror = () => {
      cleanup();
      resolve();
    };
    img.src = objUrl || url;
  });
}

async function decodeWavBufferOnDevice(wavUrl: string): Promise<void> {
  if (typeof window === 'undefined' || !wavUrl) return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  let ctx: AudioContext | null = null;
  try {
    const res = await fetch(wavUrl);
    const buf = await res.arrayBuffer();
    ctx = new AudioCtx();
    await ctx.decodeAudioData(buf);
  } catch {
    // Headless environments without audio output device can skip hardware decode
  } finally {
    if (ctx && typeof ctx.close === 'function') {
      ctx.close().catch(() => {});
    }
  }
}

export interface BootResult {
  ambientWavUrl: string;
  elapsedMs: number;
  bytesRead: number;
  filesLoaded: number;
}

/**
 * Reads actual app files from device/network via Fetch ReadableStream,
 * decodes media plates directly into MediaElementCache, verifies device fonts,
 * decodes audio engine buffers, and loads saved projects from storage.
 */
export async function runRealAppBoot(
  onProgress: (update: BootProgressUpdate) => void,
  signal?: AbortSignal,
  cache?: MediaElementCache | null
): Promise<BootResult> {
  const startTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const files = discoverAppBootFiles();
  const imageEntries = files.filter((f) => f.isImage);
  // Tasks: N file reads + M real image decodes + projects read + fonts ready + audio buffer decode
  const totalTasks = files.length + imageEntries.length + 3;

  const knownLengthById = new Map<string, number>();
  const readById = new Map<string, number>();
  let completedTasks = 0;
  let lastReported = 1;

  const emit = (stageLabel: string) => {
    if (signal?.aborted) return;
    let totalBytes = 0;
    let bytesRead = 0;
    for (const f of files) {
      const got = readById.get(f.id) ?? 0;
      const known = knownLengthById.get(f.id) ?? 0;
      totalBytes += Math.max(known, got);
      bytesRead += got;
    }
    const rawPct = computeRealBootProgress({
      bytesRead,
      totalBytes,
      completedTasks,
      totalTasks,
    });
    lastReported = Math.max(lastReported, rawPct);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    onProgress({
      progress: lastReported,
      stageLabel,
      bytesRead,
      totalBytes,
      elapsedMs: Math.round(now - startTs),
    });
  };

  emit('Scanning app files...');

  // 1. Read saved projects from device storage
  loadSavedProjects();
  completedTasks += 1;
  emit('Reading saved projects...');

  // 2. Read & stream every discovered app file using real fetch + ReadableStream
  const blobs = new Map<string, Blob>();
  let filesLoaded = 0;

  for (const entry of files) {
    if (signal?.aborted) break;
    emit(`Reading ${entry.label}...`);
    try {
      const res = await fetch(entry.url, { signal, cache: 'default' });
      const headerLen = Number(res.headers.get('content-length') || 0);
      if (Number.isFinite(headerLen) && headerLen > 0) {
        knownLengthById.set(entry.id, headerLen);
      }

      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let fileBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            fileBytes += value.byteLength;
            readById.set(entry.id, fileBytes);
            if (fileBytes > (knownLengthById.get(entry.id) ?? 0)) {
              knownLengthById.set(entry.id, fileBytes);
            }
            emit(`Reading ${entry.label}...`);
          }
        }
        if (fileBytes > 0) {
          knownLengthById.set(entry.id, fileBytes);
          readById.set(entry.id, fileBytes);
        }
        const blobParts = chunks.map((c) => new Uint8Array(c).buffer);
        blobs.set(
          entry.id,
          new Blob(blobParts, { type: res.headers.get('content-type') || undefined })
        );
        filesLoaded += 1;
      } else {
        const blob = await res.blob();
        knownLengthById.set(entry.id, blob.size);
        readById.set(entry.id, blob.size);
        blobs.set(entry.id, blob);
        filesLoaded += 1;
      }
    } catch {
      // If a file cannot be fetched (e.g., offline without cache), proceed cleanly
    }
    completedTasks += 1;
    emit(`Loaded ${entry.label}`);
  }

  // 3. Decode visual media assets on this device & warm live compositor cache
  for (const entry of imageEntries) {
    if (signal?.aborted) break;
    const blob = blobs.get(entry.id);
    if (blob) {
      emit(`Decoding ${entry.label}...`);
      await decodeAndCacheImageBlob(entry.url, blob, cache);
    }
    completedTasks += 1;
    emit(`Decoded ${entry.label}`);
  }

  // 4. Wait for real browser font readiness (no artificial timeout)
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    emit('Loading studio typography...');
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font subsystem errors
    }
  }
  completedTasks += 1;
  emit('Initializing audio engine...');

  // 5. Generate & decode audio score WAV on device audio subsystem
  const ambientWavUrl = createAmbientScoreWavUrl(12);
  await decodeWavBufferOnDevice(ambientWavUrl);
  completedTasks += 1;
  emit('Ready');

  let finalBytes = 0;
  for (const f of files) {
    finalBytes += readById.get(f.id) ?? 0;
  }
  const endTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    ambientWavUrl,
    elapsedMs: Math.round(endTs - startTs),
    bytesRead: finalBytes,
    filesLoaded,
  };
}
