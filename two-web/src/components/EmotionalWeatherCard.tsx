import React, { useState } from 'react';
import { EmotionalReport, WeatherState } from '../types';
import { Sun, Cloud, CloudRain, CloudLightning, Sparkles, Sliders } from 'lucide-react';

interface EmotionalWeatherCardProps {
  userReport: EmotionalReport;
  partnerReport: EmotionalReport;
  activeUser: 'user' | 'partner';
  onUpdateReport: (report: Partial<EmotionalReport>) => void;
}

const WEATHER_METADATA: Record<WeatherState, { label: string; icon: string; desc: string }> = {
  SUNNY: { label: 'Sunny', icon: '☀️', desc: 'Radiant, energized, expansive' },
  CALM: { label: 'Clear', icon: '🌤️', desc: 'Grounded, peaceful, steady' },
  OVERCAST: { label: 'Overcast', icon: '☁️', desc: 'Reflective, quiet, introspective' },
  RAINY: { label: 'Turbulent', icon: '🌧️', desc: 'Fragile, stressed, tender' },
  STORMY: { label: 'Stormy', icon: '⛈️', desc: 'High friction, depleted, overwhelmed' },
};

export const EmotionalWeatherCard: React.FC<EmotionalWeatherCardProps> = ({
  userReport,
  partnerReport,
  activeUser,
  onUpdateReport
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Determine current active person's report vs partner's report
  const myReport = activeUser === 'user' ? userReport : partnerReport;
  const theirReport = activeUser === 'user' ? partnerReport : userReport;
  const partnerName = activeUser === 'user' ? 'Partner' : 'You';

  return (
    <div className="bg-linen-surface rounded-2xl border border-linen-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg font-medium text-linen-primary">Emotional Weather & Capacity</h2>
          <p className="text-xs text-linen-secondary">Calibrate expectations without guesswork or assumptions.</p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="inline-flex items-center text-xs font-medium px-2.5 py-1.5 rounded-lg bg-linen-variant hover:bg-linen-border text-linen-primary transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 mr-1 text-linen-accent" />
          {isEditing ? 'Close' : 'Update Your State'}
        </button>
      </div>

      {/* Side-by-side display */}
      <div className="grid grid-cols-2 gap-4 divide-x divide-linen-border">
        {/* Partner Column */}
        <div className="pr-4 flex flex-col items-center text-center">
          <span className="text-xs font-medium text-linen-secondary uppercase tracking-wider">{partnerName}</span>
          <div className="text-3xl my-2">{WEATHER_METADATA[theirReport.weather].icon}</div>
          <span className="text-base font-serif font-medium text-linen-primary">
            {WEATHER_METADATA[theirReport.weather].label}
          </span>
          <div className="flex items-center space-x-1 mt-3">
            {[1, 2, 3, 4, 5].map(i => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i <= theirReport.capacity ? 'bg-linen-accent' : 'bg-linen-border'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-linen-secondary mt-1">Bandwidth: {theirReport.capacity}/5</span>
        </div>

        {/* You Column */}
        <div className="pl-4 flex flex-col items-center text-center">
          <span className="text-xs font-medium text-linen-accent uppercase tracking-wider">
            {activeUser === 'user' ? 'Your Status' : 'Partner (Active)'}
          </span>
          <div className="text-3xl my-2">{WEATHER_METADATA[myReport.weather].icon}</div>
          <span className="text-base font-serif font-medium text-linen-primary">
            {WEATHER_METADATA[myReport.weather].label}
          </span>
          <div className="flex items-center space-x-1 mt-3">
            {[1, 2, 3, 4, 5].map(i => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i <= myReport.capacity ? 'bg-linen-primary' : 'bg-linen-border'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-linen-secondary mt-1">Bandwidth: {myReport.capacity}/5</span>
        </div>
      </div>

      {/* Inline Editing Drawer */}
      {isEditing && (
        <div className="mt-6 pt-6 border-t border-linen-border space-y-5 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-medium text-linen-secondary mb-2">How are you feeling today?</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(WEATHER_METADATA) as WeatherState[]).map(state => {
                const meta = WEATHER_METADATA[state];
                const isSelected = myReport.weather === state;
                return (
                  <button
                    key={state}
                    onClick={() => onUpdateReport({ weather: state })}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-linen-primary bg-linen-variant ring-1 ring-linen-primary'
                        : 'border-linen-border hover:bg-linen-variant/60'
                    }`}
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="text-xs font-medium text-linen-primary mt-1">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-linen-secondary">
                Emotional Capacity (Bandwidth): <strong className="text-linen-primary">{myReport.capacity} / 5</strong>
              </label>
              <span className="text-xs text-linen-accent">
                {myReport.capacity <= 1 ? 'Very low energy, need gentle care' : myReport.capacity >= 4 ? 'Generous energy, ready to support' : 'Moderate bandwidth'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={myReport.capacity}
              onChange={(e) => onUpdateReport({ capacity: parseInt(e.target.value) })}
              className="w-full accent-linen-primary cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
