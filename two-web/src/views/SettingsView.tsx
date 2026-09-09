import React, { useState, useEffect } from 'react';
import { AUTO_LOCK_CHOICES, AutoLockSetting } from '../core/autoLock';
import { generatePairingCode, normalizePairingCode, isPlausiblePairingCode, generateJoinPhrase, checkJoinPhrase, getDeviceId } from '../core/space';
import { SpaceState } from '../core/storage';
import { ThemeMode } from '../types';
import { Locale, getTranslation } from '../core/i18n';
import { VaultBackupModal } from '../components/VaultBackupModal';
import { Shield, Download, Trash2, Palette, Lock, KeyRound, Globe, Calculator, ExternalLink, Link2, LogOut, Copy, Check, Share2, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  state: SpaceState;
  spaceCode?: string;
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  onEmergencyWipe: () => void;
  onRestoreState?: (restoredState: SpaceState) => void;
  currentLocale?: Locale;
  onSelectLocale?: (locale: Locale) => void;
  onToggleCamouflage?: () => void;
  onUnpair?: () => void;
  /**
   * Move this space to another link code.
   *
   * The phrase is part of the address, not a setting: switching to a space that
   * has one without supplying it derives a different room, and nothing on
   * screen would say why nobody is there.
   */
  onRotateCode?: (code: string, joinPhrase?: string) => void;
  /** Display name used when inviting a partner. */
  userName?: string;
  vaultName?: string;
  onRenameVault?: (name: string) => void;
  /** True only when the partner's device is in the space right now. */
  partnerOnline?: boolean;
  relayStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  lastSyncedAt?: number | null;
  /**
   * Sockets the relay currently counts in this space.
   *
   * Comes from the server's own table rather than anything a client says about
   * itself, which is what makes it the trustworthy half of this pair.
   */
  connectedDeviceCount?: number;
  onToggleActiveUser?: () => void;
  decoyCode?: string;
  onUpdateDecoyCode?: (code: string) => void;
  autoCamouflageOnBlur?: boolean;
  onToggleAutoCamouflage?: (enabled: boolean) => void;
  decoyOnLaunch?: boolean;
  onToggleDecoyOnLaunch?: (enabled: boolean) => void;
  /** True when this device already has an app-lock PIN. */
  pinEnabled?: boolean;
  /**
   * Set, change, or remove this device's app-lock PIN.
   *
   * Pass the current PIN when one exists and null when it does not; pass null
   * as the next PIN to remove the lock entirely.
   */
  onUpdatePin?: (
    currentPin: string | null,
    nextPin: string | null
  ) => Promise<'ok' | 'wrong-pin' | 'busy' | 'error'>;
  /** How long the app may sit in the background before locking itself. */
  autoLock?: AutoLockSetting;
  onSelectAutoLock?: (value: AutoLockSetting) => void;
  /** Whether this device tells the other one when it was last awake. */
  shareLastSeen?: boolean;
  onToggleShareLastSeen?: (share: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  spaceCode,
  currentTheme,
  onSelectTheme,
  onEmergencyWipe,
  onRestoreState = () => {},
  currentLocale = 'en',
  onSelectLocale = () => {},
  onToggleCamouflage = () => {},
  onUnpair = () => {},
  onRotateCode = () => {},
  userName = '',
  vaultName = '',
  onRenameVault,
  partnerOnline = false,
  relayStatus = 'idle',
  lastSyncedAt = null,
  connectedDeviceCount = 0,
  pinEnabled = false,
  onUpdatePin,
  autoLock = 60,
  onSelectAutoLock,
  shareLastSeen = true,
  onToggleShareLastSeen,
  onToggleActiveUser = () => {},
  decoyCode = '142.85',
  onUpdateDecoyCode,
  autoCamouflageOnBlur = false,
  onToggleAutoCamouflage,
  decoyOnLaunch = false,
  onToggleDecoyOnLaunch
}) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [decoyCodeInput, setDecoyCodeInput] = useState(decoyCode);
  const [decoySaved, setDecoySaved] = useState(false);
  const [nameDraft, setNameDraft] = useState(vaultName);
  const [nameSaved, setNameSaved] = useState(false);

  const thisDeviceId = getDeviceId();
  const knownDevices = state.knownDevices || [];

  /**
   * Whether more sockets are connected than there are devices you have ever
   * seen.
   *
   * The two numbers are not the same kind of thing - the count is live, the
   * roster is historical - so their difference is not a number of strangers and
   * must never be printed as one. Some of the devices in the roster may be
   * switched off right now, which would make the real number higher. As a
   * threshold it is still sound: if more are connected than you have ever met,
   * at least one of them is a device you do not know about.
   */
  const moreConnectedThanKnown = connectedDeviceCount > knownDevices.length;

  // App lock. 'idle' shows the buttons; the rest are the open form.
  const [lockMode, setLockMode] = useState<'idle' | 'set' | 'change' | 'remove'>('idle');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMessage, setLockMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  const closeLockForm = () => {
    setLockMode('idle');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  const submitLockChange = async () => {
    if (!onUpdatePin || lockBusy) return;
    setLockMessage(null);

    const removing = lockMode === 'remove';
    if (!removing) {
      if (newPinInput.length !== 4) {
        setLockMessage({ tone: 'bad', text: 'A PIN is four digits.' });
        return;
      }
      if (newPinInput !== confirmPinInput) {
        setLockMessage({ tone: 'bad', text: 'The two PINs are not the same.' });
        return;
      }
    }
    if (pinEnabled && currentPinInput.length !== 4) {
      setLockMessage({ tone: 'bad', text: 'Enter your current PIN first.' });
      return;
    }

    setLockBusy(true);
    const result = await onUpdatePin(
      pinEnabled ? currentPinInput : null,
      removing ? null : newPinInput
    );
    setLockBusy(false);

    if (result === 'ok') {
      closeLockForm();
      setLockMessage({
        tone: 'ok',
        text: removing
          ? 'App lock removed. This device now opens without a PIN.'
          : 'App lock updated. It applies the next time this app is opened.'
      });
      return;
    }

    setLockMessage({
      tone: 'bad',
      text:
        result === 'wrong-pin'
          ? 'That is not your current PIN.'
          : result === 'busy'
          ? 'Still loading your photos and memos. Try again in a moment.'
          : 'Could not change the app lock. Nothing was altered.'
    });
  };

  const [rotationPhrase, setRotationPhrase] = useState('');
  const rotationPhraseCheck = checkJoinPhrase(rotationPhrase);
  const [rotateMode, setRotateMode] = useState<'idle' | 'new' | 'join'>('idle');
  const [rotateCode, setRotateCode] = useState('');
  const [joinRotation, setJoinRotation] = useState('');

  const [relayInput, setRelayInput] = useState(() => {
    return (window as any).AndroidBridge?.getRelayUrl?.() || localStorage.getItem('two_custom_relay_url') || '';
  });

  const handleCopyCode = async () => {
    if (!spaceCode) return;
    try {
      await navigator.clipboard.writeText(spaceCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleShareCode = async () => {
    if (!spaceCode) return;
    const text = `Hey, here is our link code for Two: ${spaceCode}. Open the app and enter this code to connect!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Link our Two sanctuary',
          text
        });
        return;
      } catch {}
    }
    handleCopyCode();
  };

  const handleRename = () => {
    if (!onRenameVault) return;
    onRenameVault(nameDraft);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const relayLabel =
    relayStatus === 'connected' ? 'Connected to the relay' :
    relayStatus === 'connecting' ? 'Connecting…' :
    relayStatus === 'reconnecting' ? 'Reconnecting…' : 'Offline';


  const beginRotation = () => {
    setRotateCode(generatePairingCode());
    setRotateMode('new');
  };

  const applyRotation = (code: string, phrase?: string) => {
    const clean = normalizePairingCode(code);
    if (!isPlausiblePairingCode(clean)) return;
    onRotateCode(clean, phrase);
    setRotateMode('idle');
    setRotateCode('');
    setJoinRotation('');
  };

  const handleSaveRelay = () => {
    const trimmed = relayInput.trim();
    if (trimmed) {
      localStorage.setItem('two_custom_relay_url', trimmed);
      (window as any).AndroidBridge?.setRelayUrl?.(trimmed);
      alert('Relay server saved! Reloading to connect...');
      window.location.reload();
    } else {
      localStorage.removeItem('two_custom_relay_url');
      (window as any).AndroidBridge?.setRelayUrl?.('');
      alert('Reset to default relay.');
      window.location.reload();
    }
  };

  const t = getTranslation(currentLocale);

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `two_space_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleOpenPartnerWindow = () => {
    const partnerUrl = `${window.location.origin}${window.location.pathname}?perspective=partner`;
    window.open(partnerUrl, 'TwoPartnerSync', 'width=540,height=840,menubar=no,toolbar=no');
  };

  const themes: { id: ThemeMode; name: string; desc: string; bg: string }[] = [
    { id: 'linen', name: 'Warm Linen', desc: 'Analogue paper & warm charcoal', bg: 'bg-[#FAF8F5]' },
    { id: 'slate', name: 'Midnight Slate', desc: 'Deep indigo & soft starlight', bg: 'bg-[#121518]' },
    { id: 'forest', name: 'Forest Mist', desc: 'Grounding moss & deep pine', bg: 'bg-[#F4F6F4]' },
    { id: 'terracotta', name: 'Kyoto Terracotta', desc: 'Earthen clay & warm cedar', bg: 'bg-[#FBF7F4]' }
  ];

  const languages: { id: Locale; name: string; nativeName: string; flag: string }[] = [
    { id: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { id: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { id: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { id: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { id: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">{t.settings.title}</h2>
        <p className="text-sm text-linen-secondary">{t.settings.subtitle}</p>
      </div>

      {/* Connected Space & End-to-End Encryption */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
            <Link2 className="w-4 h-4 text-linen-accent" />
            <span>Connected Space &amp; Relay</span>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            E2EE Live
          </span>
        </div>

        <div className="bg-linen-variant/40 rounded-xl p-3 text-xs space-y-2.5 border border-linen-border/60">
          {spaceCode && (
            <div className="flex justify-between items-center text-linen-secondary pb-2 border-b border-linen-border/40">
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-linen-accent">
                  Space Link Code
                </span>
                <span className="font-mono text-sm font-bold text-linen-primary">{spaceCode}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded-lg border border-linen-border bg-linen-surface hover:bg-linen-variant text-linen-primary text-[11px] font-medium transition-colors flex items-center shadow-2xs cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1 text-linen-secondary" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareCode}
                  className="px-2.5 py-1 rounded-lg bg-linen-primary text-linen-surface text-[11px] font-medium hover:opacity-90 transition-opacity flex items-center shadow-2xs cursor-pointer"
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          )}

          {/* Who you are connected to, and whether they are here right now. */}
          <div className="pb-2 border-b border-linen-border/40 space-y-2.5">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-linen-accent">
              Our space
            </span>

            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Name our sanctuary…"
                maxLength={40}
                className="flex-1 px-3 py-2 rounded-lg border border-linen-border bg-linen-surface text-sm text-linen-primary"
              />
              <button
                type="button"
                disabled={!onRenameVault || nameDraft.trim() === vaultName.trim()}
                onClick={handleRename}
                className="px-2.5 py-2 rounded-lg bg-linen-primary text-linen-surface text-[11px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
              >
                {nameSaved ? 'Saved' : 'Rename'}
              </button>
            </div>
            <p className="text-[11px] text-linen-secondary leading-relaxed">
              Shown at the top for both of you. It is encrypted like everything else, so the
              server never learns what you called yourselves.
            </p>

            <dl className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <dt className="text-linen-secondary">Paired</dt>
                <dd className="text-linen-primary font-medium">
                  {spaceCode ? 'Yes' : 'Not yet'}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-linen-secondary">Partner</dt>
                <dd className="flex items-center font-medium">
                  <span
                    className={`w-2 h-2 rounded-full mr-1.5 ${
                      partnerOnline ? 'bg-emerald-500' : 'bg-linen-border'
                    }`}
                  />
                  <span className={partnerOnline ? 'text-emerald-700' : 'text-linen-secondary'}>
                    {partnerOnline ? 'Here now' : 'Away'}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-linen-secondary">Relay</dt>
                <dd className="text-linen-primary font-medium">{relayLabel}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-linen-secondary">Last sync</dt>
                <dd className="text-linen-primary font-medium">
                  {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-linen-secondary">Device lock</dt>
                <dd className="text-linen-primary font-medium">
                  {state.pinEnabled ? 'On' : 'Off'}
                </dd>
              </div>
            </dl>

          {/* Devices in your space.
              Two numbers, deliberately shown together. The count is the relay's
              own socket table and cannot be forged. The names below are what
              each device chose to say about itself, and only appear for devices
              that announced themselves at all - so the list can be shorter than
              the count, and that gap is the fact worth seeing. */}
          <div className="pt-4 mt-4 border-t border-linen-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-linen-primary">Devices in your space</span>
              <span
                className={`text-xs font-medium ${
                  moreConnectedThanKnown ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {connectedDeviceCount === 0
                  ? 'Not connected'
                  : `${connectedDeviceCount} connected now`}
              </span>
            </div>

            {knownDevices.length > 0 ? (
              <ul className="space-y-1.5">
                {knownDevices.map(device => (
                  <li
                    key={device.id}
                    className="flex items-center justify-between rounded-xl border border-linen-border/60 bg-linen-variant/30 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-linen-primary truncate">
                        {device.label}
                        {device.id === thisDeviceId && (
                          <span className="ml-1.5 font-normal text-linen-secondary">· this device</span>
                        )}
                      </span>
                      <span className="block text-[10px] text-linen-secondary">
                        First seen {new Date(device.firstSeenAt).toLocaleDateString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-linen-secondary">
                No devices have introduced themselves yet. They appear here once both of you have
                opened the app while connected.
              </p>
            )}

            {moreConnectedThanKnown && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-950">
                <p className="text-xs font-semibold">
                  {connectedDeviceCount} devices are connected, but only {knownDevices.length}{' '}
                  {knownDevices.length === 1 ? 'has' : 'have'} ever introduced{' '}
                  {knownDevices.length === 1 ? 'itself' : 'themselves'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  So at least one device here is not one you know about. It may be your own on an
                  older version. If it is not, anyone with your link code can read everything here,
                  including past messages, and changing the link code below is the only thing that
                  shuts them out.
                </p>
              </div>
            )}

            <p className="text-[11px] text-linen-secondary leading-relaxed">
              The count is live and comes from the relay, so it cannot be faked. The list is every
              device that has ever introduced itself, whether or not it is on right now, and those
              names are what each device says about itself &mdash; labels, not proof.
            </p>
          </div>

          {/* Last seen.
              Reciprocal on purpose, the way every messenger does it: turning
              yours off turns theirs off too. In a couple that rule is the
              whole point - without it, one of you could watch the other while
              staying invisible. */}
          {onToggleShareLastSeen && (
            <div className="pt-4 mt-4 border-t border-linen-border/60 space-y-2">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-linen-primary">
                    Share when I was last here
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-linen-secondary">
                    Your partner sees &ldquo;online&rdquo; while the app is open, and the time you
                    last had it open once you close it. Turn this off and you stop sending it
                    &mdash; and stop seeing theirs.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={shareLastSeen}
                  onChange={e => onToggleShareLastSeen(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* Device lock.
              A PIN belongs to the device it is typed on, not to the space: it
              encrypts what this phone holds, and the two of you can pick
              different ones, or only one of you can use one at all. It used to
              be offered once, while creating a space, so whoever joined was
              never asked and neither of you could change it afterwards. */}
          {onUpdatePin && (
            <div className="pt-4 mt-4 border-t border-linen-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-linen-primary">Device lock</span>
                <span
                  className={`text-xs font-medium ${
                    pinEnabled ? 'text-emerald-700' : 'text-linen-secondary'
                  }`}
                >
                  {pinEnabled ? 'PIN set' : 'No PIN'}
                </span>
              </div>

              <p className="text-[11px] text-linen-secondary leading-relaxed">
                With a PIN, everything this device holds is encrypted with it &mdash; messages,
                letters, photos, and the link code itself. It is not stored anywhere to be checked
                against: the wrong PIN simply cannot open the vault. This is your device only, so
                your partner sets their own, and it does not have to match yours.
              </p>

              {lockMode === 'idle' ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLockMessage(null);
                      setLockMode(pinEnabled ? 'change' : 'set');
                    }}
                    className="px-2.5 py-2 rounded-lg border border-linen-border bg-linen-surface hover:bg-linen-variant text-linen-primary text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {pinEnabled ? 'Change PIN' : 'Set a PIN'}
                  </button>
                  {pinEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setLockMessage(null);
                        setLockMode('remove');
                      }}
                      className="px-2.5 py-2 rounded-lg border border-linen-border bg-linen-surface hover:bg-rose-50 text-linen-secondary hover:text-rose-700 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Remove PIN
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-linen-border/70 bg-linen-variant/30 p-3">
                  {pinEnabled && (
                    <label className="block">
                      <span className="block text-[11px] font-medium text-linen-secondary mb-1">
                        Current PIN
                      </span>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        value={currentPinInput}
                        onChange={e => setCurrentPinInput(onlyDigits(e.target.value))}
                        placeholder="0000"
                        className="w-full px-3 py-2 rounded-lg border border-linen-border bg-linen-surface text-linen-primary text-sm tracking-[0.4em] focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
                      />
                    </label>
                  )}

                  {lockMode !== 'remove' && (
                    <>
                      <label className="block">
                        <span className="block text-[11px] font-medium text-linen-secondary mb-1">
                          New PIN
                        </span>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          value={newPinInput}
                          onChange={e => setNewPinInput(onlyDigits(e.target.value))}
                          placeholder="0000"
                          className="w-full px-3 py-2 rounded-lg border border-linen-border bg-linen-surface text-linen-primary text-sm tracking-[0.4em] focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-medium text-linen-secondary mb-1">
                          Repeat new PIN
                        </span>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          value={confirmPinInput}
                          onChange={e => setConfirmPinInput(onlyDigits(e.target.value))}
                          placeholder="0000"
                          className="w-full px-3 py-2 rounded-lg border border-linen-border bg-linen-surface text-linen-primary text-sm tracking-[0.4em] focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
                        />
                      </label>
                    </>
                  )}

                  {lockMode === 'remove' && (
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Removing the PIN decrypts this device&rsquo;s vault and leaves it readable to
                      anyone who picks up the phone. Your history is not deleted.
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={lockBusy}
                      onClick={() => void submitLockChange()}
                      className="flex-1 px-2.5 py-2 rounded-lg bg-linen-primary text-linen-surface text-[11px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                    >
                      {lockBusy
                        ? 'Working...'
                        : lockMode === 'remove'
                        ? 'Remove the lock'
                        : pinEnabled
                        ? 'Change it'
                        : 'Lock this device'}
                    </button>
                    <button
                      type="button"
                      disabled={lockBusy}
                      onClick={closeLockForm}
                      className="px-2.5 py-2 rounded-lg border border-linen-border bg-linen-surface text-linen-secondary text-[11px] font-medium hover:bg-linen-variant disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {lockMessage && (
                <p
                  className={`text-[11px] leading-relaxed ${
                    lockMessage.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {lockMessage.text}
                </p>
              )}

              {/* A PIN only guards a closed app. Left open on a table, Two
                  stayed open - so the lock covered the least likely case and
                  not the everyday one. */}
              {pinEnabled && onSelectAutoLock && (
                <div className="rounded-xl border border-linen-border/70 bg-linen-variant/30 p-3 space-y-2">
                  <label className="block">
                    <span className="block text-[11px] font-medium text-linen-secondary mb-1">
                      Lock again after leaving the app
                    </span>
                    <select
                      value={String(autoLock)}
                      onChange={e => {
                        const raw = e.target.value;
                        onSelectAutoLock(raw === 'off' ? 'off' : (Number(raw) as AutoLockSetting));
                      }}
                      className="w-full rounded-lg border border-linen-border bg-linen-surface px-3 py-2 text-sm text-linen-primary focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
                    >
                      {AUTO_LOCK_CHOICES.map(choice => (
                        <option key={String(choice.value)} value={String(choice.value)}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] leading-relaxed text-linen-secondary">
                    Locking the instant you switch away costs a PIN every time you glance at a
                    notification. A minute covers the glance and not the walk away.
                  </p>
                </div>
              )}
            </div>
          )}
          </div>



          {spaceCode && (
            <div className="pb-2 border-b border-linen-border/40">
              {rotateMode === 'idle' && (
                <button
                  type="button"
                  onClick={beginRotation}
                  className="w-full px-2.5 py-2 rounded-lg border border-linen-border bg-linen-surface hover:bg-linen-variant text-linen-primary text-[11px] font-medium transition-colors flex items-center justify-center cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5 text-linen-secondary" />
                  <span>Change our link code</span>
                </button>
              )}

              {rotateMode === 'new' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-linen-secondary leading-relaxed">
                    Your new code. Read it to your partner, then switch. Anything already on this
                    device stays; messages sent under the old code stop arriving once you both move.
                  </p>
                  <div className="font-mono text-sm font-bold text-linen-primary text-center bg-linen-surface border border-linen-border rounded-lg py-2">
                    {rotateCode}
                  </div>
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      onClick={() => applyRotation(rotateCode)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-linen-primary text-linen-surface text-[11px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Switch to this code
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotateMode('idle')}
                      className="px-2.5 py-1.5 rounded-lg border border-linen-border text-linen-secondary text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRotateMode('join')}
                    className="w-full text-[11px] text-linen-secondary hover:text-linen-primary transition-colors cursor-pointer"
                  >
                    My partner gave me the new code instead
                  </button>
                </div>
              )}

              {rotateMode === 'join' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-linen-secondary">Enter the new code your partner read out.</p>
                  <input
                    type="text"
                    value={joinRotation}
                    onChange={(e) => setJoinRotation(e.target.value)}
                    placeholder="TWO-XXXX-XXXX-XXXX"
                    className="w-full px-3 py-2 rounded-lg border border-linen-border bg-linen-surface font-mono text-sm text-linen-primary"
                  />
                  <input
                    type="text"
                    value={rotationPhrase}
                    onChange={(e) => setRotationPhrase(e.target.value)}
                    placeholder="spoken phrase, if they gave you one"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`w-full px-3 py-2 rounded-lg border bg-linen-surface font-mono text-sm text-linen-primary ${
                      rotationPhrase.trim() && rotationPhraseCheck.unknown.length > 0
                        ? 'border-rose-400'
                        : 'border-linen-border'
                    }`}
                  />
                  {rotationPhrase.trim() && rotationPhraseCheck.unknown.length > 0 && (
                    <p className="text-[11px] text-rose-600">
                      Not one of the words:{' '}
                      <span className="font-mono font-semibold">
                        {rotationPhraseCheck.unknown.join(', ')}
                      </span>
                    </p>
                  )}
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      disabled={
                        !isPlausiblePairingCode(joinRotation) ||
                        (!!rotationPhrase.trim() && !rotationPhraseCheck.complete)
                      }
                      onClick={() =>
                        applyRotation(
                          joinRotation,
                          rotationPhraseCheck.complete ? rotationPhraseCheck.words.join(' ') : undefined
                        )
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-linen-primary text-linen-surface text-[11px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                    >
                      Switch to this code
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotateMode('idle')}
                      className="px-2.5 py-1.5 rounded-lg border border-linen-border text-linen-secondary text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center text-linen-secondary">
            <span>Linked Sanctuary:</span>
            <strong className="text-linen-primary font-medium">
              {state.userName || 'You'} &amp; {state.partnerName || 'Partner'}
            </strong>
          </div>

          <div className="flex justify-between items-center text-linen-secondary">
            <span>Your Device Role:</span>
            <div className="flex items-center space-x-2">
              <span className="text-linen-primary font-medium">
                {state.activeUser === 'user' ? 'Creator Device' : 'Partner Device'}
              </span>
              <button
                type="button"
                onClick={onToggleActiveUser}
                title="Switch device role if both devices are accidentally set to the same role"
                className="px-2 py-0.5 rounded-md border border-linen-border bg-linen-surface hover:bg-linen-variant text-[10px] text-linen-accent font-medium flex items-center transition-colors cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5 mr-1" />
                Switch Role
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center text-linen-secondary">
            <span>App Lock:</span>
            <span className="text-linen-primary font-medium">
              {state.pinEnabled ? 'Protected with 4-Digit PIN' : 'Instant Open (No PIN)'}
            </span>
          </div>

          <div className="flex justify-between items-center text-linen-secondary">
            <span>Encrypted Relay:</span>
            <span className="font-mono text-[10px] text-linen-primary">wss://twoapp-tfj8.onrender.com/relay</span>
          </div>
        </div>

        <p className="text-xs text-linen-secondary leading-relaxed">
          Need to switch to a different link code or reconnect? Unpairing returns you to the welcome setup without wiping your local history.
        </p>

        <button
          onClick={onUnpair}
          className="inline-flex items-center px-3.5 py-2 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
          Unpair / Reconnect Space
        </button>

      </div>

      {/* Language & Locale Picker */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Globe className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.languageTitle}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {languages.map(lang => (
            <button
              key={lang.id}
              onClick={() => onSelectLocale(lang.id)}
              className={`p-3 rounded-xl border text-left transition-all flex items-center space-x-2.5 ${
                currentLocale === lang.id
                  ? 'border-linen-primary ring-2 ring-linen-primary/20 bg-linen-variant/70 font-semibold'
                  : 'border-linen-border hover:bg-linen-variant/40'
              }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <div>
                <div className="text-xs text-linen-primary font-medium">{lang.nativeName}</div>
                <div className="text-[10px] text-linen-secondary">{lang.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Theme Picker */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Palette className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.themeTitle}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {themes.map(tItem => (
            <button
              key={tItem.id}
              onClick={() => onSelectTheme(tItem.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                currentTheme === tItem.id
                  ? 'border-linen-primary ring-2 ring-linen-primary/20 bg-linen-variant/60'
                  : 'border-linen-border hover:bg-linen-variant/30'
              }`}
            >
              <div className={`w-6 h-6 rounded-md border border-linen-border ${tItem.bg} mb-2`} />
              <div className="font-medium text-xs text-linen-primary">{tItem.name}</div>
              <div className="text-[10px] text-linen-secondary mt-0.5">{tItem.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Camouflage / Decoy Mode (Discreet Calculator) */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Calculator className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.camouflageTitle}</span>
        </div>
        <p className="text-xs text-linen-secondary leading-relaxed">
          {t.settings.camouflageDesc} When active, Two looks and behaves identically to a genuine working calculator.
        </p>

        {/* Custom Unlock Code Input */}
        <div className="pt-1 space-y-2">
          <label className="block text-xs font-semibold text-linen-primary">
            Calculator Unlock Code
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={decoyCodeInput}
              onChange={(e) => {
                setDecoyCodeInput(e.target.value);
                setDecoySaved(false);
              }}
              placeholder="e.g. 142.85 or 2024"
              className="max-w-[180px] px-3 py-2 text-xs font-mono rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-1 focus:ring-linen-primary"
            />
            <button
              onClick={() => {
                const trimmed = decoyCodeInput.trim() || '142.85';
                if (onUpdateDecoyCode) onUpdateDecoyCode(trimmed);
                setDecoySaved(true);
                setTimeout(() => setDecoySaved(false), 2000);
              }}
              className="px-3 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity flex items-center"
            >
              {decoySaved ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" /> : null}
              <span>{decoySaved ? 'Saved' : 'Save Code'}</span>
            </button>
          </div>
          <p className="text-[11px] text-linen-secondary">
            Type this sequence into the calculator and press <span className="font-mono font-bold text-linen-primary">=</span> to return to your sanctuary.
          </p>
        </div>

        {/* Open straight to the calculator */}
        {onToggleDecoyOnLaunch && (
          <div className="pt-2 border-t border-linen-border/60 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-medium text-linen-primary block">
                Always open to the calculator
              </span>
              <p className="text-[11px] text-linen-secondary leading-normal">
                Two opens as a calculator every time, until you type the code above.
                Applies to the installed app only &mdash; a browser gives itself away
                by its address and history whatever is on screen.
              </p>
              <p className="text-[11px] text-linen-secondary/80 leading-normal pt-1">
                Forgotten the code? Press and hold the calculator&rsquo;s display for
                five seconds.
              </p>
            </div>
            <button
              onClick={() => onToggleDecoyOnLaunch(!decoyOnLaunch)}
              aria-pressed={decoyOnLaunch}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                decoyOnLaunch ? 'bg-linen-primary' : 'bg-linen-border'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  decoyOnLaunch ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* Auto-Camouflage on Tab Blur / App Switch */}
        {onToggleAutoCamouflage && (
          <div className="pt-2 border-t border-linen-border/60 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-medium text-linen-primary block">
                Auto-Camouflage on App Switch
              </span>
              <p className="text-[11px] text-linen-secondary leading-normal">
                Immediately disguise as the calculator whenever you switch apps or leave this browser tab.
              </p>
            </div>
            <button
              onClick={() => onToggleAutoCamouflage(!autoCamouflageOnBlur)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                autoCamouflageOnBlur ? 'bg-linen-primary' : 'bg-linen-border'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  autoCamouflageOnBlur ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* Manual Camouflage Trigger Button */}
        <div className="pt-2">
          <button
            onClick={onToggleCamouflage}
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          >
            <Calculator className="w-3.5 h-3.5 mr-2 text-linen-accent" />
            {t.settings.engageCamouflage}
          </button>
        </div>
      </div>

      {/* Cloud Relay Server (Internet Sync) */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Globe className="w-4 h-4 text-linen-accent" />
          <span>Cloud Relay Server (Sync Over Internet)</span>
        </div>
        <p className="text-xs text-linen-secondary leading-relaxed">
          Set your deployed relay address (e.g. Render, Railway, or Cloudflare Tunnel) to sync with your partner across mobile data and the internet.
        </p>
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            placeholder="https://your-relay.onrender.com"
            value={relayInput}
            onChange={(e) => setRelayInput(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-1 focus:ring-linen-primary"
          />
          <button
            onClick={handleSaveRelay}
            className="px-3 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>

      {/* Dual-Window Live Sync Demonstration */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <ExternalLink className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.dualWindowTitle}</span>
        </div>
        <p className="text-xs text-linen-secondary leading-relaxed">
          {t.settings.dualWindowDesc}
        </p>
        <div className="pt-1">
          <button
            onClick={handleOpenPartnerWindow}
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2 text-linen-accent" />
            {t.settings.openDualWindow}
          </button>
        </div>
      </div>

      {/* Sovereign Encrypted Vault Backup (.two-vault) */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <KeyRound className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.vaultTitle}</span>
        </div>
        <p className="text-xs text-linen-secondary leading-relaxed">
          {t.settings.vaultDesc}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setShowVaultModal(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            {t.actions.vaultBackup}
          </button>
        </div>
      </div>

      {/* Consent Audit Log */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Shield className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.auditTitle}</span>
        </div>
        <p className="text-xs text-linen-secondary">
          {t.settings.auditDesc}
        </p>
        <div className="space-y-2">
          {state.consentLogs.map(log => (
            <div key={log.id} className="p-3 rounded-xl border border-linen-border/60 bg-linen-variant/30 text-xs flex items-center justify-between">
              <div>
                <span className="font-medium text-linen-primary uppercase tracking-wider text-[10px] block text-linen-accent">
                  {log.kind} • {log.action}
                </span>
                <span className="text-linen-secondary">{log.details}</span>
              </div>
              <span className="text-[10px] text-linen-secondary">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Export (Unencrypted JSON) */}
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Download className="w-4 h-4 text-linen-accent" />
          <span>Raw Structured Data Export</span>
        </div>
        <p className="text-xs text-linen-secondary">
          Download your entire space history unencrypted as a plain JSON file for personal archival.
        </p>
        <button
          onClick={handleExportData}
          className="inline-flex items-center px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          {t.actions.exportData}
        </button>
      </div>

      {/* Exit-Safe Emergency Wipe */}
      <div className="p-6 rounded-2xl border border-red-200 bg-red-50/50 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-red-900">
          <Lock className="w-4 h-4 text-red-700" />
          <span>{t.settings.wipeTitle}</span>
        </div>
        <p className="text-xs text-red-800/80 leading-relaxed">
          {t.settings.wipeDesc}
        </p>
        <button
          onClick={() => setShowWipeConfirm(true)}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
        >
          {t.actions.wipeDevice}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-serif text-lg font-medium text-linen-primary">Confirm Immediate Device Wipe?</h3>
            <p className="text-xs text-linen-secondary leading-relaxed">
              This will permanently delete all local keys and stored records on this machine.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowWipeConfirm(false)}
                className="px-3 py-1.5 text-xs text-linen-secondary hover:text-linen-primary"
              >
                {t.actions.cancel}
              </button>
              <button
                onClick={() => {
                  setShowWipeConfirm(false);
                  onEmergencyWipe();
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-medium"
              >
                {t.settings.wipeConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Backup & Restore Modal */}
      <VaultBackupModal
        isOpen={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        state={state}
        onRestoreState={(restored) => {
          onRestoreState(restored);
        }}
      />
    </div>
  );
};
