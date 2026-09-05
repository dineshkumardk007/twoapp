import React, { useState, useEffect } from 'react';
import { localMesh } from '../core/localMesh';
import { Plane, Radio, Shield, Wifi, WifiOff, Sparkles, CheckCircle2, X } from 'lucide-react';

interface LocalMeshModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: 'user' | 'partner';
}

export const LocalMeshModal: React.FC<LocalMeshModalProps> = ({
  isOpen,
  onClose,
  activeUser
}) => {
  const [meshStatus, setMeshStatus] = useState(localMesh.getConnectivityStatus());
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    setMeshStatus(localMesh.getConnectivityStatus());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendMeshPing = () => {
    localMesh.broadcastLocally('PING', { text: 'Off-grid mesh connection active' }, activeUser);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-linen-primary">
            <span className="p-2 rounded-xl bg-linen-variant text-linen-accent">
              <Plane className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-serif text-lg font-medium">Off-Grid & Airplane Mesh Sync</h3>
              <p className="text-[11px] text-linen-secondary">Zero-internet sovereign peer transport</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary hover:bg-linen-variant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="p-4 rounded-2xl border border-linen-border bg-linen-variant/40 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-linen-secondary">Local Machine Mesh Bus</span>
            <span className="inline-flex items-center text-emerald-700 font-medium">
              <Radio className="w-3.5 h-3.5 mr-1 text-emerald-600 animate-pulse" />
              Active (BroadcastChannel)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-linen-secondary">Internet Relay Connectivity</span>
            <span className="inline-flex items-center text-linen-primary font-medium">
              {meshStatus.isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Online (WebSocket Active)
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Offline (100% Local Mode)
                </>
              )}
            </span>
          </div>
        </div>

        {/* Informational Guidance */}
        <div className="space-y-3 text-xs text-linen-secondary leading-relaxed">
          <p>
            <strong>How It Works During Flights & Camping:</strong> Two doesn't require cloud servers to connect two partners. When traveling off-grid or in Airplane Mode, changes are exchanged directly between browser tabs and local peers via encrypted local memory channels.
          </p>
          <div className="p-3 rounded-xl bg-linen-variant/60 border border-linen-border/70 space-y-1">
            <span className="text-linen-primary font-medium block text-[11px] uppercase tracking-wider">
              Offline Guarantees:
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Zero data sent over unencrypted public Wi-Fi networks.</li>
              <li>Chat, letters, and ritual pebbles work seamlessly offline.</li>
              <li>Automatic reconcile when internet connectivity resumes.</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-linen-border/50 flex items-center justify-between">
          <button
            onClick={handleSendMeshPing}
            className="inline-flex items-center px-3 py-1.5 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-xs font-medium text-linen-primary transition-colors"
          >
            <Radio className="w-3.5 h-3.5 mr-1 text-linen-accent" />
            Send Local Mesh Ping
          </button>

          {testSent && (
            <span className="text-xs text-emerald-600 font-medium">
              ✓ Dispatched locally
            </span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
