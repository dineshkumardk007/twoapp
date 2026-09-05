import React from 'react';
import { Heart, Info, Check } from 'lucide-react';

interface NotAboutYouBannerProps {
  isPartnerActive: boolean;
  partnerName: string;
  isUserActive: boolean;
  onToggleUserFlag: (active: boolean) => void;
}

export const NotAboutYouBanner: React.FC<NotAboutYouBannerProps> = ({
  isPartnerActive,
  partnerName,
  isUserActive,
  onToggleUserFlag
}) => {
  return (
    <div className="space-y-3">
      {/* Partner Active Banner */}
      {isPartnerActive && (
        <div className="rounded-2xl bg-gold-50 border border-gold-500/30 p-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-gold-100 text-gold-600 shrink-0">
              <Heart className="w-5 h-5 fill-gold-600" />
            </div>
            <div>
              <h3 className="font-serif text-base font-medium text-linen-primary">It’s not about you</h3>
              <p className="text-sm text-linen-secondary mt-0.5 leading-relaxed">
                <strong>{partnerName}</strong> is carrying heavy thoughts or having a rough day, but it is <em>not</em> caused by you or your relationship. Please don’t read into their tone, silence, or brevity.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User 1-Tap Toggle */}
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-linen-border bg-linen-surface/50 hover:bg-linen-surface transition-colors">
        <div className="flex items-center space-x-2.5">
          <Info className="w-4 h-4 text-linen-secondary" />
          <span className="text-sm font-medium text-linen-primary">
            {isUserActive
              ? "Active: “It’s not about you” flag is reassuring your partner"
              : "Set “It’s not about you” flag for today"}
          </span>
        </div>
        <button
          onClick={() => onToggleUserFlag(!isUserActive)}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
            isUserActive
              ? 'bg-gold-500 text-white shadow-sm'
              : 'bg-linen-variant hover:bg-linen-border text-linen-secondary'
          }`}
        >
          {isUserActive ? 'Active' : 'Turn On'}
        </button>
      </div>
    </div>
  );
};
