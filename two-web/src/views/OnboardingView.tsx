import React, { useState } from 'react';
import {
  generatePairingCode,
  normalizePairingCode,
  isPlausiblePairingCode,
  SpaceSession
} from '../core/space';
import { ArrowRight, Copy, Check, Link2, UserPlus, Heart, Lock, Clipboard, Share2, Sparkles, KeyRound } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: (session: SpaceSession, userName: string, appPin: string | null) => void;
}

type OnboardingStep = 'name' | 'pair' | 'pin';
type PairMode = 'choose' | 'create' | 'join';

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState<OnboardingStep>('name');
  const [userName, setUserName] = useState('');
  const [pairMode, setPairMode] = useState<PairMode>('choose');
  const [createdCode, setCreatedCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<SpaceSession | null>(null);
  const [pinInput, setPinInput] = useState('');

  const handleNameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userName.trim()) return;
    setStep('pair');
  };

  const beginCreate = () => {
    const code = createdCode || generatePairingCode();
    setCreatedCode(code);
    setPairMode('create');
  };

  const confirmCreate = () => {
    const newSession: SpaceSession = {
      code: createdCode,
      role: 'user',
      userName: userName.trim()
    };
    setSession(newSession);
    setStep('pin');
  };

  const confirmJoin = () => {
    if (!isPlausiblePairingCode(joinCode)) return;
    const newSession: SpaceSession = {
      code: normalizePairingCode(joinCode),
      role: 'partner',
      userName: userName.trim()
    };
    setSession(newSession);
    setStep('pin');
  };

  const handleFinish = (withPin: boolean) => {
    if (!session) return;
    const finalPin = withPin && pinInput.length === 4 ? pinInput : null;
    onComplete(session, userName.trim(), finalPin);
  };

  const startSoloDemo = () => {
    const demoCode = 'TWO-DEMO';
    onComplete(
      { code: demoCode, role: 'user', userName: userName.trim() || 'You' },
      userName.trim() || 'You',
      null
    );
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
    const text = `Hey, here is our link code for Two: ${createdCode}. Download or open the app and enter this code to connect!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Link our Two sanctuary',
          text
        });
        return;
      } catch {}
    }
    handleCopy();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setJoinCode(text.trim());
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 shadow-sm">
        
        {/* Step 1: Your Name (No login / account) */}
        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-500 mb-1 shadow-xs">
                <Heart className="w-7 h-7 fill-rose-500/20 text-rose-500" />
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary">Welcome to Two</h1>
              <p className="text-xs sm:text-sm text-linen-secondary max-w-sm mx-auto leading-relaxed">
                A private sanctuary built only for the two of you. Zero accounts, zero ads, zero passwords required.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-linen-accent block">
                What should your partner call you?
              </label>
              <input
                type="text"
                autoFocus
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name or nickname..."
                className="w-full px-4 py-3.5 rounded-2xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-base placeholder:text-linen-secondary/60"
                maxLength={30}
              />
            </div>

            <button
              type="submit"
              disabled={!userName.trim()}
              className="w-full py-4 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center shadow-xs cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </form>
        )}

        {/* Step 2: Link Together */}
        {step === 'pair' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="font-serif text-2xl font-medium text-linen-primary">
                Hi, {userName.trim()}!
              </h2>
              <p className="text-xs text-linen-secondary max-w-sm mx-auto">
                Connect your phone with your partner. Once linked, you will stay connected forever.
              </p>
            </div>

            {pairMode === 'choose' && (
              <div className="space-y-3 pt-2">
                <button
                  onClick={beginCreate}
                  className="w-full py-4 px-5 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 transition-all flex items-center shadow-xs cursor-pointer"
                >
                  <Link2 className="w-5 h-5 mr-3.5 shrink-0 text-linen-accent" />
                  <div className="text-left leading-tight">
                    <span className="block text-sm font-semibold">Create Our Link</span>
                    <span className="block text-xs opacity-80 font-normal mt-0.5">Generate a short code to send to your partner</span>
                  </div>
                </button>

                <button
                  onClick={() => setPairMode('join')}
                  className="w-full py-4 px-5 bg-linen-variant/70 text-linen-primary font-medium rounded-2xl border border-linen-border hover:bg-linen-variant transition-all flex items-center shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-5 h-5 mr-3.5 shrink-0 text-linen-accent" />
                  <div className="text-left leading-tight">
                    <span className="block text-sm font-semibold">I Have a Code</span>
                    <span className="block text-xs text-linen-secondary font-normal mt-0.5">My partner gave me a link code</span>
                  </div>
                </button>

                <div className="pt-4 border-t border-linen-border/60 text-center">
                  <button
                    onClick={startSoloDemo}
                    className="text-[11px] text-linen-secondary hover:text-linen-primary transition-colors inline-flex items-center cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-linen-accent" />
                    Testing solo? Explore Solo Preview
                  </button>
                </div>
              </div>
            )}

            {pairMode === 'create' && (
              <div className="space-y-4">
                <div className="bg-linen-variant/60 rounded-2xl border border-linen-border p-5 text-center space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent block">
                    Your Space Code
                  </span>
                  
                  <div className="font-mono text-3xl sm:text-4xl font-bold tracking-widest text-linen-primary py-2 px-4 rounded-xl bg-linen-surface border border-linen-border select-all">
                    {createdCode}
                  </div>

                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <button
                      onClick={handleCopy}
                      className="px-4 py-2 rounded-xl bg-linen-surface border border-linen-border text-xs font-medium text-linen-primary hover:bg-linen-variant transition-colors flex items-center shadow-2xs cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                      {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                    <button
                      onClick={handleShare}
                      className="px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity flex items-center shadow-2xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1.5" />
                      Send to Partner
                    </button>
                  </div>
                </div>

                <p className="text-xs text-linen-secondary leading-relaxed text-center px-3">
                  Send this code to your partner. Once they type it into their app, both of your devices will automatically lock into your shared sanctuary.
                </p>

                <button
                  onClick={confirmCreate}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  <span>Continue to Sanctuary</span>
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
                      Enter Partner’s Code
                    </label>
                    <button
                      onClick={handlePaste}
                      className="text-xs text-linen-secondary hover:text-linen-primary flex items-center transition-colors cursor-pointer"
                    >
                      <Clipboard className="w-3 h-3 mr-1" />
                      Paste
                    </button>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TWO-8492"
                    className="w-full px-4 py-3.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-lg font-mono text-center tracking-wider"
                  />
                  <p className="text-[11px] text-linen-secondary text-center">
                    Type or paste the code shown on your partner’s screen.
                  </p>
                </div>

                <button
                  onClick={confirmJoin}
                  disabled={!isPlausiblePairingCode(joinCode)}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  <span>Link Together Forever</span>
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

        {/* Step 3: Optional Private PIN Lock */}
        {step === 'pin' && (
          <div className="space-y-6 text-center">
            <div className="space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-linen-variant border border-linen-border text-linen-accent mb-1 shadow-xs">
                <Lock className="w-6 h-6 text-linen-accent" />
              </div>
              <h2 className="font-serif text-2xl font-medium text-linen-primary">Optional App Lock</h2>
              <p className="text-xs text-linen-secondary max-w-sm mx-auto leading-relaxed">
                Want to keep your messages private if a friend or family member holds your phone? You can set an optional 4-digit PIN.
              </p>
            </div>

            <div className="py-3 space-y-3">
              <div className="flex justify-center space-x-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-14 rounded-xl border flex items-center justify-center text-2xl font-mono transition-all ${
                      pinInput.length > idx
                        ? 'border-linen-primary bg-linen-variant font-bold text-linen-primary'
                        : 'border-linen-border bg-linen-surface text-linen-secondary/40'
                    }`}
                  >
                    {pinInput.length > idx ? '•' : ''}
                  </div>
                ))}
              </div>

              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="Type 4 digits or leave empty"
                className="w-full max-w-[220px] mx-auto px-3 py-2 text-center text-xs rounded-lg border border-linen-border bg-linen-variant/30 text-linen-primary"
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleFinish(pinInput.length === 4)}
                disabled={pinInput.length > 0 && pinInput.length < 4}
                className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center shadow-xs cursor-pointer"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                <span>{pinInput.length === 4 ? 'Set PIN & Enter Space' : 'Enter Without PIN'}</span>
              </button>

              {pinInput.length > 0 && (
                <button
                  onClick={() => handleFinish(false)}
                  className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors py-1 cursor-pointer"
                >
                  Skip PIN lock
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
