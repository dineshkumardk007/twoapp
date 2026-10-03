// Nature, built the way it actually sounds: in layers.
//
// Rain is not one noise - it is a distant wash, thousands of tiny impacts
// close by, and now and then a fat drip. A fire is a low roar, a fizz of
// crackles, and the odd pop. The sea is waves of different sizes that rise,
// break and draw back. Each layer here is one of those, and each moves on its
// own, so nothing repeats in a way the ear can catch.
//
// Shared by the soundscapes and the nightstand, so rain is the same rain
// wherever it plays. What each layer plays is rendered in textures.ts, off
// the main thread; a layer starts once its sounds are ready.

import { Session, play, filter, wobble, noise, recipe, random } from './kit';

// ---------------------------------------------------------------- the layers

export interface RainOptions {
  /** Heard from indoors: everything high is softened by the walls. */
  indoor?: boolean;
  /** 0..1: a drizzle up to a downpour. */
  amount?: number;
  /** Drops tapping a skylight above you. */
  skylight?: boolean;
}

export function rain(s: Session, o: RainOptions = {}) {
  const { ctx, bus } = s;
  const amount = o.amount ?? 1;
  const top = o.indoor ? 1100 : 5600;

  s.when([noise('pink'), noise('brown'), recipe('patter', { seed: 7 })], ([pink, brown, patterBuf]) => {
    // The wash: rain everywhere, far and near, as one sound.
    const washLp = filter(ctx, 'lowpass', top, 0.5);
    const wash = play(bus, pink, {
      loop: true, gain: 0.55 * amount, offset: random.between(0, 9), room: 0.25,
      through: [filter(ctx, 'highpass', 320), washLp]
    });
    s.keep({ stop: () => wash.source.stop() });
    s.keep(wobble(ctx, washLp.frequency, 0.037, top * 0.12));

    // Underneath it, the weight of water on a roof.
    const body = play(bus, brown, {
      loop: true, gain: 0.3 * amount, offset: random.between(0, 9),
      through: [filter(ctx, 'lowpass', o.indoor ? 450 : 750, 0.5)]
    });
    s.keep({ stop: () => body.source.stop() });

    // Close up: the patter of individual drops.
    const patter = play(bus, patterBuf, {
      loop: true, gain: 0.5 * amount * (o.indoor ? 0.6 : 1), offset: random.between(0, 7), room: 0.15,
      through: [filter(ctx, 'lowpass', o.indoor ? 1500 : 11000, 0.5)]
    });
    s.keep({ stop: () => patter.source.stop() });
  });

  // Now and then, a fat drip.
  s.when([0, 1, 2, 3, 4, 5].map(i => recipe('drip', { seed: 100 + i })), drips => {
    s.sched.every(when => {
      play(bus, random.pick(drips), {
        when, gain: random.between(0.15, 0.4) * amount * (o.indoor ? 0.5 : 1),
        pan: random.between(-0.75, 0.75), room: 0.4,
        through: o.indoor ? [filter(ctx, 'lowpass', 1800)] : undefined
      });
      return random.between(0.35, o.indoor ? 2.4 : 1.4) / Math.max(0.3, amount);
    }, 0.4);
  });

  if (o.skylight) {
    s.when([0, 1, 2, 3].map(i => recipe('tick', { seed: 200 + i })), ticks => {
      s.sched.every(when => {
        play(bus, random.pick(ticks), { when, gain: random.between(0.05, 0.14), pan: random.between(-0.5, 0.5), room: 0.5 });
        return random.between(0.6, 3.2);
      }, 1.1);
    });
  }
}

