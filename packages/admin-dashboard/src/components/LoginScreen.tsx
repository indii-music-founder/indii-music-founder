import React, { useState, useEffect } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail, signInWithCustomToken } from 'firebase/auth';
import { ShieldCheck, Loader2, Mail, Lock } from 'lucide-react';
import { auth } from '../firebase';

/**
 * Admin sign-in via magic link (email link auth) or passcode bypass.
 *
 * Firebase verifies it's an @indii.music account (App.tsx + backend enforce).
 * Passcode bypass generates a secure Firebase custom token backend-side.
 */
export const LoginScreen: React.FC = () => {
  const [loginMode, setLoginMode] = useState<'magic-link' | 'passcode'>('magic-link');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // On mount, check if we're returning from an email link click.
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    setChecking(true);
    const storedEmail = localStorage.getItem('indii_signin_email');
    if (!storedEmail) {
      setError('Email not found. Please start the sign-in process again.');
      setChecking(false);
      return;
    }

    signInWithEmailLink(auth, storedEmail, window.location.href)
      .then(() => {
        localStorage.removeItem('indii_signin_email');
        // Auth state change triggers App.tsx to navigate to dashboard.
      })
      .catch((err) => {
        setError((err as { message?: string }).message ?? 'Link expired or invalid. Try again.');
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B] text-white">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
          <p>Signing you in...</p>
        </div>
      </div>
    );
  }

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.endsWith('@indii.music')) {
      setError('Only @indii.music accounts can access this dashboard.');
      setSubmitting(false);
      return;
    }

    try {
      // Store email for retrieval when link is clicked.
      localStorage.setItem('indii_signin_email', trimmedEmail);

      // Send the magic link to their email.
      await sendSignInLinkToEmail(auth, trimmedEmail, {
        url: `${window.location.origin}${window.location.pathname}`,
        handleCodeInApp: true,
      });

      setSentEmail(trimmedEmail);
      setLinkSent(true);
      setEmail('');
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Failed to send link.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error || 'Invalid passcode');
      }

      const { customToken } = await res.json() as { customToken: string };
      await signInWithCustomToken(auth, customToken);
      // Auth state change will be picked up by the parent App component
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0A0A0B] text-white font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm bg-[#121214] border border-white/5 rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">indii Admin</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Restricted Access</p>
          </div>
        </div>

        {/* Tab Selector */}
        {!linkSent && (
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => { setLoginMode('magic-link'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                loginMode === 'magic-link' ? 'bg-blue-500 text-white shadow-md' : 'text-white/40 hover:text-white'
              }`}
            >
              Magic Link
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('passcode'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                loginMode === 'passcode' ? 'bg-blue-500 text-white shadow-md' : 'text-white/40 hover:text-white'
              }`}
            >
              Passcode
            </button>
          </div>
        )}

        {loginMode === 'magic-link' ? (
          <form onSubmit={handleSendLink} className="space-y-6">
            {linkSent ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <Mail className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-300">
                    <p className="font-semibold">Check your email</p>
                    <p className="text-xs text-green-200/70 mt-1">
                      We sent a link to <span className="font-mono">{sentEmail}</span>. Click it to sign in.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLinkSent(false);
                    setSentEmail('');
                  }}
                  className="w-full px-4 py-2 text-sm text-white/60 hover:text-white/80 transition-colors cursor-pointer"
                >
                  Try another email
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@indii.music"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send magic link'}
                </button>

                <p className="text-[11px] text-white/30 text-center">We'll email you a sign-in link. No password needed.</p>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handlePasscodeSubmit} className="space-y-6">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={submitting}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50 tracking-widest text-center text-lg font-bold"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>

            <p className="text-[11px] text-white/30 text-center">Enter your assigned 4-digit administrator passcode.</p>
          </form>
        )}
      </div>
    </div>
  );
};

