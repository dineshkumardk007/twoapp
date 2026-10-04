// Copy and paste that work inside the Android app as well as in a browser.
//
// The browser's clipboard reader needs a permission the Android WebView
// cannot ask for, so every Paste button there failed without a word. In the
// app the clipboard is read and written by Android itself, through the
// bridge; in a browser, by the browser.

interface ClipboardBridge {
  readClipboard?: () => string;
  copyText?: (text: string) => void;
}

function bridge(): ClipboardBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { AndroidBridge?: ClipboardBridge }).AndroidBridge ?? null;
}

/** The text on the clipboard, or '' when there is none or it cannot be read. */
export async function readClipboardText(): Promise<string> {
  const native = bridge();
  if (native && typeof native.readClipboard === 'function') {
    try {
      return String(native.readClipboard() ?? '');
    } catch {
      /* fall through to the browser's own */
    }
  }
  try {
    return navigator.clipboard?.readText ? await navigator.clipboard.readText() : '';
  } catch {
    return '';
  }
}

/** Puts text on the clipboard. Answers whether it got there. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused: try Android, then the old way */
  }
  const native = bridge();
  if (native && typeof native.copyText === 'function') {
    try {
      native.copyText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** copyText for code written as try/catch: throws when the text did not get there. */
export async function copyTextOrThrow(text: string): Promise<void> {
  if (!(await copyText(text))) throw new Error('Could not copy');
}
