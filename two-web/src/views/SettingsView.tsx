import React, { useState } from 'react';
import { SpaceState } from '../core/storage';
import { ThemeMode } from '../types';
import { Locale, getTranslation } from '../core/i18n';
import { VaultBackupModal } from '../components/VaultBackupModal';
import { Shield, Download, Trash2, Palette, Lock, KeyRound, Globe, Calculator, ExternalLink } from 'lucide-react';

interface SettingsViewProps {
  state: SpaceState;
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  onEmergencyWipe: () => void;
  onRestoreState?: (restoredState: SpaceState) => void;
  currentLocale?: Locale;
  onSelectLocale?: (locale: Locale) => void;
  onToggleCamouflage?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  currentTheme,
  onSelectTheme,
  onEmergencyWipe,
  onRestoreState = () => {},
  currentLocale = 'en',
  onSelectLocale = () => {},
  onToggleCamouflage = () => {}
}) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);

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
      <div className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-linen-primary">
          <Calculator className="w-4 h-4 text-linen-accent" />
          <span>{t.settings.camouflageTitle}</span>
        </div>
        <p className="text-xs text-linen-secondary leading-relaxed">
          {t.settings.camouflageDesc}
        </p>
        <div className="pt-1">
          <button
            onClick={onToggleCamouflage}
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 mr-2 text-linen-accent" />
            {t.settings.engageCamouflage}
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
