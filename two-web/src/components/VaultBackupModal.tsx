import React, { useState } from 'react';
import { SpaceState } from '../core/storage';
import { exportVault, importVault, downloadVaultFile } from '../core/vaultExport';
import { X, Shield, Download, Upload, Key, CheckCircle, AlertTriangle, FileArchive } from 'lucide-react';

interface VaultBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SpaceState;
  onRestoreState: (restoredState: SpaceState) => void;
}

export const VaultBackupModal: React.FC<VaultBackupModalProps> = ({
  isOpen,
  onClose,
  state,
  onRestoreState
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (passphrase.length < 8) {
      setErrorMessage('Passphrase must be at least 8 characters long for cryptographic security.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setErrorMessage('Passphrases do not match.');
      return;
    }

    setIsProcessing(true);
    try {
      const vaultJson = await exportVault(state, passphrase);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadVaultFile(vaultJson, `two-vault-${dateStr}.two-vault`);
      setSuccessMessage('Encrypted vault exported and downloaded successfully!');
      setPassphrase('');
      setConfirmPassphrase('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Export failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFileName(file.name);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportFileContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!importFileContent) {
      setErrorMessage('Please select a .two-vault file first.');
      return;
    }
    if (!importPassphrase) {
      setErrorMessage('Please enter the vault decryption passphrase.');
      return;
    }

    setIsProcessing(true);
    try {
      const restored = await importVault(importFileContent, importPassphrase);
      onRestoreState(restored);
      setSuccessMessage('Vault successfully decrypted and restored! All memories and records are recovered.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Decryption failed. Please verify your passphrase.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-linen-surface border border-linen-border shadow-xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-linen-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-linen-variant text-linen-accent">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-linen-primary">Encrypted Vault Backup</h3>
              <p className="text-xs text-linen-secondary">Sovereign offline data protection (.two-vault)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-linen-secondary hover:text-linen-primary hover:bg-linen-variant rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 my-5">
          <button
            onClick={() => { setActiveTab('export'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`py-2 text-xs font-medium rounded-xl border transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'export'
                ? 'bg-linen-primary text-linen-surface border-linen-primary shadow-xs'
                : 'bg-linen-surface text-linen-secondary border-linen-border hover:bg-linen-variant'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>
          <button
            onClick={() => { setActiveTab('import'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`py-2 text-xs font-medium rounded-xl border transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'import'
                ? 'bg-linen-primary text-linen-surface border-linen-primary shadow-xs'
                : 'bg-linen-surface text-linen-secondary border-linen-border hover:bg-linen-variant'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore From File</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'export' ? (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-linen-variant/40 border border-linen-border text-linen-secondary space-y-1">
              <p className="font-medium text-linen-primary">What gets backed up:</p>
              <p>• {state.messages.length} encrypted chat messages</p>
              <p>• {state.journalEntries.length} journal reflections</p>
              <p>• {state.agreements.length} conflict repair agreements</p>
              <p>• Lists ({state.lists.length}), Mental Load Chores ({state.chores.length}), Shared Tab ({state.expenses.length})</p>
            </div>

            <div>
              <label className="block font-medium text-linen-primary mb-1">Set Vault Backup Passphrase</label>
              <div className="relative">
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-linen-border bg-linen-surface focus:outline-none focus:ring-1 focus:ring-linen-accent"
                />
                <Key className="w-4 h-4 text-linen-secondary absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block font-medium text-linen-primary mb-1">Confirm Passphrase</label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Re-enter your passphrase..."
                className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-surface focus:outline-none focus:ring-1 focus:ring-linen-accent"
              />
            </div>

            <button
              onClick={handleExport}
              disabled={isProcessing || !passphrase}
              className="w-full py-2.5 rounded-xl bg-linen-primary text-linen-surface font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>{isProcessing ? 'Sealing & Encrypting...' : 'Export & Download .two-vault'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-linen-primary mb-1.5">Select .two-vault File</label>
              <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-linen-border bg-linen-variant/20 hover:bg-linen-variant/40 cursor-pointer transition-colors">
                <FileArchive className="w-6 h-6 text-linen-secondary mb-1" />
                <span className="text-linen-primary font-medium">
                  {importFileName || 'Click to select .two-vault backup file'}
                </span>
                <span className="text-[10px] text-linen-secondary mt-0.5">Encrypted JSON backup file</span>
                <input
                  type="file"
                  accept=".two-vault,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block font-medium text-linen-primary mb-1">Enter Master Passphrase</label>
              <div className="relative">
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  placeholder="Passphrase used during export..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-linen-border bg-linen-surface focus:outline-none focus:ring-1 focus:ring-linen-accent"
                />
                <Key className="w-4 h-4 text-linen-secondary absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={isProcessing || !importFileContent || !importPassphrase}
              className="w-full py-2.5 rounded-xl bg-emerald-700 text-white font-medium hover:bg-emerald-800 disabled:opacity-40 transition-opacity flex items-center justify-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Decrypting Vault...' : 'Decrypt & Restore Space'}</span>
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
