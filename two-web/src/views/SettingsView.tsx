import React, { useState } from 'react';
import { generatePairingCode, normalizePairingCode, isPlausiblePairingCode } from '../core/space';
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
  /** Move this space to a freshly generated link code. */
  onRotateCode?: (code: string) => void;
  onToggleActiveUser?: () => void;
  decoyCode?: string;
  onUpdateDecoyCode?: (code: string) => void;
  autoCamouflageOnBlur?: boolean;
  onToggleAutoCamouflage?: (enabled: boolean) => void;
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
  onToggleActiveUser = () => {},
  decoyCode = '142.85',
  onUpdateDecoyCode,
  autoCamouflageOnBlur = false,
  onToggleAutoCamouflage
}) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [decoyCodeInput, setDecoyCodeInput] = useState(decoyCode);
  const [decoySaved, setDecoySaved] = useState(false);
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

  const beginRotation = () => {
    setRotateCode(generatePairingCode());
    setRotateMode('new');
  };

  const applyRotation = (code: string) => {
    const clean = normalizePairingCode(code);
    if (!isPlausiblePairingCode(clean)) return;
    onRotateCode(clean);
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
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      disabled={!isPlausiblePairingCode(joinRotation)}
                      onClick={() => applyRotation(joinRotation)}
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
