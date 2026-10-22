import { describe, expect, it } from 'vitest';
import { linkParts } from './links';

const links = (text: string) => linkParts(text).filter(p => p.href).map(p => [p.text, p.href]);

describe('links in messages', () => {
  it('plain words stay plain', () => {
    expect(linkParts('see you at 7')).toEqual([{ text: 'see you at 7' }]);
    expect(linkParts('')).toEqual([{ text: '' }]);
  });

  it('finds web addresses, with or without https', () => {
    expect(links('look https://maps.app.goo.gl/abc123 now')).toEqual([['https://maps.app.goo.gl/abc123', 'https://maps.app.goo.gl/abc123']]);
    expect(links('www.irctc.co.in')).toEqual([['www.irctc.co.in', 'https://www.irctc.co.in']]);
  });

  it('leaves the full stop or comma after an address out of it', () => {
    expect(links('Booked: https://example.com/t?id=5.')).toEqual([['https://example.com/t?id=5', 'https://example.com/t?id=5']]);
    expect(links('(see https://example.com/a)')).toEqual([['https://example.com/a', 'https://example.com/a']]);
    expect(links('https://en.wikipedia.org/wiki/Pongal_(festival)')).toEqual([
      ['https://en.wikipedia.org/wiki/Pongal_(festival)', 'https://en.wikipedia.org/wiki/Pongal_(festival)']
    ]);
  });

  it('finds Indian phone numbers, written the usual ways', () => {
    expect(links('call 9876543210')).toEqual([['9876543210', 'tel:9876543210']]);
    expect(links('+91 98765 43210 is the hotel')).toEqual([['+91 98765 43210', 'tel:+919876543210']]);
    expect(links('044-2345-6789')).toEqual([['044-2345-6789', 'tel:04423456789']]);
  });

  it('does not take short numbers, times or amounts for phone numbers', () => {
    expect(links('at 10:30 on 22/10/2026')).toEqual([]);
    expect(links('it was 1500 rupees')).toEqual([]);
    expect(links('OTP 482913')).toEqual([]);
  });

  it('keeps the words around the links, in order', () => {
    const parts = linkParts('a www.x.com b 9876543210 c');
    expect(parts.map(p => p.text).join('')).toBe('a www.x.com b 9876543210 c');
    expect(parts.filter(p => p.href)).toHaveLength(2);
  });

  it('a number inside an address stays part of the address', () => {
    expect(links('https://example.com/order/98765432101')).toEqual([
      ['https://example.com/order/98765432101', 'https://example.com/order/98765432101']
    ]);
  });
});
