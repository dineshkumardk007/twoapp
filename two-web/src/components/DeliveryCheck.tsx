import React, { useEffect, useState } from 'react';
import { useT } from '../core/i18n';
import { onShownChange } from '../core/shown';
import { dayAndTime } from '../core/when';
import {
  askBatteryExemption,
  openNotificationSettings,
  openOemSettings,
  readBackgroundState,
  readDeliveryLog,
  type BackgroundState,
  type DeliveryEvent
} from '../core/background';

/** How often the check reads the phone again while it is open. */
const LOOK_EVERY_MS = 4_000;
/** How many lines of the diary are shown. */
const SHOWN = 12;
/** How far back a closing by the phone still counts as news. */
const CLOSED_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

type Mark = 'good' | 'warn' | 'bad' | 'check';

const BRAND: Record<Exclude<BackgroundState['oem'], ''>, { name: string; tip: string }> = {
  xiaomi: {
    name: 'Xiaomi',
    tip: 'Turn on Autostart for Two, set its battery saver to "No restrictions", and lock Two in Recent apps (hold its card, tap the lock).'
  },
  vivo: {
    name: 'vivo',
    tip: 'Allow Two to start on its own and to use battery in the background, and lock Two in Recent apps (pull its card down).'
  },
  oppo: {
    name: 'OPPO',
    tip: 'Allow Auto launch and Background activity for Two, and lock Two in Recent apps (tap its menu, then Lock).'
  }
};

/** "3 h 20 min", "45 min". */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/**
 * What lets messages and ticks reach this phone while Two is closed, at a
 * glance (core/background): the background connection, the battery, the
 * phone maker's own settings and the notice - each with the way to put it
 * right - and the phone's own diary of what happened, above all whether the
 * phone closed Two. Read from the phone again every few seconds, and when Two
 * comes back from a settings screen.
 */
export const DeliveryCheck: React.FC = () => {
  const tr = useT();
  const [state, setState] = useState(readBackgroundState);
  const [log, setLog] = useState(readDeliveryLog);

  useEffect(() => {
    const look = () => {
      setState(readBackgroundState());
      setLog(readDeliveryLog());
    };
    const timer = setInterval(look, LOOK_EVERY_MS);
    const off = onShownChange(shown => {
      if (shown) look();
    });
    return () => {
      clearInterval(timer);
      off();
    };
  }, []);

  if (!state) return null;

  const now = Date.now();
  const closings = log.filter(e => e.kind === 'closed' && now - e.at < CLOSED_WITHIN_MS);
  const brand = state.oem ? BRAND[state.oem] : null;

  const rows: { key: string; mark: Mark; label: string; detail: string; fix?: { label: string; run: () => void } }[] = [];
  rows.push(
    !state.running
      ? {
          key: 'connection',
          mark: 'bad',
          label: tr('Background connection'),
          detail: tr('Stopped. It starts again when you open Two.')
        }
      : state.connected
      ? {
          key: 'connection',
          mark: 'good',
          label: tr('Background connection'),
          detail: tr('Connected. Messages and ticks reach this phone while Two is closed.')
        }
      : {
          key: 'connection',
          mark: 'warn',
          label: tr('Background connection'),
          detail: tr('Connecting… (no internet, or the relay is waking up).')
        }
  );
  rows.push(
    state.restricted
      ? {
          key: 'battery',
          mark: 'bad',
          label: tr('Battery'),
          detail: tr('Background use is restricted for Two, so the phone stops it.'),
          fix: { label: tr('Fix'), run: () => openOemSettings() }
        }
      : state.ignoringBattery
      ? { key: 'battery', mark: 'good', label: tr('Battery'), detail: tr('Unrestricted.') }
      : {
          key: 'battery',
          mark: 'bad',
          label: tr('Battery'),
          detail: tr('Battery saving can pause Two in the background.'),
          fix: { label: tr('Allow'), run: () => askBatteryExemption() }
        }
  );
  if (brand) {
    rows.push({
      key: 'brand',
      mark: closings.length > 0 ? 'bad' : 'check',
      label: tr('{brand} settings', { brand: brand.name }),
      detail: tr(brand.tip),
      fix: { label: tr('Open'), run: () => openOemSettings() }
    });
  }
  rows.push(
    !state.notify
      ? { key: 'notice', mark: 'check', label: tr('New message notice'), detail: tr('Off. Turn it on above to see a quiet word when a message comes.') }
      : state.noticeAllowed
      ? { key: 'notice', mark: 'good', label: tr('New message notice'), detail: tr('On.') }
      : {
          key: 'notice',
          mark: 'bad',
          label: tr('New message notice'),
          detail: tr('Notifications are off for Two in phone settings.'),
          fix: { label: tr('Open'), run: () => openNotificationSettings() }
        }
  );

  const said = (e: DeliveryEvent): string => {
    switch (e.kind) {
      case 'started':
        return tr('Background connection started');
      case 'joined':
        return tr('Connected while Two was closed');
      case 'dropped':
        return tr('Connection dropped - connecting again');
      case 'page-down':
        return tr('Connection dropped in the background - connecting again');
      case 'page-up':
        return tr('Connected again');
      case 'message':
        return tr('A message reached this phone');
      case 'notice':
        return tr('Notice shown');
      case 'closed':
        return tr('The phone closed Two for {time}', { time: duration(e.minutes ?? 0) });
      case 'rebooted':
        return tr('Phone restarted');
    }
  };

  return (
    <div className="pt-4 mt-4 border-t border-linen-border/60 space-y-3">
      <div>
        <p className="text-sm font-medium text-linen-primary">{tr('Message delivery')}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-linen-secondary">
          {tr('What lets messages, notices and ticks reach this phone while Two is closed. Check it on both phones.')}
        </p>
      </div>

      {closings.length > 0 && (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-500 ring-1 ring-rose-500/25">
          {tr('This phone closed Two in the background {n} times this week. Until it is allowed to run, messages and ticks wait until Two is opened.', {
            n: closings.length
          })}
        </p>
      )}

      <ul className="space-y-2.5">
        {rows.map(row => (
          <li key={row.key} className="flex items-start gap-2.5">
            <span className="delivery-mark mt-0.5" data-mark={row.mark} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-linen-primary">{row.label}</span>
              <span className="block text-[11px] leading-relaxed text-linen-secondary">{row.detail}</span>
            </span>
            {row.fix && (
              <button
                type="button"
                onClick={row.fix.run}
                className="shrink-0 rounded-full border border-linen-border px-3 py-1.5 text-[11px] font-medium text-linen-primary transition-colors hover:bg-linen-variant active:scale-95 cursor-pointer"
              >
                {row.fix.label}
              </button>
            )}
          </li>
        ))}
      </ul>

      {log.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-linen-accent">
            {tr('Recent activity on this phone')}
          </summary>
          <ul className="mt-2 space-y-1">
            {log.slice(0, SHOWN).map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className={`flex items-baseline justify-between gap-3 text-[11px] ${
                  e.kind === 'closed' ? 'text-rose-500' : 'text-linen-secondary'
                }`}
              >
                <span className="min-w-0">
                  {said(e)}
                  {e.count > 1 && <span className="tabular-nums"> ×{e.count}</span>}
                </span>
                <span className="shrink-0 tabular-nums opacity-80">{dayAndTime(e.at, now)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
