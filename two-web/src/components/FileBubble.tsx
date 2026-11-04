import React, { useEffect, useReducer } from 'react';
import {
  CircleAlert,
  Clock,
  Download,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Package,
  Presentation,
  RotateCw,
  Share2,
  ShieldCheck
} from 'lucide-react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import {
  fetchFile,
  fetchesByItself,
  fileKind,
  fileStatus,
  formatSize,
  isFileReady,
  openFile,
  saveFileCopy,
  shareFile,
  subscribeFile,
  typeLabel,
  type FileInfo,
  type FileKind
} from '../core/files';

/** Each kind's colour and icon. */
const LOOK: Record<FileKind, { color: string; Icon: typeof FileIcon }> = {
  pdf: { color: '#e5484d', Icon: FileText },
  doc: { color: '#2f6fe4', Icon: FileText },
  sheet: { color: '#1f9d55', Icon: FileSpreadsheet },
  slides: { color: '#e8743b', Icon: Presentation },
  zip: { color: '#8a6d3b', Icon: FileArchive },
  image: { color: '#7c6cff', Icon: FileImage },
  video: { color: '#d946ef', Icon: FileVideo },
  audio: { color: '#0ea5e9', Icon: FileAudio },
  text: { color: '#64748b', Icon: FileText },
  app: { color: '#22a06b', Icon: Package },
  other: { color: '#6b7280', Icon: FileIcon }
};

interface FileBubbleProps {
  info: FileInfo;
  mine: boolean;
  partnerName: string;
  /** When its message was sent: one older than the relay keeps files is not fetched by itself. */
  sentAt?: number;
  /** Tries again to send one of yours that failed to go up. */
  onRetrySend: (id: string) => void;
  /** A word to say: saved, could not be opened... */
  onNote: (text: string) => void;
}

/** A ring that fills as it moves. */
const Ring: React.FC<{ fraction: number; color: string }> = ({ fraction, color }) => {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={3} />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0.03, Math.min(1, fraction)))}
        style={{ transition: 'stroke-dashoffset 300ms ease' }}
      />
    </svg>
  );
};

/**
 * A file in the chat (core/files): its kind as a coloured icon, its name,
 * size and type - and where it stands. Going up or coming down, a ring and
 * how fast; once it is here whole, "Exact copy", and opening, saving or
 * sharing it. Fetched by itself when it arrives, if it is not too big.
 */
