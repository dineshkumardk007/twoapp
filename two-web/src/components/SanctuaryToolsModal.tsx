import React from 'react';
import { 
  X, Moon, Wind, Heart, Radio, Calculator, Shield, LogOut, 
  Sparkles, Check, Compass, Wifi, EyeOff, Activity 
} from 'lucide-react';

interface SanctuaryToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSoundscapes: () => void;
  onOpenCoRegulation: () => void;
  onTriggerPulse?: () => void;
  onOpenHeartModal?: () => void;
  onToggleCamouflage?: () => void;
  onOpenMesh: () => void;
  onOpenSafetyNumbers: () => void;
  onEmergencyExit: () => void;
  /** Opens the five-act walkthrough. Absent on surfaces that cannot show it. */
  onOpenStoryTour?: () => void;
  relayStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  activeUser: 'user' | 'partner';
  vaultName?: string;
  /** True only when the partner's device is in the space right now. */
  partnerOnline?: boolean;
}

export const SanctuaryToolsModal: React.FC<SanctuaryToolsModalProps> = ({
  isOpen,
  onClose,
  onOpenSoundscapes,
  onOpenCoRegulation,
  onTriggerPulse,
  onOpenHeartModal,
  onToggleCamouflage,
  onOpenMesh,
  onOpenSafetyNumbers,
  onEmergencyExit,
  onOpenStoryTour,
  relayStatus = 'connected',
  activeUser,
  vaultName = '',
  partnerOnline = false
}) => {
  if (!isOpen) return null;

  const tools = [
    {
      id: 'soundscapes',
      title: 'Fall Asleep Together',
      subtitle: 'Ambient Night Soundscapes & Sleep Timer',
      desc: 'Synchronized procedural rain, ocean waves, fireplace & forest canopy acoustics with auto-fade sleep timer.',
      icon: Moon,
      iconColor: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      actionText: 'Open Soundscapes',
      action: () => {
        onClose();
        onOpenSoundscapes();
      }
    },
    {
      id: 'coregulation',
      title: 'Co-Regulation Sanctuary',
      subtitle: 'Synchronized 4-7-8 Breathing & Somatic Calm',
      desc: 'Calm the nervous system together with guided breathing, harmonic drones, and tactile haptic pacing.',
      icon: Wind,
      iconColor: 'text-teal-600 bg-teal-50 border-teal-200',
      actionText: 'Start Breathing',
      action: () => {
        onClose();
        onOpenCoRegulation();
      }
    },
    {
      id: 'pulse',
      title: 'Sensory Heart Pulse & Options',
      subtitle: 'Instant Touch, Hugs, Kisses & Notes',
      desc: 'Send wordless touches, warm hugs, gentle kisses, synchronized heartbeats, and custom notes directly to your partner.',
      icon: Heart,
      iconColor: 'text-rose-500 bg-rose-50 border-rose-200',
      actionText: 'Heart Options',
      action: () => {
        onClose();
        if (onOpenHeartModal) {
          onOpenHeartModal();
        } else if (onTriggerPulse) {
          onTriggerPulse();
        }
      }
    },
    {
      id: 'camouflage',
      title: 'Discreet Camouflage',
      subtitle: 'Decoy Functional Calculator',
      desc: 'Instantly disguises Two into a real working calculator. Unlock anytime with your secret passcode.',
      icon: Calculator,
      iconColor: 'text-neutral-700 bg-neutral-100 border-neutral-300',
      actionText: 'Engage Calculator',
      action: () => {
        onClose();
        if (onToggleCamouflage) onToggleCamouflage();
      }
    },
    {
      id: 'mesh',
      title: 'Off-Grid Local Mesh',
      subtitle: 'Encrypted Sync Over Local Wi-Fi & Hotspot',
      desc: 'Sync letters, gratitude stars, and recipes directly between devices even when mobile internet is down.',
      icon: Radio,
      iconColor: 'text-sky-600 bg-sky-50 border-sky-200',
      actionText: 'Mesh Status',
      action: () => {
        onClose();
        onOpenMesh();
      }
    },
    {
      id: 'safety',
      title: 'Cryptographic Safety Numbers',
      subtitle: 'Zero-Knowledge Pairing & Verification',
      desc: 'Verify safety fingerprints, QR codes, and confirm that no third party can ever intercept your space.',
      icon: Shield,
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      actionText: 'Verify Encryption',
      action: () => {
        onClose();
        onOpenSafetyNumbers();
      }
    },
    // Kept here because the home screen only offers the tour on a first run,
    // and the app has no header button for it. Without this the walkthrough
    // would be unreachable forever the moment that card was dismissed.
    ...(onOpenStoryTour
      ? [{
          id: 'tour',
          title: 'Interactive Story Tour',
          subtitle: 'A Day in the Life with Two - 5-Act Walkthrough',
          desc: 'Walk through a full day in the sanctuary, act by act, to see how the spaces fit together.',
          icon: Sparkles,
          iconColor: 'text-amber-600 bg-amber-50 border-amber-200',
          actionText: 'Start Tour',
          action: () => {
            onClose();
            onOpenStoryTour();
          }
        }]
      : []),
    {
      id: 'wipe',
      title: 'Emergency Exit',
      subtitle: 'Immediate Local Key & Session Wipe',
      desc: 'Safely clear the active session and return to welcome lock screen in one tap.',
      icon: LogOut,
      iconColor: 'text-red-600 bg-red-50 border-red-200',
      actionText: 'Emergency Wipe',
      isDanger: true,
      action: () => {
        onClose();
        onEmergencyExit();
      }
    }
  ];

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-linen-surface border border-linen-border rounded-3xl w-full max-w-lg max-h-[82dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-linen-border flex items-center justify-between bg-gradient-to-r from-linen-variant/60 via-linen-surface to-linen-variant/40 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-linen-primary text-linen-surface flex items-center justify-center shadow-xs shrink-0">
              <Compass className="w-5 h-5 text-linen-surface" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-linen-primary">
                  Sanctuary Tools
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-linen-variant text-linen-accent border border-linen-border">
                  Quick Access
                </span>
              </div>
              <p className="text-xs text-linen-secondary mt-0.5">
                Soundscapes, Co-Regulation, Sensory Touch & Privacy Controls
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Relay Status Strip */}
        <div className="px-4 sm:px-5 py-2 bg-linen-variant/40 border-b border-linen-border/60 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                relayStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="font-medium text-linen-primary text-xs">
              {relayStatus === 'connected'
                ? `${vaultName || 'Two'} • ${partnerOnline ? 'together' : 'synced'}`
                : 'Connecting to Relay...'}
            </span>
          </div>
          <span className="text-[11px] text-linen-secondary font-mono">
            Role: {activeUser === 'user' ? 'Creator (You)' : 'Partner'}
          </span>
        </div>

        {/* Scrollable Tools List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 min-h-0 scrollbar-none">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={tool.action}
                className="group p-3 sm:p-3.5 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className={`p-2.5 rounded-xl border shrink-0 transition-transform group-hover:scale-105 ${tool.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-linen-primary truncate">
                      {tool.title}
                    </h4>
                    <p className="text-xs text-linen-accent truncate">
                      {tool.subtitle}
                    </p>
                    <p className="text-xs text-linen-secondary line-clamp-1 mt-0.5">
                      {tool.desc}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      tool.action();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      tool.isDanger
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                        : 'bg-linen-primary text-linen-surface hover:opacity-90 shadow-2xs'
                    }`}
                  >
                    {tool.actionText} →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-linen-border/60 bg-linen-variant/20 flex items-center justify-between text-xs text-linen-secondary shrink-0">
          <span className="text-[11px] truncate">End-to-end encrypted locally.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary font-medium transition-colors cursor-pointer text-xs shadow-2xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
