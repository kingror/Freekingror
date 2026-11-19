import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileVideo,
  Film,
  Gauge,
  Palette,
  Pipette,
  Sliders,
  Sparkles,
  Type,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AspectRatio,
  EasingType,
  InsertPlacement,
  InspectorTab,
  LeftVaultTab,
  MediaAsset,
  SavedGalleryItem,
  TextPresetType,
  TimelineClip,
  TimelineMarker,
  TimelineTrack,
  TransitionType,
  VfxConfig,
} from './types/editor';
import type { ExportResult } from './engine/exporter';
import {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_TRANSFORM,
  DEFAULT_VFX,
  adjustClipDuration,
  appendClipAtBack,
  compactTrackGaps,
  computeAutoDuckKeyframes,
  evaluateKeyframes,
  getProjectDuration,
  insertClipAtFront,
  insertClipAtTime,
  isClipCompatibleWithTrack,
  moveClipToTrackAndTime,
  nudgeClipStart,
  rippleDeleteClip,
  splitClipAtTime,
} from './engine/timelineMath';
import { inspectMediaFileSpec } from './engine/formatInspector';
import { MediaElementCache } from './engine/compositor';
import { StudioAudioEngine } from './engine/audioEngine';
import {
  analyzeMediaAudioLoudness,
  computeNormalizeGain,
  type LoudnessMetrics,
} from './engine/audioNormalizer';
import {
  INITIAL_TRACKS,
  createAmbientScoreWavUrl,
  createInitialAssets,
  createInitialClips,
  generateWaveform,
} from './engine/sampleProject';
import { TopBar } from './components/TopBar';
import { PreviewStage } from './components/PreviewStage';
import { TimelinePanel } from './components/TimelinePanel';
import { MediaVaultPanel } from './components/MediaVaultPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { FormatsModal } from './components/FormatsModal';
import { ExportModal } from './components/ExportModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SplashScreen } from './components/SplashScreen';
import { HomeScreen } from './components/HomeScreen';
import { shouldSkipSplashFromSearch } from './engine/splashProgress';
import {
  computeProjectProgress,
  createNewBlankProjectRecord,
  deleteSavedProject,
  loadSavedProjects,
  upsertSavedProject,
  type SavedProjectRecord,
} from './engine/projectStorage';

interface EditorSnapshot {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
}

type AppScreenMode = 'splash' | 'home' | 'editor';

