import React, { useState } from 'react';
import { Users, Plus, LogIn, ArrowRight, Copy, Check, Trash2 } from 'lucide-react';
import { GroupSpace, MAX_GROUP_MEMBERS } from '../core/groups';
import {
  generatePairingCode,
  generateJoinPhrase,
  checkJoinPhrase,
  isPlausiblePairingCode,
  normalizePairingCode
} from '../core/space';

interface GroupsViewProps {
  groups: GroupSpace[];
  /** Given the very code and phrase shown on screen, not a fresh pair. */
  onCreate: (name: string, code: string, joinPhrase: string) => void;
  onJoin: (name: string, code: string, joinPhrase: string) => void;
  onOpen: (groupId: string) => void;
  onLeave: (groupId: string) => void;
}

/**
 * The list of groups, and the two ways to get into one.
 *
 * Groups are chat and nothing else. Everything the sanctuary holds - the
 * letters, the garden, the cycle compass - belongs to two people, and the
 * decision not to widen any of it is what keeps this screen small.
 */
export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  onCreate,
  onJoin,
  onOpen,
  onLeave
}) => {
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phrase, setPhrase] = useState('');
  const [generated, setGenerated] = useState<{ code: string; phrase: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const beginCreate = () => {
    setGenerated({ code: generatePairingCode(), phrase: generateJoinPhrase() });
    setName('');
    setError('');
    setMode('create');
  };

  const beginJoin = () => {
    setName('');
    setCode('');
    setPhrase('');
    setError('');
    setMode('join');
  };

  const close = () => {
    setMode('idle');
    setGenerated(null);
    setCopied(false);
    setError('');
  };

  const submitCreate = () => {
    if (!generated) return;
    if (!name.trim()) {
      setError('Give the group a name.');
      return;
    }
    onCreate(name, generated.code, generated.phrase);
    close();
  };

  const submitJoin = () => {
    if (!name.trim()) {
      setError('Give the group a name so you can tell it apart.');
      return;
    }
    if (!isPlausiblePairingCode(code)) {
      setError('That does not look like a group code.');
      return;
    }
    // A wrong phrase is silent - it derives a different room, and you sit
    // alone with nothing on screen to say why. So it is checked here.
    const check = checkJoinPhrase(phrase);
    if (!check.complete) {
      setError(
        check.unknown.length
          ? `Not one of the words: ${check.unknown.join(', ')}`
          : 'The phrase is four words.'
      );
      return;
    }
    onJoin(name, normalizePairingCode(code), phrase);
    close();
  };

  const copyInvite = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(
        `Join our group on Two.\nCode: ${generated.code}\nWords: ${generated.phrase}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy - write the code and words down instead.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-linen-accent" />
          Groups
        </h2>
        <p className="mt-1 text-sm text-linen-secondary leading-relaxed">
          A room for up to {MAX_GROUP_MEMBERS} people. Chat only &mdash; everything else in your
          sanctuary stays between the two of you.
        </p>
      </div>

      {mode === 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={beginCreate}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-linen-primary px-3 py-2.5 text-sm font-medium text-linen-surface hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Start a group
          </button>
          <button
            onClick={beginJoin}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-linen-border bg-linen-surface px-3 py-2.5 text-sm font-medium text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" /> Join a group
          </button>
        </div>
      )}

      {mode === 'create' && generated && (
        <div className="rounded-2xl border border-linen-border bg-linen-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-linen-primary">Start a group</h3>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What is this group called?"
            className="w-full rounded-xl border border-linen-border bg-linen-variant/40 px-3 py-2.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
          />

          <div className="rounded-xl border border-linen-border/70 bg-linen-variant/30 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
              Share these with the others
            </p>
            <p className="font-mono text-sm text-linen-primary break-all">{generated.code}</p>
            <p className="text-sm text-linen-primary">{generated.phrase}</p>
            <p className="text-[11px] leading-relaxed text-linen-secondary">
              Both are needed to get in, and the words are never sent anywhere &mdash; say them out
              loud rather than typing them into a message alongside the code.
            </p>
            <button
              onClick={copyInvite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-linen-border bg-linen-surface px-2.5 py-1.5 text-[11px] font-medium text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy invite'}
            </button>
          </div>

          {error && <p className="text-xs text-rose-700">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submitCreate}
              className="flex-1 rounded-xl bg-linen-primary px-3 py-2.5 text-sm font-medium text-linen-surface hover:opacity-90 transition-opacity cursor-pointer"
            >
              Create it
            </button>
            <button
              onClick={close}
              className="rounded-xl border border-linen-border bg-linen-surface px-3 py-2.5 text-sm text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="rounded-2xl border border-linen-border bg-linen-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-linen-primary">Join a group</h3>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name it on this device"
            className="w-full rounded-xl border border-linen-border bg-linen-variant/40 px-3 py-2.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
          />
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Group code"
            className="w-full rounded-xl border border-linen-border bg-linen-variant/40 px-3 py-2.5 font-mono text-sm text-linen-primary placeholder:font-sans placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
          />
          <input
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder="The four words"
            className="w-full rounded-xl border border-linen-border bg-linen-variant/40 px-3 py-2.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
          />

          {error && <p className="text-xs text-rose-700">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submitJoin}
              className="flex-1 rounded-xl bg-linen-primary px-3 py-2.5 text-sm font-medium text-linen-surface hover:opacity-90 transition-opacity cursor-pointer"
            >
              Join
            </button>
            <button
              onClick={close}
              className="rounded-xl border border-linen-border bg-linen-surface px-3 py-2.5 text-sm text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-linen-secondary">You are not in any groups yet.</p>
      ) : (
        <ul className="space-y-2">
          {groups.map(group => (
            <li
              key={group.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-linen-border bg-linen-surface px-4 py-3"
            >
              <button
                onClick={() => onOpen(group.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linen-variant text-linen-accent">
                  <Users className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-linen-primary">
                    {group.name}
                  </span>
                  <span className="block text-[11px] text-linen-secondary">
                    {group.members.length || 1}{' '}
                    {group.members.length === 1 ? 'member' : 'members'} &middot;{' '}
                    {group.messages.length} message{group.messages.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-linen-secondary" />
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Leave "${group.name}"? This removes it and its messages from this device ` +
                        `only. The others keep the group, and they are not told.`
                    )
                  ) {
                    onLeave(group.id);
                  }
                }}
                title="Leave this group"
                className="shrink-0 rounded-lg p-2 text-linen-secondary hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-linen-secondary">
        Everyone in a group shares one key, so there is no way to remove somebody from the room:
        whoever has the code and the words can read what is said, including anything said after
        they leave. To shut someone out, start a new group.
      </p>
    </div>
  );
};
