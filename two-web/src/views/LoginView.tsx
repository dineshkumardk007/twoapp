import React, { useState } from 'react';
import { Heart, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp, classifyIdentifier } from '../core/auth';
import { generate12WordPhrase } from '../core/crypto';

interface LoginViewProps {
  /** Called once the account exists and a session is active. */
  onAuthenticated: (password: string, recoveryPhrase: string | null, displayName: string) => void;
}

type Mode = 'signin' | 'signup';

export const LoginView: React.FC<LoginViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Shown once, after signup, before the space is created.
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[] | null>(null);
  const [savedPhrase, setSavedPhrase] = useState(false);

  const kind = classifyIdentifier(identifier);
  const identifierHint =
    identifier.length === 0
      ? 'Mobile number or email'
      : kind === 'phone'
      ? 'Mobile number'
      : kind === 'email'
      ? 'Email'
      : 'Enter a 10-digit mobile number or an email address';

  const canSubmit =
    kind !== 'invalid' &&
    password.length >= 8 &&
    (mode === 'signin' || displayName.trim().length > 0) &&
    !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError('');

    const result =
      mode === 'signup'
        ? await signUp(identifier, password, displayName.trim())
        : await signIn(identifier, password);

    setBusy(false);

    if (!result.ok) {
      setError(result.error || 'Something went wrong. Try again.');
      return;
    }

    if (mode === 'signup') {
      // The phrase is the only way back if the password is forgotten, so it is
      // shown before the space exists and cannot be skipped past silently.
      setRecoveryPhrase(generate12WordPhrase());
      return;
    }

    onAuthenticated(password, null, displayName.trim());
  };

  if (recoveryPhrase) {
    return (
      <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 className="font-serif text-2xl font-medium text-linen-primary">Write these down</h1>
            <p className="text-xs text-linen-secondary leading-relaxed">
              If you ever forget your password, these twelve words are the only way to open your
              sanctuary again. We cannot recover it for you — nobody here can read your space.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-linen-variant/40 p-4 rounded-2xl border border-linen-border">
            {recoveryPhrase.map((w, i) => (
              <div key={i} className="bg-linen-surface px-2 py-2 rounded-lg border border-linen-border text-center">
                <span className="text-[10px] text-linen-secondary block">{i + 1}</span>
                <span className="text-xs font-medium text-linen-primary">{w}</span>
              </div>
            ))}
          </div>

          <label className="flex items-start space-x-2 text-xs text-linen-primary cursor-pointer">
            <input
              type="checkbox"
              checked={savedPhrase}
              onChange={(e) => setSavedPhrase(e.target.checked)}
              className="mt-0.5 rounded accent-linen-primary"
            />
            <span>I have written these twelve words somewhere safe and offline.</span>
          </label>

          <button
            disabled={!savedPhrase}
            onClick={() => onAuthenticated(password, recoveryPhrase.join(' '), displayName.trim())}
            className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-5"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-500 shadow-xs">
            <Heart className="w-7 h-7 fill-rose-500/20 text-rose-500" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-xs text-linen-secondary max-w-sm mx-auto leading-relaxed">
            {mode === 'signin'
              ? 'Sign in to open your sanctuary.'
              : 'One account per person. Use whichever you prefer — a mobile number or an email.'}
          </p>
        </div>

        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent block">
              What should your partner call you?
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or nickname"
              maxLength={30}
              className="w-full px-4 py-3 rounded-2xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-base"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent block">
            {identifierHint}
          </label>
          <input
            type="text"
            inputMode={identifier.includes('@') ? 'email' : 'tel'}
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="9876543210  or  you@example.com"
            className="w-full px-4 py-3 rounded-2xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-base"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent block">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 pr-11 rounded-2xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-linen-secondary hover:text-linen-primary cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {mode === 'signup' && (
            <p className="text-[11px] text-linen-secondary leading-relaxed pt-0.5">
              This password also unlocks this device, so your sanctuary stays sealed if someone
              else picks up your phone.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2">
            <p className="text-xs text-rose-900">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-4 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{mode === 'signin' ? 'Sign in' : 'Create account'}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(m => (m === 'signin' ? 'signup' : 'signin'));
            setError('');
          }}
          className="w-full text-xs text-linen-secondary hover:text-linen-primary transition-colors cursor-pointer"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
};