export function fire(s: Session, o: { amount?: number } = {}) {
  const { ctx, bus } = s;
  const amount = o.amount ?? 1;

  s.when([noise('brown'), noise('pink')], ([brown, pink]) => {
    // The roar: air rushing into the flames, low and uneven.
    const roar = play(bus, brown, {
      loop: true, gain: 0.5 * amount, offset: random.between(0, 9),
      through: [filter(ctx, 'lowpass', 420, 0.6)]
    });
    s.keep({ stop: () => roar.source.stop() });
    // The breath of the flames themselves.
    const breath = play(bus, pink, {
      loop: true, gain: 0.06 * amount, offset: random.between(0, 9), room: 0.2,
      through: [filter(ctx, 'bandpass', 950, 0.7)]
    });
    s.keep({ stop: () => breath.source.stop() });
    // Flicker: the roar never holds still.
    s.sched.every(when => {
      const level = random.between(0.6, 1.15);
      roar.level.gain.setTargetAtTime(0.5 * amount * level, when, random.between(0.08, 0.3));
      breath.level.gain.setTargetAtTime(0.06 * amount * level, when, 0.2);
      return random.between(0.25, 0.9);
    });
  });

  // The crackle bed.
  s.when([recipe('crackle', { seed: 31 })], ([crackleBuf]) => {
    const crackle = play(bus, crackleBuf, {
      loop: true, gain: 0.55 * amount, offset: random.between(0, 9), room: 0.2
    });
    s.keep({ stop: () => crackle.source.stop() });
  });

  // And the occasional pop of a log giving way.
  s.when([0, 1, 2, 3, 4].map(i => recipe('pop', { seed: 300 + i })), pops => {
    s.sched.every(when => {
      play(bus, random.pick(pops), { when, gain: random.between(0.25, 0.6) * amount, pan: random.between(-0.4, 0.4), room: 0.3 });
      return random.chance(0.25) ? random.between(0.15, 0.5) : random.between(1.8, 6.5);
    }, 1);
  });
}

export function ocean(s: Session, o: { amount?: number } = {}) {
  const { ctx, bus } = s;
  const amount = o.amount ?? 1;

  s.when([noise('brown'), noise('pink'), noise('white')], ([brown, pink, white]) => {
    // The sea beyond the waves, never quite silent.
    const far = play(bus, brown, {
      loop: true, gain: 0.2 * amount, offset: random.between(0, 9),
      through: [filter(ctx, 'highpass', 110), filter(ctx, 'lowpass', 520, 0.5)]
    });
    s.keep({ stop: () => far.source.stop() });

    // Waves, each its own size and pace: a rise, the break, and the fizz of
    // water drawing back over sand.
    s.sched.every(when => {
      const rise = random.between(2.2, 3.6);
      const fall = random.between(3.5, 5.5);
      const peak = random.between(0.6, 1.05) * amount;
      const pan = random.between(-0.35, 0.35);
      const life = rise + fall * 1.6;

      const lp = filter(ctx, 'lowpass', 320, 0.6);
      const wave = play(bus, pink, {
        when, loop: true, gain: 0.0001, offset: random.between(0, 9), pan, room: 0.3, duration: life,
        through: [filter(ctx, 'highpass', 110), lp]
      });
      const g = wave.level.gain;
      g.setValueAtTime(0.0001, when);
      g.exponentialRampToValueAtTime(peak * 0.3, when + rise * 0.7);
      g.linearRampToValueAtTime(peak, when + rise);
      g.setTargetAtTime(0.0001, when + rise, fall / 3);
      lp.frequency.setValueAtTime(320, when);
      lp.frequency.exponentialRampToValueAtTime(random.between(1800, 4200), when + rise);
      lp.frequency.setTargetAtTime(420, when + rise, fall / 2.5);

      const fizz = play(bus, white, {
        when, loop: true, gain: 0.0001, offset: random.between(0, 9), pan: -pan * 0.5, room: 0.35, duration: life,
        through: [filter(ctx, 'highpass', 2600), filter(ctx, 'lowpass', 9000)]
      });
      const fg = fizz.level.gain;
      fg.setValueAtTime(0.0001, when);
      fg.setValueAtTime(0.0001, when + rise + 0.25);
      fg.linearRampToValueAtTime(peak * 0.15, when + rise + 0.9);
      fg.setTargetAtTime(0.0001, when + rise + 0.9, 0.9);

      return random.between(6.5, 11.5);
    }, 0.2);
  });
}

