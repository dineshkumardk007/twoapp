import React, { useState, useEffect } from 'react';
import { computeSafetyNumber } from '../core/crypto';
import {
  generatePairingCode,
  normalizePairingCode,
  isPlausiblePairingCode,
  SpaceSession
} from '../core/space';
import { CheckCircle2, ArrowRight, Copy, Check, Link2, UserPlus, Heart, Shield, Clipboard, Share2, Sparkles } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: (session: SpaceSession) => void;
}

type Step = 1 | 2;
type PairMode = 'choose' | 'create' | 'join';

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [pairMode, setPairMode] = useState<PairMode>('choose');
  const [createdCode, setCreatedCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [safetyInfo, setSafetyInfo] = useState<{ words: string[]; emojis: string; hexDisplay: string } | null>(null);
  const [session, setSession] = useState<SpaceSession | null>(null);

  // Compute safety emojis/words once session is initialized
  useEffect(() => {
    if (!session) return;
    computeSafetyNumber(session.code, session.code).then(setSafetyInfo);
  }, [session]);

  const beginCreate = () => {
    const code = createdCode || generatePairingCode();
    setCreatedCode(code);
    setPairMode('create');
  };

  const confirmCreate = () => {
    setSession({ code: createdCode, role: 'user' });
    setStep(2);
  };

  const confirmJoin = () => {
    if (!isPlausiblePairingCode(joinCode)) return;
    setSession({ code: normalizePairingCode(joinCode), role: 'partner' });
    setStep(2);
  };

  const startSoloDemo = () => {
    const demoCode = 'velvet-ocean-ember-whisper-forest-meadow-starlight-harbor';
    onComplete({ code: demoCode, role: 'user' });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join our space on Two',
          text: `Here are our private pairing words for Two: ${createdCode}`,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setJoinCode(text.trim());
      }
    } catch {
      // clipboard access denied
    }
  };

  return (
    <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 shadow-sm">
        
        {/* Step 1: Connect / Pair */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-linen-variant border border-linen-border text-linen-accent mb-1 shadow-xs">
                <Heart className="w-6 h-6 fill-linen-accent/20 text-linen-accent" />
              </div>
              <h1 className="font-serif text-2xl font-medium text-linen-primary">Two-Person Sanctuary</h1>
              <p className="text-xs text-linen-secondary max-w-sm mx-auto leading-relaxed">
                A private, zero-knowledge sanctuary just for the two of you. Everything is end-to-end encrypted directly between your two devices.
              </p>
            </div>

            {pairMode === 'choose' && (
              <div className="space-y-3 pt-2">
                <button
                  onClick={beginCreate}
                  className="w-full py-4 px-5 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 transition-all flex items-center shadow-xs cursor-pointer"
                >
                  <Link2 className="w-5 h-5 mr-3.5 shrink-0 text-linen-accent" />
                  <span className="text-left leading-tight">
                    <span className="block text-sm font-semibold">Create our space</span>
                    <span className="block text-xs opacity-80 font-normal mt-0.5">I will share 8 pairing words with my partner</span>
                  </span>
                </button>

                <button
                  onClick={() => setPairMode('join')}
                  className="w-full py-4 px-5 bg-linen-variant/70 text-linen-primary font-medium rounded-2xl border border-linen-border hover:bg-linen-variant transition-all flex items-center shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-5 h-5 mr-3.5 shrink-0 text-linen-accent" />
                  <span className="text-left leading-tight">
                    <span className="block text-sm font-semibold">Join my partner’s space</span>
                    <span className="block text-xs text-linen-secondary font-normal mt-0.5">My partner already has the 8 words</span>
                  </span>
                </button>

                <div className="pt-4 border-t border-linen-border/60 text-center">
                  <button
                    onClick={startSoloDemo}
                    className="text-[11px] text-linen-secondary hover:text-linen-primary transition-colors inline-flex items-center"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-linen-accent" />
                    Testing without a second device? Explore Solo Demo Mode
                  </button>
                </div>
              </div>
            )}

            {pairMode === 'create' && (
              <div className="space-y-4">
                <div className="bg-linen-variant/60 rounded-2xl border border-linen-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
                      Your 8 Pairing Words
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={handleCopy}
                        className="text-xs px-2 py-1 rounded-lg bg-linen-surface border border-linen-border text-linen-primary hover:bg-linen-variant transition-colors flex items-center"
                      >
                        {copied ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={handleShare}
                        className="text-xs px-2 py-1 rounded-lg bg-linen-surface border border-linen-border text-linen-primary hover:bg-linen-variant transition-colors flex items-center"
                      >
                        <Share2 className="w-3 h-3 mr-1" />
                        Share
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {createdCode.split('-').map((w, idx) => (
                      <span
                        key={idx}
                        className="bg-linen-surface py-2 px-3 rounded-xl border border-linen-border text-xs font-medium text-linen-primary text-center shadow-xs"
                      >
                        <span className="text-[10px] text-linen-secondary block mb-0.5">{idx + 1}</span>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-linen-secondary leading-relaxed text-center px-2">
                  Share these words with your partner. When they enter them, your private end-to-end encrypted room will open automatically.
                </p>

                <button
                  onClick={confirmCreate}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  <span>My partner has entered the words</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>

                <button
                  onClick={() => setPairMode('choose')}
                  className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors text-center py-1 cursor-pointer"
                >
                  Back
                </button>
              </div>
            )}

            {pairMode === 'join' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-linen-accent">
                      Enter Pairing Words
                    </label>
                    <button
                      onClick={handlePaste}
                      className="text-xs text-linen-secondary hover:text-linen-primary flex items-center transition-colors"
                    >
                      <Clipboard className="w-3 h-3 mr-1" />
                      Paste from Clipboard
                    </button>
                  </div>
                  <textarea
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    rows={3}
                    placeholder="e.g. rabbit ocean velvet harbor..."
                    className="w-full px-4 py-3 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-sm resize-none"
                  />
                  <div className="flex items-center justify-between text-xs text-linen-secondary">
                    <span>{normalizePairingCode(joinCode).split('-').filter(Boolean).length} of 8 words entered</span>
                    {isPlausiblePairingCode(joinCode) && (
                      <span className="text-emerald-600 font-medium flex items-center">
                        <Check className="w-3 h-3 mr-0.5" /> 8 words ready
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={confirmJoin}
                  disabled={!isPlausiblePairingCode(joinCode)}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  <span>Connect to our space</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>

                <button
                  onClick={() => setPairMode('choose')}
                  className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors text-center py-1 cursor-pointer"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Safety Verification */}
        {step === 2 && session && (
          <div className="space-y-6 text-center">
            <div className="space-y-1">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-linen-variant border border-linen-border text-linen-accent mb-1 shadow-xs">
                <Shield className="w-5 h-5 text-linen-accent" />
              </div>
              <h2 className="font-serif text-2xl font-medium text-linen-primary">Safety Verification</h2>
              <p className="text-xs text-linen-secondary leading-relaxed max-w-sm mx-auto">
                Compare these symbols with your partner’s screen. They only match when both phones hold the exact same cryptographic key.
              </p>
            </div>

            {!safetyInfo ? (
              <p className="text-xs text-linen-secondary py-8">Deriving zero-knowledge encryption key…</p>
            ) : (
              <div className="space-y-4">
                <div className="py-4 bg-linen-variant/60 rounded-2xl border border-linen-border">
                  <div className="text-3xl tracking-widest mb-1.5">{safetyInfo.emojis}</div>
                  <p className="text-[11px] text-linen-secondary font-medium">Visual Emoji Fingerprint</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px] text-linen-secondary">
                  {safetyInfo.words.map((w, idx) => (
                    <span key={idx} className="bg-linen-surface py-1.5 rounded-lg border border-linen-border font-medium text-linen-primary shadow-2xs">
                      {idx + 1}. {w}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onComplete(session)}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-300" />
                  <span>These Match — Enter Our Space</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setStep(1)}
              className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors cursor-pointer"
            >
              They don’t match — go back
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
