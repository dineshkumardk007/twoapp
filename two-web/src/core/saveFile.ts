// Saving a file the person asked for: a backup, an export.
//
// In a browser that is a download link. Inside the Android app it is not: a
// WebView ignores download links unless the app handles them, and Two's did
// not - so "Export & Download", the data export and the scrapbook archive all
// did nothing at all on the phone, with nothing on screen to say so. The
// encrypted backup is the only way to carry what never leaves a phone (private
// journal entries, private cycle notes) to a new one, which made this the
// worst of the three to be missing.
//
// On Android the bytes go across the bridge and the phone's own "save to"
// screen opens, so the person chooses where the file lands.

interface SaveBridge {
  saveFile?: (filename: string, mimeType: string, base64: string) => boolean;
}

function bridge(): SaveBridge | null {
  if (typeof window === 'undefined') return null;
  const b = (window as any).AndroidBridge as SaveBridge | undefined;
  return b && typeof b.saveFile === 'function' ? b : null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      // "data:<type>;base64,<payload>" - only the payload crosses the bridge.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked after the click has had its turn, not during it: some browsers
  // start the download asynchronously and find the URL already gone.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Saves `blob` as `filename`, the way this platform saves files.
 *
 * Resolves to 'saved' when the phone's save screen took over (where the file
 * goes, and whether it is saved at all, is then the person's choice on that
 * screen) and to 'downloaded' when a browser download was started.
 */
export async function saveFile(blob: Blob, filename: string): Promise<'saved' | 'downloaded'> {
  const android = bridge();
  if (android) {
    const base64 = await blobToBase64(blob);
    const accepted = android.saveFile!(filename, blob.type || 'application/octet-stream', base64);
    if (accepted !== false) return 'saved';
  }
  download(blob, filename);
  return 'downloaded';
}
