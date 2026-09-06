import React, { useEffect, useMemo, useState } from 'react';
import { ChevronUp, X, Search } from 'lucide-react';
import { getDestinations, allDestinations } from '../data/destinations';

interface AppDockProps {
  currentTab: string;
  onSelectTab: (id: string) => void;
  unreadChatCount?: number;
  /** Roughly how many favourites fit across the bar. */
  isTablet?: boolean;
}

const FAVOURITES_KEY = 'two_dock_favourites_v1';
const DEFAULT_FAVOURITES = ['home', 'chat', 'canvas', 'nightstand'];

/**
 * The app's bottom dock: a frosted bar of favourites that pulls up into every
 * destination.
 *
 * Only rendered inside the Android app. The website has room for a header and a
 * directory modal; a phone held one-handed does not, and reaching a top bar
 * with a thumb is the worst part of a tall screen. Everything here is one thumb
 * movement from the bottom edge.
 *
 * It reads from the same destination list as the website directory, so the two
 * cannot fall out of step.
 */
export const AppDock: React.FC<AppDockProps> = ({
  currentTab,
  onSelectTab,
  unreadChatCount = 0,
  isTablet = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAVOURITES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_FAVOURITES;
    } catch {
      return DEFAULT_FAVOURITES;
    }
  });

  const groups = useMemo(() => getDestinations(unreadChatCount), [unreadChatCount]);
  const flat = useMemo(() => allDestinations(unreadChatCount), [unreadChatCount]);

  // A tablet has room for more shortcuts before the bar starts to feel cramped.
  const slots = isTablet ? 6 : 4;

  const quick = useMemo(() => {
    const picked = favourites
      .map(id => flat.find(d => d.id === id))
      .filter(Boolean)
      .slice(0, slots) as typeof flat;

    // Keep the bar full even if a stored favourite no longer exists.
    for (const d of flat) {
      if (picked.length >= slots) break;
      if (!picked.some(p => p.id === d.id)) picked.push(d);
    }
    return picked;
  }, [favourites, flat, slots]);

  // The sheet is a navigation layer, not a page: hardware back should close it.
  useEffect(() => {
    if (!expanded) return;
    const onPop = (e: PopStateEvent) => {
      e.preventDefault();
      setExpanded(false);
    };
    window.history.pushState({ dock: true }, '');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [expanded]);

  const go = (id: string) => {
    onSelectTab(id);
    setExpanded(false);
    setSearch('');

    // Promote what you actually use to the bar, most recent first.
    setFavourites(prev => {
      const next = [id, ...prev.filter(f => f !== id)].slice(0, 6);
      try {
        localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      } catch {
        /* private mode - the defaults are fine */
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(
          i => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
        )
      }))
      .filter(g => g.items.length > 0);
  }, [groups, search]);

  return (
    <>
      {/* Expanded sheet */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setExpanded(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          <div
            onClick={e => e.stopPropagation()}
            className="relative rounded-t-3xl border-t border-white/25 bg-linen-surface/80 backdrop-blur-2xl shadow-2xl max-h-[82vh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 px-4 pt-3 pb-2">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linen-secondary/30" />

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linen-secondary/70" />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Find anywhere in our sanctuary…"
                    className="w-full rounded-2xl border border-linen-border/70 bg-linen-variant/50 py-2.5 pl-9 pr-3 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
                  />
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  aria-label="Close"
                  className="rounded-2xl border border-linen-border/70 bg-linen-surface/70 p-2.5 text-linen-secondary active:scale-95 transition-transform"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-linen-secondary">Nothing by that name.</p>
              )}

              {filtered.map(group => (
                <div key={group.title} className="mb-5">
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
                    <span className="mr-1">{group.emoji}</span>
                    {group.title}
                  </p>

                  <div className={`grid gap-2 ${isTablet ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const active = currentTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => go(item.id)}
                          className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                            active
                              ? 'border-linen-primary/40 bg-linen-variant/80 ring-1 ring-linen-primary/20'
                              : 'border-linen-border/60 bg-linen-surface/60 hover:bg-linen-variant/50'
                          }`}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-linen-accent" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-linen-primary">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-tight text-linen-secondary line-clamp-2">
                              {item.desc}
                            </span>
                          </span>
                          {item.badge && (
                            <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resting bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/20 bg-linen-surface/70 backdrop-blur-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className={`mx-auto flex items-stretch gap-1 px-2 py-1.5 ${isTablet ? 'max-w-2xl' : ''}`}>
          {quick.map(item => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-all active:scale-90 ${
                  active ? 'bg-linen-variant/70 text-linen-primary' : 'text-linen-secondary'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-linen-primary' : 'text-linen-secondary'}`} />
                <span className="max-w-full truncate px-1 text-[9px] font-medium">
                  {item.name.split(' ')[0]}
                </span>
                {item.badge && (
                  <span className="absolute right-1/4 top-0.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}

          <button
            onClick={() => setExpanded(true)}
            aria-label="All destinations"
            className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-linen-secondary transition-all active:scale-90"
          >
            <ChevronUp className="h-5 w-5" />
            <span className="text-[9px] font-medium">All</span>
          </button>
        </div>
      </div>
    </>
  );
};
