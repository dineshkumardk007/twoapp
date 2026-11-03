import { describe, expect, it } from 'vitest';
import { HD_MAX_PARTS, HD_PART_CHARS, HdAssembler, cleanHdInfo, cleanHdPart, splitHd } from './hdPhoto';

const photo = (chars: number) => 'data:image/jpeg;base64,' + 'A'.repeat(chars - 'data:image/jpeg;base64,'.length);

describe('HD photos in pieces', () => {
  it('splits into pieces that fit a record, and puts them back in any order', () => {
    const whole = photo(HD_PART_CHARS * 2 + 10);
    const parts = splitHd('hdabc', whole);
    expect(parts).toHaveLength(3);
    expect(parts.every(p => p.data.length <= HD_PART_CHARS)).toBe(true);

    const assembler = new HdAssembler();
    expect(assembler.add('chat', parts[2])).toBeNull();
    expect(assembler.add('chat', parts[0])).toBeNull();
    // The same piece twice changes nothing.
    expect(assembler.add('chat', parts[0])).toBeNull();
    expect(assembler.add('chat', parts[1])).toBe(whole);
  });

  it('keeps a group apart from the couple', () => {
    const whole = photo(HD_PART_CHARS + 5);
    const [first, second] = splitHd('hdsame', whole);
    const assembler = new HdAssembler();
    expect(assembler.add('chat', first)).toBeNull();
    expect(assembler.add('group:g1', second)).toBeNull();
    expect(assembler.add('chat', second)).toBe(whole);
  });

  it('throws away a whole that is not a JPEG', () => {
    const parts = splitHd('hdbad', 'data:text/html;base64,PHNjcmlwdD4=');
    const assembler = new HdAssembler();
    expect(assembler.add('chat', parts[0])).toBeNull();
  });

  it('lets go of pieces that never complete', () => {
    const parts = splitHd('hdslow', photo(HD_PART_CHARS + 5));
    const assembler = new HdAssembler();
    assembler.add('chat', parts[0], 0);
    // Much later, the second piece alone does not finish a photo forgotten long ago.
    expect(assembler.add('chat', parts[1], 2 * 60 * 60 * 1000)).toBeNull();
  });
});

describe('what comes from another phone', () => {
  it('keeps a good HD note and refuses a bad one', () => {
    expect(cleanHdInfo({ id: 'hd1a', width: 2560, height: 1920, parts: 4 })).toEqual({ id: 'hd1a', width: 2560, height: 1920, parts: 4 });
    expect(cleanHdInfo({ id: '../x', width: 2560, height: 1920, parts: 4 })).toBeUndefined();
    expect(cleanHdInfo({ id: 'hd1a', width: 2560, height: 1920, parts: HD_MAX_PARTS + 1 })).toBeUndefined();
    expect(cleanHdInfo({ id: 'hd1a', width: 0, height: 1920, parts: 2 })).toBeUndefined();
  });

  it('refuses a piece out of range or too big', () => {
    expect(cleanHdPart({ photoId: 'hd1', index: 0, total: 2, data: 'abc' })).not.toBeNull();
    expect(cleanHdPart({ photoId: 'hd1', index: 2, total: 2, data: 'abc' })).toBeNull();
    expect(cleanHdPart({ photoId: 'hd1', index: 0, total: 2, data: 'A'.repeat(HD_PART_CHARS + 1) })).toBeNull();
    expect(cleanHdPart({ photoId: 'hd1', index: 0, total: 9, data: 'abc' })).toBeNull();
  });
});