export default function App() {
  const [screenMode, setScreenMode] = useState<AppScreenMode>(() =>
    typeof window !== 'undefined' && shouldSkipSplashFromSearch(window.location.search)
      ? 'home'
      : 'splash'
  );
  const [savedProjects, setSavedProjects] = useState<SavedProjectRecord[]>(() =>
    loadSavedProjects()
  );
  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => savedProjects[0]?.id ?? 'proj_golden_horizon'
  );
  const [projectCreatedAt, setProjectCreatedAt] = useState<number>(
    () => savedProjects[0]?.createdAt ?? Date.now()
  );
  const [exportedCount, setExportedCount] = useState<number>(
    () => savedProjects[0]?.exportedCount ?? 0
  );

  const [projectTitle, setProjectTitle] = useState(
    () => savedProjects[0]?.title ?? 'Golden Horizon Reel'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    () => savedProjects[0]?.aspectRatio ?? '16:9'
  );
  const [assets, setAssets] = useState<MediaAsset[]>(() => {
    const wavUrl = createAmbientScoreWavUrl(12);
    return createInitialAssets(wavUrl);
  });
  const [tracks, setTracks] = useState<TimelineTrack[]>(
    () => savedProjects[0]?.tracks ?? INITIAL_TRACKS
  );
  const [clips, setClips] = useState<TimelineClip[]>(
    () => savedProjects[0]?.clips ?? createInitialClips()
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    () => savedProjects[0]?.clips?.[0]?.id ?? 'clip_v1_alpine'
  );

  const [historyPast, setHistoryPast] = useState<EditorSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<EditorSnapshot[]>([]);

  const [playhead, setPlayhead] = useState(() => savedProjects[0]?.playhead ?? 1.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [markers, setMarkers] = useState<TimelineMarker[]>(
    () =>
      savedProjects[0]?.markers ?? [
        { id: 'mk_intro', time: 0, label: 'Intro', color: '#22d3ee' },
        { id: 'mk_drop', time: 5.5, label: 'Scene Cut', color: '#22d3ee' },
      ]
  );
  const [clipboardClip, setClipboardClip] = useState<TimelineClip | null>(null);
  const [zoomPxPerSec, setZoomPxPerSec] = useState(64);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(true);
  const [isNormalizingAudio, setIsNormalizingAudio] = useState(false);
  const [normalizeStatusMessage, setNormalizeStatusMessage] = useState<string | null>(null);
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [showScopes, setShowScopes] = useState(false);

  const [leftTab, setLeftTab] = useState<LeftVaultTab>('media');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('color');
  const [mobileSheet, setMobileSheet] = useState<'none' | 'vault' | 'inspector'>('none');

  const [formatsModalOpen, setFormatsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [savedGallery, setSavedGallery] = useState<SavedGalleryItem[]>([]);

  const cacheRef = useRef<MediaElementCache | null>(null);
  if (!cacheRef.current) {
    cacheRef.current = new MediaElementCache();
  }
  const audioRef = useRef<StudioAudioEngine | null>(null);
  if (!audioRef.current) {
    audioRef.current = new StudioAudioEngine();
  }

  const totalDuration = useMemo(() => Math.max(12, getProjectDuration(clips)), [clips]);
  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );

  const commitMutation = useCallback(
    (nextClips: TimelineClip[], nextTracks: TimelineTrack[] = tracks) => {
      setHistoryPast((prev) => [...prev.slice(-29), { clips, tracks }]);
      setHistoryFuture([]);
      setClips(nextClips);
      setTracks(nextTracks);
    },
    [clips, tracks]
  );

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryFuture((f) => [{ clips, tracks }, ...f]);
    setHistoryPast((p) => p.slice(0, -1));
    setClips(prev.clips);
    setTracks(prev.tracks);
  }, [historyPast, clips, tracks]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((p) => [...p, { clips, tracks }]);
    setHistoryFuture((f) => f.slice(1));
    setClips(next.clips);
    setTracks(next.tracks);
  }, [historyFuture, clips, tracks]);

  useEffect(() => {
    if (!isPlaying) {
      audioRef.current?.pauseAll();
      cacheRef.current?.pauseAllVideos();
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000) * playbackRate;
      lastTs = now;

      setPlayhead((prev) => {
        const next = prev + dt;
        const maxEnd = Math.max(0.5, getProjectDuration(clips));
        if (next >= maxEnd) {
          if (loopEnabled) {
            return 0;
          }
          setIsPlaying(false);
          return 0;
        }
        return Number(next.toFixed(3));
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, clips, playbackRate, loopEnabled]);

  useEffect(() => {
    audioRef.current?.syncPlayback(isPlaying, playhead, clips, tracks, assets, playbackRate);
  }, [isPlaying, playhead, clips, tracks, assets, playbackRate]);

  useEffect(() => {
    return () => {
      audioRef.current?.dispose();
    };
  }, []);

  const handleSeek = useCallback((time: number) => {
    setPlayhead(Math.max(0, Number(time.toFixed(3))));
  }, []);

  const handleSplitAtPlayhead = useCallback(() => {
    const candidate =
      clips.find(
        (c) =>
          c.id === selectedClipId &&
          playhead > c.startTime + 0.2 &&
          playhead < c.startTime + c.duration - 0.2
      ) ??
      clips.find(
        (c) => playhead > c.startTime + 0.2 && playhead < c.startTime + c.duration - 0.2
      );

    if (!candidate) return;
    const splitResult = splitClipAtTime(candidate, playhead);
    if (!splitResult) return;

    const [left, right] = splitResult;
    const nextClips = clips.flatMap((c) => (c.id === candidate.id ? [left, right] : [c]));
    commitMutation(nextClips);
    setSelectedClipId(right.id);
  }, [clips, selectedClipId, playhead, commitMutation]);

  const handleDeleteClip = useCallback(() => {
    if (!selectedClipId) return;
    const next = rippleEnabled
      ? rippleDeleteClip(clips, selectedClipId)
      : clips.filter((c) => c.id !== selectedClipId);
    commitMutation(next);
    setSelectedClipId(next[0]?.id ?? null);
  }, [clips, selectedClipId, rippleEnabled, commitMutation]);

  const handleAddMarker = useCallback(() => {
    const t = Number(playhead.toFixed(2));
    setMarkers((prev) => {
      const filtered = prev.filter((m) => Math.abs(m.time - t) > 0.12);
      return [
        ...filtered,
        {
          id: `mk_${Date.now().toString(36)}`,
          time: t,
          label: `M${prev.length + 1}`,
          color: '#22d3ee',
        },
      ].sort((a, b) => a.time - b.time);
    });
  }, [playhead]);

  const handleRemoveMarker = useCallback((markerId: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== markerId));
  }, []);

  useEffect(() => {
    if (screenMode !== 'editor') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (selectedClip) {
          setClipboardClip(selectedClip);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (clipboardClip) {
          e.preventDefault();
          const pasted: TimelineClip = {
            ...clipboardClip,
            id: `${clipboardClip.id}_paste_${Date.now().toString(36)}`,
            name: `${clipboardClip.name} Copy`,
            startTime: Number(playhead.toFixed(3)),
            keyframes: clipboardClip.keyframes.map((k) => ({ ...k })),
            audioKeyframes: (clipboardClip.audioKeyframes ?? []).map((k) => ({ ...k })),
            transform: { ...clipboardClip.transform },
            colorGrade: { ...clipboardClip.colorGrade },
            vfx: { ...clipboardClip.vfx },
            chromaKey: { ...clipboardClip.chromaKey },
            transitionIn: { ...clipboardClip.transitionIn },
            audio: { ...clipboardClip.audio },
          };
          commitMutation([...clips, pasted]);
          setSelectedClipId(pasted.id);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setPlayhead((t) => Math.max(0, Number((t - 1 / 30).toFixed(3))));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setPlayhead((t) => Math.min(totalDuration, Number((t + 1 / 30).toFixed(3))));
      } else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleAddMarker();
      } else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey) {
        setPlaybackRate((r) => (r < 1 ? 1 : r < 1.5 ? 1.5 : 2));
        setIsPlaying(true);
      } else if (e.key.toLowerCase() === 'k' && !e.metaKey && !e.ctrlKey) {
        setIsPlaying(false);
        setPlaybackRate(1);
      } else if (e.key.toLowerCase() === 'j' && !e.metaKey && !e.ctrlKey) {
        setPlaybackRate(0.5);
        setIsPlaying(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    totalDuration,
    selectedClipId,
    selectedClip,
    clipboardClip,
    clips,
    playhead,
    commitMutation,
    handleSplitAtPlayhead,
    handleDeleteClip,
    handleAddMarker,
    handleUndo,
    handleRedo,
    screenMode,
  ]);

  const handleUpdateClip = useCallback(
    (clipId: string, updater: (prev: TimelineClip) => TimelineClip) => {
      setClips((prev) => prev.map((c) => (c.id === clipId ? updater(c) : c)));
    },
    []
  );

  const handleAdjustDuration = useCallback(
    (clipId: string, newDuration: number) => {
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? adjustClipDuration(c, newDuration) : c))
      );
    },
    []
  );

  const handleNudgeClip = useCallback(
    (deltaFrames: number) => {
      if (!selectedClipId) return;
      const nextClips = clips.map((c) =>
        c.id === selectedClipId ? nudgeClipStart(c, deltaFrames, 30) : c
      );
      commitMutation(nextClips);
    },
    [clips, selectedClipId, commitMutation]
  );

  const handleAddTrack = useCallback(
    (kind: 'video' | 'audio') => {
      if (kind === 'video') {
        const videoCount = tracks.filter((t) => t.type === 'video' || t.type === 'overlay').length;
        const nextNum = videoCount + 1;
        const newTrack: TimelineTrack = {
          id: `track_v${nextNum}_${Date.now().toString(36).slice(-3)}`,
          type: 'overlay',
          role: 'overlay',
          label: `V${nextNum} Overlay`,
          muted: false,
          locked: false,
          hidden: false,
        };
        const titleIdx = tracks.findIndex((t) => t.type === 'text');
        const nextTracks = [...tracks];
        nextTracks.splice(titleIdx >= 0 ? titleIdx + 1 : 0, 0, newTrack);
        commitMutation(clips, nextTracks);
      } else {
        const audioCount = tracks.filter((t) => t.type === 'audio').length;
        const nextNum = audioCount + 1;
        const newTrack: TimelineTrack = {
          id: `track_a${nextNum}_${Date.now().toString(36).slice(-3)}`,
          type: 'audio',
          role: nextNum === 3 ? 'voiceover' : 'music',
          label: `A${nextNum} ${nextNum === 3 ? 'Voiceover' : 'Audio'}`,
          muted: false,
          locked: false,
          hidden: false,
        };
        commitMutation(clips, [...tracks, newTrack]);
      }
    },
    [clips, tracks, commitMutation]
  );

  const handleAddKeyframe = useCallback(
    (clipId: string, easing: EasingType) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;
      const localTime = Number(
        Math.max(0, Math.min(target.duration, playhead - target.startTime)).toFixed(3)
      );
      const currentTf = evaluateKeyframes(target, localTime);
      const newKf = {
        id: `kf_${Date.now().toString(36)}`,
        time: localTime,
        easing,
        x: currentTf.x,
        y: currentTf.y,
        scale: currentTf.scale,
        rotation: currentTf.rotation,
        opacity: currentTf.opacity,
      };
      const filtered = target.keyframes.filter((k) => Math.abs(k.time - localTime) > 0.08);
      const nextClips = clips.map((c) =>
        c.id === clipId
          ? { ...c, keyframes: [...filtered, newKf].sort((a, b) => a.time - b.time) }
          : c
      );
      commitMutation(nextClips);
    },
    [clips, playhead, commitMutation]
  );

  const handleRemoveKeyframe = useCallback(
    (clipId: string, keyframeId: string) => {
      const nextClips = clips.map((c) =>
        c.id === clipId
          ? { ...c, keyframes: c.keyframes.filter((k) => k.id !== keyframeId) }
          : c
      );
      commitMutation(nextClips);
    },
    [clips, commitMutation]
  );

  const handleAddAudioKeyframe = useCallback(
    (clipId: string) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;
      const localTime = Number(
        Math.max(0, Math.min(target.duration, playhead - target.startTime)).toFixed(3)
      );
      const newAkf = {
        id: `akf_${Date.now().toString(36)}`,
        time: localTime,
        easing: 'linear' as EasingType,
        volume: target.audio.volume,
        pan: target.audio.pan ?? 0,
      };
      const existing = (target.audioKeyframes ?? []).filter(
        (k) => Math.abs(k.time - localTime) > 0.08
      );
      const nextClips = clips.map((c) =>
        c.id === clipId
          ? { ...c, audioKeyframes: [...existing, newAkf].sort((a, b) => a.time - b.time) }
          : c
      );
      commitMutation(nextClips);
    },
    [clips, playhead, commitMutation]
  );

  const handleRemoveAudioKeyframe = useCallback(
    (clipId: string, keyframeId: string) => {
      const nextClips = clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              audioKeyframes: (c.audioKeyframes ?? []).filter((k) => k.id !== keyframeId),
            }
          : c
      );
      commitMutation(nextClips);
    },
    [clips, commitMutation]
  );

  const handleFreezeFrame = useCallback(
    (clipId: string) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;
      const localOffset = Math.max(0, playhead - target.startTime);
      const freezeClip: TimelineClip = {
        ...target,
        id: `clip_freeze_${Date.now().toString(36)}`,
        name: `${target.name} (Freeze)`,
        startTime: Number((target.startTime + target.duration).toFixed(3)),
        duration: 2.5,
        sourceOffset: Number((target.sourceOffset + localOffset * target.speed).toFixed(3)),
        speed: 1,
        freezeFrame: true,
        keyframes: [],
        audioKeyframes: [],
      };
      commitMutation([...clips, freezeClip]);
      setSelectedClipId(freezeClip.id);
    },
    [clips, playhead, commitMutation]
  );

  const handleAddAssetToTimeline = useCallback(
    (
      asset: MediaAsset,
      trackId: string,
      placement: InsertPlacement = 'back',
      explicitTime?: number
    ) => {
      const requestedTrack = tracks.find((t) => t.id === trackId);
      const dummyClipForTrackCheck = { kind: asset.kind } as TimelineClip;
      const targetTrack =
        requestedTrack && isClipCompatibleWithTrack(dummyClipForTrackCheck, requestedTrack)
          ? requestedTrack
          : tracks.find((t) => isClipCompatibleWithTrack(dummyClipForTrackCheck, t)) ?? tracks[0];

      const resolvedTrackId = targetTrack?.id ?? trackId;
      const isOverlay = targetTrack?.type === 'overlay';
      const defaultStart =
        explicitTime !== undefined
          ? explicitTime
          : isOverlay || asset.audioSubType === 'sfx' || asset.audioSubType === 'voiceover'
          ? playhead
          : 0;

      const newClip: TimelineClip = {
        id: `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        assetId: asset.id,
        trackId: resolvedTrackId,
        name: asset.name.replace(/\.[^.]+$/, ''),
        kind: asset.kind,
        startTime: Number(defaultStart.toFixed(3)),
        duration: Math.max(0.45, Math.min(60, asset.duration || 5)),
        sourceOffset: 0,
        speed: 1,
        speedRamp: 'none',
        reversed: false,
        freezeFrame: false,
        blendMode: 'source-over',
        transform: isOverlay
          ? { ...DEFAULT_TRANSFORM, scale: 0.45, x: 0.25, y: 0.2 }
          : { ...DEFAULT_TRANSFORM },
        keyframes: [],
        audioKeyframes: [],
        colorGrade: { ...DEFAULT_COLOR_GRADE },
        vfx: { ...DEFAULT_VFX },
        chromaKey: { ...DEFAULT_CHROMA_KEY },
        transitionIn: { type: 'none', duration: 0.5 },
        audio: { ...DEFAULT_AUDIO_CONFIG },
      };

      let nextClips: TimelineClip[];
      if (placement === 'front') {
        nextClips = insertClipAtFront(clips, newClip, resolvedTrackId);
        setPlayhead(0);
      } else if (placement === 'back') {
        nextClips = appendClipAtBack(clips, newClip, resolvedTrackId);
      } else {
        nextClips = insertClipAtTime(
          clips,
          newClip,
          resolvedTrackId,
          defaultStart,
          rippleEnabled && targetTrack?.type === 'video'
        );
      }

      commitMutation(nextClips);
      setSelectedClipId(newClip.id);
      setMobileSheet('none');
    },
    [clips, tracks, playhead, rippleEnabled, commitMutation]
  );

  const handleDropAsset = useCallback(
    (assetId: string, trackId: string, placement: InsertPlacement, startTime: number) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      handleAddAssetToTimeline(asset, trackId, placement, startTime);
    },
    [assets, handleAddAssetToTimeline]
  );

  const normalizeAudioClips = useCallback(
    async (
      predicate: (clip: TimelineClip) => boolean,
      targetLufs: number,
      preventClipping = true
    ) => {
      const candidates = clips.filter(predicate);
      if (candidates.length === 0) {
        setNormalizeStatusMessage('No audio-bearing clips matched for normalization.');
        return;
      }

      setIsNormalizingAudio(true);
      setNormalizeStatusMessage(null);
      try {
        const assetMap = new Map(assets.map((a) => [a.id, a]));
        const metricsCache = new Map<string, LoudnessMetrics>();
        const updatedWaveforms = new Map<string, number[]>();
        let normalizedCount = 0;
        let lastSummary = '';

        const nextClips = await Promise.all(
          clips.map(async (clip) => {
            if (!predicate(clip)) return clip;
            const asset = assetMap.get(clip.assetId);
            if (!asset || !asset.src || asset.kind === 'image' || clip.kind === 'text') {
              return clip;
            }

            let metrics = metricsCache.get(asset.id);
            if (!metrics) {
              try {
                metrics = await analyzeMediaAudioLoudness(asset.src);
                metricsCache.set(asset.id, metrics);
                updatedWaveforms.set(asset.id, metrics.waveform);
              } catch {
                return clip;
              }
            }

            const result = computeNormalizeGain(
              metrics.integratedLufs,
              targetLufs,
              metrics.truePeakDb,
              preventClipping
            );

            const ratio = result.volumePercent / Math.max(1, clip.audio.volume || 100);
            const scaledKeyframes = (clip.audioKeyframes ?? []).map((akf) => ({
              ...akf,
              volume: Math.max(0, Math.min(500, Math.round(akf.volume * ratio))),
            }));

            normalizedCount += 1;
            const sign = result.gainDb >= 0 ? '+' : '';
            lastSummary = `Normalized ${clip.name}: ${metrics.integratedLufs} LUFS -> ${result.projectedLufs} LUFS (${sign}${result.gainDb} dB, ${result.volumePercent}%)${result.peakLimited ? ' · Peak Limited' : ''}`;

            return {
              ...clip,
              audio: {
                ...clip.audio,
                volume: result.volumePercent,
                measuredLufs: metrics.integratedLufs,
                targetLufs: result.projectedLufs,
                peakDb: metrics.truePeakDb,
              },
              audioKeyframes: scaledKeyframes,
            };
          })
        );

        if (updatedWaveforms.size > 0) {
          setAssets((prev) =>
            prev.map((a) =>
              updatedWaveforms.has(a.id) ? { ...a, waveform: updatedWaveforms.get(a.id) } : a
            )
          );
        }

        if (normalizedCount > 0) {
          commitMutation(nextClips);
          setNormalizeStatusMessage(
            normalizedCount === 1
              ? lastSummary
              : `Normalized ${normalizedCount} clips to ${targetLufs} LUFS target.`
          );
        } else {
          setNormalizeStatusMessage('Selected clip has no decodable audio stream.');
        }
      } finally {
        setIsNormalizingAudio(false);
      }
    },
    [clips, assets, commitMutation]
  );

  const handleVoiceoverRecorded = useCallback(
    (blob: Blob, durationSec: number) => {
      const url = URL.createObjectURL(blob);
      const voAsset: MediaAsset = {
        id: `asset_vo_${Date.now().toString(36)}`,
        name: `Voiceover_${new Date().toLocaleTimeString().replace(/[: ]/g, '')}.webm`,
        src: url,
        kind: 'audio',
        audioSubType: 'voiceover',
        duration: durationSec,
        width: 0,
        height: 0,
        sizeBytes: blob.size,
        waveform: generateWaveform(blob.size % 89, 36),
        formatInfo: inspectMediaFileSpec('voiceover.webm', blob.type || 'audio/webm'),
      };
      setAssets((prev) => [voAsset, ...prev]);
      const targetAudio =
        tracks.find((t) => t.role === 'voiceover')?.id ??
        tracks.find((t) => t.type === 'audio')?.id ??
        'track_a1';
      handleAddAssetToTimeline(voAsset, targetAudio, 'time');
    },
    [tracks, handleAddAssetToTimeline]
  );

  const handleImportFiles = useCallback(
    async (fileList: FileList | File[], preferredTrackId?: string, preferredStartTime?: number) => {
      const files = Array.from(fileList);
      for (const file of files) {
        const headerSlice = file.slice(0, 32);
        const buf = await headerSlice.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const formatInfo = inspectMediaFileSpec(file.name, file.type, bytes);
        const objectUrl = URL.createObjectURL(file);

        let duration = formatInfo.category === 'image' ? 5 : 8;
        let width = 1920;
        let height = 1080;

        if (formatInfo.category === 'video' && formatInfo.nativePlayable) {
          await new Promise<void>((resolve) => {
            const vid = document.createElement('video');
            vid.preload = 'metadata';
            const timer = setTimeout(() => resolve(), 1500);
            vid.onloadedmetadata = () => {
              clearTimeout(timer);
              if (Number.isFinite(vid.duration) && vid.duration > 0) {
                duration = Number(vid.duration.toFixed(2));
              }
              if (vid.videoWidth > 0) {
                width = vid.videoWidth;
                height = vid.videoHeight;
              }
              resolve();
            };
            vid.onerror = () => {
              clearTimeout(timer);
              resolve();
            };
            vid.src = objectUrl;
          });
        } else if (formatInfo.category === 'audio') {
          await new Promise<void>((resolve) => {
            const aud = document.createElement('audio');
            aud.preload = 'metadata';
            const timer = setTimeout(() => resolve(), 1500);
            aud.onloadedmetadata = () => {
              clearTimeout(timer);
              if (Number.isFinite(aud.duration) && aud.duration > 0) {
                duration = Number(aud.duration.toFixed(2));
              }
              resolve();
            };
            aud.onerror = () => {
              clearTimeout(timer);
              resolve();
            };
            aud.src = objectUrl;
          });
        }

        const newAsset: MediaAsset = {
          id: `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          name: file.name,
          src: objectUrl,
          kind: formatInfo.category,
          duration,
          width,
          height,
          sizeBytes: file.size,
          formatInfo,
          waveform: formatInfo.category === 'audio' ? generateWaveform(file.size % 97, 48) : undefined,
        };

        setAssets((prev) => [newAsset, ...prev]);
        const targetTrack =
          preferredTrackId ??
          (formatInfo.category === 'audio'
            ? tracks.find((t) => t.type === 'audio')?.id ?? 'track_a1'
            : tracks.find((t) => t.type === 'video')?.id ?? 'track_v1');
        handleAddAssetToTimeline(
          newAsset,
          targetTrack,
          preferredStartTime !== undefined ? 'time' : 'back',
          preferredStartTime
        );
      }
    },
    [tracks, handleAddAssetToTimeline]
  );

  const handleAddTextClip = useCallback(
    (preset: TextPresetType) => {
      const defaults: Record<
        TextPresetType,
        { text: string; subtitle?: string; fontSize: number; y: number; anim: 'slideUp' | 'pop' | 'fade' | 'typewriter' }
      > = {
        title: { text: 'CHAPTER ONE', subtitle: '4K Cinema Edit', fontSize: 68, y: 0, anim: 'fade' },
        lowerThird: {
          text: 'DIRECTOR CUT',
          subtitle: 'RORN Mobile Studio',
          fontSize: 48,
          y: 0.28,
          anim: 'slideUp',
        },
        subtitle: {
          text: 'Every frame graded in real time',
          fontSize: 38,
          y: 0.34,
          anim: 'typewriter',
        },
        kinetic: { text: 'ULTRA 60FPS', fontSize: 72, y: 0, anim: 'pop' },
      };
      const d = defaults[preset];
      const clip: TimelineClip = {
        id: `clip_text_${Date.now().toString(36)}`,
        assetId: 'text_builtin',
        trackId: tracks.find((t) => t.type === 'text')?.id ?? 'track_t1',
        name: `Title: ${d.text}`,
        kind: 'text',
        startTime: Number(playhead.toFixed(3)),
        duration: 3.5,
        sourceOffset: 0,
        speed: 1,
        speedRamp: 'none',
        reversed: false,
        freezeFrame: false,
        blendMode: 'source-over',
        transform: { ...DEFAULT_TRANSFORM, y: d.y },
        keyframes: [],
        audioKeyframes: [],
        colorGrade: { ...DEFAULT_COLOR_GRADE },
        vfx: { ...DEFAULT_VFX },
        chromaKey: { ...DEFAULT_CHROMA_KEY },
        transitionIn: { type: 'none', duration: 0.3 },
        audio: { ...DEFAULT_AUDIO_CONFIG },
        textConfig: {
          text: d.text,
          subtitle: d.subtitle,
          fontFamily: 'Plus Jakarta Sans',
          fontSize: d.fontSize,
          fontWeight: preset === 'kinetic' ? '900' : '700',
          letterSpacing: preset === 'title' ? 2 : 0,
          textStyle: preset === 'kinetic' ? 'outline' : preset === 'lowerThird' ? 'badge' : 'clean',
          color: '#F9FAFB',
          bgColor: '#090A0D',
          bgOpacity: preset === 'kinetic' ? 0 : 0.45,
          strokeColor: '#000000',
          animation: d.anim,
          preset,
        },
      };
      commitMutation([...clips, clip]);
      setSelectedClipId(clip.id);
      setInspectorTab('text');
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileSheet('inspector');
      }
    },
    [clips, tracks, playhead, commitMutation]
  );

  const handleDuplicateClip = useCallback(() => {
    if (!selectedClip) return;
    const dup: TimelineClip = {
      ...selectedClip,
      id: `${selectedClip.id}_dup_${Date.now().toString(36)}`,
      name: `${selectedClip.name} Copy`,
      startTime: Number((selectedClip.startTime + selectedClip.duration).toFixed(3)),
      keyframes: selectedClip.keyframes.map((k) => ({ ...k })),
      audioKeyframes: (selectedClip.audioKeyframes ?? []).map((k) => ({ ...k })),
      transform: { ...selectedClip.transform },
      colorGrade: { ...selectedClip.colorGrade },
      vfx: { ...selectedClip.vfx },
      chromaKey: { ...selectedClip.chromaKey },
      transitionIn: { ...selectedClip.transitionIn },
      audio: { ...selectedClip.audio },
    };
    commitMutation([...clips, dup]);
    setSelectedClipId(dup.id);
  }, [selectedClip, clips, commitMutation]);

  const handleMoveClip = useCallback(
    (clipId: string, newStartTime: number, targetTrackId?: string) => {
      setClips((prev) =>
        prev.map((c) => {
          if (c.id !== clipId) return c;
          if (targetTrackId) {
            const tr = tracks.find((t) => t.id === targetTrackId);
            if (tr) return moveClipToTrackAndTime(c, tr, newStartTime);
          }
          return { ...c, startTime: newStartTime };
        })
      );
    },
    [tracks]
  );

  const handleTrimClip = useCallback(
    (clipId: string, newStart: number, newDur: number, newOffset: number) => {
      setClips((prev) =>
        prev.map((c) =>
          c.id === clipId
            ? { ...c, startTime: newStart, duration: newDur, sourceOffset: newOffset }
            : c
        )
      );
    },
    []
  );

  const handleToggleTrackFlag = useCallback(
    (trackId: string, flag: 'muted' | 'locked' | 'hidden' | 'solo') => {
      const next = tracks.map((t) =>
        t.id === trackId ? { ...t, [flag]: !t[flag] } : t
      );
      commitMutation(clips, next);
    },
    [clips, tracks, commitMutation]
  );

  const handleDeleteTrack = useCallback(
    (trackId: string) => {
      const nextTracks = tracks.filter((t) => t.id !== trackId);
      const nextClips = clips.filter((c) => c.trackId !== trackId);
      commitMutation(nextClips, nextTracks);
    },
    [clips, tracks, commitMutation]
  );

  const handleCompactGaps = useCallback(() => {
    const targetTrackId = selectedClip?.trackId ?? 'track_v1';
    const compacted = compactTrackGaps(clips, targetTrackId);
    commitMutation(compacted);
  }, [clips, selectedClip?.trackId, commitMutation]);

  const handleAutoDuckClip = useCallback(
    (clipId: string) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;
      const trackRoleMap = new Map(tracks.map((t) => [t.id, t]));
      const triggers = clips.filter((c) => {
        if (c.id === target.id || c.kind !== 'audio') return false;
        const tr = trackRoleMap.get(c.trackId);
        return Boolean(tr && !tr.muted && !c.audio.muted && c.trackId !== target.trackId);
      });
      const kfs = computeAutoDuckKeyframes(target, triggers, 30);
      if (kfs.length === 0) {
        setNormalizeStatusMessage(
          'Place a Voiceover or SFX clip overlapping this track to generate Auto-Ducking keyframes.'
        );
        return;
      }
      const nextClips = clips.map((c) =>
        c.id === clipId ? { ...c, audioKeyframes: kfs } : c
      );
      commitMutation(nextClips);
      setNormalizeStatusMessage(
        `Auto-Ducked ${target.name} with ${kfs.length} envelope keyframes around Voice/SFX.`
      );
    },
    [clips, tracks, commitMutation]
  );

  const handleTransformSelectedClip = useCallback(
    (clipId: string, patch: { x?: number; y?: number; scale?: number }) => {
      setClips((prev) =>
        prev.map((c) =>
          c.id === clipId
            ? {
                ...c,
                transform: {
                  ...c.transform,
                  ...(patch.x !== undefined ? { x: patch.x } : {}),
                  ...(patch.y !== undefined ? { y: patch.y } : {}),
                  ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
                },
              }
            : c
        )
      );
    },
    []
  );

  const handlePickChromaColor = useCallback(
    (hex: string) => {
      if (selectedClipId) {
        setClips((prev) =>
          prev.map((c) =>
            c.id === selectedClipId
              ? { ...c, chromaKey: { ...c.chromaKey, color: hex, enabled: true } }
              : c
          )
        );
      }
      setEyedropperActive(false);
    },
    [selectedClipId]
  );

  const openMobileTool = (tab: InspectorTab) => {
    setInspectorTab(tab);
    setMobileSheet('inspector');
  };

  const renderVault = () => (
    <MediaVaultPanel
      activeTab={leftTab}
      onChangeTab={setLeftTab}
      assets={assets}
      tracks={tracks}
      selectedClip={selectedClip}
      onImportFiles={handleImportFiles}
      onAddAssetToTimeline={handleAddAssetToTimeline}
      onApplyLut={(lutId) => {
        if (!selectedClip) return;
        handleUpdateClip(selectedClip.id, (p) => ({
          ...p,
          colorGrade: { ...p.colorGrade, lutId },
        }));
      }}
      onApplyVfx={(key: keyof VfxConfig, intensity: number) => {
        if (!selectedClip) return;
        handleUpdateClip(selectedClip.id, (p) => ({
          ...p,
          vfx: { ...(p.vfx ?? DEFAULT_VFX), [key]: intensity },
        }));
        setInspectorTab('vfx');
      }}
      onApplyTransition={(type: TransitionType) => {
        if (!selectedClip) return;
        handleUpdateClip(selectedClip.id, (p) => ({
          ...p,
          transitionIn: { ...p.transitionIn, type },
        }));
      }}
      onAddTextClip={handleAddTextClip}
      onVoiceoverRecorded={handleVoiceoverRecorded}
      onNormalizeAllAudio={(targetLufs) =>
        normalizeAudioClips((c) => c.kind === 'audio' || c.kind === 'video', targetLufs, true)
      }
      isNormalizingAudio={isNormalizingAudio}
    />
  );

  const renderInspector = () => (
    <InspectorPanel
      clip={selectedClip}
      playhead={playhead}
      activeTab={inspectorTab}
      onChangeTab={setInspectorTab}
      onUpdateClip={handleUpdateClip}
      onAdjustDuration={handleAdjustDuration}
      onAddKeyframe={handleAddKeyframe}
      onRemoveKeyframe={handleRemoveKeyframe}
      onAddAudioKeyframe={handleAddAudioKeyframe}
      onRemoveAudioKeyframe={handleRemoveAudioKeyframe}
      onFreezeFrame={handleFreezeFrame}
      onNormalizeClipAudio={(clipId, targetLufs, preventClipping) =>
        normalizeAudioClips((c) => c.id === clipId, targetLufs, preventClipping)
      }
      onNormalizeTrackAudio={(trackId, targetLufs, preventClipping) =>
        normalizeAudioClips((c) => c.trackId === trackId, targetLufs, preventClipping)
      }
      onAutoDuckClip={handleAutoDuckClip}
      onAddTextClip={handleAddTextClip}
      eyedropperActive={eyedropperActive}
      onToggleEyedropper={() => {
        setEyedropperActive((a) => !a);
        setMobileSheet('none');
      }}
      isNormalizingAudio={isNormalizingAudio}
      normalizeStatusMessage={normalizeStatusMessage}
    />
  );

  const persistCurrentProject = useCallback(
    (overrideExportCount?: number) => {
      const visualClip = clips.find((c) => c.kind === 'image' || c.kind === 'video');
      const visualAsset = visualClip
        ? assets.find((a) => a.id === visualClip.assetId)
        : undefined;
      const effectiveExports = overrideExportCount ?? exportedCount;
      const nextRecord: SavedProjectRecord = {
        id: activeProjectId,
        title: projectTitle.trim() || 'Untitled Project',
        aspectRatio,
        tracks,
        clips,
        markers,
        playhead,
        durationSec: Number(getProjectDuration(clips).toFixed(1)),
        progressPct: computeProjectProgress({
          clips,
          tracks,
          playhead,
          exportedCount: effectiveExports,
        }),
        createdAt: projectCreatedAt,
        updatedAt: Date.now(),
        thumbnailSrc:
          visualAsset && !visualAsset.src.startsWith('blob:')
            ? visualAsset.src
            : undefined,
        clipCount: clips.length,
        exportedCount: effectiveExports,
      };
      setSavedProjects((prev) => upsertSavedProject(nextRecord, prev));
    },
    [
      activeProjectId,
      projectTitle,
      aspectRatio,
      tracks,
      clips,
      markers,
      playhead,
      exportedCount,
      projectCreatedAt,
      assets,
    ]
  );

  useEffect(() => {
    if (screenMode !== 'editor') return;
    const timer = setTimeout(() => {
      persistCurrentProject();
    }, 280);
    return () => clearTimeout(timer);
  }, [
    screenMode,
    clips,
    tracks,
    projectTitle,
    aspectRatio,
    markers,
    exportedCount,
    persistCurrentProject,
  ]);

  const handleCreateNewProject = useCallback(() => {
    const fresh = createNewBlankProjectRecord(savedProjects);
    setSavedProjects((prev) => upsertSavedProject(fresh, prev));
    setActiveProjectId(fresh.id);
    setProjectCreatedAt(fresh.createdAt);
    setProjectTitle(fresh.title);
    setAspectRatio(fresh.aspectRatio);
    setTracks(fresh.tracks);
    setClips([]);
    setMarkers([]);
    setPlayhead(0);
    setSelectedClipId(null);
    setExportedCount(0);
    setHistoryPast([]);
    setHistoryFuture([]);
    setIsPlaying(false);
    setScreenMode('editor');
  }, [savedProjects]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      const target = savedProjects.find((p) => p.id === projectId);
      if (!target) return;
      setActiveProjectId(target.id);
      setProjectCreatedAt(target.createdAt);
      setProjectTitle(target.title);
      setAspectRatio(target.aspectRatio);
      setTracks(target.tracks.length > 0 ? target.tracks : INITIAL_TRACKS);
      setClips(target.clips);
      setMarkers(target.markers ?? []);
      setPlayhead(target.playhead ?? 0);
      setSelectedClipId(target.clips[0]?.id ?? null);
      setExportedCount(target.exportedCount ?? 0);
      setHistoryPast([]);
      setHistoryFuture([]);
      setIsPlaying(false);
      setScreenMode('editor');
    },
    [savedProjects]
  );

  const handleDeleteProject = useCallback((projectId: string) => {
    setSavedProjects((prev) => deleteSavedProject(projectId, prev));
  }, []);

  const handleBackToHome = useCallback(() => {
    setIsPlaying(false);
    persistCurrentProject();
    setScreenMode('home');
  }, [persistCurrentProject]);

  if (screenMode !== 'editor') {
    return (
      <>
        <HomeScreen
          projects={savedProjects}
          onCreateNew={handleCreateNewProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
          onOpenFormats={() => setFormatsModalOpen(true)}
        />
        <FormatsModal open={formatsModalOpen} onClose={() => setFormatsModalOpen(false)} />
        <OfflineIndicator />
        {screenMode === 'splash' && (
          <SplashScreen
            mediaCache={cacheRef.current}
            onComplete={(bootResult) => {
              if (bootResult.ambientWavUrl) {
                setAssets((prev) =>
                  prev.map((a) =>
                    a.id === 'asset_score' ? { ...a, src: bootResult.ambientWavUrl } : a
                  )
                );
              }
              setSavedProjects(loadSavedProjects());
              setScreenMode('home');
            }}
          />
        )}
      </>
    );
  }

  return (
    <div
      className="h-[100dvh] w-full flex flex-col bg-[#090A0D] text-[#F3F4F6] overflow-hidden"
      data-playing={isPlaying ? 'true' : 'false'}
    >
      <TopBar
        projectTitle={projectTitle}
        onRenameProject={setProjectTitle}
        aspectRatio={aspectRatio}
        onChangeAspectRatio={setAspectRatio}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenFormats={() => setFormatsModalOpen(true)}
        onOpenExport={() => setExportModalOpen(true)}
        onBackToHome={handleBackToHome}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[296px_1fr_316px] overflow-hidden">
        <div className="hidden lg:block min-h-0 overflow-hidden">{renderVault()}</div>

        <PreviewStage
          playhead={playhead}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          loopEnabled={loopEnabled}
          aspectRatio={aspectRatio}
          clips={clips}
          tracks={tracks}
          assets={assets}
          cache={cacheRef.current}
          selectedClip={selectedClip}
          eyedropperActive={eyedropperActive}
          showSafeMargins={showSafeMargins}
          showScopes={showScopes}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onChangePlaybackRate={setPlaybackRate}
          onToggleLoop={() => setLoopEnabled((v) => !v)}
          onSeek={handleSeek}
          onToggleSafeMargins={() => setShowSafeMargins((v) => !v)}
          onToggleScopes={() => setShowScopes((v) => !v)}
          onSplitAtPlayhead={handleSplitAtPlayhead}
          onTransformSelectedClip={handleTransformSelectedClip}
          onPickChromaColor={handlePickChromaColor}
          onCancelEyedropper={() => setEyedropperActive(false)}
        />

        <div className="hidden lg:block min-h-0 overflow-hidden">{renderInspector()}</div>
      </main>

      {/* Multi-Track Timeline */}
      <TimelinePanel
        tracks={tracks}
        clips={clips}
        assets={assets}
        markers={markers}
        selectedClipId={selectedClipId}
        playhead={playhead}
        totalDuration={totalDuration}
        zoomPxPerSec={zoomPxPerSec}
        snapEnabled={snapEnabled}
        rippleEnabled={rippleEnabled}
        onSelectClip={(id) => {
          setSelectedClipId(id);
          setNormalizeStatusMessage(null);
        }}
        onSeek={handleSeek}
        onZoomChange={setZoomPxPerSec}
        onToggleSnap={() => setSnapEnabled((s) => !s)}
        onToggleRipple={() => setRippleEnabled((r) => !r)}
        onToggleTrackFlag={handleToggleTrackFlag}
        onAddTrack={handleAddTrack}
        onDeleteTrack={handleDeleteTrack}
        onAddMarker={handleAddMarker}
        onRemoveMarker={handleRemoveMarker}
        onCompactGaps={handleCompactGaps}
        onMoveClip={handleMoveClip}
        onTrimClip={handleTrimClip}
        onNudgeClip={handleNudgeClip}
        onSplitClip={handleSplitAtPlayhead}
        onDuplicateClip={handleDuplicateClip}
        onDeleteClip={handleDeleteClip}
        onDropAsset={handleDropAsset}
        onDropFiles={(files, trackId, startTime) => handleImportFiles(files, trackId, startTime)}
      />

      {/* Android Mobile Thumb-Zone Bottom Dock (< lg) */}
      <nav
        aria-label="Mobile Studio Tools"
        className="lg:hidden shrink-0 border-t border-white/10 bg-[#0D0F14] px-2 py-1 flex items-center gap-1 overflow-x-auto no-scrollbar"
      >
        <button
          type="button"
          onClick={() => {
            setLeftTab('media');
            setMobileSheet('vault');
          }}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Film className="w-4 h-4 text-sky-400" />
          <span>Media</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('color')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Palette className="w-4 h-4 text-amber-400" />
          <span>Color</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('vfx')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Wand2 className="w-4 h-4 text-fuchsia-400" />
          <span>VFX</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('motion')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Sliders className="w-4 h-4 text-violet-400" />
          <span>Motion</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('speed')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span>Speed</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('chroma')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Pipette className="w-4 h-4 text-emerald-400" />
          <span>Chroma</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('transition')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Trans</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setLeftTab('titles');
            setMobileSheet('vault');
          }}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Type className="w-4 h-4 text-pink-400" />
          <span>Text</span>
        </button>
        <button
          type="button"
          onClick={() => openMobileTool('audio')}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <Volume2 className="w-4 h-4 text-emerald-300" />
          <span>Audio</span>
        </button>
        <button
          type="button"
          onClick={() => setFormatsModalOpen(true)}
          className="min-h-[44px] min-w-[54px] px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-zinc-200 hover:bg-white/10 shrink-0"
        >
          <FileVideo className="w-4 h-4 text-zinc-300" />
          <span>Formats</span>
        </button>
      </nav>

      {/* Mobile Bottom Sheet Drawer */}
      {mobileSheet !== 'none' && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setMobileSheet('none')}
        >
          <div
            className="relative h-[68vh] rounded-t-3xl border-t border-white/15 bg-[#0D0F14] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <span className="text-xs font-semibold text-zinc-200">
                {mobileSheet === 'vault' ? 'Media, Filters & VFX Vault' : 'Clip Inspector'}
              </span>
              <button
                type="button"
                onClick={() => setMobileSheet('none')}
                aria-label="Close Tool Drawer"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {mobileSheet === 'vault' ? renderVault() : renderInspector()}
            </div>
          </div>
        </div>
      )}

      <FormatsModal open={formatsModalOpen} onClose={() => setFormatsModalOpen(false)} />
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        projectTitle={projectTitle}
        aspectRatio={aspectRatio}
        clips={clips}
        tracks={tracks}
        assets={assets}
        savedGallery={savedGallery}
        onSaveToGallery={(res: ExportResult, adUnitId: string) => {
          setExportedCount((c) => {
            const next = c + 1;
            persistCurrentProject(next);
            return next;
          });
          setSavedGallery((prev) => {
            if (prev.some((g) => g.blobUrl === res.blobUrl)) return prev;
            return [
              {
                id: `gal_${Date.now().toString(36)}`,
                filename: res.filename,
                mimeType: res.mimeType,
                sizeBytes: res.sizeBytes,
                blobUrl: res.blobUrl,
                blob: res.blob,
                createdAt: Date.now(),
                aspectRatio,
                adUnitId,
              },
              ...prev,
            ];
          });
        }}
      />
      <OfflineIndicator />
    </div>
  );
}
