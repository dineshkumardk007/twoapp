// Stickers hold still while a chat is being scrolled.
//
// A sticker's little extras - hearts floating up, tears dripping - are drawn
// inside its picture, so each frame they move the phone draws that sticker
// again. One is nothing; several at once, under a finger scrolling the chat,
// could cost a frame. So while the chat scrolls they wait (index.css,
// [data-scrolling]), and carry on a moment after it stops.

const SETTLE_MS = 160;
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Called on every scroll of `list`: marks it scrolling until it has been still a moment. */
export function markScrolling(list: HTMLElement | null): void {
  if (!list) return;
  if (!list.hasAttribute('data-scrolling')) list.setAttribute('data-scrolling', '');
  const was = timers.get(list);
  if (was) clearTimeout(was);
  timers.set(
    list,
    setTimeout(() => {
      timers.delete(list);
      list.removeAttribute('data-scrolling');
    }, SETTLE_MS)
  );
}
