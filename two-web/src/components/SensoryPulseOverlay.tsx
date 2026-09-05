import React, { useEffect, useState, useCallback } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { wsRelay } from '../core/ws';

interface SensoryPulseOverlayProps {
  activeUser: 'user' | 'partner';
}

// Web Audio API acoustic synthesis (Warm 528Hz Solfeggio Love frequency harmonic)
function playGentleHarmonicChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Root 528Hz Oscillator
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now); // Solfeggio 528Hz "Transformation & Miracles"
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.1);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Sub-harmonic 264Hz warm lower octave
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(264, now);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.0);
    osc2.stop(now + 2.4);
  } catch (e) {
    // Graceful fallback if browser restricts audio autoplay
  }
}

export const SensoryPulseOverlay: React.FC<SensoryPulseOverlayProps> = ({ activeUser }) => {
  const [pulseActive, setPulseActive] = useState(false);
  const [pulseSender, setPulseSender] = useState<string>('partner');
  const [pulseNote, setPulseNote] = useState<string>('Thinking of you');

  const triggerPulseLocal = useCallback((sender: string, note?: string) => {
    setPulseSender(sender);
    setPulseNote(note || 'Thinking of you');
    setPulseActive(true);

    // Play tactile harmonic audio
    playGentleHarmonicChime();

    // Trigger mobile device haptic vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([60, 40, 60, 100, 80]);
      } catch (e) {
        // Haptic permission or unsupported
      }
    }

    // Auto-dismiss ripple after 3 seconds
    const timer = setTimeout(() => {
      setPulseActive(false);
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  // Listen for live remote PULSE updates from WebSocket
  useEffect(() => {
    const unsubscribe = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD' && msg.record?.type === 'PULSE') {
        try {
          const parsed = JSON.parse(msg.record.payload);
          const isFromOther = msg.record.authorId !== activeUser;
          if (isFromOther) {
            triggerPulseLocal('Partner', parsed.note);
          }
        } catch (e) {
          console.error('[Pulse parse error]', e);
        }
      }
    });

    return () => unsubscribe();
  }, [activeUser, triggerPulseLocal]);

  // Expose global trigger for local buttons
  useEffect(() => {
    (window as any).__triggerSensoryPulse = (note?: string) => {
      // Broadcast via WebSocket to remote partner
      wsRelay.broadcastUpdate('PULSE', { sender: activeUser, note });
      // Also show gentle feedback locally
      triggerPulseLocal(activeUser === 'user' ? 'You' : 'Partner', note || 'Sent warm pulse');
    };

    return () => {
      delete (window as any).__triggerSensoryPulse;
    };
  }, [activeUser, triggerPulseLocal]);

  if (!pulseActive) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Expanding Liquid Ripple Rings */}
      <div className="absolute w-40 h-40 rounded-full border-2 border-rose-300/40 bg-rose-400/5 animate-ping duration-1000" />
      <div className="absolute w-80 h-80 rounded-full border border-linen-accent/20 bg-linen-accent/5 animate-pulse duration-700" />
      <div className="absolute w-[500px] h-[500px] rounded-full border border-rose-200/20 pointer-events-none animate-ping duration-1500" />

      {/* Floating Center Sensory Card */}
      <div className="pointer-events-auto bg-linen-surface/95 backdrop-blur-md border border-linen-border rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-3 max-w-xs mx-4 animate-fade-in">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm animate-bounce">
            <Heart className="w-7 h-7 fill-rose-500 text-rose-500" />
          </div>
          <div className="absolute -top-1 -right-1 p-1 rounded-full bg-linen-variant text-linen-accent">
            <Sparkles className="w-3 h-3" />
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-linen-accent">
            Sensory Haptic Pulse
          </span>
          <h4 className="font-serif text-lg font-medium text-linen-primary mt-0.5">
            {pulseSender === 'You' ? 'You sent a warm touch' : `${pulseSender} is thinking of you`}
          </h4>
          <p className="text-xs text-linen-secondary mt-1 italic">
            "{pulseNote}"
          </p>
        </div>

        <div className="pt-2 border-t border-linen-border/50 w-full text-[10px] text-linen-secondary font-medium">
          A wordless presence across distance • No reply needed
        </div>
      </div>
    </div>
  );
};

export const triggerGlobalPulse = (note?: string) => {
  if (typeof window !== 'undefined' && (window as any).__triggerSensoryPulse) {
    (window as any).__triggerSensoryPulse(note);
  }
};
