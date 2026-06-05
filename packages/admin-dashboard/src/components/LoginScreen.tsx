import React, { useState, useEffect } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail, signInWithCustomToken } from 'firebase/auth';
import { ShieldCheck, Loader2, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';

/**
 * Admin sign-in via magic link (email link auth) or passcode bypass.
 * Fully redesigned with high-fidelity glassmorphism and animated glows.
 */
export const LoginScreen: React.FC = () => {
  const [loginMode, setLoginMode] = useState<'magic-link' | 'passcode'>('magic-link');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [checking, setChecking] = useState(() => isSignInWithEmailLink(auth, window.location.href));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // On mount, check if we're returning from an email link click.
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const timer = setTimeout(() => {
      const storedEmail = localStorage.getItem('indii_signin_email');
      if (!storedEmail) {
        setError('Email not found. Please start the sign-in process again.');
        setChecking(false);
        return;
      }

      signInWithEmailLink(auth, storedEmail, window.location.href)
        .then(() => {
          localStorage.removeItem('indii_signin_email');
        })
        .catch((err) => {
          setError((err as { message?: string }).message ?? 'Link expired or invalid. Try again.');
        })
        .finally(() => setChecking(false));
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#030303] text-white">
        <div className="text-center space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-16 h-16 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 relative z-10" />
          </div>
          <p className="text-sm font-medium text-white/60 tracking-wider">Establishing secure connection...</p>
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
      localStorage.setItem('indii_signin_email', trimmedEmail);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#030303] text-white font-sans relative overflow-hidden">
      {/* Dynamic Ambient Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-600/15 to-purple-600/5 rounded-full blur-[140px] pointer-events-none animate-float-1" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-purple-600/10 to-blue-600/5 rounded-full blur-[140px] pointer-events-none animate-float-2" />

      <div className="relative z-10 w-full max-w-[420px] p-6">
        <div className="glass-panel rounded-3xl p-8 space-y-8 relative overflow-hidden">
          {/* Edge shimmer effect */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          {/* Logo / Title */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/15 relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-2xl opacity-100 group-hover:opacity-100 transition-opacity" />
              <ShieldCheck className="text-white w-6 h-6 relative z-10" />
            </div>
            <div className="space-y-1">
              <h1 className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                indii Admin
              </h1>
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-subtle" />
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                  Restricted Gateway
                </p>
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          {!linkSent && (
            <div className="flex bg-white/[0.03] border border-white/5 rounded-2xl p-1 relative">
              <button
                type="button"
                onClick={() => { setLoginMode('magic-link'); setError(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold tab-btn cursor-pointer transition-all duration-300 relative z-10 ${
                  loginMode === 'magic-link' ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Magic Link
                {loginMode === 'magic-link' && (
                  <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl -z-10 shadow-sm" />
                )}
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('passcode'); setError(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold tab-btn cursor-pointer transition-all duration-300 relative z-10 ${
                  loginMode === 'passcode' ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Passcode
                {loginMode === 'passcode' && (
                  <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl -z-10 shadow-sm" />
                )}
              </button>
            </div>
          )}

          {/* Login Form Layout */}
          {loginMode === 'magic-link' ? (
            <form onSubmit={handleSendLink} className="space-y-6">
              {linkSent ? (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center p-6 bg-green-500/5 border border-green-500/10 rounded-2xl space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-green-400">Verification Link Sent</p>
                      <p className="text-xs text-white/50 leading-relaxed">
                        We sent a secure link to <span className="text-white/90 font-medium font-mono">{sentEmail}</span>. Click the link to complete sign in.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkSent(false);
                      setSentEmail('');
                    }}
                    className="w-full py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] text-xs text-white/60 hover:text-white transition-all cursor-pointer font-medium"
                  >
                    Use another email
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="you@indii.music"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 glass-input outline-none disabled:opacity-50"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 text-xs text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Magic Link'}
                  </button>

                  <p className="text-[10px] text-white/20 text-center leading-relaxed">
                    A verification link will be sent to your inbox. No password is required.
                  </p>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handlePasscodeSubmit} className="space-y-5">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="••••"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-lg text-white placeholder-white/20 tracking-[0.25em] text-center font-bold glass-input outline-none disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
              </button>

              <p className="text-[10px] text-white/20 text-center leading-relaxed">
                Enter your assigned 4-digit administrator passcode.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};


