import { describe, expect, it } from 'vitest';
import {
  FILE_PART_BYTES,
  MAX_FILE_BYTES,
  cleanFileInfo,
  cleanFileName,
  fileKind,
  fingerprint,
  formatSize,
  importFileKey,
  newFileKey,
  openPart,
  partsFor,
  sealPart,
  typeLabel
} from './files';

const good = {
  id: 'flabc12345',
  name: 'Report.pdf',
  size: FILE_PART_BYTES + 10,
  mime: 'application/pdf',
  parts: 2,
  key: 'A'.repeat(43) + '=',
  sha: 'a'.repeat(64)
};

describe('what arrives with a file', () => {
  it('takes a well-formed one', () => {
    expect(cleanFileInfo(good)).toEqual(good);
  });

  it('refuses one whose pieces do not add up to its size, or that is too big', () => {
    expect(cleanFileInfo({ ...good, parts: 3 })).toBeUndefined();
    expect(cleanFileInfo({ ...good, size: MAX_FILE_BYTES + 1, parts: partsFor(MAX_FILE_BYTES + 1) })).toBeUndefined();
    expect(cleanFileInfo({ ...good, size: 0, parts: 1 })).toBeUndefined();
  });

  it('refuses a bad key, fingerprint or id', () => {
    expect(cleanFileInfo({ ...good, key: 'short' })).toBeUndefined();
    expect(cleanFileInfo({ ...good, sha: 'xyz' })).toBeUndefined();
    expect(cleanFileInfo({ ...good, id: '../../etc' })).toBeUndefined();
  });

  it('keeps a name to show and save under, and a type it can trust', () => {
    expect(cleanFileInfo({ ...good, name: '../secret/plan.pdf', mime: 'not a type' })).toMatchObject({
      name: '.._secret_plan.pdf',
      mime: 'application/octet-stream'
    });
    expect(cleanFileName('')).toBe('file');
    expect(cleanFileName('a\u0000b.txt')).toBe('ab.txt');
  });

  it('drops a picture that is not a small JPEG', () => {
    expect(cleanFileInfo({ ...good, thumb: 'data:image/svg+xml;base64,AAAA' })?.thumb).toBeUndefined();
    expect(cleanFileInfo({ ...good, thumb: 'data:image/jpeg;base64,AAAA' })?.thumb).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('how a file is shown', () => {
  it('knows its kind by type or name', () => {
    expect(fileKind({ name: 'a.pdf', mime: 'application/octet-stream' })).toBe('pdf');
    expect(fileKind({ name: 'notes.docx', mime: 'application/octet-stream' })).toBe('doc');
    expect(fileKind({ name: 'b.xlsx', mime: '' })).toBe('sheet');
    expect(fileKind({ name: 'clip', mime: 'video/mp4' })).toBe('video');
    expect(fileKind({ name: 'x.zip', mime: 'application/zip' })).toBe('zip');
    expect(fileKind({ name: 'mystery', mime: 'application/octet-stream' })).toBe('other');
  });

  it('gives its size and type in a few letters', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(48 * 1024)).toBe('48 KB');
    expect(formatSize(12.44 * 1024 * 1024)).toBe('12 MB');
    expect(formatSize(3.2 * 1024 * 1024)).toBe('3.2 MB');
    expect(typeLabel({ name: 'Report.pdf', mime: 'application/pdf' })).toBe('PDF');
    expect(typeLabel({ name: 'noextension', mime: 'video/mp4' })).toBe('VIDEO');
  });
});

describe('sealing a piece', () => {
  it('opens to exactly what was sealed, with the key sent in its message', async () => {
    const { key, text } = await newFileKey();
    const plain = new TextEncoder().encode('hello, exact copy').buffer;
    const sealed = await sealPart(key, plain);
    const opened = await openPart(await importFileKey(text), sealed);
    expect(new TextDecoder().decode(opened)).toBe('hello, exact copy');
  });

  it('refuses a piece changed on the way, even by one bit', async () => {
    const { key } = await newFileKey();
    const sealed = new Uint8Array(await sealPart(key, new Uint8Array([1, 2, 3, 4]).buffer));
    sealed[14] ^= 1;
    await expect(openPart(key, sealed.buffer)).rejects.toBeTruthy();
  });

  it('seals the same piece differently each time', async () => {
    const { key } = await newFileKey();
    const plain = new Uint8Array(64).buffer;
    const a = new Uint8Array(await sealPart(key, plain));
    const b = new Uint8Array(await sealPart(key, plain));
    expect(a).not.toEqual(b);
  });
});

describe('a file’s fingerprint', () => {
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));

  it('is the same for the same pieces in the same order, and different otherwise', async () => {
    const one = await fingerprint([await digest('a'), await digest('b')]);
    expect(await fingerprint([await digest('a'), await digest('b')])).toBe(one);
    expect(await fingerprint([await digest('b'), await digest('a')])).not.toBe(one);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
  });
});
