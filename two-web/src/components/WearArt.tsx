import React from 'react';
import type { Glasses, Hat, Neck, Wear, WearSlot } from '../core/wear';

// What the bear and the bunny can wear (core/wear), drawn in the units of
// the "Us two" character (components/UsRig): the middle of the head at 0,0,
// the head about 30 across each way. Each piece arrives with a little move of
// its own (index.css, .wr-in) every time it is put on.

const INK = '#3b2723';
type Kind = 'bear' | 'bunny';

/** Where things sit on each head: its top, its eyes, and just under its chin. */
const SITS: Record<Kind, { top: number; eyes: number; neck: number }> = {
  bear: { top: -29, eyes: -6, neck: 34 },
  bunny: { top: -26, eyes: -3, neck: 32 }
};

const edge = (fill: string, width = 2.6) => ({ fill, stroke: INK, strokeWidth: width, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });
const HEART = 'M0,5.5 C-8,-0.5 -7.2,-7 -3.2,-7 C-1.3,-7 -0.4,-6 0,-5 C0.4,-6 1.3,-7 3.2,-7 C7.2,-7 8,-0.5 0,5.5 Z';
const STAR = 'M0,-8 L2.3,-2.6 L8,-2.4 L3.6,1.4 L5,7 L0,3.8 L-5,7 L-3.6,1.4 L-8,-2.4 L-2.3,-2.6 Z';

