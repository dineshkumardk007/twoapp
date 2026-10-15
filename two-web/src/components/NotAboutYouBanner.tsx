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
        <div className="rounded-2xl bg-amber-50 border border-amber-300/60 p-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-serif text-base font-medium text-linen-primary">It’s not about you</h3>
              <p className="text-sm text-linen-secondary mt-0.5 leading-relaxed">
                <strong>{partnerName}</strong> is having a hard day, but it’s <em>not</em> because of you. Don’t read too much into a short reply or a quiet mood.
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
              ? `On: ${partnerName} knows it’s not about them`
              : `Tell ${partnerName} “it’s not about you” today`}
          </span>
        </div>
        <button
          onClick={() => onToggleUserFlag(!isUserActive)}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            isUserActive
              ? 'bg-amber-700 text-white shadow-sm'
              : 'bg-linen-variant hover:bg-linen-border text-linen-secondary'
          }`}
        >
          {isUserActive ? 'On' : 'Turn on'}
        </button>
      </div>
    </div>
  );
};
