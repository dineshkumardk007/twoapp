// What sits around the couple's chat: whether the app's top bar shows above
// it, and whether the chat runs to the screen's edges.

/**
 * The bar and the chat's edges for the screen in front.
 *
 * In the app the chat is the one screen without the bar: its own header (her
 * name, her status, the call and ⋮) takes the top, as a messenger has it, and
 * Heart and Quick exit move into the ⋮. Every other tab keeps the bar. The
 * website keeps its header everywhere, because it has no dock and that header
 * is its only way around.
 *
 * Flush - square to the top and both sides - only on a phone. A tablet keeps
 * the rounded card, with room around it.
 */
export function chatChrome(o: { inApp: boolean; tablet: boolean; tab: string }): { barHidden: boolean; flush: boolean } {
  const barHidden = o.inApp && o.tab === 'chat';
  return { barHidden, flush: barHidden && !o.tablet };
}

/**
 * Whether a counter that was bumped to open something asks for it now.
 *
 * `handled` is the last value already acted on, which starts as the value the
 * component mounted with. A counter only goes up, so a value already handled -
 * or the one that was there before the component came back - asks for nothing.
 * Testing `> 0` instead reopened the panel each time Navigation mounted again
 * (after a group, the lock or the calculator) once it had been bumped once.
 */
export function signalAsks(handled: number, now: number): boolean {
  return now !== handled;
}
