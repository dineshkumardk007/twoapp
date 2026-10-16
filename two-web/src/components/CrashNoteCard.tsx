import React, { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { CrashNote, dismissCrashNote, readCrashNote } from '../core/crashNote';
import { copyTextOrThrow } from '../core/clipboard';
import { whenLabelWithTime } from '../core/when';

/**
 * Why Two last closed unexpectedly, inside Settings' App version card: when
 * it happened, and the details to copy and pass on so it can be fixed. Gone
 * once dismissed, until something else goes wrong.
 */
export const CrashNoteCard: React.FC = () => {
  const [note, setNote] = useState<CrashNote | null>(() => readCrashNote());
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (!note) return null;

  const copy = async () => {
    try {
      await copyTextOrThrow(note.text);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3.5" role="status">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-linen-primary">
            Two closed unexpectedly{note.at > 0 ? ` · ${whenLabelWithTime(note.at)}` : ''}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-linen-secondary">
            The details say where it stopped. Copy them to pass on, so it can be fixed. Nothing from your messages is in them.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-linen-border bg-linen-surface px-3 py-1.5 text-[11px] font-semibold text-linen-primary transition-colors hover:bg-linen-variant cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy details'}
            </button>
            <button
              type="button"
              onClick={() => {
                dismissCrashNote();
                setNote(null);
              }}
              className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          {copyFailed && (
            <p className="mt-2 text-[11px] text-linen-secondary">Copying was refused. Long-press the details below to copy them.</p>
          )}
          {copyFailed && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-linen-surface p-2 text-[10px] leading-snug text-linen-primary select-text">
              {note.text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
