import React, { useState } from 'react';
import { HearthGardenState, GardenBlossom } from '../types';
import { Sparkles, Heart, Droplets, Sun, X } from 'lucide-react';

interface HearthGardenCanvasProps {
  garden: HearthGardenState;
  activeUser: 'user' | 'partner';
  isWateringAnimation?: boolean;
  isSunlightAnimation?: boolean;
  onSelectBlossom?: (blossom: GardenBlossom) => void;
}

export function playWaterDropSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    [0, 0.08, 0.18, 0.28].forEach((delay, idx) => {
      const t = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const baseFreq = 950 + idx * 120;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.09);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.09);
    });
  } catch (_) {}
}

export function playSunlightChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic warm drone (G major: 392Hz, 493.88Hz, 587.33Hz, 783.99Hz)
    const chord = [392, 493.88, 587.33, 783.99];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.15 + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + 1.2);
    });
  } catch (_) {}
}

export function playBlossomPopSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, now); // Love frequency 528Hz
    osc.frequency.exponentialRampToValueAtTime(1056, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (_) {}
}

export const HearthGardenCanvas: React.FC<HearthGardenCanvasProps> = ({
  garden,
  activeUser,
  isWateringAnimation = false,
  isSunlightAnimation = false,
  onSelectBlossom
}) => {
  const [selectedBlossom, setSelectedBlossom] = useState<GardenBlossom | null>(null);

  const isDormant = garden.isDormant || garden.vitality < 20;

  // Foliage colors
  const foliageColorA = isDormant ? '#d4a373' : '#2d6a4f';
  const foliageColorB = isDormant ? '#c58f58' : '#52b788';
  const foliageColorC = isDormant ? '#e9c46a' : '#74c69d';

  const handleBlossomClick = (blossom: GardenBlossom) => {
    setSelectedBlossom(blossom);
    if (onSelectBlossom) onSelectBlossom(blossom);
  };

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[460px] rounded-3xl overflow-hidden border border-linen-border bg-gradient-to-b from-stone-900 via-stone-850 to-stone-950 flex items-center justify-center p-4 select-none shadow-inner">
      {/* Ambient background sky & starlight/mist */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft radial aura */}
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl transition-opacity duration-1000 ${
            isSunlightAnimation
              ? 'opacity-80 bg-amber-400/40'
              : isDormant
              ? 'opacity-30 bg-amber-600/20'
              : 'opacity-40 bg-emerald-600/20'
          }`}
        />

        {/* Ambient floating dust / pollen */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

        {/* Sunlight animation overlay */}
        {isSunlightAnimation && (
          <div className="absolute inset-0 bg-gradient-to-b from-amber-300/20 via-yellow-200/10 to-transparent animate-pulse pointer-events-none" />
        )}

        {/* Rain / Water droplets animation */}
        {isWateringAnimation && (
          <div className="absolute inset-0 flex justify-around pointer-events-none overflow-hidden">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-8 bg-gradient-to-b from-cyan-200 to-teal-400 rounded-full opacity-70 animate-bounce"
                style={{
                  animationDuration: `${0.6 + (i % 4) * 0.15}s`,
                  animationDelay: `${(i % 5) * 0.1}s`,
                  transform: `translateY(${Math.random() * 20}px)`
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* SVG Bonsai Illustration */}
      <svg
        viewBox="0 0 500 420"
        className="w-full h-full max-h-full drop-shadow-2xl overflow-visible"
      >
        <defs>
          {/* Ceramic Pot Gradients */}
          <linearGradient id="potGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3d3a37" />
            <stop offset="50%" stopColor="#57534e" />
            <stop offset="100%" stopColor="#292524" />
          </linearGradient>
          <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#241e19" />
            <stop offset="100%" stopColor="#171310" />
          </linearGradient>

          {/* Wood Trunk Gradient */}
          <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5c4033" />
            <stop offset="60%" stopColor="#43281c" />
            <stop offset="100%" stopColor="#2b1810" />
          </linearGradient>

          {/* Foliage Gradients */}
          <radialGradient id="foliageGradLeft" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor={foliageColorC} />
            <stop offset="70%" stopColor={foliageColorB} />
            <stop offset="100%" stopColor={foliageColorA} />
          </radialGradient>
          <radialGradient id="foliageGradCenter" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stopColor={foliageColorC} />
            <stop offset="65%" stopColor={foliageColorB} />
            <stop offset="100%" stopColor={foliageColorA} />
          </radialGradient>
          <radialGradient id="foliageGradRight" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={foliageColorC} />
            <stop offset="70%" stopColor={foliageColorB} />
            <stop offset="100%" stopColor={foliageColorA} />
          </radialGradient>
        </defs>

        {/* 1. Ceramic Planter & Earthen Stand */}
        <g id="pot">
          {/* Wooden Bench / Plinth */}
          <rect x="150" y="375" width="200" height="14" rx="4" fill="#2d1e18" />
          <rect x="170" y="389" width="16" height="18" rx="2" fill="#1c120e" />
          <rect x="314" y="389" width="16" height="18" rx="2" fill="#1c120e" />

          {/* Pot Base */}
          <path
            d="M 170 330 L 330 330 L 315 375 L 185 375 Z"
            fill="url(#potGrad)"
            stroke="#1c1917"
            strokeWidth="2"
          />
          {/* Pot Rim */}
          <ellipse cx="250" cy="330" rx="82" ry="12" fill="#44403c" stroke="#1c1917" strokeWidth="2" />
          {/* Rich Dark Soil */}
          <ellipse cx="250" cy="330" rx="74" ry="9" fill="url(#soilGrad)" />
          {/* Mossy Soil Mound */}
          <ellipse cx="250" cy="328" rx="50" ry="6" fill={isDormant ? '#785938' : '#386641'} opacity="0.8" />
        </g>

        {/* 2. Trunk & Sculptural Branches */}
        <g id="trunk">
          {/* Main Trunk curving gracefully */}
          <path
            d="M 245 328 C 242 290, 230 250, 245 200 C 255 170, 240 140, 248 110"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="24"
            strokeLinecap="round"
          />
          {/* Lower Left Branch */}
          <path
            d="M 238 245 C 205 240, 175 225, 145 215"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Sub-branch Left */}
          <path
            d="M 170 228 C 155 210, 130 195, 115 190"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Right Main Branch */}
          <path
            d="M 248 210 C 285 205, 325 195, 355 185"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          {/* Sub-branch Right */}
          <path
            d="M 310 198 C 340 180, 365 160, 390 150"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Top Crown Fork */}
          <path
            d="M 245 155 C 230 135, 205 120, 185 110"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 248 140 C 265 120, 290 105, 315 95"
            fill="none"
            stroke="url(#trunkGrad)"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </g>

        {/* 3. Foliage Clouds (Organic clouds of leaves) */}
        <g id="foliage">
          {/* Left Cloud Cluster */}
          <g className="transition-all duration-700 hover:opacity-95">
            <ellipse cx="130" cy="200" rx="55" ry="32" fill="url(#foliageGradLeft)" opacity="0.95" />
            <ellipse cx="160" cy="185" rx="42" ry="26" fill="url(#foliageGradLeft)" opacity="0.9" />
            <ellipse cx="110" cy="210" rx="38" ry="24" fill="url(#foliageGradLeft)" opacity="0.85" />
          </g>

          {/* Right Cloud Cluster */}
          <g className="transition-all duration-700 hover:opacity-95">
            <ellipse cx="360" cy="170" rx="60" ry="35" fill="url(#foliageGradRight)" opacity="0.95" />
            <ellipse cx="330" cy="155" rx="45" ry="28" fill="url(#foliageGradRight)" opacity="0.9" />
            <ellipse cx="385" cy="180" rx="40" ry="25" fill="url(#foliageGradRight)" opacity="0.85" />
          </g>

          {/* Top Center Crown Cluster */}
          <g className="transition-all duration-700 hover:opacity-95">
            <ellipse cx="250" cy="95" rx="70" ry="42" fill="url(#foliageGradCenter)" opacity="0.98" />
            <ellipse cx="205" cy="110" rx="50" ry="30" fill="url(#foliageGradCenter)" opacity="0.9" />
            <ellipse cx="295" cy="105" rx="52" ry="32" fill="url(#foliageGradCenter)" opacity="0.9" />
            <ellipse cx="250" cy="75" rx="45" ry="26" fill="url(#foliageGradCenter)" opacity="0.85" />
          </g>
        </g>

        {/* 4. Interactive Sprouted Blossoms */}
        <g id="blossoms">
          {garden.blossoms.map((blossom) => {
            // Map percentage (0-100) to SVG coordinates (x: 50-450, y: 50-320)
            const cx = 50 + (blossom.xPercent / 100) * 400;
            const cy = 40 + (blossom.yPercent / 100) * 260;

            const isCherry = blossom.type === 'cherry';
            const isLotus = blossom.type === 'lotus';
            const isJasmine = blossom.type === 'jasmine';

            return (
              <g
                key={blossom.id}
                onClick={() => handleBlossomClick(blossom)}
                className="cursor-pointer group transform transition-transform duration-300 hover:scale-125"
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                {/* Glow ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill={isCherry ? '#f472b6' : isLotus ? '#c084fc' : isJasmine ? '#fef08a' : '#fbbf24'}
                  opacity="0.25"
                  className="animate-pulse"
                />

                {/* 5 Petals */}
                {[0, 72, 144, 216, 288].map((angle, pIdx) => {
                  const rad = (angle * Math.PI) / 180;
                  const px = cx + Math.cos(rad) * 7;
                  const py = cy + Math.sin(rad) * 7;
                  const petalColor = isCherry
                    ? '#fbcfe8'
                    : isLotus
                    ? '#e9d5ff'
                    : isJasmine
                    ? '#fef9c3'
                    : '#fde68a';
                  return (
                    <circle
                      key={pIdx}
                      cx={px}
                      cy={py}
                      r="4.5"
                      fill={petalColor}
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                  );
                })}

                {/* Blossom Center Core */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="3.5"
                  fill={isCherry ? '#db2777' : isLotus ? '#9333ea' : '#ca8a04'}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Status Pill */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-700/60 text-xs text-stone-200">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-serif font-medium">{garden.stageName}</span>
        <span className="text-stone-400 font-mono text-[11px]">Lvl {garden.level}</span>
      </div>

      {/* Slumber or Vitality Pill */}
      <div className="absolute top-4 right-4">
        {isDormant ? (
          <div className="bg-amber-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-amber-700/60 text-xs text-amber-200 flex items-center space-x-1.5">
            <span>🍂 Winter Slumber</span>
          </div>
        ) : (
          <div className="bg-emerald-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-700/60 text-xs text-emerald-200 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{garden.vitality}% Flourishing</span>
          </div>
        )}
      </div>

      {/* Selected Blossom Inspection Modal / Popover */}
      {selectedBlossom && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-20">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-stone-100">
            <button
              onClick={() => setSelectedBlossom(null)}
              className="absolute top-3 right-3 p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-xs text-pink-400 font-serif uppercase tracking-widest mb-1.5">
              <Heart className="w-3.5 h-3.5 fill-pink-400" />
              <span>{selectedBlossom.type.replace('_', ' ')} Blossom</span>
            </div>

            <p className="font-serif text-base text-stone-100 italic leading-relaxed my-2">
              “{selectedBlossom.note}”
            </p>

            <div className="flex items-center justify-between text-xs text-stone-400 border-t border-stone-800 pt-3 mt-3">
              <span>Dedicated by {selectedBlossom.sproutedByName}</span>
              <span>{selectedBlossom.sproutedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