export function wind(s: Session, o: { pine?: boolean; amount?: number } = {}) {
  const { ctx, bus } = s;
  const amount = o.amount ?? 1;

  s.when([noise('pink')], ([pink]) => {
    // Three bands of air, each gusting on its own time.
    const bands = [
      { f: 340, q: 0.7, base: 0.42 },
      { f: 880, q: 1.0, base: 0.22 },
      { f: 2100, q: 1.4, base: 0.08 }
    ];
    for (const band of bands) {
      const bp = filter(ctx, 'bandpass', band.f, band.q);
      const layer = play(bus, pink, { loop: true, gain: band.base * amount * 0.6, offset: random.between(0, 9), room: 0.25, through: [bp] });
      s.keep({ stop: () => layer.source.stop() });
      s.sched.every(when => {
        layer.level.gain.setTargetAtTime(band.base * amount * random.between(0.12, 1.4), when, random.between(0.6, 2.2));
        bp.frequency.setTargetAtTime(band.f * random.between(0.75, 1.3), when, 1.6);
        return random.between(1.5, 4.5);
      }, random.between(0, 1.5));
    }
  });

  if (o.pine) {
    s.when([noise('white'), recipe('rustle', { seed: 41 })], ([white, rustleBuf]) => {
      // Wind through needles whistles, faintly, and changes its note.
      const bp = filter(ctx, 'bandpass', 1100, 18);
      const whistle = play(bus, white, { loop: true, gain: 0, offset: random.between(0, 9), room: 0.4, through: [bp] });
      s.keep({ stop: () => whistle.source.stop() });
      s.sched.every(when => {
        bp.frequency.setTargetAtTime(random.between(820, 1500), when, 2);
        whistle.level.gain.setTargetAtTime(random.chance(0.5) ? random.between(0.06, 0.16) * amount : 0, when, 1.5);
        return random.between(3, 7);
      });
      // And the needles themselves rustle.
      const rustle = play(bus, rustleBuf, { loop: true, gain: 0.25 * amount, offset: random.between(0, 7), room: 0.2 });
      s.keep({ stop: () => rustle.source.stop() });
      s.sched.every(when => {
        rustle.level.gain.setTargetAtTime(random.between(0.05, 0.35) * amount, when, 1.2);
        return random.between(2, 5);
      });
    });
  }
}

export function crickets(s: Session, o: { amount?: number } = {}) {
  const { ctx, bus } = s;
  const amount = o.amount ?? 1;
  // A few crickets, near and far, each keeping its own time.
  const voices = [
    { f: 4650, pulses: 3, every: 0.62, gain: 0.07, pan: -0.55, lp: 12000 },
    { f: 4380, pulses: 4, every: 0.81, gain: 0.04, pan: 0.6, lp: 7000 },
    { f: 4900, pulses: 3, every: 1.05, gain: 0.025, pan: 0.15, lp: 5000 }
  ];
  for (const v of voices) {
    s.when([recipe('chirp', { freq: v.f, pulses: v.pulses })], ([chirp]) => {
      let restUntil = 0;
      s.sched.every(when => {
        if (when < restUntil) return restUntil - when;
        if (random.chance(0.05)) {
          restUntil = when + random.between(3, 9);
          return restUntil - when;
        }
        play(bus, chirp, { when, gain: v.gain * amount * random.between(0.8, 1.1), pan: v.pan, room: 0.35, through: [filter(ctx, 'lowpass', v.lp)] });
        return v.every * random.between(0.94, 1.06);
      }, random.between(0, 1));
    });
  }
}

/** A quiet, warm room: what silence sounds like indoors. */
export function roomTone(s: Session, o: { clinks?: boolean } = {}) {
  const { ctx, bus } = s;
  s.when([noise('brown'), noise('pink')], ([brown, pink]) => {
    const hum = play(bus, brown, { loop: true, gain: 0.16, offset: random.between(0, 9), through: [filter(ctx, 'lowpass', 230, 0.5)] });
    s.keep({ stop: () => hum.source.stop() });
    const air = play(bus, pink, { loop: true, gain: 0.025, offset: random.between(0, 9), through: [filter(ctx, 'lowpass', 900, 0.5)] });
    s.keep({ stop: () => air.source.stop() });
  });
  if (o.clinks) {
    s.when([0, 1, 2].map(i => recipe('clink', { seed: 400 + i })), clinks => {
      s.sched.every(when => {
        play(bus, random.pick(clinks), { when, gain: random.between(0.03, 0.07), pan: random.between(-0.6, 0.6), room: 0.6 });
        return random.between(10, 28);
      }, random.between(4, 10));
    });
  }
}

export function birds(s: Session, o: { amount?: number } = {}) {
  const { ctx, bus } = s;
  const amount = o.amount ?? 1;
  s.when([0, 1, 2, 3, 4].map(i => recipe('bird', { seed: 500 + i })), phrases => {
    s.sched.every(when => {
      play(bus, random.pick(phrases), {
        when, gain: random.between(0.03, 0.07) * amount, pan: random.between(-0.85, 0.85), room: 0.55,
        rate: random.between(0.92, 1.08), through: [filter(ctx, 'lowpass', 7000)]
      });
      return random.between(6, 16);
    }, random.between(2, 6));
  });
}
