import React, { useLayoutEffect, useRef } from 'react';
import { Home, Users } from 'lucide-react';
import { GroupSpace } from '../core/groups';

interface GroupDockProps {
  groups: GroupSpace[];
  activeGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onLeaveGroupMode: () => void;
  unreadByGroup?: Record<string, number>;
}

/**
 * The dock while you are in a group.
 *
 * Its own bar rather than extra tabs on the sanctuary's: a group is chat and
 * nothing else, and putting the garden, the letters and the cycle compass one
 * thumb away from a room with nine other people in it would be the wrong shape
 * entirely. The only ways out are another group, or back to the sanctuary.
 */
export const GroupDock: React.FC<GroupDockProps> = ({
  groups,
  activeGroupId,
  onSelectGroup,
  onLeaveGroupMode,
  unreadByGroup = {}
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);

  /**
   * Publishes this bar's height as --two-dock-h, exactly as the sanctuary's
   * dock does. The chat panel sizes itself against that variable; without it
   * a group's composer would sit underneath this bar, because the value left
   * behind would be whichever dock last measured itself - or nothing at all.
   */
  useLayoutEffect(() => {
    const publish = () => {
      const el = barRef.current;
      if (!el) return;
      document.documentElement.style.setProperty(
        '--two-dock-h',
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    };
    publish();
    window.addEventListener('resize', publish);
    window.visualViewport?.addEventListener('resize', publish);
    return () => {
      window.removeEventListener('resize', publish);
      window.visualViewport?.removeEventListener('resize', publish);
      document.documentElement.style.setProperty('--two-dock-h', '0px');
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/20 bg-linen-surface/70 backdrop-blur-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex items-stretch">
        {/* Pinned, and first: the way back must not be something you scroll to
            find, and it is the control people will reach for most. */}
        <div className="flex shrink-0 items-stretch py-2 pl-2 pr-1">
          <button
            onClick={onLeaveGroupMode}
            aria-label="Back to the sanctuary"
            className="flex w-[62px] flex-col items-center justify-center gap-1 rounded-2xl text-linen-secondary transition-all active:scale-90"
          >
            <Home className="h-5 w-5" />
            <span className="text-[9px] font-medium">Sanctuary</span>
          </button>
        </div>

        <div className="dock-rail flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto px-1 py-2">
          {groups.map(group => {
            const active = group.id === activeGroupId;
            const unread = unreadByGroup[group.id] || 0;
            return (
              <button
                key={group.id}
                data-dock-active={active}
                onClick={() => onSelectGroup(group.id)}
                className={`dock-tab relative flex w-[80px] shrink-0 flex-col items-center gap-1 rounded-2xl py-1.5 transition-all active:scale-90 ${
                  active ? 'dock-tab-active text-linen-primary' : 'text-linen-secondary'
                }`}
              >
                <Users
                  className={`h-5 w-5 transition-transform ${
                    active ? 'dock-tab-icon text-linen-primary' : 'text-linen-secondary'
                  }`}
                />
                <span
                  className={`dock-tab-label px-0.5 text-[9px] leading-[1.15] ${
                    active ? 'font-semibold' : 'font-medium'
                  }`}
                >
                  {group.name}
                </span>
                {unread > 0 && !active && (
                  <span className="absolute right-1/4 top-0.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
