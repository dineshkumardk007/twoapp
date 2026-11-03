// Shrinking a photo before it travels.
//
// A photo goes to the partner's phone inside one encrypted record, and the
// relay carries at most so much in one - so the photo has to fit, not just be
// smaller. It starts at 1600 pixels on the long side, sharp full-screen on a
// phone, and steps down in size and quality only as far as it must to come in
// under the limit it is given.

export interface ShrunkPhoto {
  /** A JPEG data: URL. */
  dataUrl: string;
  width: number;
  height: number;
}

/** Long side in pixels, and JPEG quality - tried in this order. */
const STEPS: Array<[number, number]> = [
  [1600, 0.85], [1600, 0.72], [1280, 0.72], [1280, 0.6], [1024, 0.6], [800, 0.6], [640, 0.55]
];

/**
 * The HD copy (core/hdPhoto): up to 2560 pixels, at a quality that keeps
 * detail when zoomed in or printed, travelling in pieces. Never smaller than
 * 1920, where it would add little to the ordinary photo.
 */
const HD_STEPS: Array<[number, number]> = [[2560, 0.88], [2560, 0.8], [2240, 0.8], [1920, 0.8]];

/**
 * `file` as a JPEG data: URL of at most `maxChars` characters (or as small as
 * the last step makes it). Turned the right way up: the browser applies the
 * camera's orientation when it reads the photo, and the canvas keeps it.
 */
export function shrinkPhoto(file: Blob, maxChars: number, steps: Array<[number, number]> = STEPS): Promise<ShrunkPhoto> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      let dataUrl = '';
      for (const [edge, quality] of steps) {
        const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= maxChars) break;
      }
      resolve({ dataUrl, width: canvas.width, height: canvas.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not an image'));
    };
    img.src = url;
  });
}

/** The HD copy of `file`, at most `maxChars` (or as small as the last HD step makes it). */
export function shrinkPhotoHd(file: Blob, maxChars: number): Promise<ShrunkPhoto> {
  return shrinkPhoto(file, maxChars, HD_STEPS);
}
