// The app's own "are you sure?" and "note this" pop-ups.
//
// These used to be window.confirm and window.alert. Inside the Android app
// those are drawn by the WebView, not by Two: a grey system box headed
// `The page at "https://appassets.androidplatform.net" says:` - the app's
// insides showing, at the exact moment someone is about to disconnect, wipe
// the device or clear a drawing. On a computer they were the browser's, with
// the same effect.
//
// Same shape as before, so a call site barely changes:
//
//   if (await askConfirm({ title: 'Clear the drawing board?', confirm: 'Clear' })) ...
//   await showNotice({ title: 'Relay saved' });
//
// One dialog is shown at a time; any asked for meanwhile wait their turn.
// DialogHost (mounted beside the app in main.tsx, so the lock screen and the
// welcome screens have it too) draws whichever is first.

export interface DialogRequest {
  kind: 'confirm' | 'notice';
  title: string;
  body?: string;
  /** The button that goes ahead (confirm) or closes (notice). */
  confirmLabel: string;
  cancelLabel: string;
  /** A go-ahead that loses something: drawn in red rather than the aurora. */
  danger: boolean;
  resolve: (answer: boolean) => void;
}

const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

/** The dialog that should be on screen now, if any. */
export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null;
}

/** Called whenever a dialog opens or closes. Returns how to stop listening. */
export function subscribeDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Closes the dialog on screen with this answer, and shows the next. */
export function answerDialog(answer: boolean) {
  const top = queue.shift();
  if (!top) return;
  top.resolve(answer);
  changed();
}

function ask(request: Omit<DialogRequest, 'resolve'>): Promise<boolean> {
  return new Promise(resolve => {
    queue.push({ ...request, resolve });
    changed();
  });
}

/** True for the go-ahead; false for Cancel, Back, Escape or a tap outside. */
export function askConfirm(options: {
  title: string;
  body?: string;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return ask({
    kind: 'confirm',
    title: options.title,
    body: options.body,
    confirmLabel: options.confirm ?? 'Continue',
    cancelLabel: options.cancel ?? 'Cancel',
    danger: !!options.danger
  });
}

/** Settles once it has been read and closed, however it was closed. */
export async function showNotice(options: { title: string; body?: string; ok?: string }): Promise<void> {
  await ask({
    kind: 'notice',
    title: options.title,
    body: options.body,
    confirmLabel: options.ok ?? 'OK',
    cancelLabel: '',
    danger: false
  });
}
