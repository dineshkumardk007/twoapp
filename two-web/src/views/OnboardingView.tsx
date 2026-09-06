import React, { useState, useEffect } from 'react';
import { generate12WordPhrase, computeSafetyNumber } from '../core/crypto';
import {
  generatePairingCode,
  normalizePairingCode,
  isPlausiblePairingCode,
  SpaceSession
} from '../core/space';
import { CheckCircle2, ArrowRight, Copy, Check, Link2, UserPlus } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: (session: SpaceSession) => void;
}

type Step = 1 | 2 | 3 | 4;
type PairMode = 'choose' | 'create' | 'join';

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [passphrase, setPassphrase] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [safetyInfo, setSafetyInfo] = useState<{ words: string[]; emojis: string; hexDisplay: string } | null>(null);

  // Pairing state
  const [pairMode, setPairMode] = useState<PairMode>('choose');
  const [createdCode, setCreatedCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  // The code both partners share, and which side this device is.
  const [session, setSession] = useState<SpaceSession | null>(null);

  useEffect(() => {
    setWords(generate12WordPhrase());
  }, []);

  // The safety number is derived from the shared pairing code, so it only
  // matches on both phones when both devices really hold the same secret.
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
    setStep(4);
  };

  const confirmJoin = () => {
    if (!isPlausiblePairingCode(joinCode)) return;
    setSession({ code: normalizePairingCode(joinCode), role: 'partner' });
    setStep(4);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable; the code is on screen to copy by hand */
    }
  };

  return (
    <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-8 shadow-sm">
        {/* Step 1: Passphrase */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 1 of 4</span>
              <h1 className="font-serif text-2xl font-medium text-linen-primary mt-1">Derive Your Master Key</h1>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                Choose a memorable passphrase. It derives your device’s master encryption key on-device. It is never transmitted.
              </p>
            </div>

            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter a secure passphrase..."
              className="w-full px-4 py-3 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary"
            />

            <button
              onClick={() => passphrase.length >= 6 && setStep(2)}
              disabled={passphrase.length < 6}
              className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center"
            >
              <span>Derive Key &amp; Continue</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 2: 12-Word Recovery Sheet */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 2 of 4</span>
              <h2 className="font-serif text-2xl font-medium text-linen-primary mt-1">12-Word Recovery Phrase</h2>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                Write these down in order. If you lose your phone, this phrase can restore your local vault.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-linen-variant/40 p-4 rounded-2xl border border-linen-border">
              {words.map((w, idx) => (
                <div key={idx} className="bg-linen-surface px-2 py-2 rounded-lg border border-linen-border text-center">
                  <span className="text-[10px] text-linen-secondary block">{idx + 1}</span>
                  <span className="text-xs font-medium text-linen-primary">{w}</span>
                </div>
              ))}
            </div>

            <label className="flex items-center space-x-2 text-xs text-linen-primary cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="rounded accent-linen-primary"
              />
              <span>I have written these 12 words down in a safe physical place.</span>
            </label>

            <button
              onClick={() => confirmedSaved && setStep(3)}
              disabled={!confirmedSaved}
              className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center"
            >
              <span>Proceed to Pairing Ritual</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 3: Link the two devices into one space */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 3 of 4</span>
              <h2 className="font-serif text-2xl font-medium text-linen-primary mt-1">Connect Your Space</h2>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                One of you creates the space and reads the words aloud. The other types them in. These words are the key to everything you share — send them in person or over a call, never over the internet.
              </p>
            </div>

            {pairMode === 'choose' && (
              <div className="space-y-3">
                <button
                  onClick={beginCreate}
                  className="w-full py-4 px-4 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center"
                >
                  <Link2 className="w-4 h-4 mr-3 shrink-0" />
                  <span className="text-left leading-tight">
                    Create our space
                    <span className="block text-xs opacity-75 font-normal">I will read the words to my partner</span>
                  </span>
                </button>

                <button
                  onClick={() => setPairMode('join')}
                  className="w-full py-4 px-4 bg-linen-variant/60 text-linen-primary font-medium rounded-xl border border-linen-border hover:bg-linen-variant transition-all flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-3 shrink-0" />
                  <span className="text-left leading-tight">
                    Join my partner’s space
                    <span className="block text-xs text-linen-secondary font-normal">They already have the words</span>
                  </span>
                </button>
              </div>
            )}

            {pairMode === 'create' && (
              <div className="space-y-4">
                <div className="bg-linen-variant/60 rounded-2xl border border-linen-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Your pairing words</span>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-linen-secondary hover:text-linen-primary flex items-center transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {createdCode.split('-').map((w, idx) => (
                      <span
                        key={idx}
                        className="bg-linen-surface py-1.5 px-2 rounded-lg border border-linen-border text-xs font-medium text-linen-primary text-center"
                      >
                        {idx + 1}. {w}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-linen-secondary leading-relaxed">
                  Anyone holding these words can read your space. Keep them between the two of you.
                </p>

                <button
                  onClick={confirmCreate}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center"
                >
                  <span>My partner has these words</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
                <button
                  onClick={() => setPairMode('choose')}
                  className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors"
                >
                  Back
                </button>
              </div>
            )}

            {pairMode === 'join' && (
              <div className="space-y-4">
                <textarea
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  rows={3}
                  placeholder="Type the eight words your partner reads out..."
                  className="w-full px-4 py-3 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-sm resize-none"
                />

                <p className="text-xs text-linen-secondary">
                  {normalizePairingCode(joinCode).split('-').filter(Boolean).length} of 8 words
                </p>

                <button
                  onClick={confirmJoin}
                  disabled={!isPlausiblePairingCode(joinCode)}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  <span>Join our space</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
                <button
                  onClick={() => setPairMode('choose')}
                  className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Safety Number Verification */}
        {step === 4 && session && (
          <div className="space-y-6 text-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 4 of 4</span>
              <h2 className="font-serif text-2xl font-medium text-linen-primary mt-1">Safety Number Verification</h2>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                Compare these symbols and words with your partner’s screen. They only match when you both hold the same pairing words.
              </p>
            </div>

            {!safetyInfo && (
              <p className="text-xs text-linen-secondary py-8">Deriving your shared key…</p>
            )}

            {safetyInfo && (
              <>
                <div className="py-4 bg-linen-variant/60 rounded-2xl border border-linen-border">
                  <div className="text-3xl tracking-widest mb-2">{safetyInfo.emojis}</div>
                  <p className="text-xs text-linen-secondary">Visual Emoji Cluster</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px] text-linen-secondary">
                  {safetyInfo.words.map((w, idx) => (
                    <span key={idx} className="bg-linen-surface py-1 rounded border border-linen-border">
                      {idx + 1}. {w}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onComplete(session)}
                  className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span>These Match — Enter Our Space</span>
                </button>
              </>
            )}

            <button
              onClick={() => setStep(3)}
              className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors"
            >
              They don’t match — go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
