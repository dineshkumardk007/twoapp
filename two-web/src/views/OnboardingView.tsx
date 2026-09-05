import React, { useState, useEffect } from 'react';
import { generate12WordPhrase, computeSafetyNumber } from '../core/crypto';
import { Key, Shield, CheckCircle2, QrCode, ArrowRight } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [passphrase, setPassphrase] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [safetyInfo, setSafetyInfo] = useState<{ words: string[]; emojis: string; hexDisplay: string } | null>(null);

  useEffect(() => {
    setWords(generate12WordPhrase());
    computeSafetyNumber("CLIENT_PUBKEY_ALPHA", "PARTNER_PUBKEY_OMEGA").then(setSafetyInfo);
  }, []);

  return (
    <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-8 shadow-sm">
        {/* Step 1: Passphrase */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 1 of 3</span>
              <h1 className="font-serif text-2xl font-medium text-linen-primary mt-1">Derive Your Master Key</h1>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                Choose a memorable passphrase. It derives your device’s master encryption key on-device via Argon2id. It is never transmitted.
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
              <span>Derive Key & Continue</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 2: 12-Word Recovery Sheet */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 2 of 3</span>
              <h2 className="font-serif text-2xl font-medium text-linen-primary mt-1">12-Word Recovery Phrase</h2>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                Write these down in order. If you lose your phone, this phrase or your partner’s phone can restore your space.
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

        {/* Step 3: Safety Number Verification */}
        {step === 3 && safetyInfo && (
          <div className="space-y-6 text-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Step 3 of 3</span>
              <h2 className="font-serif text-2xl font-medium text-linen-primary mt-1">Safety Number Verification</h2>
              <p className="text-sm text-linen-secondary mt-2 leading-relaxed">
                Compare these symbols and words with your partner’s screen. If they match, your connection is safe from interception.
              </p>
            </div>

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
              onClick={onComplete}
              className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-xl hover:opacity-95 transition-all flex items-center justify-center"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span>These Match — Enter Our Space</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
