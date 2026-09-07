import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, X, Search } from 'lucide-react';
import { getDestinations, allDestinations } from '../data/destinations';

interface AppDockProps {
  currentTab: string;
  onSelectTab: (id: string) => void;
  unreadChatCount?: number;
  /** Roughly how many favourites fit across the bar. */
  isTablet?: boolean;
  /**
   * Everything below is what the top bar used to carry.
   *
   * The app has no header any more, so the dock has to answer the two questions
   * that bar answered: are we connected, and where are the tools.
   */
  relayStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  partnerOnline?: boolean;
  vaultName?: string;
  onOpenTools?: () => void;
  onOpenHeart?: () => void;
}

/**
 * The four that lead the rail, then every other destination in the order the
 * directory lists them.
 *
 * Deliberately a constant and not a most-recently-used list. The bar used to
 * promote whatever you last opened to the front, so the row you had just
 * learned rearranged itself under your thumb every single time you tapped it -
 * you could never build muscle memory for a position, because tapping the
 * position was what destroyed it. A dock is worth having because it is always
 * the same.
 */
const PINNED = ['home', 'chat', 'canvas', 'nightstand'];
const LEGACY_FAVOURITES_KEY = 'two_dock_favourites_v1';

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
  isTablet = false,
  relayStatus = 'idle',
  partnerOnline = false,
  vaultName = '',
  onOpenTools,
  onOpenHeart
}) => {
  const connected = relayStatus === 'connected';
  const connecting = relayStatus === 'connecting' || relayStatus === 'reconnecting';
  const statusLabel = connected ? (partnerOnline ? 'Together' : 'Synced') : 'Connecting';
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => getDestinations(unreadChatCount), [unreadChatCount]);
  const flat = useMemo(() => allDestinations(unreadChatCount), [unreadChatCount]);

  const railRef = useRef<HTMLDivElement | null>(null);

  /**
   * Every destination, in one order that never changes.
   *
   * The bar used to show four and hide the other twenty-eight behind a sheet,
   * which made the sheet the only real way to move around. Now the bar scrolls:
   * the four you reach for are still under your thumb where they were, and the
   * rest are a swipe away instead of two taps and a search field.
   */
  const rail = useMemo(() => {
    const seen = new Set<string>();
    const ordered: typeof flat = [];

    for (const id of PINNED) {
      const found = flat.find(d => d.id === id);
      if (found && !seen.has(found.id)) {
        seen.add(found.id);
        ordered.push(found);
      }
    }
    for (const d of flat) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        ordered.push(d);
      }
    }
    return ordered;
  }, [flat]);

  // Whatever order a device had drifted into is no longer read, so the stored
  // list is dead weight sitting in localStorage. Clear it once rather than
  // leave a key behind that looks like it still means something.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_FAVOURITES_KEY);
    } catch {
      /* private mode - nothing was stored to begin with */
    }
  }, []);

  // Jumping somewhere from the sheet should leave that tab visible in the bar,
  // not scrolled off behind the edge with no sign of where you are.
  useEffect(() => {
    const strip = railRef.current;
    if (!strip) return;

    const active = strip.querySelector<HTMLElement>('[data-dock-active="true"]');
    if (!active) return;

    const target = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({
      left: Math.max(0, target),
      behavior: strip.scrollLeft === 0 ? 'auto' : 'smooth'
    });
  }, [currentTab, rail]);

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

              {/* What the header used to say, and the two things worth reaching
                  from here. Tools is the hub: soundscapes, co-regulation, the
                  mesh, safety numbers, camouflage and the quick exit all live
                  behind it. The tour is not here because it has its own card on
                  the home screen, and the spaces are the dock itself. */}
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-linen-secondary">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      connected ? 'bg-emerald-500' : connecting ? 'bg-amber-400 animate-pulse' : 'bg-stone-400'
                    }`}
                  />
                  <span className="truncate font-medium text-linen-primary">
                    {vaultName || 'Two'}
                  </span>
                  <span className="truncate">&middot; {statusLabel}</span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  {onOpenHeart && (
                    <button
                      onClick={() => {
                        setExpanded(false);
                        onOpenHeart();
                      }}
                      className="rounded-xl border border-linen-border/70 bg-linen-surface/70 px-2.5 py-1.5 text-[11px] font-medium text-linen-secondary active:scale-95 transition-transform"
                    >
                      Heart
                    </button>
                  )}
                  {onOpenTools && (
                    <button
                      onClick={() => {
                        setExpanded(false);
                        onOpenTools();
                      }}
                      className="rounded-xl border border-linen-border/70 bg-linen-variant/60 px-2.5 py-1.5 text-[11px] font-medium text-linen-primary active:scale-95 transition-transform"
                    >
                      Tools
                    </button>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linen-secondary/70" />
                  {/* Deliberately NOT autofocused. Opening the sheet threw the
                      keyboard up over the destinations you came here to look
                      at, so browsing meant dismissing a keyboard first. Tap the
                      field when you actually want to search. */}
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    inputMode="search"
                    enterKeyHint="search"
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

            <div className="min-h-0 flex-1 overflow-y-auto scroll-contain px-4 pb-4">
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
        <div className={`mx-auto flex items-stretch ${isTablet ? 'max-w-3xl' : ''}`}>
          <div
            ref={railRef}
            className="dock-rail flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto px-2 py-2"
          >
            {rail.map(item => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  data-dock-active={active}
                  onClick={() => go(item.id)}
                  className={`dock-tab relative flex shrink-0 snap-start flex-col items-center gap-1 rounded-2xl py-1.5 transition-all active:scale-90 ${
                    // Sized so the next tab is always half-visible at the right
                    // edge. That sliver is the only thing telling you the bar
                    // scrolls at all; with tabs sized to divide the width
                    // exactly, it reads as a fixed row of four.
                    isTablet ? 'w-[104px]' : 'w-[80px]'
                  } ${active ? 'dock-tab-active text-linen-primary' : 'text-linen-secondary'}`}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform ${
                      active ? 'dock-tab-icon text-linen-primary' : 'text-linen-secondary'
                    }`}
                  />
                  {/* The whole name, the same one the directory sheet and the
                      screen itself use. It used to be the first word only, so
                      the bar said "Private" for Private Chat and "State" for
                      State of Union - you had to already know the map to read
                      your own position on it. Two lines, clamped, with the box
                      held at a fixed height so a one-word tab and a two-word
                      tab sit on the same baseline. */}
                  <span
                    className={`dock-tab-label px-0.5 text-[9px] leading-[1.15] ${
                      active ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.badge && (
                    <span className="absolute right-1/4 top-0.5 h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Pinned outside the scroller: the way out of the bar must not be
              something you have to scroll to find. */}
          <div className="dock-all-edge flex shrink-0 items-stretch py-1.5 pl-1 pr-2">
            <button
              onClick={() => setExpanded(true)}
              aria-label={`All destinations. ${statusLabel}.`}
              className="relative flex w-[54px] flex-col items-center justify-center gap-0.5 rounded-2xl text-linen-secondary transition-all active:scale-90"
            >
              <ChevronUp className="h-5 w-5" />
              <span className="text-[9px] font-medium">All</span>
              {/* Connection state, without needing to open anything. Amber and
                  grey are worth a glance; green is the resting state and would
                  only add noise. */}
              {!connected && (
                <span
                  className={`absolute right-2 top-1 h-1.5 w-1.5 rounded-full ${
                    connecting ? 'bg-amber-400 animate-pulse' : 'bg-stone-400'
                  }`}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
