// Colour for the boxes on a screen.
//
// Every box gets a pair of colours: one glowing in from its top corner, its
// partner from the bottom one, and an edge running from one to the other
// (index.css, "Coloured boxes"). The pairs take turns down the page, so two
// boxes one above the other never match, and the first box on a screen takes
// the colour of the tab's family - pink for the two of you, teal for the quiet
// places, gold for memories and play, sky blue for everyday life, violet for
// your own space - so every tab opens in its own colour.
//
// Boxes are found rather than marked: a box is a rounded, bordered card on the
// app's surface colour (BOX below), so every screen - and any screen added
// later - is coloured without each one opting in. Themed boxes that paint
// their own background (the radio, the bedside clock, the night sky) never
// match, and keep their look.

import { familyOf, type Family } from '../data/destinations';

/** The order the colours take down a screen. Neighbours always differ. */
export const HUES = ['violet', 'gold', 'teal', 'pink', 'sky', 'peach'] as const;
export type Hue = (typeof HUES)[number];

const FAMILY_HUE: Record<Family, Hue> = {
  love: 'pink',
  calm: 'teal',
  play: 'gold',
  everyday: 'sky',
  space: 'violet'
};

/** The colour of the first box on a tab. */
export function firstHue(tabId: string): Hue {
  return FAMILY_HUE[familyOf(tabId)];
}

/** The colours of `count` boxes, top to bottom, starting from `first`. */
export function huesFrom(first: Hue, count: number): Hue[] {
  const start = HUES.indexOf(first);
  return Array.from({ length: count }, (_, i) => HUES[(start + i) % HUES.length]);
}

/**
 * A box: rounded-3xl (or rounded-2xl with real padding, not a row or a
 * button), bordered, on the surface colour - or on the see-through surface of
 * an empty screen's placeholder.
 */
const BOX = [
  ':is(.rounded-3xl, .rounded-2xl:is(.p-4, .p-5, .p-6, .p-8, .p-10, .p-12))',
  ':is(.border, .border-2)',
  ':is(.bg-linen-surface, .bg-linen-surface\\/40, .bg-linen-surface\\/50, .via-linen-surface)'
].join('');

/** Colours every box under `root`. Pop-ups, and boxes inside boxes, stay as they are. */
export function paintBoxes(root: ParentNode, first: Hue): void {
  const boxes = Array.from(root.querySelectorAll<HTMLElement>(BOX)).filter(
    box => !box.closest('.fixed') && !box.parentElement?.closest(BOX)
  );
  const hues = huesFrom(first, boxes.length);
  boxes.forEach((box, i) => {
    if (box.dataset.hue !== hues[i]) box.dataset.hue = hues[i];
  });
  // Something that stopped being a box gives its colour back.
  root.querySelectorAll<HTMLElement>('[data-hue]').forEach(el => {
    if (!boxes.includes(el)) delete el.dataset.hue;
  });
}

/**
 * Keeps a screen's boxes coloured as it changes - a list filling in, a card
 * appearing - and returns the function that stops. Repaints wait for the next
 * frame, so a burst of changes costs one pass, and that pass runs before the
 * frame is drawn: a new box never shows plain first.
 */
export function watchBoxes(root: HTMLElement, first: Hue): () => void {
  let frame = 0;
  const paint = () => {
    frame = 0;
    paintBoxes(root, first);
  };
  paint();
  const observer = new MutationObserver(() => {
    if (!frame) frame = requestAnimationFrame(paint);
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
