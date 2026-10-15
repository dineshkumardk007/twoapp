import React from 'react';
import { Heart } from 'lucide-react';

interface NotAboutYouBannerProps {
  isPartnerActive: boolean;
  partnerName: string;
  isUserActive: boolean;
  onToggleUserFlag: (active: boolean) => void;
}

/**
 * "It's not about you" on Home - only while it is on.
 *
 * Either of you switches it on in Settings, for a hard day that is not the
 * other's doing. While your partner's is on, their note is here, where you
 * land; while yours is on, a line says so and can turn it off.
 */
export const NotAboutYouBanner: React.FC<NotAboutYouBannerProps> = ({
  isPartnerActive,
  partnerName,
  isUserActive,
  onToggleUserFlag
}) => {
  if (!isPartnerActive && !isUserActive) return null;
  return (
    <div className="space-y-3">
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

      {isUserActive && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 py-2.5 pl-4 pr-2">
          <Heart className="h-4 w-4 shrink-0 fill-current text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-linen-primary">
            {partnerName} can see it’s not about them
          </p>
          <button
            type="button"
            onClick={() => onToggleUserFlag(false)}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Turn off
          </button>
        </div>
      )}
    </div>
  );
};
