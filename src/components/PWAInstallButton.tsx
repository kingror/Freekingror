import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
        aria-label="Install Android App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Add App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#14171F] p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-white">Install KineForge Studio</h3>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in your browser toolbar.
                <br />
                2. Select <strong>Add to Home Screen</strong> for full-screen editing.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