/** A hat, with its brim at 0,0 and the rest above. */
export const HatShape: React.FC<{ hat: Hat }> = ({ hat }) => {
  switch (hat) {
    case 'party':
      return (
        <g transform="rotate(10)">
          <path d="M-12,3 L0,-27 L12,3 Q0,7 -12,3 Z" {...edge('#f472b6')} />
          <path d="M-8.2,-6.5 L7.6,-8 M-5,-14.5 L4.6,-15.6" stroke="#fde047" strokeWidth={3} strokeLinecap="round" />
          <circle cx={0} cy={-28} r={4.2} {...edge('#fde047', 2.2)} />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path d="M-15,3 L-16,-11 L-8,-4 L0,-16 L8,-4 L16,-11 L15,3 Z" {...edge('#fbbf24')} />
          <circle cx={0} cy={-3} r={2.6} fill="#ef4444" stroke={INK} strokeWidth={1.4} />
          <circle cx={-9} cy={-1.5} r={1.9} fill="#38bdf8" stroke={INK} strokeWidth={1.2} />
          <circle cx={9} cy={-1.5} r={1.9} fill="#38bdf8" stroke={INK} strokeWidth={1.2} />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M11,1 Q27,-1 30,6.5 Q20,8 11,5.5 Z" {...edge('#1d4ed8')} />
          <path d="M-18,4 Q-19,-16 0,-16.5 Q19,-16 18,4 Q0,8 -18,4 Z" {...edge('#3b82f6')} />
          <path d="M0,-16.5 V5.5 M-9.5,-14 Q-11,-4 -10,5 M9.5,-14 Q11,-4 10,5" fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={1.6} />
          <circle cx={0} cy={-17} r={2.4} {...edge('#1d4ed8', 1.8)} />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <circle cx={0} cy={-21} r={6} {...edge('#ffffff', 2.2)} />
          <path d="M-18,1 Q-19,-17 0,-18 Q19,-17 18,1 Z" {...edge('#14b8a6')} />
          <path d="M-20,-1 H20 V6 Q0,10 -20,6 Z" {...edge('#5eead4')} />
          <path d="M-13,0.5 V7 M-6.5,0.5 V8 M0,0.5 V8.4 M6.5,0.5 V8 M13,0.5 V7" stroke={INK} strokeOpacity={0.4} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
    case 'flowers':
      return (
        <g>
          <path d="M-21,6 Q0,-9 21,6" fill="none" stroke="#16a34a" strokeWidth={3.4} strokeLinecap="round" />
          {[
            [-18, 3, '#f472b6'],
            [-9.5, -2.2, '#fde047'],
            [0, -4, '#fb7185'],
            [9.5, -2.2, '#c084fc'],
            [18, 3, '#f472b6']
          ].map(([x, y, fill]) => (
            <g key={String(x)}>
              <circle cx={Number(x)} cy={Number(y)} r={5} fill={String(fill)} stroke={INK} strokeWidth={1.8} />
              <circle cx={Number(x)} cy={Number(y)} r={1.9} fill="#fff7ea" />
            </g>
          ))}
        </g>
      );
    case 'chef':
      return (
        <g>
          <circle cx={-10} cy={-15} r={8.5} {...edge('#ffffff')} />
          <circle cx={10} cy={-15} r={8.5} {...edge('#ffffff')} />
          <circle cx={0} cy={-19} r={10} {...edge('#ffffff')} />
          <path d="M-13,3 V-10 H13 V3 Q0,6 -13,3 Z" {...edge('#ffffff')} />
          <path d="M-6,-8 V1.5 M0,-8 V2.4 M6,-8 V1.5" stroke={INK} strokeOpacity={0.3} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
  }
};

/** Glasses, with the bridge of the nose at 0,0 and an eye 11 to each side. */
export const GlassesShape: React.FC<{ glasses: Glasses }> = ({ glasses }) => {
  switch (glasses) {
    case 'round':
      return (
        <g>
          <path d="M-3.4,-0.5 Q0,-3.6 3.4,-0.5 M-19,-1 L-27,-4 M19,-1 L27,-4" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={-11} cy={0} r={8} fill="#ffffff" fillOpacity={0.28} stroke={INK} strokeWidth={2.4} />
          <circle cx={11} cy={0} r={8} fill="#ffffff" fillOpacity={0.28} stroke={INK} strokeWidth={2.4} />
        </g>
      );
    case 'shades':
      return (
        <g>
          <path d="M-3,-2.5 H3 M-19.5,-3 L-27,-5 M19.5,-3 L27,-5" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <rect x={-20} y={-6.5} width={17.5} height={13} rx={4.5} {...edge('#1c1917', 2)} />
          <rect x={2.5} y={-6.5} width={17.5} height={13} rx={4.5} {...edge('#1c1917', 2)} />
          <path d="M-16.5,2.5 L-11,-4 M6,2.5 L11.5,-4" stroke="#fff" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    case 'hearts':
      return (
        <g>
          <path d="M-3.4,-1.5 Q0,-4 3.4,-1.5 M-19,-2 L-27,-5 M19,-2 L27,-5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <path d={HEART} transform="translate(-11 0.5) scale(1.25)" fill="#fb7185" fillOpacity={0.88} stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
          <path d={HEART} transform="translate(11 0.5) scale(1.25)" fill="#fb7185" fillOpacity={0.88} stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
        </g>
      );
    case 'stars':
      return (
        <g>
          <path d="M-4,-1 Q0,-3.6 4,-1 M-19,-2 L-27,-5 M19,-2 L27,-5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <path d={STAR} transform="translate(-11 0) scale(1.15)" fill="#facc15" fillOpacity={0.92} stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
          <path d={STAR} transform="translate(11 0) scale(1.15)" fill="#facc15" fillOpacity={0.92} stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
        </g>
      );
  }
};

/** Something round the neck, with the middle of the collar at 0,0. */
export const NeckShape: React.FC<{ neck: Neck }> = ({ neck }) => {
  switch (neck) {
    case 'bowtie':
      return (
        <g>
          <path d="M-2,0 L-14,-8 Q-16,0 -14,8 Z" {...edge('#ef4444')} />
          <path d="M2,0 L14,-8 Q16,0 14,8 Z" {...edge('#ef4444')} />
          <circle cx={0} cy={0} r={3.6} {...edge('#b91c1c', 2.2)} />
        </g>
      );
    case 'scarf':
      return (
        <g>
          <path d="M7,3 L16,4 L15,23 L11,20.5 L7,23.5 Z" {...edge('#f97316')} />
          <path d="M7.4,11 L15.6,12 M7.2,17 L15.3,18" stroke="#fde047" strokeWidth={2.4} />
          <path d="M-21,-5 Q0,4 21,-5 Q23,0 21,5 Q0,14 -21,5 Q-23,0 -21,-5 Z" {...edge('#f97316')} />
          <path d="M-11,-0.8 L-12,8.2 M0,1.6 V10.6 M11,-0.8 L12,8.2" stroke="#fde047" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      );
    case 'pearls':
      return (
        <g>
          {[-18, -12.2, -6.2, 0, 6.2, 12.2, 18].map(x => (
            <circle key={x} cx={x} cy={-2 + (1 - (x / 18) ** 2) * 8} r={3.1} fill="#fffdf7" stroke={INK} strokeWidth={1.6} />
          ))}
        </g>
      );
  }
};

/** A piece as it arrives: `how` is the move it makes. Keyed by what it is, so each new one arrives afresh. */
const Arriving: React.FC<{ how: 'drop' | 'slide' | 'pop'; children: React.ReactNode }> = ({ how, children }) => (
  <g className="wr-in" data-how={how}>
    {children}
  </g>
);

/** The hat a character wears, on its head (in the head's units). */
export const WornHat: React.FC<{ kind: Kind; wear?: Wear }> = ({ kind, wear }) =>
  wear?.hat ? (
    <g transform={`translate(0 ${SITS[kind].top})`}>
      <Arriving how="drop" key={wear.hat}>
        <HatShape hat={wear.hat} />
      </Arriving>
    </g>
  ) : null;

export const WornGlasses: React.FC<{ kind: Kind; wear?: Wear }> = ({ kind, wear }) =>
  wear?.eyes ? (
    <g transform={`translate(0 ${SITS[kind].eyes})`}>
      <Arriving how="slide" key={wear.eyes}>
        <GlassesShape glasses={wear.eyes} />
      </Arriving>
    </g>
  ) : null;

export const WornNeck: React.FC<{ kind: Kind; wear?: Wear }> = ({ kind, wear }) =>
  wear?.neck ? (
    <g transform={`translate(0 ${SITS[kind].neck})`}>
      <Arriving how="pop" key={wear.neck}>
        <NeckShape neck={wear.neck} />
      </Arriving>
    </g>
  ) : null;

/**
 * The same hat and glasses on the small face used in the games (48 units
 * square, components/CosyHomes): the head's units brought down to its size.
 * `glasses` off where the face has eyes of its own to show, as an emote does.
 */
export const WornOnFace: React.FC<{ kind: Kind; wear?: Wear; glasses?: boolean }> = ({ kind, wear, glasses = true }) =>
  wear && (wear.hat || (glasses && wear.eyes)) ? (
    <g transform={kind === 'bear' ? 'translate(24 27) scale(0.583)' : 'translate(24 30.5) scale(0.55)'}>
      <WornHat kind={kind} wear={wear} />
      {glasses && <WornGlasses kind={kind} wear={wear} />}
    </g>
  ) : null;

/** One thing by itself, for its key in the wardrobe. */
export const WearTile: React.FC<{ slot: WearSlot; item: string }> = ({ slot, item }) => (
  <svg viewBox={slot === 'hat' ? '-32 -36 64 48' : slot === 'eyes' ? '-30 -14 60 28' : '-26 -12 52 40'} className="wr-tile" aria-hidden="true">
    {slot === 'hat' ? <HatShape hat={item as Hat} /> : slot === 'eyes' ? <GlassesShape glasses={item as Glasses} /> : <NeckShape neck={item as Neck} />}
  </svg>
);
