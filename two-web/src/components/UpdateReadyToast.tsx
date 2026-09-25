import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface UpdateReadyToastProps {
  /** Held back while a call is up: refreshing would end it. */
  suppressed: boolean;
}

/**
 * Offers a refresh once a new version of the app has arrived.
 *
 * The service worker takes over as soon as a new one installs (skipWaiting and
 * clients.claim), and loads fresh files from then on - but the page already
 * open is still running the code it started with, and on a phone that page can
 * stay open for days. So the change of worker is the moment to say so.
 *
 * Only a change: the very first worker taking control of a fresh install is
 * not an update, and saying there is one would be the first thing a new
 * person is told that is not true.
 *
 * Never refreshes by itself. Half a message typed, a letter being written - the
 * moment is theirs to choose.
 */
export const UpdateReadyToast: React.FC<UpdateReadyToastProps> = ({ suppressed }) => {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    let hadController = !!sw.controller;

    const onControllerChange = () => {
      if (hadController) setReady(true);
      hadController = true;
    };

    // A page left open for days would otherwise only look for a new version
    // when the browser happened to. Coming back to the app is a good moment.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      sw.getRegistration()
        .then(reg => reg?.update())
        .catch(() => {});
    };

    sw.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sw.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!ready || dismissed || suppressed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-[45] flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-linen-border bg-linen-surface/95 py-1 pl-1 pr-1 text-linen-primary shadow-lg backdrop-blur-xl">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-linen-border/40"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <span>
            A gentle update is ready <span className="text-linen-secondary">•</span> Tap to refresh
          </span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Not now"
          className="shrink-0 rounded-full p-1.5 text-linen-secondary transition-colors hover:bg-linen-border/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
