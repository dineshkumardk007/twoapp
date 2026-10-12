import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { UpdateInfo, installUpdate, remindLater, sizeLabel } from '../core/appUpdate';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';

interface UpdatePromptProps {
  update: UpdateInfo;
  onClose: () => void;
}

type Stage = 'ready' | 'downloading' | 'installer' | 'permission' | 'failed';

/**
 * A new version is out: what is new, and Update or Later.
 *
 * Update downloads it inside the app and opens Android's installer, which
 * asks once more before it installs - an app outside a store cannot update
 * itself silently, and a person who tapped Update should see why the phone is
 * asking. The first time, the phone also wants Two allowed to install apps;
 * its settings screen opens, and coming back carries on by itself.
 *
 * Later hides this version for a day. Back counts as Later.
 */
export const UpdatePrompt: React.FC<UpdatePromptProps> = ({ update, onClose }) => {
  const [stage, setStage] = useState<Stage>('ready');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  const later = () => {
    remindLater(update.code);
    onClose();
  };
  useBackLayer(true, later);

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    haptic('tick');
    setMessage(null);
    setProgress(0);
    setStage('downloading');
    const result = await installUpdate(setProgress);
    busy.current = false;
    if (result.ok) {
      setStage('installer');
      return;
    }
    switch (result.reason) {
      case 'permission':
        setStage('permission');
        return;
      case 'busy':
        setStage('downloading');
        return;
      case 'none':
        onClose();
        return;
      case 'network':
        setMessage("Couldn't download it. Check your connection and try again.");
        break;
      case 'verify':
        setMessage("The download didn't check out, so nothing was installed. Try again in a while.");
        break;
      default:
        setMessage("Couldn't open the installer. Try again.");
    }
    setStage('failed');
  };

  // Back from the phone's "install unknown apps" switch: carry on.
  useEffect(() => {
    if (stage !== 'permission') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void start();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const percent = Math.round(progress * 100);
  const size = sizeLabel(update.size);

  return (
    <div
      className="fixed inset-0 z-[58] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-2xl space-y-5 animate-scale-up">
        <button
          type="button"
          onClick={later}
          aria-label="Later"
          className="absolute right-4 top-4 rounded-full p-1.5 text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 pr-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linen-primary text-linen-surface shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 id="update-title" className="font-serif text-xl font-semibold text-linen-primary">
              A new Two is ready
            </h2>
            <p className="text-xs text-linen-secondary">
              Version {update.name}
              {size && ` · ${size}`}
            </p>
          </div>
        </div>

        {update.notes.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-linen-secondary">What's new</p>
            <ul className="mt-2 space-y-1.5">
              {update.notes.map((note, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug text-linen-primary">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-pink" />
                  <span className="min-w-0">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stage === 'downloading' && (
          <div className="space-y-1.5" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-linen-variant">
              <div
                className="h-full rounded-full bg-linen-primary transition-[width] duration-300"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
            <p className="text-[11px] text-linen-secondary tabular-nums">Downloading… {percent}%</p>
          </div>
        )}

        {stage === 'installer' && (
          <p role="status" className="text-[11px] leading-relaxed text-linen-secondary">
            Android is asking you to confirm. Tap <span className="font-semibold text-linen-primary">Install</span> -
            everything in Two stays as it is. Closed it by mistake? Tap Update again.
          </p>
        )}

        {stage === 'permission' && (
          <p role="status" className="text-[11px] leading-relaxed text-linen-secondary">
            One time only: on the screen that just opened, turn on{' '}
            <span className="font-semibold text-linen-primary">Allow from this source</span> for Two, then come
            back here. The update carries on by itself.
          </p>
        )}

        {message && (
          <p role="status" className="text-[11px] leading-relaxed text-rose-700">
            {message}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={later}
            className="px-4 py-2.5 rounded-xl border border-linen-border bg-linen-surface text-sm font-medium text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void start()}
            disabled={stage === 'downloading'}
            className="flex-1 py-2.5 rounded-xl bg-linen-primary text-linen-surface text-sm font-semibold shadow-glow hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer"
          >
            {stage === 'downloading' ? 'Downloading…' : 'Update'}
          </button>
        </div>

        {stage === 'ready' && (
          <p className="text-[11px] leading-relaxed text-linen-secondary">
            Your messages and everything else in Two stay as they are.
          </p>
        )}
      </div>
    </div>
  );
};