export const FileBubble: React.FC<FileBubbleProps> = ({ info, mine, partnerName, sentAt, onRetrySend, onNote }) => {
  const tr = useT();
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeFile(info.id, bump), [info.id]);
  const status = fileStatus(info, mine);
  const ready = isFileReady(info.id);
  const { color, Icon } = LOOK[fileKind(info)];

  // Fetched by itself once all of it is in the bucket - when not too big.
  useEffect(() => {
    if (!mine && status.phase === 'idle' && ready && fetchesByItself(info, sentAt)) void fetchFile(info);
  }, [mine, status.phase, ready, info, sentAt]);

  const here = mine || status.phase === 'done';
  const moving = status.phase === 'preparing' || status.phase === 'uploading' || status.phase === 'downloading';
  const pct = Math.round((status.done / Math.max(1, status.total)) * 100);
  const speed = status.speed && status.speed > 0 ? ` · ${formatSize(Math.round(status.speed))}/s` : '';

  const act = async (what: 'open' | 'save' | 'share') => {
    haptic('tick');
    try {
      const ok = await (what === 'open' ? openFile(info) : what === 'save' ? saveFileCopy(info) : shareFile(info));
      if (!ok && what === 'open') onNote(tr('No app on this phone opens this kind of file - try Save'));
      else if (ok && what === 'save') onNote(tr('Saved to Downloads'));
    } catch {
      onNote(tr('That file could not be opened'));
    }
  };

  const line = (() => {
    switch (status.phase) {
      case 'preparing':
        return tr('Getting it ready… {pct}%', { pct });
      case 'uploading':
        return tr('Sending {pct}%', { pct }) + speed;
      case 'downloading':
        return tr('Downloading {pct}%', { pct }) + speed;
      case 'sent':
        return tr('Sent');
      case 'done':
        return tr('Exact copy');
      case 'waiting':
        return tr('Waiting for {name}’s phone to finish sending', { name: partnerName });
      case 'missing':
        return tr('No longer on the relay - it keeps files 30 days');
      case 'failed':
        return status.error === 'mismatch'
          ? tr('It did not arrive whole - try again')
          : status.error === 'files-off'
            ? tr('Files are off on the relay for now')
            : mine
              ? tr('Could not send - tap to try again')
              : tr('Could not download - tap to try again');
      default:
        return ready || mine ? tr('Tap to download') : tr('Waiting for {name}’s phone to finish sending', { name: partnerName });
    }
  })();

  const onMain = () => {
    if (here) void act('open');
    else if (status.phase === 'failed' && mine) onRetrySend(info.id);
    else if (!moving) void fetchFile(info);
  };

  return (
    <div className="w-[16.5rem] max-w-full">
      {info.thumb && (
        <button type="button" onClick={onMain} className="mb-1.5 block w-full overflow-hidden rounded-xl" aria-label={tr('Open {name}', { name: info.name })}>
          <img src={info.thumb} alt="" className="max-h-44 w-full object-cover" />
        </button>
      )}
      <div className="flex items-center gap-2.5 rounded-xl bg-linen-variant/40 p-2">
        <button
          type="button"
          onClick={onMain}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: color }}
          aria-label={here ? tr('Open {name}', { name: info.name }) : tr('Download {name}', { name: info.name })}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -bottom-1 rounded bg-white/95 px-1 text-[8px] font-bold leading-[12px] tracking-wide" style={{ color }}>
            {typeLabel(info)}
          </span>
        </button>
        <button type="button" onClick={onMain} className="min-w-0 flex-1 text-left">
          <span className="line-clamp-2 break-all text-[13px] font-semibold leading-snug text-linen-primary">{info.name}</span>
          <span className="mt-0.5 block text-[11px] text-linen-secondary">
            {formatSize(info.size)} · {typeLabel(info)}
          </span>
        </button>
        <span className="shrink-0 text-linen-secondary">
          {moving ? (
            <Ring fraction={status.done / Math.max(1, status.total)} color={color} />
          ) : status.phase === 'failed' ? (
            <RotateCw className="h-5 w-5 text-rose-500" aria-hidden="true" />
          ) : status.phase === 'waiting' ? (
            <Clock className="h-5 w-5" aria-hidden="true" />
          ) : status.phase === 'missing' ? (
            <CircleAlert className="h-5 w-5" aria-hidden="true" />
          ) : !here ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-linen-border">
              <Download className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
        <span
          className={`flex min-w-0 items-center gap-1 text-[11px] ${
            status.phase === 'failed' ? 'text-rose-600' : status.phase === 'done' ? 'text-emerald-700 dark:text-emerald-300' : 'text-linen-secondary'
          }`}
          aria-live="polite"
        >
          {status.phase === 'done' && <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span className="truncate">{line}</span>
        </span>
        {here && !moving && (
          <span className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => void act('open')}
              className="rounded-md p-1.5 text-linen-secondary hover:bg-linen-variant hover:text-linen-primary"
              aria-label={tr('Open')}
              title={tr('Open')}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void act('save')}
              className="rounded-md p-1.5 text-linen-secondary hover:bg-linen-variant hover:text-linen-primary"
              aria-label={tr('Save')}
              title={tr('Save')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void act('share')}
              className="rounded-md p-1.5 text-linen-secondary hover:bg-linen-variant hover:text-linen-primary"
              aria-label={tr('Share')}
              title={tr('Share')}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
