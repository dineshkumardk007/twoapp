import React, { useState } from 'react';
import {
  generatePairingCode,
  normalizePairingCode,
  isPlausiblePairingCode,
  getLastSpaceCode,
  saveSpaceSession,
  loadSpaceSession,
  SpaceSession,
  SpaceRole
} from '../core/space';
import { ArrowRight, Copy, Check, Link2, UserPlus, Heart, Lock, Clipboard, Share2, Sparkles, KeyRound, RotateCcw, ShieldCheck } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: (session: SpaceSession, userName: string, appPin: string | null) => void;
}

type OnboardingStep = 'name' | 'pair' | 'pin';
type PairMode = 'choose' | 'create' | 'join';

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const existingSession = loadSpaceSession();
  const lastCode = getLastSpaceCode();

  const [step, setStep] = useState<OnboardingStep>('name');
  const [userName, setUserName] = useState(() => {
    return existingSession?.userName || localStorage.getItem('two_draft_user_name') || '';
  });
  const [pairMode, setPairMode] = useState<PairMode>('choose');
  const [createdCode, setCreatedCode] = useState(() => {
    return existingSession?.role === 'user' ? existingSession.code : '';
  });
  const [joinCode, setJoinCode] = useState(() => {
    return lastCode || '';
  });
  const [joinRole, setJoinRole] = useState<SpaceRole>('partner');
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<SpaceSession | null>(existingSession);
  const [pinInput, setPinInput] = useState('');

  const handleUserNameChange = (val: string) => {
    setUserName(val);
    try {
      localStorage.setItem('two_draft_user_name', val.trim());
    } catch {}
  };

  const handleNameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userName.trim()) return;
    setStep('pair');
  };

  const beginCreate = () => {
    const code = createdCode || generatePairingCode();
    setCreatedCode(code);
    setPairMode('create');

    // Persist immediately to localStorage so a page refresh never wipes the session or code!
    const draftSession: SpaceSession = {
      code,
      role: 'user',
      userName: userName.trim() || 'You'
    };
    saveSpaceSession(draftSession);
    setSession(draftSession);
  };

  const confirmCreate = () => {
    const activeCode = createdCode || generatePairingCode();
    const newSession: SpaceSession = {
      code: activeCode,
      role: 'user',
      userName: userName.trim() || 'You'
    };
    saveSpaceSession(newSession);
    setSession(newSession);
    onComplete(newSession, userName.trim() || 'You', null);
  };

  const confirmJoin = () => {
    if (!isPlausiblePairingCode(joinCode)) return;
    const cleanCode = normalizePairingCode(joinCode);
    const newSession: SpaceSession = {
      code: cleanCode,
      role: joinRole,
      userName: userName.trim() || (joinRole === 'user' ? 'You' : 'Partner')
    };
    saveSpaceSession(newSession);
    setSession(newSession);
    onComplete(newSession, userName.trim() || (joinRole === 'user' ? 'You' : 'Partner'), null);
  };

  const handleFinish = (withPin: boolean) => {
    if (!session) return;
    const finalPin = withPin && pinInput.length === 4 ? pinInput : null;
    onComplete(session, userName.trim() || 'You', finalPin);
  };

  const startSoloDemo = () => {
    const demoCode = 'TWO-DEMO';
    const demoSession: SpaceSession = {
      code: demoCode,
      role: 'user',
      userName: userName.trim() || 'You'
    };
    saveSpaceSession(demoSession);
    onComplete(demoSession, userName.trim() || 'You', null);
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
    const text = `Hey, here is our link code for Two: ${createdCode}. Open the app and enter this code to connect!`;
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
        setJoinCode(text.trim().toUpperCase());
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

            {/* Quick Resume Card if a previous session/code exists on this device */}
            {lastCode && (
              <div className="bg-linen-variant/60 border border-linen-border rounded-2xl p-4 space-y-2.5 text-left shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
                    <RotateCcw className="w-3.5 h-3.5 text-linen-accent" />
                    <span>Previous Session Found</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-linen-primary bg-linen-surface px-2 py-0.5 rounded-md border border-linen-border">
                    {lastCode}
                  </span>
                </div>
                <p className="text-xs text-linen-secondary leading-snug">
                  You previously used code <strong className="text-linen-primary font-mono">{lastCode}</strong>. Would you like to rejoin?
                </p>
                <div className="flex space-x-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const effectiveName = userName.trim() || existingSession?.userName || 'You';
                      const sess: SpaceSession = {
                        code: lastCode,
                        role: existingSession?.role || 'user',
                        userName: effectiveName
                      };
                      saveSpaceSession(sess);
                      onComplete(sess, effectiveName, null);
                    }}
                    className="flex-1 py-2.5 px-3 bg-linen-primary text-linen-surface text-xs font-medium rounded-xl hover:opacity-95 transition-opacity text-center cursor-pointer shadow-2xs flex items-center justify-center"
                  >
                    <span>Rejoin {lastCode}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-linen-accent block">
                What should your partner call you?
              </label>
              <input
                type="text"
                autoFocus
                value={userName}
                onChange={(e) => handleUserNameChange(e.target.value)}
                placeholder="Enter your name or nickname..."
                className="w-full px-4 py-3.5 rounded-2xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-base placeholder:text-linen-secondary/60"
                maxLength={30}
              />
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={!userName.trim()}
                className="w-full py-4 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center shadow-xs cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('pair');
                  setPairMode('join');
                  setJoinRole('partner');
                }}
                className="w-full py-2.5 text-xs text-linen-accent hover:text-linen-primary font-medium transition-colors flex items-center justify-center cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                <span>Already have a space code? Reconnect here</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Link Together */}
        {step === 'pair' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="font-serif text-2xl font-medium text-linen-primary">
                Hi, {userName.trim() || 'there'}!
              </h2>
              <p className="text-xs text-linen-secondary max-w-sm mx-auto">
                Connect your device with your partner. Once linked, you stay connected forever.
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
                  onClick={() => {
                    setPairMode('join');
                    setJoinRole('partner');
                  }}
                  className="w-full py-4 px-5 bg-linen-variant/70 text-linen-primary font-medium rounded-2xl border border-linen-border hover:bg-linen-variant transition-all flex items-center shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-5 h-5 mr-3.5 shrink-0 text-linen-accent" />
                  <div className="text-left leading-tight">
                    <span className="block text-sm font-semibold">Enter Code / Reconnect</span>
                    <span className="block text-xs text-linen-secondary font-normal mt-0.5">Join your partner or reconnect to an existing space</span>
                  </div>
                </button>

                <div className="pt-4 border-t border-linen-border/60 text-center space-y-2">
                  <button
                    onClick={startSoloDemo}
                    className="text-[11px] text-linen-secondary hover:text-linen-primary transition-colors inline-flex items-center cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-linen-accent" />
                    Testing solo? Explore Solo Preview
                  </button>

                  <div>
                    <button
                      onClick={() => setStep('name')}
                      className="text-xs text-linen-secondary hover:text-linen-primary transition-colors cursor-pointer"
                    >
                      Change Name
                    </button>
                  </div>
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

                  <div className="flex items-center justify-center text-[11px] text-emerald-700 font-medium pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                    <span>Auto-saved. Refreshing will never lose this space.</span>
                  </div>
                </div>

                <p className="text-xs text-linen-secondary leading-relaxed text-center px-3">
                  Send this code to your partner. You can enter your sanctuary right now — your space code is also displayed on your Home screen.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={confirmCreate}
                    className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                  >
                    <span>Enter Sanctuary Now</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>

                  <button
                    onClick={() => {
                      const newSession: SpaceSession = {
                        code: createdCode,
                        role: 'user',
                        userName: userName.trim() || 'You'
                      };
                      setSession(newSession);
                      setStep('pin');
                    }}
                    className="w-full py-2 text-xs text-linen-secondary hover:text-linen-primary transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    <span>Optional: Add 4-digit PIN lock</span>
                  </button>

                  <button
                    onClick={() => setPairMode('choose')}
                    className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors text-center py-1 cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {pairMode === 'join' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-linen-accent">
                      Enter Space Code
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

                  {/* Device / Role Selector to avoid duplicate partner roles */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-linen-secondary block">
                      Select your role for this device:
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setJoinRole('user')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          joinRole === 'user'
                            ? 'border-linen-primary bg-linen-variant/70 ring-1 ring-linen-primary/20 shadow-2xs'
                            : 'border-linen-border bg-linen-surface/60 hover:bg-linen-variant/30 text-linen-secondary'
                        }`}
                      >
                        <span className="block text-xs font-semibold text-linen-primary">Creator</span>
                        <span className="block text-[10px] text-linen-secondary leading-tight mt-0.5">
                          I originally created this space
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJoinRole('partner')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          joinRole === 'partner'
                            ? 'border-linen-primary bg-linen-variant/70 ring-1 ring-linen-primary/20 shadow-2xs'
                            : 'border-linen-border bg-linen-surface/60 hover:bg-linen-variant/30 text-linen-secondary'
                        }`}
                      >
                        <span className="block text-xs font-semibold text-linen-primary">Partner</span>
                        <span className="block text-[10px] text-linen-secondary leading-tight mt-0.5">
                          My partner sent me this code
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={confirmJoin}
                  disabled={!isPlausiblePairingCode(joinCode)}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  <span>Connect &amp; Enter Sanctuary</span>
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
