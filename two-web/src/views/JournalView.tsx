import React, { useState } from 'react';
import { JournalEntry } from '../types';
import { Lock, Globe, Plus, Share2, Shield } from 'lucide-react';

interface JournalViewProps {
  entries: JournalEntry[];
  activeUser: 'user' | 'partner';
  onAddEntry: (entry: Omit<JournalEntry, 'id'>) => void;
  onPromoteEntry: (id: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  entries,
  activeUser,
  onAddEntry,
  onPromoteEntry
}) => {
  const [tab, setTab] = useState<'shared' | 'private'>('shared');
  const [isWriting, setIsWriting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const currentAuthorName = activeUser === 'user' ? 'You' : 'Partner';

  // Filter entries:
  // Shared: isPrivate === false
  // Private: isPrivate === true AND authorId === activeUser (owner-only!)
  const visibleEntries = tab === 'shared'
    ? entries.filter(e => !e.isPrivate)
    : entries.filter(e => e.isPrivate && e.authorId === activeUser);

  const handleSave = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    onAddEntry({
      authorId: activeUser,
      authorName: currentAuthorName,
      title: newTitle.trim(),
      content: newContent.trim(),
      date: 'Today',
      isPrivate: tab === 'private'
    });
    setNewTitle('');
    setNewContent('');
    setIsWriting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-medium text-linen-primary">Thought & Mood Journal</h2>
          <p className="text-sm text-linen-secondary">Reflective micro-blogging away from rapid-fire chat.</p>
        </div>
        <button
          onClick={() => setIsWriting(!isWriting)}
          className="inline-flex items-center px-4 py-2 rounded-xl bg-linen-primary text-linen-surface font-medium text-sm hover:opacity-95 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Write Entry
        </button>
      </div>

      {/* Segmented Control */}
      <div className="flex p-1 bg-linen-variant rounded-xl max-w-sm border border-linen-border">
        <button
          onClick={() => setTab('shared')}
          className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            tab === 'shared' ? 'bg-linen-surface text-linen-primary shadow-xs' : 'text-linen-secondary'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Shared Space</span>
        </button>
        <button
          onClick={() => setTab('private')}
          className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            tab === 'private' ? 'bg-linen-surface text-linen-primary shadow-xs' : 'text-linen-secondary'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Private to You</span>
        </button>
      </div>

      {tab === 'private' && (
        <div className="p-4 rounded-2xl bg-linen-surface border border-linen-border text-xs text-linen-secondary flex items-start space-x-3">
          <Shield className="w-4 h-4 text-linen-accent shrink-0 mt-0.5" />
          <span>
            <strong>Cryptographic Guarantee:</strong> Entries here are sealed under an owner-only subkey. Your partner’s device is mathematically unable to derive this subkey or read these drafts until you tap “Promote to Shared”.
          </span>
        </div>
      )}

      {/* Writing Drawer */}
      {isWriting && (
        <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-medium text-linen-primary">
              {tab === 'private' ? 'New Private Reflection' : 'New Shared Note'}
            </h3>
            <span className="text-xs text-linen-accent font-medium">
              {tab === 'private' ? '🔒 Owner-only draft' : '🌐 Shared with partner'}
            </span>
          </div>

          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title of your reflection..."
            className="w-full px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant/30 text-linen-primary font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
          />

          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            placeholder="Write your unedited thoughts freely..."
            className="w-full px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant/30 text-linen-primary text-sm focus:outline-hidden focus:ring-2 focus:ring-linen-primary resize-none"
          />

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsWriting(false)}
              className="px-4 py-2 text-sm text-linen-secondary hover:text-linen-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-medium bg-linen-primary text-linen-surface rounded-xl hover:opacity-90 transition-opacity"
            >
              Save Entry
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-4">
        {visibleEntries.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-linen-border text-linen-secondary text-sm">
            {tab === 'private'
              ? "You have no private drafts. Write a note to process feelings safely before sharing."
              : "No shared journal entries yet. Post a reflection to start your feed."}
          </div>
        ) : (
          visibleEntries.map(entry => (
            <div
              key={entry.id}
              className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-linen-secondary">
                <span className="font-medium text-linen-primary">{entry.authorName}</span>
                <span>{entry.date}</span>
              </div>
              <h3 className="font-serif text-lg font-medium text-linen-primary">{entry.title}</h3>
              <p className="text-sm text-linen-secondary leading-relaxed whitespace-pre-wrap">{entry.content}</p>

              {entry.isPrivate && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => onPromoteEntry(entry.id)}
                    className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-lg border border-linen-border hover:bg-linen-variant text-linen-primary transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
                    Promote to Shared Space
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
