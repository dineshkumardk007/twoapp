import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fed } from '../core/pet';
import { openSecret } from '../core/secretMessage';
import { GLASSES, HATS, NECKS, showWear } from '../core/wear';
import { BearFace, BunnyFace } from './CosyHomes';
import { EmoteFace } from './Emotes';
import { PetArt, PetCard } from './PetCard';
import { SecretScratch } from './SecretScratch';
import { WearTile, WornGlasses, WornHat, WornNeck, WornOnFace } from './WearArt';

// The new things drawn once each: nothing here checks how they look, only
// that they can be drawn at all, and that what should be in them is.

describe('what the bear and bunny wear can be drawn', () => {
  it('every hat, pair of glasses and neck piece, on each of them and by itself', () => {
    const seen = new Set<string>();
    for (const kind of ['bear', 'bunny'] as const) {
      for (const hat of HATS) seen.add(renderToString(<svg><WornHat kind={kind} wear={{ hat, at: 1 }} /></svg>));
      for (const eyes of GLASSES) seen.add(renderToString(<svg><WornGlasses kind={kind} wear={{ eyes, at: 1 }} /></svg>));
      for (const neck of NECKS) seen.add(renderToString(<svg><WornNeck kind={kind} wear={{ neck, at: 1 }} /></svg>));
    }
    expect(seen.size).toBe(2 * (HATS.length + GLASSES.length + NECKS.length));
    for (const html of seen) {
      expect(html).toContain('wr-in');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
    }
    for (const hat of HATS) expect(renderToString(<WearTile slot="hat" item={hat} />)).toContain('wr-tile');
    for (const eyes of GLASSES) expect(renderToString(<WearTile slot="eyes" item={eyes} />)).toContain('wr-tile');
    for (const neck of NECKS) expect(renderToString(<WearTile slot="neck" item={neck} />)).toContain('wr-tile');
  });

  it('nothing worn draws nothing', () => {
    expect(renderToString(<svg><WornHat kind="bear" /></svg>)).toBe('<svg></svg>');
    expect(renderToString(<svg><WornOnFace kind="bunny" wear={{ at: 1 }} /></svg>)).toBe('<svg></svg>');
    // Only something for the neck: the small face has no neck to put it on.
    expect(renderToString(<svg><WornOnFace kind="bear" wear={{ neck: 'scarf', at: 1 }} /></svg>)).toBe('<svg></svg>');
  });

  it('the small faces in the games wear the hat and glasses; an emote wears the hat only', () => {
    const plain = renderToString(<BearFace />);
    const dressed = renderToString(<BearFace wear={{ hat: 'crown', eyes: 'shades', at: 1 }} />);
    expect(plain).not.toContain('wr-in');
    expect(dressed.match(/wr-in/g)?.length).toBe(2);
    expect(renderToString(<BunnyFace wear={{ hat: 'chef', at: 1 }} />).match(/wr-in/g)?.length).toBe(1);
    showWear({ user: { hat: 'party', eyes: 'stars', at: 1 } });
    try {
      expect(renderToString(<EmoteFace emote="laugh" seat="user" />).match(/wr-in/g)?.length).toBe(1);
      expect(renderToString(<EmoteFace emote="laugh" seat="partner" />)).not.toContain('wr-in');
    } finally {
      showWear(undefined);
    }
  });
});

describe('a secret message can be drawn', () => {
  it('under its foil until rubbed open, then as plain words', () => {
    const shut = renderToString(
      <SecretScratch id="smoke-shut" label="Rub to read">
        <p>hello</p>
      </SecretScratch>
    );
    expect(shut).toContain('sc-foil');
    expect(shut).toContain('hello');
    openSecret('smoke-open');
    const open = renderToString(
      <SecretScratch id="smoke-open" label="Rub to read">
        <p>hello</p>
      </SecretScratch>
    );
    expect(open).not.toContain('sc-foil');
    expect(open).toContain('hello');
  });
});

describe('the puppy can be drawn', () => {
  it('in every mood, and doing everything it does', () => {
    const seen = new Set<string>();
    for (const mood of ['new', 'happy', 'fine', 'hungry', 'bored', 'sulking', 'asleep'] as const) {
      for (const doing of [null, 'eat', 'play', 'stroke', 'full'] as const) {
        const html = renderToString(<PetArt mood={mood} doing={doing} level={mood === 'happy' ? 4 : 1} />);
        expect(html).toContain(`data-mood="${mood}"`);
        expect(html).not.toContain('NaN');
        seen.add(html);
      }
    }
    // Asleep, sulking and hungry each look their own way.
    expect(renderToString(<PetArt mood="asleep" doing={null} level={1} />)).toContain('pt-z');
    expect(renderToString(<PetArt mood="sulking" doing={null} level={1} />)).toContain('pt-cloud');
    expect(renderToString(<PetArt mood="hungry" doing={null} level={1} />)).toContain('pt-want');
    expect(renderToString(<PetArt mood="happy" doing="eat" level={1} />)).toContain('pt-bowl');
    expect(renderToString(<PetArt mood="happy" doing="play" level={1} />)).toContain('pt-ball');
    expect(renderToString(<PetArt mood="fine" doing="stroke" level={1} />)).toContain('pt-heart');
    expect(seen.size).toBeGreaterThan(20);
  });

  it('its card: a name, a level, and the two things to do for it', () => {
    const fresh = renderToString(<PetCard partnerName="Priya" onHalf={() => {}} />);
    expect(fresh).toContain('Mochi');
    expect(fresh).toContain('Say hello');
    expect(fresh).toContain('Level 1');
    expect(fresh).toContain('Feed');
    expect(fresh).toContain('Play');
    const loved = renderToString(<PetCard mine={{ ...fed(undefined, Date.now()), fed: 5, name: 'Laddu', nameAt: 1 }} theirs={{ ...fed(undefined, Date.now()), fed: 4 }} partnerName="Priya" onHalf={() => {}} />);
    expect(loved).toContain('Laddu');
    // Nine meals: eighteen points, the start of level 3.
    expect(loved).toContain('Level 3');
  });
});
