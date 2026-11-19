import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FolderCheck,
  Share2,
} from 'lucide-react';
import type { ExportResult } from '../engine/exporter';
import {
  GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID,
  saveExportToDeviceGallery,
  shareExportedMedia,
} from '../engine/googleAds';

interface GalleryExportSuccessViewProps {
  result: ExportResult;
  projectTitle: string;
  verifiedAdUnitId: string;
  onSavedToGallery: (result: ExportResult, adUnitId: string) => void;
}

export const GalleryExportSuccessView: React.FC<GalleryExportSuccessViewProps> = ({
  result,
  projectTitle,
  verifiedAdUnitId,
  onSavedToGallery,
}) => {
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const handleSaveToGallery = async () => {
    try {
      const res = await saveExportToDeviceGallery(result);
      onSavedToGallery(result, verifiedAdUnitId || GOOGLE_ADMOB_REWARDED_VIDEO_TEST_ID);
      setSavedConfirmed(true);
      setActionMsg(res.message);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setActionMsg('Saved copy to Studio Gallery.');
      }
    }
  };

  const handleShare = async () => {
    try {
      const res = await shareExportedMedia(result, projectTitle);
      setActionMsg(res.message);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setActionMsg('Unable to open share sheet in this environment.');
      }
    }
  };

  return (
    <div
      className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 space-y-3"
      data-testid="save-share-unlocked-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-100 truncate">{result.filename}</p>
            <p className="text-[11px] font-mono-tabular text-emerald-300/80">
              {(result.sizeBytes / 1024).toFixed(0)} KB · Ad Verified ({verifiedAdUnitId.slice(-10)})
            </p>
          </div>
        </div>
      </div>

      {/* Inline Media Preview */}
      {result.mimeType.startsWith('video/') ? (
        <video
          src={result.blobUrl}
          controls
          playsInline
          className="w-full max-h-[150px] rounded-xl bg-black border border-white/10"
        />
      ) : result.mimeType.startsWith('audio/') ? (
        <audio src={result.blobUrl} controls className="w-full h-10" />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSaveToGallery}
          className="min-h-[42px] px-3 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-semibold hover:bg-emerald-400 flex items-center justify-center gap-1.5 transition-colors"
        >
          {savedConfirmed ? (
            <FolderCheck className="w-4 h-4 shrink-0" />
          ) : (
            <Download className="w-4 h-4 shrink-0" />
          )}
          <span>{savedConfirmed ? 'Saved to Gallery' : 'Save to Gallery'}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="min-h-[42px] px-3 rounded-xl bg-sky-500 text-zinc-950 text-xs font-semibold hover:bg-sky-400 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span>Share Video</span>
        </button>
      </div>

      {actionMsg && (
        <p className="text-[11px] text-emerald-200 leading-snug" role="status">
          {actionMsg}
        </p>
      )}
    </div>
  );
};
