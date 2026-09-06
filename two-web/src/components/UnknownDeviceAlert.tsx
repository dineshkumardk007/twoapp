import React from 'react';
import { ShieldAlert, Check, RefreshCw } from 'lucide-react';
import type { KnownDevice } from '../core/storage';

interface UnknownDeviceAlertProps {
  /** Sockets the relay counts in this space right now. */
  totalDevices: number;
  /** How many you have accepted as legitimate. */
  approvedCount: number;
  pending: KnownDevice[];
  onApprove: (deviceId: string) => void;
  onApproveCount: () => void;
  onRotateCode: () => void;
}

/**
 * Warns when more devices are in the space than have been vouched for.
 *
 * The number it reacts to comes from the relay's own socket table, not from
 * anything a client claims about itself, so a third party holding the link code
 * cannot suppress it by lying. The device names below are only labels those
 * devices sent about themselves and are worth exactly that much.
 *
 * Approving changes nothing technically - whoever holds the code can already
 * read the space. Rotating the code is the only action that shuts anyone out,
 * which is why it is offered as the answer rather than a dismiss button.
 */
export const UnknownDeviceAlert: React.FC<UnknownDeviceAlertProps> = ({
  totalDevices,
  approvedCount,
  pending,
  onApprove,
  onApproveCount,
  onRotateCode
}) => {
  const unexpected = totalDevices > approvedCount;
  if (!unexpected && pending.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
      <div className="rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3.5 text-amber-950">
        <p className="flex items-center text-sm font-semibold">
          <ShieldAlert className="w-4 h-4 mr-1.5" />
          {unexpected
            ? `${totalDevices} devices are in your space`
            : 'A device you have not seen before'}
        </p>

        <p className="mt-1 text-xs leading-relaxed">
          {unexpected
            ? `You have accepted ${approvedCount}. Anyone who knows your link code can join and read everything, including past messages.`
            : 'It says it belongs to your space. If you do not recognise it, change your link code.'}
        </p>

        {pending.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {pending.map(d => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-amber-300 bg-white/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{d.label}</p>
                  <p className="text-[10px] opacity-70">
                    First seen {new Date(d.firstSeenAt).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => onApprove(d.id)}
                  className="ml-2 shrink-0 rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <Check className="mr-1 inline h-3 w-3" />
                  It&rsquo;s ours
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {unexpected && pending.length === 0 && (
            <button
              onClick={onApproveCount}
              className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-amber-100 transition-colors cursor-pointer"
            >
              That&rsquo;s our other device
            </button>
          )}
          <button
            onClick={onRotateCode}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-[11px] font-medium text-amber-50 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <RefreshCw className="mr-1 inline h-3 w-3" />
            Change our link code
          </button>
        </div>
      </div>
    </div>
  );
};
