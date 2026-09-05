import React, { useState } from 'react';
import { 
  Compass, Heart, BatteryCharging, Sparkles, Sliders, Check, 
  MessageSquare, Coffee, Shield, RefreshCw, Send
} from 'lucide-react';
import { CareCompassProfile } from '../types';

interface CareCompassViewProps {
  userProfile: CareCompassProfile;
  partnerProfile: CareCompassProfile;
  activeUser: 'user' | 'partner';
  onUpdateProfile: (profile: CareCompassProfile) => void;
  onSendToChat: (message: string) => void;
}

const AXES = [
  { key: 'wordsOfAffirmation', label: 'Affirmation', fullLabel: 'Words of Affirmation', emoji: '💬' },
  { key: 'qualityTime', label: 'Quality Time', fullLabel: 'Undivided Quality Time', emoji: '⏳' },
  { key: 'actsOfService', label: 'Acts of Service', fullLabel: 'Thoughtful Acts of Service', emoji: '🤝' },
  { key: 'physicalTouch', label: 'Touch', fullLabel: 'Comforting Physical Touch', emoji: '🤲' },
  { key: 'thoughtfulSurprises', label: 'Surprises', fullLabel: 'Thoughtful Small Surprises', emoji: '🎁' },
] as const;

export const CareCompassView: React.FC<CareCompassViewProps> = ({
  userProfile,
  partnerProfile,
  activeUser,
  onUpdateProfile,
  onSendToChat
}) => {
  const [viewMode, setViewMode] = useState<'both' | 'partner' | 'you'>('both');
  const [isEditing, setIsEditing] = useState(false);

  // Editable local state for the active user
  const currentMyProfile = activeUser === 'user' ? userProfile : partnerProfile;
  const currentTheirProfile = activeUser === 'user' ? partnerProfile : userProfile;

  const [formProfile, setFormProfile] = useState<CareCompassProfile>(currentMyProfile);

  const handleSave = () => {
    onUpdateProfile({
      ...formProfile,
      updatedAt: 'Just now'
    });
    setIsEditing(false);
  };

  // SVG Radar Dimensions
  const size = 300;
  const center = size / 2;
  const radius = 105;

  const getCoordinates = (value: number, index: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const generatePolygonPoints = (profile: CareCompassProfile) => {
    const vals = [
      profile.wordsOfAffirmation,
      profile.qualityTime,
      profile.actsOfService,
      profile.physicalTouch,
      profile.thoughtfulSurprises,
    ];
    return vals.map((v, i) => {
      const { x, y } = getCoordinates(v, i);
      return `${x},${y}`;
    }).join(' ');
  };

  // Micro-suggestions based on partner's highest weighted love language
  const getSuggestionsForPartner = () => {
    const scores = [
      { key: 'wordsOfAffirmation', val: currentTheirProfile.wordsOfAffirmation, text: 'Slip a handwritten 1-sentence note into their pocket acknowledging something you love about them.' },
      { key: 'qualityTime', val: currentTheirProfile.qualityTime, text: 'Put both phones in a drawer for 25 minutes and make warm herbal tea to sip on the couch.' },
      { key: 'actsOfService', val: currentTheirProfile.actsOfService, text: 'Quietly take care of tonight’s kitchen clean-up or prep their morning travel mug without asking.' },
      { key: 'physicalTouch', val: currentTheirProfile.physicalTouch, text: 'Offer a slow 5-minute silent neck or hand massage before falling asleep.' },
      { key: 'thoughtfulSurprises', val: currentTheirProfile.thoughtfulSurprises, text: 'Bring home their favorite bakery pastry or leave a fresh folded blanket on their chair.' },
    ];
    scores.sort((a, b) => b.val - a.val);
    return scores.slice(0, 3);
  };

  const getFuelBadge = (fuel: number) => {
    if (fuel >= 80) return { label: 'Full & Generous', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (fuel >= 50) return { label: 'Comfortably Balanced', color: 'bg-blue-50 text-blue-800 border-blue-200' };
    if (fuel >= 25) return { label: 'Running Low', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { label: 'Depleted • Gentle Care Needed', color: 'bg-rose-50 text-rose-800 border-rose-200' };
  };

  const partnerFuel = getFuelBadge(currentTheirProfile.fuelTankPercent);
  const myFuel = getFuelBadge(formProfile.fuelTankPercent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-linen-variant border border-linen-border flex items-center justify-center text-linen-accent">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tight text-linen-primary flex items-center space-x-2">
              <span>The Care Compass</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-linen-variant text-linen-accent border border-linen-border font-sans font-normal">
                Love Language Radar
              </span>
            </h2>
            <p className="text-xs text-linen-secondary mt-0.5">
              Visualizing how you both receive care and replenishing emotional reserves with zero demands.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
              isEditing 
                ? 'bg-linen-primary text-linen-surface border-linen-primary' 
                : 'bg-linen-variant hover:bg-linen-border text-linen-primary border-linen-border'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Close Tuning' : 'Tune My Compass'}</span>
          </button>
        </div>
      </div>

      {/* Editor Drawer (if editing is active) */}
      {isEditing && (
        <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 shadow-md animate-fade-in space-y-6">
          <div className="flex items-center justify-between border-b border-linen-border pb-3">
            <h3 className="font-serif text-lg font-medium text-linen-primary">
              Tune Your Love Languages & Fuel Tank
            </h3>
            <span className="text-xs text-linen-secondary">
              Update how you currently feel most cherished
            </span>
          </div>

          {/* Emotional Fuel Slider */}
          <div className="p-4 rounded-2xl bg-linen-variant/50 border border-linen-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-linen-primary flex items-center space-x-1.5">
                <BatteryCharging className="w-4 h-4 text-linen-accent" />
                <span>Current Emotional Fuel Reserve</span>
              </label>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${myFuel.color}`}>
                {formProfile.fuelTankPercent}% • {myFuel.label}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={formProfile.fuelTankPercent}
              onChange={(e) => setFormProfile({ ...formProfile, fuelTankPercent: parseInt(e.target.value) })}
              className="w-full accent-linen-accent cursor-pointer"
            />
          </div>

          {/* 5 Dimensions Tuning */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AXES.map((axis) => (
              <div key={axis.key} className="p-3.5 rounded-2xl bg-linen-surface border border-linen-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-linen-primary flex items-center space-x-1.5">
                    <span>{axis.emoji}</span>
                    <span>{axis.fullLabel}</span>
                  </span>
                  <span className="text-xs font-mono font-medium text-linen-accent">
                    {formProfile[axis.key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formProfile[axis.key]}
                  onChange={(e) => setFormProfile({ ...formProfile, [axis.key]: parseInt(e.target.value) })}
                  className="w-full accent-linen-primary cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Personal Craving Note */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1.5">
              Personal Craving / Tender Request (Optional)
            </label>
            <input
              type="text"
              value={formProfile.currentCravingNote}
              onChange={(e) => setFormProfile({ ...formProfile, currentCravingNote: e.target.value })}
              placeholder="e.g. Draining work week; craving quiet cuddles and tea tonight without problem solving."
              className="w-full px-4 py-2.5 rounded-2xl bg-linen-variant/40 border border-linen-border text-sm text-linen-primary placeholder-linen-secondary focus:outline-hidden focus:border-linen-accent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl text-xs text-linen-secondary hover:bg-linen-variant"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 shadow-sm"
            >
              Save Compass Profile
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Geometric Radar Chart + Partner Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Visual Pentagon Radar */}
        <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 shadow-xs flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-medium text-linen-primary">
              Geometric Resonance Map
            </h3>
            <div className="flex items-center space-x-1 text-xs">
              {(['both', 'partner', 'you'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1 rounded-lg capitalize text-[11px] font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-linen-primary text-linen-surface'
                      : 'text-linen-secondary hover:bg-linen-variant'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Radar Chart */}
          <div className="relative w-[300px] h-[300px] my-2">
            <svg width={size} height={size} className="overflow-visible">
              {/* Concentric Guide Pentagons */}
              {[0.25, 0.5, 0.75, 1.0].map((level) => {
                const points = [0, 1, 2, 3, 4].map(i => {
                  const { x, y } = getCoordinates(level * 100, i);
                  return `${x},${y}`;
                }).join(' ');
                return (
                  <polygon
                    key={level}
                    points={points}
                    fill="none"
                    stroke="#e5e0db"
                    strokeWidth="1"
                    strokeDasharray={level === 1 ? 'none' : '3 3'}
                  />
                );
              })}

              {/* Radial Axis Lines */}
              {[0, 1, 2, 3, 4].map(i => {
                const { x, y } = getCoordinates(100, i);
                return (
                  <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke="#e5e0db"
                    strokeWidth="1"
                  />
                );
              })}

              {/* User Polygon (Terracotta / Linen Primary) */}
              {(viewMode === 'both' || viewMode === 'you') && (
                <polygon
                  points={generatePolygonPoints(currentMyProfile)}
                  fill="#c48b71"
                  fillOpacity="0.28"
                  stroke="#c48b71"
                  strokeWidth="2.2"
                />
              )}

              {/* Partner Polygon (Indigo / Sage Accent) */}
              {(viewMode === 'both' || viewMode === 'partner') && (
                <polygon
                  points={generatePolygonPoints(currentTheirProfile)}
                  fill="#6366f1"
                  fillOpacity="0.24"
                  stroke="#6366f1"
                  strokeWidth="2.2"
                />
              )}

              {/* Axis Labels */}
              {AXES.map((axis, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                const labelRadius = radius + 24;
                const x = center + labelRadius * Math.cos(angle);
                const y = center + labelRadius * Math.sin(angle);
                return (
                  <text
                    key={axis.key}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-sans font-medium fill-stone-600 select-none"
                  >
                    {axis.emoji} {axis.label}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center space-x-6 text-xs text-linen-secondary mt-3">
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-[#c48b71]" />
              <span className="font-medium text-linen-primary">Your Needs</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
              <span className="font-medium text-linen-primary">Partner’s Needs</span>
            </div>
          </div>
        </div>

        {/* Right Column: Partner Capacity, Craving & Gentle Action Sparks */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Partner Status & Emotional Fuel */}
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent flex items-center space-x-1.5">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                <span>Partner’s Emotional Bandwidth</span>
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${partnerFuel.color}`}>
                {currentTheirProfile.fuelTankPercent}% • {partnerFuel.label}
              </span>
            </div>

            {currentTheirProfile.currentCravingNote && (
              <div className="p-3 rounded-2xl bg-linen-variant/60 border border-linen-border text-xs text-linen-primary italic">
                “{currentTheirProfile.currentCravingNote}”
              </div>
            )}
          </div>

          {/* Tailored Micro-Care Suggestions */}
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-primary flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-linen-accent" />
                <span>Low-Effort Care Suggestions for Partner</span>
              </h4>
            </div>

            <div className="space-y-2.5">
              {getSuggestionsForPartner().map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-linen-border bg-linen-variant/30 hover:bg-linen-variant/60 transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <p className="text-linen-primary leading-relaxed">
                    {item.text}
                  </p>
                  <button
                    onClick={() => onSendToChat(`I was thinking of you: ${item.text}`)}
                    className="shrink-0 p-1.5 rounded-lg bg-linen-surface hover:bg-linen-border text-linen-accent transition-colors border border-linen-border cursor-pointer"
                    title="Send this idea to chat"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-linen-secondary italic text-center pt-1">
              Suggestions adapt organically based on your partner's top love priorities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
