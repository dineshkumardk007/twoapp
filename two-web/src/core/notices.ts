/**
 * Which floating notice (InAppNotificationToast) shows where. A notice names
 * the screen it is about by its tabId: a tab of the couple's space, or
 * "group:<id>" for a group.
 */

/** The screen in front of you, as a notice names it: the open group, or else the tab. */
export function screenInFront(tab: string, groupId: string | null): string {
  return groupId ? `group:${groupId}` : tab;
}

/**
 * Whether group mode shows a notice: one about a group, and one about the
 * couple's chat - a message, a missed call - which would otherwise wait
 * unseen behind a group left open on the Chat tab. The couple's other
 * notices, a letter or a heart, wait for the space as they always have.
 */
export function shownInGroupMode(tabId: string): boolean {
  return tabId.startsWith('group:') || tabId === 'chat';
}
