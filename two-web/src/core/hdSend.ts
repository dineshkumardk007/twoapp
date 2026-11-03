// Making a photo's HD copy at the moment it is sent (core/hdPhoto).

import { HD_MAX_CHARS, HD_PART_CHARS, newHdId, type HdInfo } from './hdPhoto';
import { shrinkPhotoHd, type ShrunkPhoto } from './photo';

/**
 * The HD copy of `file`, and what the message says of it - or null when
 * there is nothing to gain: a photo no bigger than the ordinary one already
 * sent (a screenshot, a small picture), or one that will not come in under
 * the HD limit, or that could not be read.
 */
export async function hdCopyOf(file: Blob, ordinary: ShrunkPhoto): Promise<{ info: HdInfo; dataUrl: string } | null> {
  try {
    const big = await shrinkPhotoHd(file, HD_MAX_CHARS);
    if (big.dataUrl.length > HD_MAX_CHARS) return null;
    if (Math.max(big.width, big.height) <= Math.max(ordinary.width, ordinary.height)) return null;
    return {
      info: {
        id: newHdId(),
        width: big.width,
        height: big.height,
        parts: Math.ceil(big.dataUrl.length / HD_PART_CHARS)
      },
      dataUrl: big.dataUrl
    };
  } catch {
    return null;
  }
}
